import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  customBankId: z.string(),
  name: z.string().min(1),
  amount: z.number().positive(),
  billingDay: z.number().int().min(1).max(31).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customBankId = searchParams.get("customBankId");

  const where: Record<string, unknown> = {
    active: true,
    customBank: { userId: session.user.id },
  };
  if (customBankId) where.customBankId = customBankId;

  const fees = await prisma.customBankFee.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json(fees);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const bank = await prisma.customBank.findUnique({ where: { id: data.customBankId } });
    if (!bank || bank.userId !== session.user.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const fee = await prisma.customBankFee.create({
      data: { customBankId: data.customBankId, name: data.name, amount: data.amount, billingDay: data.billingDay ?? 1 },
    });
    return NextResponse.json(fee, { status: 201 });
  } catch (error) {
    console.error("[custom-bank-fees POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
