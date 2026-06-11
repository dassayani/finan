import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

const BANK_KEYS = Object.keys(BANKS) as BankKey[];
function toBankKey(s: string | null | undefined): BankKey | null {
  return s && BANK_KEYS.includes(s as BankKey) ? (s as BankKey) : null;
}

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
  const { members, startDate, bank: bankField, customBankId: customBankIdField, ...data } = body;

  // Validate shares sum equals total
  if (members && data.total != null) {
    const sharesSum = (members as MemberInput[]).reduce((a, m) => a + (m.share || 0), 0);
    if (Math.abs(sharesSum - data.total) > 0.02) {
      return NextResponse.json({ error: "A soma das cotas deve ser igual ao total" }, { status: 400 });
    }
  }

  try {
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

      const bankKey = toBankKey(bankField);
      await tx.subscription.update({
        where: { id, userId: session.user.id },
        data: {
          name: data.name as string,
          brand: data.brand as string | undefined,
          icon: data.icon as string | undefined,
          total: data.total as number,
          account: (data.account as string) || null,
          period: data.period as string | undefined,
          startDate: startDate ? new Date(startDate) : null,
          bank: bankKey,
          customBankId: customBankIdField ?? null,
        },
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
  } catch (error) {
    console.error("[subscriptions PUT]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
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
  const sub = await prisma.subscription.findUnique({
    where: { id, userId: session.user.id },
    include: { members: { where: { id: memberId } } },
  });
  if (sub?.startDate) {
    const start = sub.startDate;
    const sy = start.getUTCFullYear();
    const sm = start.getUTCMonth() + 1;
    if (year < sy || (year === sy && month < sm)) {
      return NextResponse.json({ error: "Mês anterior à data de início da assinatura" }, { status: 400 });
    }
  }

  if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

  const member = sub.members[0];
  const hasBank = !!(sub.bank || sub.customBankId);
  const entryGroupId = `sub-entry-${id}-${memberId}-${month}-${year}`;

  if (paid) {
    await prisma.subscriptionPayment.upsert({
      where: { memberId_month_year: { memberId, month, year } },
      create: { memberId, month, year },
      update: { paidAt: new Date() },
    });

    if (hasBank && member) {
      const existing = await prisma.bankEntry.findFirst({
        where: { userId: session.user.id, groupId: entryGroupId },
      });
      if (!existing) {
        const isOwner = member.isOwner;
        await prisma.bankEntry.create({
          data: {
            userId: session.user.id,
            bank: sub.bank ?? null,
            customBankId: sub.customBankId ?? null,
            month, year,
            description: isOwner ? sub.name : `${sub.name} — ${member.name}`,
            amount: member.share,
            type: isOwner ? "EXPENSE" : "INCOME",
            category: isOwner ? "assin" : "reemb",
            groupId: entryGroupId,
            isPaid: true,
          },
        });
      }
    }
  } else {
    await prisma.subscriptionPayment.deleteMany({ where: { memberId, month, year } });
    if (hasBank) {
      await prisma.bankEntry.deleteMany({ where: { userId: session.user.id, groupId: entryGroupId } });
    }
  }

  return NextResponse.json({ ok: true });
}
