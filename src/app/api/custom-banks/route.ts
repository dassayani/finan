import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const feeSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  billingDay: z.number().int().min(1).max(31).optional(),
});

const schema = z.object({
  name: z.string().min(1),
  short: z.string().min(1).max(3),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fees: z.array(feeSchema).optional(),
  initialBalance: z.number().optional().nullable(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const banks = await prisma.customBank.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(banks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const bank = await prisma.$transaction(async (tx) => {
      const created = await tx.customBank.create({
        data: { name: data.name, short: data.short, color: data.color, userId: session.user.id },
      });

      if (data.fees?.length) {
        await tx.customBankFee.createMany({
          data: data.fees.map(f => ({
            customBankId: created.id,
            name: f.name,
            amount: f.amount,
            billingDay: f.billingDay ?? 1,
          })),
        });
      }

      if (data.initialBalance != null && data.month && data.year) {
        await tx.customBankBalance.create({
          data: {
            customBankId: created.id,
            month: data.month,
            year: data.year,
            balance: data.initialBalance,
          },
        });
      }

      return created;
    });

    return NextResponse.json(bank, { status: 201 });
  } catch (error) {
    console.error("[custom-banks POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
