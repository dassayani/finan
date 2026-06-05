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
        category: (data.category as CategoryKey) ?? null,
        bank: (data.bank as BankKey) ?? null,
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

  return NextResponse.json(transaction);
}
