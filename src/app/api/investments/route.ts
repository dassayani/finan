import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

const bankKeySchema = z.string().refine((v): v is BankKey => v in BANKS, { message: "Banco inválido" });

const schema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  institution: bankKeySchema.optional().nullable(),
  value: z.number().positive(),
  returnRate: z.number().optional().nullable(),
  monthlyAdd: z.number().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const investments = await prisma.investment.findMany({
    where: { userId: session.user.id },
    orderBy: { value: "desc" },
  });

  return NextResponse.json(investments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const inv = await prisma.investment.create({
      data: {
        name: data.name,
        type: data.type,
        institution: (data.institution as BankKey) ?? null,
        value: data.value,
        returnRate: data.returnRate ?? null,
        monthlyAdd: data.monthlyAdd ?? null,
        userId: session.user.id,
      },
    });
    return NextResponse.json(inv, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => i.message).join("; ") }, { status: 400 });
    }
    console.error("[investments POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
