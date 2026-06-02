import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CategoryKey, BankKey } from "@/lib/constants";

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
  const isPaid = searchParams.get("isPaid");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: session.user.id };

  if (month && year) {
    const y = Number(year), m = Number(month);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end   = new Date(Date.UTC(y, m,     0, 23, 59, 59, 999));
    where.date = { gte: start, lte: end };
  }
  if (type) where.type = type;
  if (expenseType) where.expenseType = expenseType;
  if (bank) where.bank = bank;
  if (isPaid !== null) where.isPaid = isPaid === "true";

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(transactions);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) return NextResponse.json({ error: "groupId é obrigatório" }, { status: 400 });

  const year = searchParams.get("year");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { groupId, userId: session.user.id };
  if (year) {
    const y = Number(year);
    where.date = { gte: new Date(Date.UTC(y, 0, 1)), lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)) };
  }

  await prisma.transaction.deleteMany({ where });
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = transactionSchema.parse(body);

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
        isPaid: data.type === "INCOME" ? false : (data.isPaid ?? false),
        installments: data.installments ?? null,
        installmentIndex: data.installmentIndex ?? null,
        groupId: data.groupId ?? null,
        userId: session.user.id,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("[transactions POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
