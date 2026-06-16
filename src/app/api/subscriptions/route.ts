import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";
import { generateSubBillTransactions } from "@/lib/subscriptions";
import { recordAudit, ipFromRequest } from "@/lib/audit";

const BANK_KEYS = Object.keys(BANKS) as BankKey[];
function toBankKey(s: string | null | undefined): BankKey | null {
  return s && BANK_KEYS.includes(s as BankKey) ? (s as BankKey) : null;
}

const memberSchema = z.object({
  name: z.string().min(1),
  share: z.number().positive(),
  isOwner: z.boolean().optional(),
});

const subSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  icon: z.string().optional(),
  total: z.number().positive(),
  account: z.string().optional(),
  period: z.enum(["mensal", "anual"]).optional(),
  startDate: z.string().optional().nullable(),
  bank: z.string().nullable().optional(),
  customBankId: z.string().nullable().optional(),
  members: z.array(memberSchema),
}).refine(d => {
  const sum = d.members.reduce((a, m) => a + m.share, 0);
  return Math.abs(sum - d.total) < 0.02;
}, { message: "A soma das cotas deve ser igual ao total", path: ["members"] });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const year  = Number(searchParams.get("year")  ?? now.getFullYear());

  const subs = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: {
      members: {
        include: { payments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Shape the response: add paidAt (this month), paidCount and payments (all-time) per member
  const shaped = subs.map(s => ({
    ...s,
    total: Number(s.total),
    endDate: s.endDate ?? null,
    members: s.members.map(m => {
      const thisMonth = m.payments.find(p => p.month === month && p.year === year);
      return {
        id: m.id,
        name: m.name,
        share: m.share,
        isOwner: m.isOwner,
        paidAt: thisMonth?.paidAt ?? null,
        paidCount: m.payments.length,
        payments: m.payments.map(p => ({ month: p.month, year: p.year, paidAt: p.paidAt })),
      };
    }),
  }));

  // Hide subscriptions that were encerradas before the requested month/year.
  // Future subscriptions (startDate > current month) are still shown — the
  // assinaturas page is a management view, not a billing view.
  const filtered = shaped.filter(s => {
    if (s.endDate) {
      const endDate = s.endDate as Date;
      const ey = endDate.getUTCFullYear();
      const em = endDate.getUTCMonth() + 1;
      if (year > ey || (year === ey && month > em)) return false;
    }
    return true;
  });

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { members, ...data } = subSchema.parse(body);
    const now = new Date();

    const { startDate, bank: bankField, customBankId: customBankIdField, ...rest } = data;
    const sub = await prisma.subscription.create({
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : null,
        bank: toBankKey(bankField),
        customBankId: customBankIdField ?? null,
        userId: session.user.id,
        members: {
          create: members.map(m => ({
            name: m.name,
            share: m.share,
            isOwner: m.isOwner ?? false,
          })),
        },
      },
      include: { members: { include: { payments: true } } },
    });

    await generateSubBillTransactions(
      { ...sub, total: Number(sub.total), endDate: null },
      session.user.id
    );

    await recordAudit({
      userId: session.user.id, action: "CREATE", entity: "subscription", entityId: sub.id,
      after: { name: sub.name, total: Number(sub.total), bank: sub.bank, customBankId: sub.customBankId, members: members.length },
      ip: ipFromRequest(req),
    });

    return NextResponse.json(sub, { status: 201 });
  } catch (error) {
    console.error("[subscriptions POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
