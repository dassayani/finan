"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, Activity } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DashboardStats, MonthlyData, CategoryData, TransactionWithCategory } from "@/types";

interface DashboardData {
  stats: DashboardStats;
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dashRes, txRes] = await Promise.all([
          fetch(`/api/dashboard?year=${year}&month=${month}`),
          fetch(`/api/transactions?year=${year}&month=${month}`),
        ]);
        const dashData = await dashRes.json();
        const txData = await txRes.json();
        setData(dashData);
        setRecentTransactions(txData.slice(0, 5));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year, month]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 capitalize">{monthName}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Saldo do Mês"
          value={data?.stats.balance ?? 0}
          icon={Wallet}
        />
        <StatsCard
          title="Receitas"
          value={data?.stats.totalIncome ?? 0}
          icon={TrendingUp}
          variant="income"
        />
        <StatsCard
          title="Despesas"
          value={data?.stats.totalExpense ?? 0}
          icon={TrendingDown}
          variant="expense"
        />
        <StatsCard
          title="Transações"
          value={data?.stats.transactionCount ?? 0}
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MonthlyChart data={data?.monthlyData ?? []} />
        <CategoryChart data={data?.categoryData ?? []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList transactions={recentTransactions} />
        </CardContent>
      </Card>
    </div>
  );
}
