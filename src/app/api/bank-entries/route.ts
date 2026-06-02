import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BankKey } from "@/lib/constants";

const schema = z.object({
  bank: z.string().optional().nullable(),
  customBankId: z.string().optional().nullable(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (month) where.month = Number(month);
  if (year) where.year = Number(year);

  const entries = await prisma.bankEntry.findMany({ where, orderBy: { createdAt: "asc" } });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const entry = await prisma.bankEntry.create({
      data: {
        bank: (data.bank as BankKey) ?? null,
        customBankId: data.customBankId ?? null,
        month: data.month,
        year: data.year,
        description: data.description,
        amount: data.amount,
        type: data.type,
        userId: session.user.id,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("[bank-entries POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
