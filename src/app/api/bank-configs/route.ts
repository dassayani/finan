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
  agency: z.string().optional().nullable(),
  account: z.string().optional().nullable(),
  accountType: z.string().optional().nullable(),
  cutoffDay: z.number().int().min(1).max(31).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const configs = await prisma.bankConfig.findMany({
    where: { userId: session.user.id },
  });
  return NextResponse.json(configs);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const config = await prisma.bankConfig.upsert({
      where: { userId_bank: { userId: session.user.id, bank: data.bank } },
      create: {
        userId: session.user.id,
        bank: data.bank,
        agency: data.agency ?? null,
        account: data.account ?? null,
        accountType: data.accountType ?? null,
        cutoffDay: data.cutoffDay ?? null,
        dueDay: data.dueDay ?? null,
      },
      update: {
        agency: data.agency ?? null,
        account: data.account ?? null,
        accountType: data.accountType ?? null,
        cutoffDay: data.cutoffDay ?? null,
        dueDay: data.dueDay ?? null,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("[bank-configs PUT]", error);
    if (error instanceof z.ZodError) {
      const msg = error.issues.map(issue => issue.message).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
