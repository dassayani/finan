import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";
import { recordAudit, ipFromRequest } from "@/lib/audit";

const bankKeySchema = z.string().refine((v): v is BankKey => v in BANKS, { message: "Banco inválido" });

const schema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  institution: bankKeySchema.optional().nullable(),
  value: z.number().positive(),
  costBasis: z.number().nonnegative().optional().nullable(),
  returnRate: z.number().optional().nullable(),
  monthlyAdd: z.number().optional().nullable(),
});

// Decimal nunca deve vazar pro frontend (regra do projeto). Serializa em number.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeInvestment(inv: any) {
  return {
    id: inv.id,
    name: inv.name,
    type: inv.type,
    institution: inv.institution,
    value: Number(inv.value),
    costBasis: inv.costBasis !== null && inv.costBasis !== undefined ? Number(inv.costBasis) : null,
    returnRate: inv.returnRate !== null && inv.returnRate !== undefined ? Number(inv.returnRate) : null,
    monthlyAdd: inv.monthlyAdd !== null && inv.monthlyAdd !== undefined ? Number(inv.monthlyAdd) : null,
    createdAt: inv.createdAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshots: (inv.snapshots ?? []).map((s: any) => ({ date: s.date, value: Number(s.value) })),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const investments = await prisma.investment.findMany({
      where: { userId: session.user.id },
      orderBy: { value: "desc" },
      include: { snapshots: { orderBy: { date: "asc" } } },
    });
    return NextResponse.json(investments.map(serializeInvestment));
  } catch (error) {
    console.error("[investments GET]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);
    // Custo: usa o informado ou assume o valor atual como custo de entrada
    // (ganho inicial = 0, honesto enquanto o usuário não declara o aporte real).
    const costBasis = data.costBasis ?? data.value;
    const uid = session.user.id;

    const inv = await prisma.investment.create({
      data: {
        name: data.name,
        type: data.type,
        institution: (data.institution as BankKey) ?? null,
        value: data.value,
        costBasis,
        returnRate: data.returnRate ?? null,
        monthlyAdd: data.monthlyAdd ?? null,
        userId: uid,
        // Primeiro ponto da série temporal — abre a curva de evolução.
        snapshots: { create: { userId: uid, value: data.value } },
      },
      include: { snapshots: { orderBy: { date: "asc" } } },
    });
    await recordAudit({
      userId: uid, action: "CREATE", entity: "investment", entityId: inv.id,
      after: { name: data.name, type: data.type, value: data.value, costBasis, institution: data.institution ?? null },
      ip: ipFromRequest(req),
    });
    return NextResponse.json(serializeInvestment(inv), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => i.message).join("; ") }, { status: 400 });
    }
    console.error("[investments POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
