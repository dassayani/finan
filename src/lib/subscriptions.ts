import { prisma } from "@/lib/prisma";
import type { BankKey } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

interface SubForBillGen {
  id: string;
  name: string;
  total: Prisma.Decimal | number;
  bank: BankKey | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
}

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Creates BANK_BILL transactions for each month a subscription is active.
 * Skips months that already have a transaction (idempotent via groupId check).
 * Horizon: endDate, or 24 months from today if no endDate.
 */
export async function generateSubBillTransactions(
  sub: SubForBillGen,
  userId: string,
  db: DbClient = prisma
) {
  const bank = sub.bank;
  if (!bank) return;

  const startDate = sub.startDate ?? sub.createdAt;
  const startMonth = startDate.getUTCMonth() + 1;
  const startYear = startDate.getUTCFullYear();

  let endMonth: number, endYear: number;
  if (sub.endDate) {
    endYear = sub.endDate.getUTCFullYear();
    endMonth = sub.endDate.getUTCMonth() + 1;
  } else {
    const horizon = new Date();
    horizon.setUTCMonth(horizon.getUTCMonth() + 24);
    endYear = horizon.getUTCFullYear();
    endMonth = horizon.getUTCMonth() + 1;
  }

  const months: Array<{ groupId: string; date: Date }> = [];
  let m = startMonth, y = startYear;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({
      groupId: `sub-bill-${sub.id}-${m}-${y}`,
      date: new Date(Date.UTC(y, m - 1, 1)),
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  const existing = await (db as typeof prisma).transaction.findMany({
    where: { userId, groupId: { in: months.map(t => t.groupId) } },
    select: { groupId: true },
  });
  const existingSet = new Set(existing.map(t => t.groupId));
  const missing = months.filter(t => !existingSet.has(t.groupId));
  if (missing.length === 0) return;

  const amount = typeof sub.total === "object" ? sub.total.toNumber() : Number(sub.total);

  await (db as typeof prisma).transaction.createMany({
    data: missing.map(t => ({
      userId,
      description: `Assinatura - ${sub.name}`,
      amount,
      type: "EXPENSE" as const,
      expenseType: "BANK_BILL" as const,
      bank,
      date: t.date,
      category: "assin" as const,
      isPaid: false,
      groupId: t.groupId,
    })),
  });
}

/** Deletes all future unpaid sub-bill transactions for a subscription (used when encerrar). */
export async function purgeFutureSubBillTransactions(
  subId: string,
  userId: string,
  afterDate: Date
) {
  await prisma.transaction.deleteMany({
    where: {
      userId,
      groupId: { startsWith: `sub-bill-${subId}-` },
      isPaid: false,
      date: { gt: afterDate },
    },
  });
}

/** Deletes ALL sub-bill transactions for a subscription (used on delete). */
export async function deleteAllSubBillTransactions(subId: string, userId: string) {
  await prisma.transaction.deleteMany({
    where: { userId, groupId: { startsWith: `sub-bill-${subId}-` } },
  });
}
