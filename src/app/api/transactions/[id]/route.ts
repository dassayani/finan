import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS, CATEGORIES } from "@/lib/constants";
import type { CategoryKey, BankKey } from "@/lib/constants";

const bankKeySchema = z.string().refine((value): value is BankKey => value in BANKS, {
  message: "Banco inválido",
});

const categoryKeySchema = z.string().refine((value): value is CategoryKey => value in CATEGORIES, {
  message: "Categoria inválida",
});

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  expenseType: z.enum(["FIXED", "VARIABLE", "BANK_BILL"]).optional().nullable(),
  category: categoryKeySchema.optional().nullable(),
  bank: bankKeySchema.optional().nullable(),
  date: z.string().optional(),
  notes: z.string().optional().nullable(),
  isPaid: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const transaction = await prisma.transaction.update({
      where: { id, userId: session.user.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        ...(data.category !== undefined ? { category: (data.category as CategoryKey) ?? null } : {}),
        ...(data.bank !== undefined ? { bank: (data.bank as BankKey) ?? null } : {}),
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("[transactions PUT]", error);
    if (error instanceof z.ZodError) {
      const msg = error.issues.map(issue => issue.message).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  await prisma.transaction.delete({ where: { id, userId: session.user.id } });
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { isPaid } = await req.json();

  const transaction = await prisma.transaction.update({
    where: { id, userId: session.user.id },
    data: { isPaid },
  });

  // Sync linked BankEntry when Transaction isPaid changes
  if (transaction.groupId === `salary-${session.user.id}`) {
    const month = transaction.date.getUTCMonth() + 1;
    const year = transaction.date.getUTCFullYear();
    await prisma.bankEntry.updateMany({
      where: { userId: session.user.id, groupId: `salary-entry-${session.user.id}-${month}-${year}` },
      data: { isPaid },
    });
  } else if (transaction.groupId?.startsWith("bonus-")) {
    const entryGroupId = transaction.groupId.replace("bonus-", "bonus-entry-");
    await prisma.bankEntry.updateMany({
      where: { userId: session.user.id, groupId: entryGroupId },
      data: { isPaid },
    });
  }
  // Always try to sync a credit-entry BankEntry linked by transaction id
  await prisma.bankEntry.updateMany({
    where: { userId: session.user.id, groupId: `credit-entry-${id}` },
    data: { isPaid },
  });

  // Sync SubscriptionPayment (owner) when a sub-bill-* transaction isPaid changes
  if (transaction.groupId?.startsWith("sub-bill-")) {
    // groupId format: sub-bill-{subId}-{month}-{year}
    const parts = transaction.groupId.split("-");
    const subYear  = parseInt(parts[parts.length - 1]);
    const subMonth = parseInt(parts[parts.length - 2]);
    const subId    = parts.slice(2, parts.length - 2).join("-");
    const owner = await prisma.subscriptionMember.findFirst({
      where: { subscriptionId: subId, isOwner: true },
    });
    if (owner) {
      if (isPaid) {
        await prisma.subscriptionPayment.upsert({
          where: { memberId_month_year: { memberId: owner.id, month: subMonth, year: subYear } },
          create: { memberId: owner.id, month: subMonth, year: subYear },
          update: { paidAt: new Date() },
        });
      } else {
        await prisma.subscriptionPayment.deleteMany({
          where: { memberId: owner.id, month: subMonth, year: subYear },
        });
      }
    }
  }

  // Sync loan bank entry and loan payment when a loan-tx-* transaction changes
  if (transaction.groupId?.startsWith("loan-tx-")) {
    const parts = transaction.groupId.split("-");
    const year  = parseInt(parts[parts.length - 1]);
    const month = parseInt(parts[parts.length - 2]);
    const loanId = parts.slice(2, parts.length - 2).join("-");
    await prisma.bankEntry.updateMany({
      where: { userId: session.user.id, groupId: `loan-entry-${loanId}-${month}-${year}` },
      data: { isPaid },
    });
    if (isPaid) {
      await prisma.loanPayment.upsert({
        where: { loanId_month_year: { loanId, month, year } },
        create: { loanId, month, year },
        update: { paidAt: new Date() },
      });
    } else {
      await prisma.loanPayment.deleteMany({ where: { loanId, month, year } });
    }
  }

  return NextResponse.json(transaction);
}
