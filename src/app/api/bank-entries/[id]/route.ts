import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { CategoryKey } from "@/lib/constants";

const putSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { description, amount, category } = parsed.data;
  const entry = await prisma.bankEntry.update({
    where: { id, userId: session.user.id },
    data: { description, amount, category: (category as CategoryKey) ?? null },
  });
  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  await prisma.bankEntry.delete({ where: { id, userId: session.user.id } });
  return new NextResponse(null, { status: 204 });
}
