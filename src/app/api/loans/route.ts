import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

const BANK_KEYS = Object.keys(BANKS) as BankKey[];
function toBankKey(s: string | null | undefined): BankKey | null {
  return s && BANK_KEYS.includes(s as BankKey) ? (s as BankKey) : null;
}

const loanSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("pessoal"),
  creditor: z.string().min(1),
  owner: z.string().min(1),
  totalAmount: z.number().positive(),
  installment: z.number().positive(),
  installments: z.number().int().positive(),
  startDate: z.string().min(1),
  bank: z.string().nullable().optional(),
  customBankId: z.string().nullable().optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const loans = await prisma.loan.findMany({
    where: { userId: session.user.id },
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  });

  const shaped = loans.map(l => ({
    ...l,
    totalAmount: Number(l.totalAmount),
    installment: Number(l.installment),
    payments: l.payments.map(p => ({ id: p.id, month: p.month, year: p.year, paidAt: p.paidAt })),
  }));

  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = loanSchema.parse(body);

    const loan = await prisma.loan.create({
      data: {
        userId: session.user.id,
        name: data.name,
        type: data.type,
        creditor: data.creditor,
        owner: data.owner,
        totalAmount: data.totalAmount,
        installment: data.installment,
        installments: data.installments,
        startDate: new Date(data.startDate),
        bank: toBankKey(data.bank),
        customBankId: data.customBankId ?? null,
        notes: data.notes ?? null,
      },
      include: { payments: true },
    });

    return NextResponse.json({
      ...loan,
      totalAmount: Number(loan.totalAmount),
      installment: Number(loan.installment),
      payments: loan.payments.map(p => ({ id: p.id, month: p.month, year: p.year, paidAt: p.paidAt })),
    }, { status: 201 });
  } catch (error) {
    console.error("[loans POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
