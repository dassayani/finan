import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const memberSchema = z.object({
  name: z.string().min(1),
  share: z.number().positive(),
  isOwner: z.boolean().optional(),
});

const subSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  icon: z.string().optional(),
  total: z.number().positive(),
  account: z.string().optional(),
  members: z.array(memberSchema),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const subs = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: { members: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { members, ...data } = subSchema.parse(body);
    const now = new Date();

    const sub = await prisma.subscription.create({
      data: {
        ...data,
        userId: session.user.id,
        members: {
          create: members.map(m => ({
            ...m,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
          })),
        },
      },
      include: { members: true },
    });

    return NextResponse.json(sub, { status: 201 });
  } catch (error) {
    console.error("[subscriptions POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
