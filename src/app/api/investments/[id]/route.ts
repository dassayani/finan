import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";
import { recordAudit, ipFromRequest } from "@/lib/audit";

const bankKeySchema = z.string().refine((v): v is BankKey => v in BANKS, { message: "Banco inválido" });

// Partial update — only the whitelisted fields can be changed. Prevents mass
// assignment (e.g. reatribuir userId) e valores inválidos.
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  institution: bankKeySchema.nullable().optional(),
  value: z.number().positive().optional(),
  costBasis: z.number().nonnegative().nullable().optional(),
  returnRate: z.number().nullable().optional(),
  monthlyAdd: z.number().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join("; ") }, { status: 400 });
  }

  const uid = session.user.id;
  const before = await prisma.investment.findFirst({
    where: { id, userId: uid },
    select: { name: true, type: true, value: true, institution: true },
  });

  // Ownership-safe update: the compound where ({ id, userId }) guarantees a user
  // can only touch their own records.
  const result = await prisma.investment.updateMany({
    where: { id, userId: uid },
    data: {
      ...parsed.data,
      institution: parsed.data.institution !== undefined ? (parsed.data.institution as BankKey | null) : undefined,
    },
  });
  if (result.count === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Quando o valor muda, grava um ponto na série temporal (snapshot) — preserva o
  // histórico em vez de sobrescrever. Best-effort: nunca derruba o update.
  const valueChanged = !!before && parsed.data.value !== undefined && parsed.data.value !== Number(before.value);
  if (valueChanged) {
    await prisma.investmentSnapshot.create({
      data: { investmentId: id, userId: uid, value: parsed.data.value! },
    });
  }

  await recordAudit({
    userId: uid, action: "UPDATE", entity: "investment", entityId: id,
    before: before ? { ...before, value: Number(before.value) } : null,
    after: { ...parsed.data },
    ip: ipFromRequest(req),
  });

  const inv = await prisma.investment.findFirst({
    where: { id, userId: uid },
    include: { snapshots: { orderBy: { date: "asc" } } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const i = inv as any;
  return NextResponse.json(inv ? {
    id: i.id, name: i.name, type: i.type, institution: i.institution,
    value: Number(i.value),
    costBasis: i.costBasis !== null && i.costBasis !== undefined ? Number(i.costBasis) : null,
    returnRate: i.returnRate !== null && i.returnRate !== undefined ? Number(i.returnRate) : null,
    monthlyAdd: i.monthlyAdd !== null && i.monthlyAdd !== undefined ? Number(i.monthlyAdd) : null,
    createdAt: i.createdAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshots: (i.snapshots ?? []).map((s: any) => ({ date: s.date, value: Number(s.value) })),
  } : null);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;
  const before = await prisma.investment.findFirst({
    where: { id, userId: uid },
    select: { name: true, type: true, value: true, institution: true },
  });
  const result = await prisma.investment.deleteMany({ where: { id, userId: uid } });
  if (result.count === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await recordAudit({
    userId: uid, action: "DELETE", entity: "investment", entityId: id,
    before: before ? { ...before, value: Number(before.value) } : null,
    ip: ipFromRequest(req),
  });

  return new NextResponse(null, { status: 204 });
}
