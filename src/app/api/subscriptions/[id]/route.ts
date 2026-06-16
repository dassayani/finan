import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";
import type { Prisma } from "@prisma/client";
import {
  generateSubBillTransactions,
  purgeFutureSubBillTransactions,
  deleteAllSubBillTransactions,
} from "@/lib/subscriptions";
import { recordAudit, ipFromRequest } from "@/lib/audit";

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
  const { members, startDate, endDate, bank: bankField, customBankId: customBankIdField, ...data } = body;

  if (members && data.total != null) {
    const sharesSum = (members as MemberInput[]).reduce((a, m) => a + (m.share || 0), 0);
    if (Math.abs(sharesSum - data.total) > 0.02) {
      return NextResponse.json({ error: "A soma das cotas deve ser igual ao total" }, { status: 400 });
    }
  }

  try {
    const newBank = toBankKey(bankField);
    const uid = session.user.id;

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
        where: { id, userId: uid },
        data: {
          name: data.name as string,
          brand: data.brand as string | undefined,
          icon: data.icon as string | undefined,
          total: data.total as number,
          account: (data.account as string) || null,
          period: data.period as string | undefined,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          bank: newBank,
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

    // Update existing unpaid sub-bill transactions to reflect new name/amount/bank
    if (data.name || data.total != null || newBank !== undefined) {
      const updateData: Prisma.TransactionUpdateManyMutationInput = {};
      if (data.name) updateData.description = `Assinatura - ${data.name as string}`;
      if (data.total != null) updateData.amount = data.total as number;
      if (newBank !== undefined) {
        if (newBank === null) {
          // Bank removed — delete all unpaid sub-bill transactions
          await prisma.transaction.deleteMany({
            where: { userId: uid, groupId: { startsWith: `sub-bill-${id}-` }, isPaid: false },
          });
        } else {
          updateData.bank = newBank;
        }
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.transaction.updateMany({
          where: { userId: uid, groupId: { startsWith: `sub-bill-${id}-` }, isPaid: false },
          data: updateData,
        });
      }
    }

    // Generate missing months (idempotent) — uses updated sub data
    if (sub && newBank) {
      const parsedEndDate = endDate ? new Date(endDate) : null;
      await generateSubBillTransactions(
        {
          id,
          name: (data.name as string) ?? sub.name,
          total: data.total ?? Number(sub.total),
          bank: newBank,
          startDate: startDate ? new Date(startDate) : sub.startDate,
          endDate: parsedEndDate,
          createdAt: sub.createdAt,
        },
        uid
      );

      // If endDate set, purge future unpaid transactions beyond endDate
      if (parsedEndDate) {
        await purgeFutureSubBillTransactions(id, uid, parsedEndDate);
      }
    }

    await recordAudit({
      userId: uid, action: "UPDATE", entity: "subscription", entityId: id,
      after: { name: data.name ?? null, total: data.total ?? null, bank: newBank, customBankId: customBankIdField ?? null },
      ip: ipFromRequest(req),
    });

    return NextResponse.json(sub);
  } catch (error) {
    console.error("[subscriptions PUT]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;

  const before = await prisma.subscription.findFirst({
    where: { id, userId: uid },
    select: { name: true, total: true, bank: true, customBankId: true },
  });

  // Clean up generated BANK_BILL transactions before deleting the subscription
  await deleteAllSubBillTransactions(id, uid);
  await prisma.subscription.delete({ where: { id, userId: uid } });

  await recordAudit({
    userId: uid, action: "DELETE", entity: "subscription", entityId: id,
    before: before ? { ...before, total: Number(before.total) } : null,
    ip: ipFromRequest(req),
  });

  return new NextResponse(null, { status: 204 });
}

// Toggle member paid OR encerrar subscription
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;
  const body = await req.json();

  // --- Encerrar action ---
  if (body.action === "encerrar") {
    const endDate = new Date();
    // End of current month so the current month's entry is preserved
    endDate.setUTCDate(1);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    endDate.setUTCDate(0);
    endDate.setUTCHours(23, 59, 59, 999);

    const sub = await prisma.subscription.update({
      where: { id, userId: uid },
      data: { endDate },
    });

    // Delete all future unpaid BANK_BILL transactions
    await purgeFutureSubBillTransactions(id, uid, endDate);

    await recordAudit({
      userId: uid, action: "UPDATE", entity: "subscription", entityId: id,
      after: { action: "encerrar", endDate: endDate.toISOString() },
      ip: ipFromRequest(req),
    });

    return NextResponse.json(sub);
  }

  // --- Toggle member payment ---
  const now = new Date();
  const { memberId, paid, month = now.getMonth() + 1, year = now.getFullYear() } = body;

  const sub = await prisma.subscription.findUnique({
    where: { id, userId: uid },
    include: { members: { where: { id: memberId } } },
  });

  if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

  // Block payments before startDate
  if (sub.startDate) {
    const sy = sub.startDate.getUTCFullYear();
    const sm = sub.startDate.getUTCMonth() + 1;
    if (year < sy || (year === sy && month < sm)) {
      return NextResponse.json({ error: "Mês anterior à data de início da assinatura" }, { status: 400 });
    }
  }

  const member = sub.members[0];
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  const isOwner = member.isOwner;
  const hasBank = !!(sub.bank || sub.customBankId);
  const billGroupId = `sub-bill-${id}-${month}-${year}`;
  const entryGroupId = `sub-entry-${id}-${memberId}-${month}-${year}`;

  if (paid) {
    await prisma.subscriptionPayment.upsert({
      where: { memberId_month_year: { memberId, month, year } },
      create: { memberId, month, year },
      update: { paidAt: new Date() },
    });

    if (hasBank) {
      if (isOwner && sub.bank) {
        // Mark the pre-generated BANK_BILL transaction as paid
        const existing = await prisma.transaction.findFirst({
          where: { userId: uid, groupId: billGroupId },
        });
        if (existing) {
          await prisma.transaction.update({ where: { id: existing.id }, data: { isPaid: true } });
        } else {
          // Fallback: create if the transaction wasn't pre-generated
          await prisma.transaction.create({
            data: {
              userId: uid,
              description: `Assinatura - ${sub.name}`,
              amount: Number(sub.total),
              type: "EXPENSE",
              expenseType: "BANK_BILL",
              bank: sub.bank,
              date: new Date(Date.UTC(year, month - 1, 1)),
              category: "assin",
              isPaid: true,
              groupId: billGroupId,
            },
          });
        }
      } else if (!isOwner) {
        // Non-owner: create BankEntry INCOME (reimbursement to the subscription bank)
        const existing = await prisma.bankEntry.findFirst({
          where: { userId: uid, groupId: entryGroupId },
        });
        if (!existing) {
          await prisma.bankEntry.create({
            data: {
              userId: uid,
              bank: sub.bank ?? null,
              customBankId: sub.customBankId ?? null,
              month, year,
              description: `${sub.name} — ${member.name}`,
              amount: Number(member.share),
              type: "INCOME",
              category: "reemb",
              groupId: entryGroupId,
              isPaid: true,
            },
          });
        }
      }
    }
  } else {
    await prisma.subscriptionPayment.deleteMany({ where: { memberId, month, year } });

    if (hasBank) {
      if (isOwner && sub.bank) {
        // Unmark the BANK_BILL transaction
        await prisma.transaction.updateMany({
          where: { userId: uid, groupId: billGroupId },
          data: { isPaid: false },
        });
      } else if (!isOwner) {
        await prisma.bankEntry.deleteMany({ where: { userId: uid, groupId: entryGroupId } });
      }
    }
  }

  await recordAudit({
    userId: uid, action: paid ? "PAY" : "UNPAY", entity: "subscription", entityId: id,
    after: { memberId, month, year, paid: !!paid, share: Number(member.share) },
    ip: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true });
}
