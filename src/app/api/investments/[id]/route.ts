import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

const bankKeySchema = z.string().refine((v): v is BankKey => v in BANKS, { message: "Banco inválido" });

// Partial update — only the whitelisted fields can be changed. Prevents mass
// assignment (e.g. reatribuir userId) e valores inválidos.
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  institution: bankKeySchema.nullable().optional(),
  value: z.number().positive().optional(),
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

  // Ownership-safe update: the compound where ({ id, userId }) guarantees a user
  // can only touch their own records.
  const result = await prisma.investment.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...parsed.data,
      institution: parsed.data.institution !== undefined ? (parsed.data.institution as BankKey | null) : undefined,
    },
  });
  if (result.count === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const inv = await prisma.investment.findFirst({ where: { id, userId: session.user.id } });
  return NextResponse.json(inv);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.investment.deleteMany({ where: { id, userId: session.user.id } });
  if (result.count === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
