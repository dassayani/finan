"use client";

import { useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { formatBRL } from "@/lib/constants";

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
  stats: { totalIncome: number; totalExpense: number; balance: number; transactionCount: number };
  monthlyData: MonthStat[];
  categoryData: CategoryStat[];
}

interface YearMonthData {
  m: string;
  income: number;
  expense: number;
  projected: boolean; // true = future month filled by salary template
}

interface SalaryTemplate {
  netAmount: number;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [currentData, setCurrentData] = useState<DashboardData | null>(null);
  const [yearData, setYearData] = useState<YearMonthData[]>([]);
  const [investments, setInvestments] = useState<{ value: number }[]>([]);
  const [salaryTemplate, setSalaryTemplate] = useState<SalaryTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const curMonth = now.getMonth() + 1;

        const [dashRes, invRes, salRes] = await Promise.all([
          fetch(`/api/dashboard?year=${year}&month=${curMonth}`),
          fetch("/api/investments"),
          fetch("/api/salary?month=0&year=0"),
        ]);

        if (dashRes.ok) setCurrentData(await dashRes.json());
        if (invRes.ok) setInvestments(await invRes.json());

        let template: SalaryTemplate | null = null;
        if (salRes.ok) {
          const salData = await salRes.json();
          template = salData.template ?? null;
          setSalaryTemplate(template);
        }

        // Fetch all 12 months
        const monthPromises = MONTH_NAMES.map(async (m, i) => {
          const monthNum = i + 1;
          const isFuture = year === now.getFullYear() && monthNum > curMonth;

          if (isFuture) {
            // Project future months from salary template
            return {
              m,
              income: template ? Number(template.netAmount) : 0,
              expense: 0,
              projected: true,
            };
          }

          const r = await fetch(`/api/dashboard?year=${year}&month=${monthNum}`);
          const d: DashboardData | null = r.ok ? await r.json() : null;
          return {
            m,
            income: d?.stats.totalIncome ?? 0,
            expense: d?.stats.totalExpense ?? 0,
            projected: false,
          };
        });

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

  // KPI totals: only count realized months
  const totalIncomeReal = yearData.filter(m => !m.projected).reduce((s, m) => s + m.income, 0);
  const totalExpenseReal = yearData.filter(m => !m.projected).reduce((s, m) => s + m.expense, 0);
  // Projected annual total (real + future projections)
  const totalIncomeProj = yearData.reduce((s, m) => s + m.income, 0);
  const economiaReal = totalIncomeReal - totalExpenseReal;
  const patrimonio = investments.reduce((s, i) => s + Number(i.value), 0);

  const maxIncome = Math.max(...yearData.map(m => m.income), 1);

  const catData = (currentData?.categoryData ?? []).filter(c => c.value > 0).slice(0, 6);
  const catTotal = catData.reduce((s, c) => s + c.value, 0);
  const maxCat = catData[0]?.value ?? 1;

  const hasAnyReal = yearData.some(m => !m.projected && (m.income > 0 || m.expense > 0));
  const hasProjection = yearData.some(m => m.projected && m.income > 0);

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

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
            <div className="kpi-val sm num" style={{ color: "var(--pos)" }}>{formatBRL(totalIncomeReal)}</div>
            {hasProjection && (
              <div className="kpi-delta muted">
                Projeção: {formatBRL(totalIncomeProj)}
              </div>
            )}
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowUp" size={14} style={{ color: "var(--neg)" }} />Gasto no ano</div>
            <div className="kpi-val sm num" style={{ color: "var(--neg)" }}>{formatBRL(totalExpenseReal)}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} style={{ color: "var(--accent)" }} />Guardado (realizado)</div>
            <div className="kpi-val sm num" style={{ color: economiaReal >= 0 ? "var(--accent)" : "var(--neg)" }}>
              {formatBRL(economiaReal, { sign: true })}
            </div>
            {totalIncomeReal > 0 && (
              <div className="kpi-delta" style={{ color: economiaReal >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {Math.round((economiaReal / totalIncomeReal) * 100)}% da renda
              </div>
            )}
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="trend" size={14} />Patrimônio investido</div>
            <div className="kpi-val sm num">{formatBRL(patrimonio)}</div>
          </div>
        </div>

        {!hasAnyReal && !hasProjection ? (
          <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 80 }}>
            <OrcaIcon name="dashboard" size={40} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
            <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 8px", color: "var(--ink-2)" }}>Nenhum lançamento ainda</p>
            <p style={{ fontSize: 13, margin: 0 }}>Lance créditos e despesas para ver o dashboard preenchido.</p>
          </div>
        ) : (
          <>
            {/* Projection legend */}
            {hasProjection && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 14px", background: "var(--accent-soft)", borderRadius: "var(--r-md)", fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>
                <OrcaIcon name="repeat" size={14} style={{ flex: "0 0 auto" }} />
                <span>Meses futuros projetados com base no salário base cadastrado ({hasProjection && salaryTemplate ? formatBRL(Number(salaryTemplate.netAmount)) : ""}/mês)</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
              {/* Bar chart */}
              <div className="card card-pad">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div className="card-title">Recebimentos por mês</div>
                  <div style={{ display: "flex", gap: 14, fontSize: 11.5, fontWeight: 700 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--pos)" }} />Realizado
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent-soft)", border: "1.5px dashed var(--accent)" }} />Projetado
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
                          <span className="num" style={{ fontSize: 9, fontWeight: 700, color: isCur ? "var(--pos)" : m.projected ? "var(--accent)" : "var(--ink-3)", opacity: m.projected ? 0.6 : 1 }}>
                            {(m.income / 1000).toFixed(1)}k
                          </span>
                        )}
                        <div style={{ position: "relative", width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: Math.max(h, hExp, 4) }}>
                          {/* Income bar */}
                          <div style={{
                            flex: 1, height: h || 2,
                            background: m.projected ? "transparent" : isCur ? "var(--pos)" : "var(--accent)",
                            border: m.projected ? "1.5px dashed var(--accent)" : "none",
                            borderBottom: "none",
                            borderRadius: "4px 4px 0 0",
                            opacity: m.projected ? 0.5 : isCur ? 1 : 0.75,
                          }} />
                          {/* Expense bar */}
                          {hExp > 2 && (
                            <div style={{ flex: 1, height: hExp, background: "var(--neg)", borderRadius: "4px 4px 0 0", opacity: 0.6 }} />
                          )}
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
                  catData.map(c => (
                    <div key={c.name} style={{ marginBottom: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />{c.name}
                        </span>
                        <span className="num">{formatBRL(c.value)}</span>
                      </div>
                      <div className="bar"><span style={{ width: `${(c.value / maxCat) * 100}%`, background: c.color }} /></div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Monthly saldo strip */}
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div className="card-title">Saldo mês a mês</div>
                {hasProjection && <span className="row-meta">Tracejado = projetado</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 8 }}>
                {yearData.map((m, i) => {
                  const saldo = m.income - m.expense;
                  const isCur = i === curMonthIdx;
                  const hasData = m.income > 0 || m.expense > 0;
                  return (
                    <div key={m.m} style={{
                      textAlign: "center", padding: "10px 4px", borderRadius: 10,
                      background: isCur ? "var(--accent-soft)" : "var(--surface-2)",
                      border: `${m.projected ? "1.5px dashed" : "1px solid"} ${isCur ? "var(--accent)" : "var(--line-2)"}`,
                      opacity: m.projected ? 0.7 : 1,
                    }}>
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
