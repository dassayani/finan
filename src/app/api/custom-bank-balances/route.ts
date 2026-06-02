import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  customBankId: z.string(),
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

  const where: Record<string, unknown> = {
    customBank: { userId: session.user.id },
  };
  if (month) where.month = Number(month);
  if (year) where.year = Number(year);

  const balances = await prisma.customBankBalance.findMany({ where });
  return NextResponse.json(balances);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    // Verify ownership
    const bank = await prisma.customBank.findUnique({ where: { id: data.customBankId } });
    if (!bank || bank.userId !== session.user.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const balance = await prisma.customBankBalance.upsert({
      where: { customBankId_month_year: { customBankId: data.customBankId, month: data.month, year: data.year } },
      update: { balance: data.balance },
      create: { customBankId: data.customBankId, month: data.month, year: data.year, balance: data.balance },
    });

    return NextResponse.json(balance);
  } catch (error) {
    console.error("[custom-bank-balances POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
