"use client";

import { useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { CATEGORIES, formatBRL } from "@/lib/constants";
import type { CategoryKey } from "@/lib/constants";

interface MonthStat {
  month: string;
  income: number;
  expense: number;
}

interface CategoryStat {
  name: string;
  value: number;
  color: string;
}

interface DashboardData {
  stats: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    transactionCount: number;
  };
  monthlyData: MonthStat[];
  categoryData: CategoryStat[];
}

interface YearMonthData {
  m: string;
  income: number;
  expense: number;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [currentData, setCurrentData] = useState<DashboardData | null>(null);
  const [yearData, setYearData] = useState<YearMonthData[]>([]);
  const [investments, setInvestments] = useState<{ value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const curMonth = now.getMonth() + 1;

        // Fetch current month dashboard stats + investments
        const [dashRes, invRes] = await Promise.all([
          fetch(`/api/dashboard?year=${year}&month=${curMonth}`),
          fetch("/api/investments"),
        ]);

        if (dashRes.ok) setCurrentData(await dashRes.json());
        if (invRes.ok) setInvestments(await invRes.json());

        // Fetch all 12 months for the bar chart
        const monthPromises = MONTH_NAMES.map((m, i) =>
          fetch(`/api/dashboard?year=${year}&month=${i + 1}`)
            .then(r => r.ok ? r.json() : null)
            .then((d: DashboardData | null) => ({
              m,
              income: d?.stats.totalIncome ?? 0,
              expense: d?.stats.totalExpense ?? 0,
            }))
        );
        setYearData(await Promise.all(monthPromises));
      } catch (e) {
        console.error("[dashboard]", e);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const curMonthIdx = now.getMonth();
  const totalIncome = yearData.reduce((s, m) => s + m.income, 0);
  const totalExpense = yearData.reduce((s, m) => s + m.expense, 0);
  const economia = totalIncome - totalExpense;
  const patrimonio = investments.reduce((s, i) => s + Number(i.value), 0);

  const maxIncome = Math.max(...yearData.map(m => m.income), 1);

  const catData = (currentData?.categoryData ?? [])
    .filter(c => c.value > 0)
    .slice(0, 6);

  const catTotal = catData.reduce((s, c) => s + c.value, 0);
  const maxCat = catData[0]?.value ?? 1;

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const isEmpty = totalIncome === 0 && totalExpense === 0;

  return (
    <>
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Visão geral</div>
          <div className="page-title">Dashboard {year}</div>
        </div>
        <div className="topbar-r">
          <div className="seg">
            <button className={year === now.getFullYear() ? "on" : ""} onClick={() => setYear(now.getFullYear())}>{now.getFullYear()}</button>
            <button className={year === now.getFullYear() - 1 ? "on" : ""} onClick={() => setYear(now.getFullYear() - 1)}>{now.getFullYear() - 1}</button>
          </div>
          <button className="btn-icon"><OrcaIcon name="filter" size={18} /></button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowDown" size={14} style={{ color: "var(--pos)" }} />Recebido no ano</div>
            <div className="kpi-val sm num" style={{ color: "var(--pos)" }}>{formatBRL(totalIncome)}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowUp" size={14} style={{ color: "var(--neg)" }} />Gasto no ano</div>
            <div className="kpi-val sm num" style={{ color: "var(--neg)" }}>{formatBRL(totalExpense)}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} style={{ color: "var(--accent)" }} />Guardado</div>
            <div className="kpi-val sm num" style={{ color: economia >= 0 ? "var(--accent)" : "var(--neg)" }}>
              {formatBRL(economia, { sign: true })}
            </div>
            {totalIncome > 0 && (
              <div className="kpi-delta" style={{ color: economia >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {Math.round((economia / totalIncome) * 100)}% da renda
              </div>
            )}
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="trend" size={14} />Patrimônio investido</div>
            <div className="kpi-val sm num">{formatBRL(patrimonio)}</div>
          </div>
        </div>

        {isEmpty ? (
          <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 80 }}>
            <OrcaIcon name="dashboard" size={40} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
            <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 8px", color: "var(--ink-2)" }}>Nenhum lançamento ainda</p>
            <p style={{ fontSize: 13, margin: 0 }}>Lance créditos e despesas para ver o dashboard preenchido com seus dados reais.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
              {/* Bar chart */}
              <div className="card card-pad">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div className="card-title">Recebimentos por mês</div>
                  <div style={{ display: "flex", gap: 14, fontSize: 11.5, fontWeight: 700 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--pos)" }} />Receitas
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--neg-soft)" }} />Despesas
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 200 }}>
                  {yearData.map((m, i) => {
                    const isCur = i === curMonthIdx;
                    const h = Math.round((m.income / maxIncome) * 170);
                    const hExp = Math.round((m.expense / maxIncome) * 170);
                    return (
                      <div key={m.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                        {m.income > 0 && (
                          <span className="num" style={{ fontSize: 9, fontWeight: 700, color: isCur ? "var(--pos)" : "var(--ink-3)" }}>
                            {(m.income / 1000).toFixed(1)}k
                          </span>
                        )}
                        <div style={{ position: "relative", width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: Math.max(h, hExp, 4) }}>
                          <div style={{ flex: 1, height: h || 2, background: isCur ? "var(--pos)" : "var(--accent)", borderRadius: "4px 4px 0 0", opacity: isCur ? 1 : 0.75 }} />
                          <div style={{ flex: 1, height: hExp || 2, background: isCur ? "var(--neg)" : "var(--neg-soft)", borderRadius: "4px 4px 0 0", opacity: isCur ? 1 : 0.6 }} />
                        </div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: isCur ? "var(--ink)" : "var(--ink-3)" }}>{m.m}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category breakdown */}
              <div className="card card-pad">
                <div className="card-title" style={{ marginBottom: 4 }}>Gastos por categoria</div>
                <div className="row-meta" style={{ marginBottom: 16 }}>
                  {MONTH_NAMES[curMonthIdx]} {year}{catTotal > 0 ? ` · ${formatBRL(catTotal)}` : ""}
                </div>
                {catData.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "24px 0", fontSize: 13 }}>
                    Nenhuma despesa neste mês
                  </div>
                ) : (
                  catData.map((c) => (
                    <div key={c.name} style={{ marginBottom: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                          {c.name}
                        </span>
                        <span className="num">{formatBRL(c.value)}</span>
                      </div>
                      <div className="bar">
                        <span style={{ width: `${(c.value / maxCat) * 100}%`, background: c.color }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Monthly saldo strip */}
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Saldo mês a mês</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 8 }}>
                {yearData.map((m, i) => {
                  const saldo = m.income - m.expense;
                  const isCur = i === curMonthIdx;
                  const hasData = m.income > 0 || m.expense > 0;
                  return (
                    <div key={m.m} style={{ textAlign: "center", padding: "10px 4px", borderRadius: 10,
                      background: isCur ? "var(--accent-soft)" : "var(--surface-2)",
                      border: `1px solid ${isCur ? "var(--accent)" : "var(--line-2)"}` }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>{m.m}</div>
                      {hasData ? (
                        <div className="num" style={{ fontSize: 11, fontWeight: 800, marginTop: 4, color: saldo >= 0 ? "var(--pos)" : "var(--neg)" }}>
                          {saldo >= 0 ? "+" : "−"}{(Math.abs(saldo) / 1000).toFixed(1)}k
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: "var(--ink-3)" }}>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
