"use client";

import { useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { BankBadge } from "@/components/ui/bank-badge";
import { BANKS, CATEGORIES, formatBRL } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";
import type { DashTransaction as Transaction } from "@/types/dashboard";
import { useDashboardMensal } from "@/lib/hooks/use-dashboard-mensal";
import { useDashboardAnual } from "@/lib/hooks/use-dashboard-anual";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "mensal" | "anual";

const BANK_IDS: BankKey[] = ["caixa", "itau", "bb", "nubank", "picpay", "inter", "mp"];
const ALL_CAT_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

// ─── Read-only row ────────────────────────────────────────────────────────────

function ReadOnlyRow({ tx }: { tx: Transaction }) {
  const cat = tx.category ? CATEGORIES[tx.category as CategoryKey] : null;
  const statusLabel = tx.type === "INCOME"
    ? (tx.isPaid ? "Recebido" : "A receber")
    : (tx.isPaid ? "Pago"     : "Pendente");
  const statusColor = tx.isPaid ? "var(--pos)" : "var(--warn)";
  const statusBg    = tx.isPaid ? "color-mix(in srgb, var(--pos) 12%, transparent)" : "color-mix(in srgb, var(--warn) 12%, transparent)";
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "6px 14px", borderBottom: "1px solid var(--line-2)", fontSize: 12.5, gap: 8, minWidth: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cat?.color ?? "var(--ink-3)", flex: "0 0 auto" }} />
      <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</span>
      <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 700, color: statusColor, background: statusBg, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>
        {statusLabel}
      </span>
      <span className="num" style={{ flex: "0 0 auto", fontWeight: 700, minWidth: 72, textAlign: "right", color: tx.type === "INCOME" ? "var(--pos)" : "var(--neg)" }}>
        {tx.type === "INCOME" ? formatBRL(tx.amount) : formatBRL(-tx.amount)}
      </span>
    </div>
  );
}

// ─── Read-only section ────────────────────────────────────────────────────────

function ReadOnlySection({ title, badge, color, items, total, paidVal, variant = "expense" }: {
  title: string; badge: React.ReactNode; color: string;
  items: Transaction[]; total: number; paidVal?: number;
  variant?: "expense" | "income";
}) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const visible = sorted.slice(0, 10);
  const rest = sorted.length - visible.length;

  const hasPaidInfo = paidVal !== undefined;
  const pending = hasPaidInfo ? total - paidVal! : 0;

  const headerDisplay = !hasPaidInfo
    ? formatBRL(total)
    : variant === "income"
      ? (paidVal! > 0 ? formatBRL(paidVal!) : "—")
      : formatBRL(-pending);

  const headerColor = !hasPaidInfo
    ? color
    : variant === "income"
      ? "var(--pos)"
      : (pending > 0 ? "var(--neg)" : "var(--ink-3)");

  return (
    <div className="card" style={{ marginBottom: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderLeft: `3px solid ${color}`, background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {badge}
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>{title}</span>
          <span className="row-meta">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>
        <span className="num" style={{ fontSize: 13, fontWeight: 800, color: headerColor }}>{headerDisplay}</span>
      </div>
      {visible.map(tx => <ReadOnlyRow key={tx.id} tx={tx} />)}
      {rest > 0 && (
        <div style={{ padding: "6px 14px", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>+ {rest} mais</div>
      )}
      {hasPaidInfo && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 14px", borderTop: "1px solid var(--line-2)", background: "var(--surface-2)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>Total</span>
          <span className="num" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>{formatBRL(total)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Compact bank card ────────────────────────────────────────────────────────

function CompactBankCard({ id, saldoInicial, entradas, saidas, bankBillTotal, feesTotal, estornosTotal }: {
  id: BankKey;
  saldoInicial: number | null;
  entradas: number;
  saidas: number;
  bankBillTotal: number;
  feesTotal: number;
  estornosTotal: number;
}) {
  const bank = BANKS[id];
  const saldoTotal = (saldoInicial ?? 0) + entradas - saidas - bankBillTotal - feesTotal + estornosTotal;

  const row = (label: string, display: string, color: string, bold = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 14px", fontSize: 12 }}>
      <span style={{ color: bold ? "var(--ink)" : "var(--ink-3)", fontWeight: bold ? 800 : 600 }}>{label}</span>
      <span className="num" style={{ fontWeight: bold ? 800 : 700, color }}>{display}</span>
    </div>
  );

  return (
    <div className="card" style={{ overflow: "hidden", breakInside: "avoid" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BankBadge id={id} size={22} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>{bank.name}</span>
        </div>
        <span className="num" style={{ fontWeight: 800, fontSize: 13, color: saldoTotal >= 0 ? "var(--pos)" : "var(--neg)" }}>
          {formatBRL(saldoTotal)}
        </span>
      </div>
      <div style={{ padding: "6px 0 8px" }}>
        {row("Saldo inicial",
          saldoInicial !== null ? formatBRL(saldoInicial) : "—",
          saldoInicial !== null ? (saldoInicial >= 0 ? "var(--pos)" : "var(--neg)") : "var(--ink-3)"
        )}
        {entradas > 0      && row("Entradas",            formatBRL(entradas),       "var(--pos)")}
        {saidas > 0        && row("Saídas",              formatBRL(-saidas),        "var(--neg)")}
        {bankBillTotal > 0 && row("Cartão de crédito",   formatBRL(-bankBillTotal), "var(--neg)")}
        {feesTotal > 0     && row("Taxas",               formatBRL(-feesTotal),     "var(--neg)")}
        {estornosTotal > 0 && row("Créditos",            formatBRL(estornosTotal),  "var(--pos)")}
        <div style={{ margin: "5px 0 4px", borderTop: "1px solid var(--line-2)" }} />
        {row("Valor total", formatBRL(saldoTotal), saldoTotal >= 0 ? "var(--pos)" : "var(--neg)", true)}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const now = new Date();
  const [view,  setView]  = useState<View>("mensal");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const [excludedCats, setExcludedCats] = useState<CategoryKey[]>(["reemb"]);
  const [showFilters,  setShowFilters]  = useState(false);

  const {
    monthDash, transactions, incomes, bankFees,
    bankBalances, bankEntriesList, prevBankClosing,
    loading: mensalLoading,
  } = useDashboardMensal(month, year, excludedCats, view === "mensal");

  const {
    yearData, investments, salaryNet,
    loading: anualLoading,
  } = useDashboardAnual(year, excludedCats, view === "anual");

  const loading = view === "mensal" ? mensalLoading : anualLoading;

  // ── Category filter ─────────────────────────────────────────────────────────

  function toggleCat(key: CategoryKey) {
    setExcludedCats(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap   = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // ── Mensal derived ───────────────────────────────────────────────────────────

  const pct = (v: number, t: number) => t > 0 ? Math.round((v / t) * 100) : 0;

  // Category / type data (from dashboard API)
  const catData  = monthDash?.categoryData    ?? [];
  const expType  = monthDash?.expenseTypeData ?? { fixed: 0, variable: 0, bankBill: 0 };
  const maxCat   = catData[0]?.value ?? 1;
  const expTotal = expType.fixed + expType.variable + expType.bankBill;

  // Raw ledger data
  const sum     = (items: Transaction[]) => items.reduce((a, t) => a + Number(t.amount), 0);
  const sumPaid = (items: Transaction[]) => items.filter(t => t.isPaid).reduce((a, t) => a + Number(t.amount), 0);
  const sumFees = (id: string) => bankFees.filter(f => f.bank === id).reduce((a, f) => a + Number(f.amount), 0);

  const bankEstornos   = incomes.filter(t => t.bank !== null);
  const regularIncomes = incomes.filter(t => t.bank === null);
  const credits        = sum(regularIncomes);

  const fixosAll    = transactions.filter(t => t.expenseType === "FIXED");
  const variaveisAll = transactions.filter(t => t.expenseType === "VARIABLE");
  const fixosTotal  = sum(fixosAll.filter(t => !t.bank));
  const varsTotal   = sum(variaveisAll.filter(t => !t.bank));

  const banksTotals = Object.fromEntries(BANK_IDS.map(id => [
    id,
    Math.max(0,
      sum(transactions.filter(t => (t.expenseType === "BANK_BILL" || t.expenseType === "FIXED" || t.expenseType === "VARIABLE") && t.bank === id))
      + sumFees(id)
      - (bankEstornos.filter(t => t.bank === id).reduce((a, t) => a + Number(t.amount), 0))
    ),
  ]));

  const allBankIds = BANK_IDS.filter(id =>
    transactions.some(t => t.bank === id) ||
    bankFees.some(f => f.bank === id) ||
    bankEstornos.some(t => t.bank === id) ||
    bankBalances.some(b => b.bank === id) ||
    bankEntriesList.some(e => e.bank === id && e.bank in BANKS)
  );

  const debits  = fixosTotal + varsTotal + Object.values(banksTotals).reduce((a, v) => a + v, 0);
  const paid    = sumPaid(transactions);
  const saldo   = credits - debits;

  const receivedIncome = regularIncomes.filter(t => t.isPaid).reduce((a, t) => a + Number(t.amount), 0);
  const realSaldo      = receivedIncome - paid;

  // "Para onde foi" buckets
  const buckets = [
    { label: "Gastos Fixos", v: fixosTotal, c: "var(--accent)" },
    { label: "Variáveis",    v: varsTotal,  c: "#5B49C9" },
    ...allBankIds.map(id => ({ label: BANKS[id].name, v: banksTotals[id], c: BANKS[id].color })),
  ].filter(b => b.v > 0).sort((a, b) => b.v - a.v);
  const maxB = Math.max(...buckets.map(b => b.v), 1);

  // ── Annual derived ───────────────────────────────────────────────────────────

  const realMonths   = yearData.filter(m => !m.projected);
  const incomeReal   = realMonths.reduce((s, m) => s + m.income, 0);
  const expenseReal  = realMonths.reduce((s, m) => s + m.expense, 0);
  const incomeProj   = yearData.reduce((s, m) => s + m.income, 0);
  const economiaReal = incomeReal - expenseReal;
  const patrimonio   = investments.reduce((s, i) => s + Number(i.value), 0);
  const maxBar       = Math.max(...yearData.map(m => Math.max(m.income, m.expense)), 1);
  const hasProjection = yearData.some(m => m.projected && m.income > 0);

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Visão geral</div>
          <div className="page-title">Dashboard</div>
        </div>
        <div className="topbar-r">
          {view === "mensal" && <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />}
          {view === "anual" && (
            <div className="seg">
              <button className={year === now.getFullYear()     ? "on" : ""} onClick={() => setYear(now.getFullYear())}>{now.getFullYear()}</button>
              <button className={year === now.getFullYear() - 1 ? "on" : ""} onClick={() => setYear(now.getFullYear() - 1)}>{now.getFullYear() - 1}</button>
            </div>
          )}
          <div className="seg">
            <button className={view === "mensal" ? "on" : ""} onClick={() => setView("mensal")}>Mensal</button>
            <button className={view === "anual"  ? "on" : ""} onClick={() => setView("anual")}>Anual</button>
          </div>
          <button className={`btn btn-ghost${showFilters ? " on" : ""}`} onClick={() => setShowFilters(v => !v)} style={{ position: "relative" }}>
            <OrcaIcon name="filter" size={15} />Categorias
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
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Categorias exibidas</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => setExcludedCats([])}>Marcar todas</button>
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => setExcludedCats(["reemb"])}>Padrão</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ALL_CAT_KEYS.map(key => {
              const cat = CATEGORIES[key];
              const included = !excludedCats.includes(key);
              return (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: "var(--r-sm)", cursor: "pointer", background: included ? "var(--surface)" : "var(--surface-3)", border: `1.5px solid ${included ? cat.color : "var(--line-2)"}`, opacity: included ? 1 : 0.5, userSelect: "none" }}>
                  <input type="checkbox" checked={included} onChange={() => toggleCat(key)} style={{ accentColor: cat.color, width: 13, height: 13 }} />
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

        // ══════════════════════════════ MENSAL ══════════════════════════════════
        <div className="content">

          {/* KPIs */}
          <div className="r-kpi-4" style={{ marginBottom: 24 }}>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="arrowDown" size={13} style={{ color: "var(--pos)" }} />Receitas</div>
              <div className="kpi-val sm num" style={{ color: "var(--pos)" }}>{credits > 0 ? formatBRL(credits) : "—"}</div>
              <div className="kpi-delta muted">{regularIncomes.length} lançamento{regularIncomes.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="arrowUp" size={13} style={{ color: "var(--neg)" }} />Despesas</div>
              <div className="kpi-val sm num" style={{ color: "var(--neg)" }}>{debits > 0 ? formatBRL(debits) : "—"}</div>
              <div className="kpi-delta muted">{transactions.length} lançamento{transactions.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="wallet" size={13} style={{ color: "var(--accent)" }} />Saldo projetado</div>
              <div className="kpi-val sm num" style={{ color: saldo >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {(credits > 0 || debits > 0) ? formatBRL(saldo) : "—"}
              </div>
              {credits > 0 && debits > 0 && (
                <div className="kpi-delta" style={{ color: "var(--ink-3)" }}>{pct(debits, credits)}% da renda comprometida</div>
              )}
            </div>
            <div className="card kpi">
              <div className="kpi-label"><OrcaIcon name="check" size={13} style={{ color: realSaldo >= 0 ? "var(--pos)" : "var(--neg)" }} />Saldo real</div>
              <div className="kpi-val sm num" style={{ color: realSaldo >= 0 ? "var(--pos)" : "var(--neg)" }}>
                {(receivedIncome > 0 || paid > 0) ? formatBRL(realSaldo) : "—"}
              </div>
              <div className="kpi-delta muted">recebido − pago</div>
            </div>
          </div>

          {/* Main grid: sidebar esquerdo + razão à direita */}
          <div className="r-grid-sidebar" style={{ alignItems: "start" }}>

            {/* ── LEFT: análise ────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Para onde foi */}
              {buckets.length > 0 && (
                <div className="card card-pad">
                  <div className="section-label" style={{ color: "var(--ink-2)", marginBottom: 14 }}>Para onde foi</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {buckets.map((b, i) => (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                          <span style={{ color: "var(--ink-2)" }}>{b.label}</span>
                          <span className="num">{formatBRL(b.v)}</span>
                        </div>
                        <div className="bar"><span style={{ width: `${(b.v / maxB) * 100}%`, background: b.c }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gastos por categoria */}
              {catData.length > 0 && (
                <div className="card card-pad">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                    <div>
                      <div className="card-title">Gastos por categoria</div>
                      <div className="row-meta">{catData.length} categorias · {formatBRL(catData.reduce((s, c) => s + c.value, 0))}</div>
                    </div>
                    {credits > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>% renda</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {catData.map(c => (
                      <div key={c.key}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flex: "0 0 auto" }} />
                            {c.name}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className="num" style={{ fontSize: 12.5, fontWeight: 800 }}>{formatBRL(c.value)}</span>
                            {credits > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 700, minWidth: 36, textAlign: "right", color: pct(c.value, credits) >= 30 ? "var(--neg)" : pct(c.value, credits) >= 15 ? "var(--warn)" : "var(--ink-3)" }}>
                                {pct(c.value, credits)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="bar"><span style={{ width: `${pct(c.value, maxCat)}%`, background: c.color }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tipo de gasto */}
              {expTotal > 0 && (
                <div className="card card-pad">
                  <div className="card-title" style={{ marginBottom: 14 }}>Tipo de gasto</div>
                  {[
                    { label: "Gastos fixos",    value: expType.fixed,    color: "var(--accent)", desc: "Boletos e recorrentes" },
                    { label: "Gastos variáveis", value: expType.variable, color: "#5B49C9",       desc: "Avulsos e esporádicos" },
                    { label: "Faturas / Cartão", value: expType.bankBill, color: "var(--warn)",   desc: "Compras parceladas" },
                  ].map(({ label, value, color, desc }) => (
                    <div key={label} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{label}
                        </span>
                        <span className="num">{value > 0 ? formatBRL(value) : "—"}</span>
                      </div>
                      <div className="row-meta" style={{ paddingLeft: 15, marginBottom: 4 }}>{desc}</div>
                      <div className="bar"><span style={{ width: expTotal > 0 ? `${pct(value, expTotal)}%` : "0%", background: color }} /></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Análise do mês */}
              {credits > 0 && (
                <div className="card card-pad" style={{ background: "var(--accent-soft)", border: "none" }}>
                  <div className="section-label" style={{ marginBottom: 10 }}>Análise do mês</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Comprometido</span>
                      <span className="num">{pct(debits, credits)}% da renda</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Custo fixo</span>
                      <span className="num">{pct(expType.fixed, credits)}% da renda</span>
                    </div>
                    {catData[0] && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Maior gasto</span>
                          <span style={{ color: catData[0].color, fontWeight: 700 }}>{catData[0].name}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Representa</span>
                          <span className="num">{pct(catData[0].value, credits)}% da renda</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: razão por bloco ───────────────────────────────────── */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Razão do mês · por bloco</div>

              {/* Receitas */}
              <ReadOnlySection
                title="Receitas" color="var(--pos)"
                badge={<span style={{ color: "var(--pos)", fontWeight: 900, fontSize: 17, lineHeight: 1 }}>↑</span>}
                items={regularIncomes} total={credits}
                paidVal={sumPaid(regularIncomes)} variant="income"
              />

              {/* Gastos Fixos — exclui os com banco (aparecem no card do banco via Saídas) */}
              <ReadOnlySection
                title="Gastos Fixos" color="var(--accent)"
                badge={<OrcaIcon name="repeat" size={15} style={{ color: "var(--accent)" }} />}
                items={fixosAll.filter(t => !t.bank)} total={fixosTotal}
                paidVal={sumPaid(fixosAll.filter(t => !t.bank))}
              />

              {/* Gastos Variáveis — idem */}
              <ReadOnlySection
                title="Gastos Variáveis" color="#5B49C9"
                badge={<OrcaIcon name="flame" size={15} style={{ color: "#5B49C9" }} />}
                items={variaveisAll.filter(t => !t.bank)} total={varsTotal}
                paidVal={sumPaid(variaveisAll.filter(t => !t.bank))}
              />

              {/* Bancos compact */}
              {allBankIds.length > 0 && (
                <>
                  <div className="section-label" style={{ margin: "14px 0 10px" }}>Bancos</div>
                  <div className="r-grid-banks">
                    {allBankIds.map(id => {
                      const bankBills = transactions.filter(t => t.expenseType === "BANK_BILL" && t.bank === id);
                      const balRecord = bankBalances.find(b => b.bank === id);
                      const storedBal = balRecord ? Number(balRecord.balance) : null;
                      const saldoInicial = storedBal ?? (prevBankClosing[id] ?? null);
                      const entradas = bankEntriesList.filter(e => e.bank === id && e.type === "INCOME").reduce((a, e) => a + Number(e.amount), 0);
                      const saidas   = bankEntriesList.filter(e => e.bank === id && e.type === "EXPENSE").reduce((a, e) => a + Number(e.amount), 0);
                      const bankBillTotal  = bankBills.reduce((a, t) => a + Number(t.amount), 0);
                      const feesTotal      = sumFees(id);
                      const estornosTotal  = bankEstornos.filter(t => t.bank === id).reduce((a, t) => a + Number(t.amount), 0);
                      return (
                        <CompactBankCard
                          key={id} id={id}
                          saldoInicial={saldoInicial}
                          entradas={entradas} saidas={saidas}
                          bankBillTotal={bankBillTotal}
                          feesTotal={feesTotal}
                          estornosTotal={estornosTotal}
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {transactions.length === 0 && incomes.length === 0 && (
                <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 56 }}>
                  <OrcaIcon name="dashboard" size={32} style={{ margin: "0 auto 12px", opacity: 0.2 }} />
                  <p style={{ fontWeight: 600, margin: "0 0 4px", color: "var(--ink-2)" }}>Nenhum lançamento em {monthCap}</p>
                  <p style={{ fontSize: 13, margin: 0 }}>Use as telas de Receitas e Despesas para lançar.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      ) : (

        // ══════════════════════════════ ANUAL ════════════════════════════════════
        <div className="content">
          <div className="r-kpi-4">
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
              <div className="kpi-val sm num" style={{ color: economiaReal >= 0 ? "var(--accent)" : "var(--neg)" }}>{formatBRL(economiaReal)}</div>
              {incomeReal > 0 && (
                <div className="kpi-delta" style={{ color: economiaReal >= 0 ? "var(--pos)" : "var(--neg)" }}>{pct(economiaReal, incomeReal)}% da renda</div>
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

          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div className="card-title">Receitas vs Despesas — {year}</div>
              <div style={{ display: "flex", gap: 14, fontSize: 11.5, fontWeight: 700 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--pos)" }} />Receita</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--neg)", opacity: .7 }} />Despesa</span>
                {hasProjection && <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-3)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent-soft)", border: "1.5px dashed var(--accent)" }} />Projetado</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 200 }}>
              {yearData.map((m, i) => {
                const isCur = i === now.getMonth() && year === now.getFullYear();
                const hInc  = Math.round((m.income  / maxBar) * 170);
                const hExp  = Math.round((m.expense / maxBar) * 170);
                return (
                  <div key={m.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                    {m.income > 0 && <span className="num" style={{ fontSize: 9, fontWeight: 700, color: isCur ? "var(--pos)" : "var(--ink-3)", opacity: m.projected ? 0.6 : 1 }}>{(m.income / 1000).toFixed(1)}k</span>}
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

          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div className="card-title">Saldo mês a mês</div>
              {hasProjection && <span className="row-meta">Tracejado = projetado</span>}
            </div>
            <div className="r-months-grid">
              {yearData.map((m, i) => {
                const saldoM = m.income - m.expense;
                const isCur  = i === now.getMonth() && year === now.getFullYear();
                const hasData = m.income > 0 || m.expense > 0;
                return (
                  <div key={m.m} style={{ textAlign: "center", padding: "10px 4px", borderRadius: 10, background: isCur ? "var(--accent-soft)" : "var(--surface-2)", border: `${m.projected ? "1.5px dashed" : "1px solid"} ${isCur ? "var(--accent)" : "var(--line-2)"}`, opacity: m.projected ? 0.7 : 1 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>{m.m}</div>
                    {hasData ? (
                      <div className="num" style={{ fontSize: 11, fontWeight: 800, marginTop: 4, color: saldoM >= 0 ? "var(--pos)" : "var(--neg)" }}>
                        {saldoM >= 0 ? "+" : "−"}{(Math.abs(saldoM) / 1000).toFixed(1)}k
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
