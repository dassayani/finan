import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import type { CategoryKey } from "@/lib/constants";
import { manualBankEntryWhere } from "@/lib/bank-entry-sync";

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
  const txExclFilter: Record<string, any> = excl.length > 0 ? { NOT: { category: { in: excl } } } : {};
  const beExclCategory = excl.length > 0 ? { notIn: [...excl, "reserva" as CategoryKey] } : { not: "reserva" as CategoryKey };

  // Annual mode: return monthly aggregates for the whole year in one query
  if (searchParams.get("mode") === "annual") {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [txs, bankEntriesAnnual] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: session.user.id, date: { gte: yearStart, lte: yearEnd }, ...txExclFilter },
        select: { type: true, amount: true, date: true },
      }),
      prisma.bankEntry.findMany({
        where: {
          userId: session.user.id,
          year,
          category: beExclCategory,
          ...manualBankEntryWhere(),
        },
        select: { type: true, amount: true, month: true },
      }),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthTxs = txs.filter(t => new Date(t.date).getUTCMonth() + 1 === m);
      const monthBes = bankEntriesAnnual.filter(e => e.month === m);
      return {
        month: m,
        income:  monthTxs.filter(t => t.type === "INCOME") .reduce((s, t) => s + Number(t.amount), 0)
               + monthBes.filter(e => e.type === "INCOME") .reduce((s, e) => s + Number(e.amount), 0),
        expense: monthTxs.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0)
               + monthBes.filter(e => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0),
      };
    });

    return NextResponse.json({ months });
  }

  const [transactions, categoryGroups, expTypeGroups, bankEntries] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session.user.id, date: { gte: start, lte: end }, ...txExclFilter },
      select: { type: true, amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { userId: session.user.id, type: "EXPENSE", date: { gte: start, lte: end }, category: { not: null }, ...txExclFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["expenseType"],
      where: { userId: session.user.id, type: "EXPENSE", date: { gte: start, lte: end }, expenseType: { not: null }, ...txExclFilter },
      _sum: { amount: true },
    }),
    prisma.bankEntry.findMany({
      where: {
        userId: session.user.id,
        month,
        year,
        category: beExclCategory,
        ...manualBankEntryWhere(),
      },
      select: { type: true, amount: true, category: true },
    }),
  ]);

  const beIncome  = bankEntries.filter(e => e.type === "INCOME") .reduce((s, e) => s + Number(e.amount), 0);
  const beExpense = bankEntries.filter(e => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);

  const totalIncome  = transactions.filter(t => t.type === "INCOME") .reduce((s, t) => s + Number(t.amount), 0) + beIncome;
  const totalExpense = transactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0) + beExpense;

  // Merge BankEntry expense categories into Transaction category groups
  const beCategoryMap = bankEntries
    .filter(e => e.type === "EXPENSE" && e.category)
    .reduce<Record<string, number>>((acc, e) => {
      const k = e.category as string;
      acc[k] = (acc[k] ?? 0) + Number(e.amount);
      return acc;
    }, {});

  // Build merged category list
  const mergedKeys = new Set<string>([
    ...categoryGroups.map(cg => cg.category as string),
    ...Object.keys(beCategoryMap),
  ]);

  const categoryData = Array.from(mergedKeys)
    .map(k => {
      const txAmt = Number(categoryGroups.find(cg => cg.category === k)?._sum?.amount ?? 0);
      const beAmt = beCategoryMap[k] ?? 0;
      const total = txAmt + beAmt;
      const cat   = CATEGORIES[k as CategoryKey];
      return {
        key:   k,
        name:  cat?.label ?? "Sem categoria",
        value: total,
        color: cat?.color ?? "#6b7280",
      };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const g = (type: string) => Number(expTypeGroups.find(e => e.expenseType === type)?._sum?.amount ?? 0);
  const expenseTypeData = { fixed: g("FIXED"), variable: g("VARIABLE"), bankBill: g("BANK_BILL") };

  return NextResponse.json({
    stats: { totalIncome, totalExpense, balance: totalIncome - totalExpense, transactionCount: transactions.length },
    categoryData,
    expenseTypeData,
  });
}
