import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BankKey } from "@/lib/constants";

const schema = z.object({
  bank: z.string(),
  name: z.string().min(1),
  amount: z.number().positive(),
  billingDay: z.number().int().min(1).max(31).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const fees = await prisma.bankFee.findMany({
      where: { userId: session.user.id, active: true },
      orderBy: [{ bank: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(fees);
  } catch (error) {
    console.error("[bank-fees GET]", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const fee = await prisma.bankFee.create({
      data: {
        bank: data.bank as BankKey,
        name: data.name,
        amount: data.amount,
        billingDay: data.billingDay ?? 1,
        active: data.active ?? true,
        userId: session.user.id,
      },
    });

    return NextResponse.json(fee, { status: 201 });
  } catch (error) {
    console.error("[bank-fees POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
