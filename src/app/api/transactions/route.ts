import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CategoryKey, BankKey } from "@prisma/client";

const transactionSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  expenseType: z.enum(["FIXED", "VARIABLE", "BANK_BILL"]).optional().nullable(),
  category: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  date: z.string(),
  notes: z.string().optional().nullable(),
  isPaid: z.boolean().optional(),
  installments: z.number().optional().nullable(),
  installmentIndex: z.number().optional().nullable(),
  groupId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const type = searchParams.get("type");
  const expenseType = searchParams.get("expenseType");
  const bank = searchParams.get("bank");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: session.user.id };

  if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
    where.date = { gte: start, lte: end };
  }
  if (type) where.type = type;
  if (expenseType) where.expenseType = expenseType;
  if (bank) where.bank = bank;

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = transactionSchema.parse(body);

    // For installments, create one record per installment
    if (data.installments && data.installments > 1) {
      const groupId = crypto.randomUUID();
      const baseDate = new Date(data.date);
      const each = data.amount / data.installments;

      const records = Array.from({ length: data.installments }, (_, i) => {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
        return {
          description: `${data.description} ${i + 1}/${data.installments}`,
          amount: each,
          type: data.type,
          expenseType: data.expenseType ?? null,
          category: (data.category as CategoryKey) ?? null,
          bank: (data.bank as BankKey) ?? null,
          date: d,
          notes: data.notes ?? null,
          isPaid: i === 0 ? (data.isPaid ?? false) : false,
          installments: data.installments,
          installmentIndex: i + 1,
          groupId,
          userId: session.user.id,
        };
      });

      await prisma.transaction.createMany({ data: records });
      return NextResponse.json({ groupId, count: records.length }, { status: 201 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        description: data.description,
        amount: data.amount,
        type: data.type,
        expenseType: data.expenseType ?? null,
        category: (data.category as CategoryKey) ?? null,
        bank: (data.bank as BankKey) ?? null,
        date: new Date(data.date),
        notes: data.notes ?? null,
        isPaid: data.isPaid ?? false,
        userId: session.user.id,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("[transactions POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
