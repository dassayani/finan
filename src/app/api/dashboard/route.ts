import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Transaction } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const [transactions, categoryExpenses] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session.user.id, date: { gte: startOfMonth, lte: endOfMonth } },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId: session.user.id,
        type: "EXPENSE",
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = transactions
    .filter((t: Transaction) => t.type === "INCOME")
    .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t: Transaction) => t.type === "EXPENSE")
    .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

  const categoryIds = categoryExpenses
    .map((c) => c.categoryId)
    .filter((id): id is string => id !== null);

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });

  const categoryData = categoryExpenses.map((ce) => {
    const cat = categories.find((c) => c.id === ce.categoryId);
    return {
      name: cat?.name ?? "Sem categoria",
      value: Number(ce._sum.amount ?? 0),
      color: cat?.color ?? "#6b7280",
    };
  });

  type MonthGroups = { type: "INCOME" | "EXPENSE"; _sum: { amount: unknown } }[];

  const monthlyPromises = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - i, 1);
    return prisma.transaction.groupBy({
      by: ["type"],
      where: {
        userId: session.user.id,
        date: {
          gte: new Date(d.getFullYear(), d.getMonth(), 1),
          lte: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
        },
      },
      _sum: { amount: true },
    }).then((groups: MonthGroups) => ({
      month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      income: Number(groups.find((g) => g.type === "INCOME")?._sum.amount ?? 0),
      expense: Number(groups.find((g) => g.type === "EXPENSE")?._sum.amount ?? 0),
    }));
  });

  const monthlyData = (await Promise.all(monthlyPromises)).reverse();

  return NextResponse.json({
    stats: {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      transactionCount: transactions.length,
    },
    categoryData,
    monthlyData,
  });
}
