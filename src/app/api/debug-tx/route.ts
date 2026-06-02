import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const all = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    select: { id: true, description: true, amount: true, expenseType: true, bank: true, date: true, isPaid: true },
  });

  const byBank = Object.groupBy(all, t => t.bank ?? "null");
  const summary = Object.entries(byBank).map(([bank, txs]) => ({
    bank,
    count: txs!.length,
    samples: txs!.slice(0, 3).map(t => ({
      date: t.date.toISOString().split("T")[0],
      expenseType: t.expenseType,
      desc: t.description,
      amount: String(t.amount),
    })),
  }));

  return NextResponse.json({ total: all.length, byBank: summary });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Reset all salary INCOME transactions to isPaid: false
  const result = await prisma.transaction.updateMany({
    where: {
      userId: session.user.id,
      type: "INCOME",
      groupId: { startsWith: "salary-" },
      isPaid: true,
    },
    data: { isPaid: false },
  });

  return NextResponse.json({ updated: result.count });
}
