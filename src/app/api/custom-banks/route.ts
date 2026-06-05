import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const feeSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  billingDay: z.number().int().min(1).max(31).optional(),
});

const schema = z.object({
  name: z.string().min(1),
  short: z.string().min(1).max(3),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  agency: z.string().optional().nullable(),
  account: z.string().optional().nullable(),
  accountType: z.string().optional().nullable(),
  cutoffDay: z.number().int().min(1).max(31).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
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

    const bank = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.customBank.create({
        data: {
          name: data.name,
          short: data.short,
          color: data.color,
          agency: data.agency ?? null,
          account: data.account ?? null,
          accountType: data.accountType ?? null,
          cutoffDay: data.cutoffDay ?? null,
          dueDay: data.dueDay ?? null,
          userId: session.user.id,
        },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => i.message).join("; ") }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
