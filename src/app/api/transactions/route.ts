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

const transactionSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  expenseType: z.enum(["FIXED", "VARIABLE", "BANK_BILL"]).optional().nullable(),
  category: categoryKeySchema.optional().nullable(),
  bank: bankKeySchema.optional().nullable(),
  date: z.string(),
  notes: z.string().optional().nullable(),
  isPaid: z.boolean().optional(),
  installments: z.number().optional().nullable(),
  installmentIndex: z.number().optional().nullable(),
  groupId: z.string().optional().nullable(),
});

type BatchFailure = {
  index: number;
  error: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map(issue => issue.message).join("; ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Erro interno";
}

async function createTransaction(data: z.infer<typeof transactionSchema>, userId: string) {
  return prisma.transaction.create({
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
      installments: data.installments ?? null,
      installmentIndex: data.installmentIndex ?? null,
      groupId: data.groupId ?? null,
      userId,
    },
  });
}

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
  if (bank === "none") where.bank = null;
  else if (bank) where.bank = bank;
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
  const groupId     = searchParams.get("groupId");
  const bank        = searchParams.get("bank");
  const month       = searchParams.get("month");
  const year        = searchParams.get("year");
  const expenseType = searchParams.get("expenseType");
  const uid         = session.user.id;

  // Delete by groupId (existing behaviour)
  if (groupId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { groupId, userId: uid };
    if (year) {
      const y = Number(year);
      where.date = { gte: new Date(Date.UTC(y, 0, 1)), lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)) };
    }
    await prisma.transaction.deleteMany({ where });
    return new NextResponse(null, { status: 204 });
  }

  // Delete all for a bank + month + year (for "Excluir todos" in fatura section)
  if (bank && month && year) {
    const y = Number(year), m = Number(month);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end   = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { userId: uid, bank, date: { gte: start, lte: end } };
    if (expenseType) where.expenseType = expenseType;
    await prisma.transaction.deleteMany({ where });
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ error: "groupId ou (bank + month + year) são obrigatórios" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bank        = searchParams.get("bank");
  const month       = searchParams.get("month");
  const year        = searchParams.get("year");
  const expenseType = searchParams.get("expenseType");

  if (!bank || !month || !year) {
    return NextResponse.json({ error: "bank, month e year são obrigatórios" }, { status: 400 });
  }

  const y = Number(year), m = Number(month);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end   = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: session.user.id, bank, date: { gte: start, lte: end } };
  if (expenseType) where.expenseType = expenseType;

  try {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.isPaid === "boolean") data.isPaid = body.isPaid;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const result = await prisma.transaction.updateMany({ where, data });
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("[transactions PATCH]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();

    if (Array.isArray(body) || (body && typeof body === "object" && Array.isArray(body.items))) {
      const rawItems = Array.isArray(body) ? body : body.items;
      const failures: BatchFailure[] = [];
      const created: Array<{ index: number; id: string }> = [];

      await Promise.all(rawItems.map(async (rawItem: unknown, index: number) => {
        try {
          const data = transactionSchema.parse(rawItem);
          const transaction = await createTransaction(data, session.user.id);
          created.push({ index, id: transaction.id });
        } catch (error) {
          failures.push({ index, error: getErrorMessage(error) });
        }
      }));

      const total = rawItems.length;
      const successCount = created.length;
      const failedCount = failures.length;
      const status = failedCount > 0 ? 207 : 201;

      return NextResponse.json({
        mode: "batch",
        total,
        successCount,
        failedCount,
        created,
        failures,
      }, { status });
    }

    const data = transactionSchema.parse(body);
    const transaction = await createTransaction(data, session.user.id);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("[transactions POST]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
