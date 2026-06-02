import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface MemberInput {
  id?: string;
  name: string;
  share: number;
  isOwner?: boolean;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { members, startDate, ...data } = body;

  // Validate shares sum equals total
  if (members && data.total != null) {
    const sharesSum = (members as MemberInput[]).reduce((a, m) => a + (m.share || 0), 0);
    if (Math.abs(sharesSum - data.total) > 0.02) {
      return NextResponse.json({ error: "A soma das cotas deve ser igual ao total" }, { status: 400 });
    }
  }

  // Diff existing members to preserve payment history — all in one transaction
  const sub = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existingMembers = await tx.subscriptionMember.findMany({
      where: { subscriptionId: id },
    });
    const existingIds = new Set(existingMembers.map(m => m.id));

    const incoming: MemberInput[] = members ?? [];
    const toUpdate    = incoming.filter(m => m.id && existingIds.has(m.id));
    const toCreate    = incoming.filter(m => !m.id || !existingIds.has(m.id));
    const toDeleteIds = existingMembers
      .filter(em => !incoming.some(nm => nm.id === em.id))
      .map(em => em.id);

    await tx.subscription.update({
      where: { id, userId: session.user.id },
      data: { ...data, startDate: startDate ? new Date(startDate) : null },
    });

    if (toDeleteIds.length) {
      await tx.subscriptionMember.deleteMany({ where: { id: { in: toDeleteIds } } });
    }

    await Promise.all(toUpdate.map(m =>
      tx.subscriptionMember.update({
        where: { id: m.id },
        data: { name: m.name, share: m.share, isOwner: m.isOwner ?? false },
      })
    ));

    if (toCreate.length) {
      await tx.subscriptionMember.createMany({
        data: toCreate.map(m => ({
          subscriptionId: id,
          name: m.name,
          share: m.share,
          isOwner: m.isOwner ?? false,
        })),
      });
    }

    return tx.subscription.findUnique({
      where: { id },
      include: { members: { include: { payments: true } } },
    });
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
  const now = new Date();
  const { memberId, paid, month = now.getMonth() + 1, year = now.getFullYear() } = await req.json();

  // Block payments for months before the subscription's start date
  // Also verifies ownership — findUnique returns null if userId doesn't match
  const sub = await prisma.subscription.findUnique({ where: { id, userId: session.user.id } });
  if (sub?.startDate) {
    const start = sub.startDate;
    const sy = start.getUTCFullYear();
    const sm = start.getUTCMonth() + 1;
    if (year < sy || (year === sy && month < sm)) {
      return NextResponse.json({ error: "Mês anterior à data de início da assinatura" }, { status: 400 });
    }
  }

  if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

  if (paid) {
    await prisma.subscriptionPayment.upsert({
      where: { memberId_month_year: { memberId, month, year } },
      create: { memberId, month, year },
      update: { paidAt: new Date() },
    });
  } else {
    await prisma.subscriptionPayment.deleteMany({
      where: { memberId, month, year },
    });
  }

  return NextResponse.json({ ok: true });
}
