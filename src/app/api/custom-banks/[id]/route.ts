import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  short: z.string().min(1).max(3).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  agency: z.string().optional().nullable(),
  account: z.string().optional().nullable(),
  accountType: z.string().optional().nullable(),
  cutoffDay: z.number().int().min(1).max(31).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const updateData: {
      name?: string;
      short?: string;
      color?: string;
      agency?: string | null;
      account?: string | null;
      accountType?: string | null;
      cutoffDay?: number | null;
      dueDay?: number | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.short !== undefined) updateData.short = data.short;
    if (data.color !== undefined) updateData.color = data.color;
    if (Object.prototype.hasOwnProperty.call(data, "agency")) updateData.agency = data.agency;
    if (Object.prototype.hasOwnProperty.call(data, "account")) updateData.account = data.account;
    if (Object.prototype.hasOwnProperty.call(data, "accountType")) updateData.accountType = data.accountType;
    if (Object.prototype.hasOwnProperty.call(data, "cutoffDay")) updateData.cutoffDay = data.cutoffDay;
    if (Object.prototype.hasOwnProperty.call(data, "dueDay")) updateData.dueDay = data.dueDay;

    const updated = await prisma.customBank.update({
      where: { id, userId: session.user.id },
      data: updateData,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[custom-banks PATCH]", error);
    if (error instanceof z.ZodError) {
      const msg = error.issues.map(issue => issue.message).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  await prisma.customBank.delete({ where: { id, userId: session.user.id } });
  return new NextResponse(null, { status: 204 });
}
