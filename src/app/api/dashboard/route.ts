import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import type { CategoryKey } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year  = Number(searchParams.get("year")  ?? new Date().getFullYear());
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month,     0, 23, 59, 59, 999));

  // Categories to exclude (comma-separated keys)
  const excl = (searchParams.get("excl") ?? "").split(",").map(s => s.trim()).filter(Boolean) as CategoryKey[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exclFilter: Record<string, any> = excl.length > 0 ? { NOT: { category: { in: excl } } } : {};

  // Annual mode: return monthly aggregates for the whole year in one query
  if (searchParams.get("mode") === "annual") {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const txs = await prisma.transaction.findMany({
      where: { userId: session.user.id, date: { gte: yearStart, lte: yearEnd }, ...exclFilter },
      select: { type: true, amount: true, date: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthTxs = txs.filter(t => new Date(t.date).getUTCMonth() + 1 === m);
      return {
        month: m,
        income:  monthTxs.filter(t => t.type === "INCOME") .reduce((s, t) => s + Number(t.amount), 0),
        expense: monthTxs.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0),
      };
    });

    return NextResponse.json({ months });
  }

  const [transactions, categoryGroups, expTypeGroups] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session.user.id, date: { gte: start, lte: end }, ...exclFilter },
      select: { type: true, amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { userId: session.user.id, type: "EXPENSE", date: { gte: start, lte: end }, category: { not: null }, ...exclFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["expenseType"],
      where: { userId: session.user.id, type: "EXPENSE", date: { gte: start, lte: end }, expenseType: { not: null }, ...exclFilter },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome  = transactions.filter(t => t.type === "INCOME") .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);

  const categoryData = categoryGroups.map(ce => {
    const key = ce.category as CategoryKey;
    const cat = key ? CATEGORIES[key] : null;
    return {
      key: key ?? "other",
      name: cat?.label ?? "Sem categoria",
      value: Number(ce._sum?.amount ?? 0),
      color: cat?.color ?? "#6b7280",
    };
  }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  const g = (type: string) => Number(expTypeGroups.find(e => e.expenseType === type)?._sum?.amount ?? 0);
  const expenseTypeData = { fixed: g("FIXED"), variable: g("VARIABLE"), bankBill: g("BANK_BILL") };

  return NextResponse.json({
    stats: { totalIncome, totalExpense, balance: totalIncome - totalExpense, transactionCount: transactions.length },
    categoryData,
    expenseTypeData,
  });
}
