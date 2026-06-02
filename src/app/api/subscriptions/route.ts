import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  // Exclude subscriptions not yet started in the requested month/year.
  // When startDate is null, fall back to createdAt as the effective start.
  // Use UTC methods to avoid timezone shift (dates are stored as UTC midnight).
  const filtered = shaped.filter(s => {
    const start = (s.startDate ?? s.createdAt) as Date;
    const sy = start.getUTCFullYear();
    const sm = start.getUTCMonth() + 1;
    return year > sy || (year === sy && month >= sm);
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

    const { startDate, ...rest } = data;
    const sub = await prisma.subscription.create({
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : null,
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

    return NextResponse.json(sub, { status: 201 });
  } catch (error) {
    console.error("[subscriptions POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
