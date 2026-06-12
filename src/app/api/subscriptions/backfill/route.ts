import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSubBillTransactions } from "@/lib/subscriptions";
import type { BankKey } from "@/lib/constants";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const uid = session.user.id;

  const subs = await prisma.subscription.findMany({
    where: { userId: uid, bank: { not: null }, endDate: null },
    select: { id: true, name: true, total: true, bank: true, startDate: true, endDate: true, createdAt: true },
  });

  await Promise.all(
    subs.map(async s => {
      const expectedDesc = `Assinatura - ${s.name}`;

      // Fix description on existing sub-bill transactions that lack the prefix
      await prisma.transaction.updateMany({
        where: {
          userId: uid,
          groupId: { startsWith: `sub-bill-${s.id}-` },
          description: { not: expectedDesc },
        },
        data: { description: expectedDesc },
      });

      await generateSubBillTransactions(
        {
          id: s.id,
          name: s.name,
          total: s.total,
          bank: s.bank as BankKey,
          startDate: s.startDate,
          endDate: null,
          createdAt: s.createdAt,
        },
        uid
      );
    })
  );

  return NextResponse.json({ backfilled: subs.length });
}
