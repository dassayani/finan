import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { members, ...data } = body;

  const sub = await prisma.subscription.update({
    where: { id, userId: session.user.id },
    data: {
      ...data,
      ...(members && {
        members: {
          deleteMany: {},
          create: members.map((m: { name: string; share: number; isOwner?: boolean }) => ({
            ...m,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
          })),
        },
      }),
    },
    include: { members: true },
  });

  return NextResponse.json(sub);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  await prisma.subscription.delete({ where: { id, userId: session.user.id } });
  return new NextResponse(null, { status: 204 });
}

// Toggle member paid
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { memberId, paid } = await req.json();

  const member = await prisma.subscriptionMember.update({
    where: { id: memberId },
    data: { paidAt: paid ? new Date() : null },
  });

  return NextResponse.json(member);
}
