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

const loanUpdateSchema = z.object({
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = loanUpdateSchema.parse(body);

    const loan = await prisma.loan.update({
      where: { id, userId: session.user.id },
      data: {
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
    });
  } catch (error) {
    console.error("[loans PUT]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const yearParam  = searchParams.get("year");

  try {
    // Single installment delete: remove records for that month/year and mark month as excluded
    if (monthParam && yearParam) {
      const month = parseInt(monthParam);
      const year  = parseInt(yearParam);
      await prisma.loanPayment.deleteMany({ where: { loanId: id, month, year } });
      await prisma.transaction.deleteMany({
        where: { userId: session.user.id, groupId: `loan-tx-${id}-${month}-${year}` },
      });
      await prisma.bankEntry.deleteMany({
        where: { userId: session.user.id, groupId: `loan-entry-${id}-${month}-${year}` },
      });
      const loan = await prisma.loan.findUnique({ where: { id, userId: session.user.id }, select: { excludedMonths: true } });
      const excluded = (loan?.excludedMonths as { month: number; year: number }[] | null) ?? [];
      const already = excluded.some(e => e.month === month && e.year === year);
      if (!already) {
        await prisma.loan.update({
          where: { id, userId: session.user.id },
          data: { excludedMonths: [...excluded, { month, year }] },
        });
      }
      return new NextResponse(null, { status: 204 });
    }

    // Full loan delete: clean up all bank entries and transactions
    await prisma.bankEntry.deleteMany({
      where: { userId: session.user.id, groupId: { startsWith: `loan-entry-${id}-` } },
    });
    await prisma.transaction.deleteMany({
      where: { userId: session.user.id, groupId: { startsWith: `loan-tx-${id}-` } },
    });

    await prisma.loan.delete({ where: { id, userId: session.user.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[loans DELETE]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// Toggle payment for a given month/year
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const now = new Date();
  const { paid, month = now.getMonth() + 1, year = now.getFullYear() } = await req.json();

  const loan = await prisma.loan.findUnique({ where: { id, userId: session.user.id } });
  if (!loan) return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 });

  const txGroupId    = `loan-tx-${id}-${month}-${year}`;
  const entryGroupId = `loan-entry-${id}-${month}-${year}`;
  const hasBank      = !!(loan.bank || loan.customBankId);

  if (paid) {
    await prisma.loanPayment.upsert({
      where: { loanId_month_year: { loanId: id, month, year } },
      create: { loanId: id, month, year },
      update: { paidAt: new Date() },
    });

    // Create expense transaction
    const txExists = await prisma.transaction.findFirst({ where: { userId: session.user.id, groupId: txGroupId } });
    if (!txExists) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-01`;
      await prisma.transaction.create({
        data: {
          userId: session.user.id,
          description: loan.name,
          amount: loan.installment,
          type: "EXPENSE",
          expenseType: "VARIABLE",
          category: "tarifas",
          date: new Date(dateStr),
          isPaid: true,
          groupId: txGroupId,
        },
      });
    }

    // Create bank entry if bank configured
    if (hasBank) {
      const entryExists = await prisma.bankEntry.findFirst({ where: { userId: session.user.id, groupId: entryGroupId } });
      if (!entryExists) {
        await prisma.bankEntry.create({
          data: {
            userId: session.user.id,
            bank: loan.bank ?? null,
            customBankId: loan.customBankId ?? null,
            month, year,
            description: loan.name,
            amount: loan.installment,
            type: "EXPENSE",
            category: "tarifas",
            groupId: entryGroupId,
            isPaid: true,
          },
        });
      }
    }
  } else {
    await prisma.loanPayment.deleteMany({ where: { loanId: id, month, year } });
    await prisma.transaction.deleteMany({ where: { userId: session.user.id, groupId: txGroupId } });
    if (hasBank) {
      await prisma.bankEntry.deleteMany({ where: { userId: session.user.id, groupId: entryGroupId } });
    }
  }

  return NextResponse.json({ ok: true });
}
