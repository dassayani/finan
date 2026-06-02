"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { formatBRL, CATEGORIES } from "@/lib/constants";
import type { CategoryKey } from "@/lib/constants";

type View = "mensal" | "anual";

const ALL_CAT_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

interface CategoryStat { key: string; name: string; value: number; color: string; }
interface ExpenseType   { fixed: number; variable: number; bankBill: number; }
interface MonthData {
  stats: { totalIncome: number; totalExpense: number; balance: number };
  categoryData: CategoryStat[];
  expenseTypeData: ExpenseType;
}
interface YearMonthData { m: string; income: number; expense: number; projected: boolean; }

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function DashboardPage() {
  const now   = new Date();
  const [view,         setView]        = useState<View>("mensal");
  const [month,        setMonth]       = useState(now.getMonth() + 1);
  const [year,         setYear]        = useState(now.getFullYear());
  const [excludedCats, setExcludedCats] = useState<CategoryKey[]>(["reemb"]);
  const [showFilters,  setShowFilters]  = useState(false);

  const [monthData,   setMonthData]   = useState<MonthData | null>(null);
  const [yearData,    setYearData]    = useState<YearMonthData[]>([]);
  const [investments, setInvestments] = useState<{ value: number }[]>([]);
  const [salaryNet,   setSalaryNet]   = useState(0);
  const [loading,     setLoading]     = useState(true);

  function toggleCat(key: CategoryKey) {
    setExcludedCats(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }
  const exclParam = excludedCats.length > 0 ? `&excl=${excludedCats.join(",")}` : "";

  // ── Monthly fetch ────────────────────────────────────────────────────────────
  const fetchMonth = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/dashboard?year=${year}&month=${month}${exclParam}`);
    if (r.ok) setMonthData(await r.json());
    setLoading(false);
  }, [year, month, exclParam]);

  useEffect(() => { if (view === "mensal") fetchMonth(); }, [view, fetchMonth]);

  // ── Annual fetch ─────────────────────────────────────────────────────────────
  const fetchAnnual = useCallback(async () => {
    setLoading(true);
    const curMonth = now.getMonth() + 1;
    const [invRes, salRes] = await Promise.all([
      fetch("/api/investments"),
      fetch("/api/salary?month=0&year=0"),
    ]);
    if (invRes.ok) setInvestments(await invRes.json());
    let netSal = 0;
    if (salRes.ok) {
      const sd = await salRes.json();
      netSal = Number(sd.template?.netAmount ?? 0);
      setSalaryNet(netSal);
    }
    const rows = await Promise.all(MONTH_NAMES.map(async (m, i) => {
      const mn = i + 1;
      if (year === now.getFullYear() && mn > curMonth)
        return { m, income: netSal, expense: 0, projected: true };
      const r = await fetch(`/api/dashboard?year=${year}&month=${mn}${exclParam}`);
      const d: MonthData | null = r.ok ? await r.json() : null;
      return { m, income: d?.stats.totalIncome ?? 0, expense: d?.stats.totalExpense ?? 0, projected: false };
    }));
    setYearData(rows);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, exclParam]);

  useEffect(() => { if (view === "anual") fetchAnnual(); }, [view, fetchAnnual]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap   = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // ── Monthly derived ──────────────────────────────────────────────────────────
  const { totalIncome = 0, totalExpense = 0 } = monthData?.stats ?? {};
  const catData   = monthData?.categoryData    ?? [];
  const expType   = monthData?.expenseTypeData ?? { fixed: 0, variable: 0, bankBill: 0 };
  const catTotal  = catData.reduce((s, c) => s + c.value, 0);
  const maxCat    = catData[0]?.value ?? 1;
  const expTotal  = expType.fixed + expType.variable + expType.bankBill;

  // ── Annual derived ───────────────────────────────────────────────────────────
  const realMonths    = yearData.filter(m => !m.projected);
  const incomeReal    = realMonths.reduce((s, m) => s + m.income, 0);
  const expenseReal   = realMonths.reduce((s, m) => s + m.expense, 0);
  const incomeProj    = yearData.reduce((s, m) => s + m.income, 0);
  const economiaReal  = incomeReal - expenseReal;
  const patrimonio    = investments.reduce((s, i) => s + Number(i.value), 0);
  const maxBar        = Math.max(...yearData.map(m => Math.max(m.income, m.expense)), 1);
  const hasProjection = yearData.some(m => m.projected && m.income > 0);

  // ── Shared helpers ───────────────────────────────────────────────────────────
  const pct = (v: number, total: number) => total > 0 ? Math.round((v / total) * 100) : 0;

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Visão geral</div>
          <div className="page-title">Dashboard</div>
        </div>
        <div className="topbar-r">
          {view === "mensal" && (
            <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          )}
          {view === "anual" && (
            <div className="seg">
              <button className={year === now.getFullYear()     ? "on" : ""} onClick={() => setYear(now.getFullYear())}    >{now.getFullYear()}</button>
              <button className={year === now.getFullYear() - 1 ? "on" : ""} onClick={() => setYear(now.getFullYear() - 1)}>{now.getFullYear() - 1}</button>
            </div>
          )}
          <div className="seg">
            <button className={view === "mensal" ? "on" : ""} onClick={() => setView("mensal")}>Mensal</button>
            <button className={view === "anual"  ? "on" : ""} onClick={() => setView("anual") }>Anual</button>
          </div>
          <button
            className={`btn btn-ghost${showFilters ? " on" : ""}`}
            onClick={() => setShowFilters(v => !v)}
            style={{ position: "relative" }}
          >
            <OrcaIcon name="filter" size={15} />
            Categorias
            {excludedCats.length > 0 && (
              <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ padding: "14px 24px 10px", borderBottom: "1px solid var(--line-2)", background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
              Categorias exibidas no dashboard
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => setExcludedCats([])}>
                Marcar todas
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => setExcludedCats(["reemb"])}>
                Padrão
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ALL_CAT_KEYS.map(key => {
              const cat = CATEGORIES[key];
              const included = !excludedCats.includes(key);
              return (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: "var(--r-sm)", cursor: "pointer", background: included ? "var(--surface)" : "var(--surface-3)", border: `1.5px solid ${included ? cat.color : "var(--line-2)"}`, opacity: included ? 1 : 0.5, userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggleCat(key)}
                    style={{ accentColor: cat.color, width: 13, height: 13 }}
                  />
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: cat.color }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: included ? "var(--ink)" : "var(--ink-3)" }}>{cat.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : view === "mensal" ? (

        // ════════════════════════════════ MENSAL ═══════════════════════════════
        <div className="content">

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="arrowDown" size={13} style={{ color: "var(--pos)" }} />Receitas</div>
              <div className="kpi-val sm num" style={{ color: "var(--pos)" }}>{totalIncome > 0 ? formatBRL(totalIncome) : "—"}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="arrowUp" size={13} style={{ color: "var(--neg)" }} />Despesas</div>
              <div className="kpi-val sm num" style={{ color: "var(--neg)" }}>{totalExpense > 0 ? formatBRL(totalExpense) : "—"}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="wallet" size={13} style={{ color: "var(--accent)" }} />Saldo projetado</div>
              <div className="kpi-val sm num" style={{ color: (totalIncome - totalExpense) >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {(totalIncome > 0 || totalExpense > 0) ? formatBRL(totalIncome - totalExpense) : "—"}
              </div>
              {totalIncome > 0 && totalExpense > 0 && (
                <div className="kpi-delta" style={{ color: "var(--ink-3)" }}>
                  {pct(totalExpense, totalIncome)}% da renda comprometida
                </div>
              )}
            </div>
            <div className="card kpi">
              <div className="kpi-label" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} />Fixo
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "#5B49C9", display: "inline-block", marginLeft: 6 }} />Variável
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--warn)", display: "inline-block", marginLeft: 6 }} />Fatura
              </div>
              {expTotal > 0 ? (
                <>
                  <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", margin: "8px 0 6px", gap: 1 }}>
                    {expType.fixed   > 0 && <div style={{ flex: expType.fixed,   background: "var(--accent)" }} />}
                    {expType.variable > 0 && <div style={{ flex: expType.variable, background: "#5B49C9" }} />}
                    {expType.bankBill > 0 && <div style={{ flex: expType.bankBill, background: "var(--warn)" }} />}
                  </div>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: "var(--accent)" }}>{pct(expType.fixed,   expTotal)}% fixo</span>
                    <span style={{ color: "#5B49C9"       }}>{pct(expType.variable, expTotal)}% var</span>
                    <span style={{ color: "var(--warn)"   }}>{pct(expType.bankBill, expTotal)}% fat</span>
                  </div>
                </>
              ) : (
                <div className="kpi-val sm num" style={{ color: "var(--ink-3)" }}>—</div>
              )}
            </div>
          </div>

          {/* Main section: categories + analysis */}
          {catData.length === 0 ? (
            <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 80 }}>
              <OrcaIcon name="dashboard" size={36} style={{ margin: "0 auto 12px", opacity: 0.2 }} />
              <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 6px", color: "var(--ink-2)" }}>Nenhuma despesa em {monthCap}</p>
              <p style={{ fontSize: 13, margin: 0 }}>Lance despesas para ver a análise por categoria.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>

              {/* Category breakdown — decision focus */}
              <div className="card card-pad">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
                  <div>
                    <div className="card-title">Gastos por categoria</div>
                    <div className="row-meta">{monthCap} · {catData.length} categorias · {formatBRL(catTotal)}</div>
                  </div>
                  {totalIncome > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>
                      % da renda
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {catData.map(c => {
                    const barPct  = pct(c.value, maxCat);
                    const incPct  = totalIncome > 0 ? pct(c.value, totalIncome) : null;
                    return (
                      <div key={c.key}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.color, flex: "0 0 auto" }} />
                            {c.name}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span className="num" style={{ fontSize: 13, fontWeight: 800 }}>{formatBRL(c.value)}</span>
                            {incPct !== null && (
                              <span style={{
                                fontSize: 11, fontWeight: 700, minWidth: 40, textAlign: "right",
                                color: incPct >= 30 ? "var(--neg)" : incPct >= 15 ? "var(--warn)" : "var(--ink-3)",
                              }}>
                                {incPct}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="bar">
                          <span style={{ width: `${barPct}%`, background: c.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right column: type analysis + insights */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Tipo de gasto */}
                <div className="card card-pad">
                  <div className="card-title" style={{ marginBottom: 14 }}>Tipo de gasto</div>
                  {[
                    { label: "Gastos fixos",    value: expType.fixed,    color: "var(--accent)", desc: "Boletos e recorrentes" },
                    { label: "Gastos variáveis", value: expType.variable, color: "#5B49C9",       desc: "Avulsos e esporádicos" },
                    { label: "Faturas / Cartão", value: expType.bankBill, color: "var(--warn)",   desc: "Compras parceladas" },
                  ].map(({ label, value, color, desc }) => (
                    <div key={label} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                          {label}
                        </span>
                        <span className="num">{value > 0 ? formatBRL(value) : "—"}</span>
                      </div>
                      <div className="row-meta" style={{ paddingLeft: 15, marginBottom: 5 }}>{desc}</div>
                      <div className="bar">
                        <span style={{ width: expTotal > 0 ? `${pct(value, expTotal)}%` : "0%", background: color }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Insight card */}
                {totalIncome > 0 && (
                  <div className="card card-pad" style={{ background: "var(--accent-soft)", border: "none" }}>
                    <div className="section-label" style={{ marginBottom: 10 }}>Análise do mês</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Comprometido</span>
                        <span className="num">{pct(totalExpense, totalIncome)}% da renda</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Custo fixo</span>
                        <span className="num">{pct(expType.fixed, totalIncome)}% da renda</span>
                      </div>
                      {catData[0] && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Maior gasto</span>
                          <span style={{ color: catData[0].color, fontWeight: 700 }}>{catData[0].name}</span>
                        </div>
                      )}
                      {catData[0] && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Representa</span>
                          <span className="num">{pct(catData[0].value, totalIncome)}% da renda</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      ) : (

        // ════════════════════════════════ ANUAL ════════════════════════════════
        <div className="content">

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="arrowDown" size={13} style={{ color: "var(--pos)" }} />Recebido no ano</div>
              <div className="kpi-val sm num" style={{ color: "var(--pos)" }}>{formatBRL(incomeReal)}</div>
              {hasProjection && <div className="kpi-delta muted">Projeção: {formatBRL(incomeProj)}</div>}
            </div>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="arrowUp" size={13} style={{ color: "var(--neg)" }} />Gasto no ano</div>
              <div className="kpi-val sm num" style={{ color: "var(--neg)" }}>{formatBRL(expenseReal)}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="wallet" size={13} style={{ color: "var(--accent)" }} />Guardado</div>
              <div className="kpi-val sm num" style={{ color: economiaReal >= 0 ? "var(--accent)" : "var(--neg)" }}>
                {formatBRL(economiaReal)}
              </div>
              {incomeReal > 0 && (
                <div className="kpi-delta" style={{ color: economiaReal >= 0 ? "var(--pos)" : "var(--neg)" }}>
                  {pct(economiaReal, incomeReal)}% da renda
                </div>
              )}
            </div>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="trend" size={13} />Patrimônio investido</div>
              <div className="kpi-val sm num">{formatBRL(patrimonio)}</div>
            </div>
          </div>

          {hasProjection && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 14px", background: "var(--accent-soft)", borderRadius: "var(--r-md)", fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>
              <OrcaIcon name="repeat" size={14} style={{ flex: "0 0 auto" }} />
              <span>Meses futuros projetados com base no salário base ({formatBRL(salaryNet)}/mês)</span>
            </div>
          )}

          {/* Bar chart */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div className="card-title">Receitas vs Despesas — {year}</div>
              <div style={{ display: "flex", gap: 14, fontSize: 11.5, fontWeight: 700 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--pos)" }} />Receita
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--neg)", opacity: .7 }} />Despesa
                </span>
                {hasProjection && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-3)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent-soft)", border: "1.5px dashed var(--accent)" }} />Projetado
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 200 }}>
              {yearData.map((m, i) => {
                const isCur = i === now.getMonth() && year === now.getFullYear();
                const hInc  = Math.round((m.income  / maxBar) * 170);
                const hExp  = Math.round((m.expense / maxBar) * 170);
                return (
                  <div key={m.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                    {m.income > 0 && (
                      <span className="num" style={{ fontSize: 9, fontWeight: 700, color: isCur ? "var(--pos)" : "var(--ink-3)", opacity: m.projected ? 0.6 : 1 }}>
                        {(m.income / 1000).toFixed(1)}k
                      </span>
                    )}
                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: Math.max(hInc, hExp, 4) }}>
                      <div style={{ flex: 1, height: hInc || 2, background: m.projected ? "transparent" : "var(--pos)", border: m.projected ? "1.5px dashed var(--accent)" : "none", borderBottom: "none", borderRadius: "4px 4px 0 0", opacity: m.projected ? 0.5 : isCur ? 1 : 0.75 }} />
                      {hExp > 2 && <div style={{ flex: 1, height: hExp, background: "var(--neg)", borderRadius: "4px 4px 0 0", opacity: 0.65 }} />}
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: isCur ? "var(--ink)" : "var(--ink-3)" }}>{m.m}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Month saldo strip */}
          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div className="card-title">Saldo mês a mês</div>
              {hasProjection && <span className="row-meta">Tracejado = projetado</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 8 }}>
              {yearData.map((m, i) => {
                const saldo = m.income - m.expense;
                const isCur = i === now.getMonth() && year === now.getFullYear();
                const hasData = m.income > 0 || m.expense > 0;
                return (
                  <div key={m.m} style={{ textAlign: "center", padding: "10px 4px", borderRadius: 10, background: isCur ? "var(--accent-soft)" : "var(--surface-2)", border: `${m.projected ? "1.5px dashed" : "1px solid"} ${isCur ? "var(--accent)" : "var(--line-2)"}`, opacity: m.projected ? 0.7 : 1 }}>
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
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
