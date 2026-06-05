import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

const bankKeySchema = z.string().refine((value): value is BankKey => value in BANKS, {
  message: "Banco inválido",
});

const schema = z.object({
  bank: bankKeySchema,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  balance: z.number(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  try {
    const where: Record<string, unknown> = { userId: session.user.id };
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);

    const balances = await prisma.bankBalance.findMany({
      where,
      orderBy: { bank: "asc" },
    });
    return NextResponse.json(balances);
  } catch (error) {
    console.error("[bank-balances GET]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const balance = await prisma.bankBalance.upsert({
      where: {
        userId_bank_month_year: {
          userId: session.user.id,
          bank: data.bank,
          month: data.month,
          year: data.year,
        },
      },
      update: { balance: data.balance },
      create: {
        bank: data.bank,
        month: data.month,
        year: data.year,
        balance: data.balance,
        userId: session.user.id,
      },
    });

    return NextResponse.json(balance);
  } catch (error) {
    console.error("[bank-balances POST]", error);
    if (error instanceof z.ZodError) {
      const msg = error.issues.map(issue => issue.message).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
