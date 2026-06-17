"use client";

import { useCallback, useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { BankBadge } from "@/components/ui/bank-badge";
import { Modal } from "@/components/ui/modal";
import { BANKS, formatBRL, INVESTMENT_TYPES, investmentTypeColor } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";
import { buildPortfolioSeries } from "@/lib/finance/portfolio";

interface Snapshot { date: string; value: number; }
interface Investment {
  id: string; name: string; type: string; institution: string | null;
  value: number; costBasis: number | null; returnRate: number | null; monthlyAdd: number | null;
  snapshots?: Snapshot[];
}

const TYPES = Object.keys(INVESTMENT_TYPES);
const BANK_IDS = Object.keys(BANKS) as BankKey[];

/** Custo de um ativo: aporte declarado ou, na ausência, o valor atual (ganho 0). */
const costOf = (i: Investment) => (i.costBasis ?? i.value);

function InvForm({ initial, onSave, onCancel, loading }: { initial?: Partial<Investment>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; loading: boolean; }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? "Renda Fixa",
    institution: initial?.institution ?? "",
    value: initial?.value ? String(initial.value) : "",
    costBasis: initial?.costBasis != null ? String(initial.costBasis) : "",
    returnRate: initial?.returnRate ? String(Number(initial.returnRate) * 100) : "",
    monthlyAdd: initial?.monthlyAdd ? String(initial.monthlyAdd) : "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field"><label>Nome do ativo</label><input className="orça-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Tesouro Selic 2029" /></div>
      <div className="field-row-2">
        <div className="field"><label>Tipo</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TYPES.map(t => <span key={t} className={`opt${form.type === t ? " sel" : ""}`} onClick={() => set("type", t)} style={{ cursor: "pointer", fontSize: 12 }}>{t}</span>)}
          </div>
        </div>
        <div className="field"><label>Valor atual (R$)</label><input className="orça-input num" type="number" step="0.01" value={form.value} onChange={e => set("value", e.target.value)} /></div>
      </div>
      <div className="field-row-2">
        <div className="field"><label>Custo / aporte total (R$)</label><input className="orça-input num" type="number" step="0.01" value={form.costBasis} onChange={e => set("costBasis", e.target.value)} placeholder="quanto você investiu" /></div>
        <div className="field"><label>Aporte mensal (R$)</label><input className="orça-input num" type="number" step="0.01" value={form.monthlyAdd} onChange={e => set("monthlyAdd", e.target.value)} placeholder="0" /></div>
      </div>
      <div className="field"><label>Rentabilidade anual estimada (%)</label><input className="orça-input num" type="number" step="0.1" value={form.returnRate} onChange={e => set("returnRate", e.target.value)} placeholder="10.5" /></div>
      <div className="field"><label>Instituição (banco)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span className={`opt${form.institution === "" ? " sel" : ""}`} onClick={() => set("institution", "")} style={{ cursor: "pointer", fontSize: 12 }}>Nenhuma</span>
          {BANK_IDS.map(id => <span key={id} className={`opt${form.institution === id ? " sel" : ""}`} onClick={() => set("institution", id)} style={{ cursor: "pointer", padding: "6px 8px", fontSize: 12 }}><BankBadge id={id} size={16} />{BANKS[id].name}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !form.name || !form.value}
          onClick={() => onSave({
            name: form.name, type: form.type, institution: form.institution || null,
            value: parseFloat(form.value),
            costBasis: form.costBasis ? parseFloat(form.costBasis) : null,
            returnRate: form.returnRate ? parseFloat(form.returnRate) / 100 : null,
            monthlyAdd: form.monthlyAdd ? parseFloat(form.monthlyAdd) : null,
          })}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />Salvar</>}
        </button>
      </div>
    </div>
  );
}

type SortKey = "value" | "gain" | "name";

export default function InvestimentosPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editInv, setEditInv] = useState<Investment | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("value");

  const fetchInvs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investments");
      if (!res.ok) { setInvestments([]); return; }
      const data = await res.json().catch(() => []);
      setInvestments(Array.isArray(data) ? data : []);
    } catch {
      setInvestments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvs(); }, [fetchInvs]);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    try {
      if (editInv) {
        await fetch(`/api/investments/${editInv.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      } else {
        await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      }
      setEditInv(null); setShowNew(false); fetchInvs();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    await fetch(`/api/investments/${id}`, { method: "DELETE" });
    fetchInvs();
  }

  // ── Métricas ────────────────────────────────────────────────────────────────
  const total    = investments.reduce((s, i) => s + Number(i.value), 0);
  const invested = investments.reduce((s, i) => s + costOf(i), 0);
  const gain     = total - invested;
  const gainPct  = invested > 0 ? gain / invested : 0;
  const aporte   = investments.reduce((s, i) => s + Number(i.monthlyAdd ?? 0), 0);
  const wReturn  = total > 0 ? investments.reduce((s, i) => s + Number(i.returnRate ?? 0) * Number(i.value), 0) / total : 0;

  // Evolução do patrimônio (série mensal) e variação vs mês anterior
  const series = buildPortfolioSeries(investments.map(i => ({ snapshots: i.snapshots ?? [] })));
  const prevDelta = series.length >= 2 ? series[series.length - 1].value - series[series.length - 2].value : 0;

  // Alocação por classe (donut)
  const byType: Record<string, number> = {};
  investments.forEach(i => { byType[i.type] = (byType[i.type] || 0) + Number(i.value); });
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  let acc = 0;
  const stops = types.map(([k, v]) => { const s = (acc / total) * 360; acc += v; return `${investmentTypeColor(k)} ${s}deg ${(acc / total) * 360}deg`; }).join(", ");
  const totalK = total.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Totalizadores por instituição (banco) — com ganho real
  const byBankMap: Record<string, { value: number; cost: number; count: number; aporte: number }> = {};
  investments.forEach(i => {
    const key = i.institution ?? "__none__";
    const b = byBankMap[key] ?? { value: 0, cost: 0, count: 0, aporte: 0 };
    b.value += Number(i.value);
    b.cost  += costOf(i);
    b.count += 1;
    b.aporte += Number(i.monthlyAdd ?? 0);
    byBankMap[key] = b;
  });
  const byBank = Object.entries(byBankMap)
    .map(([key, v]) => ({ key, ...v, gain: v.value - v.cost, gainPct: v.cost > 0 ? (v.value - v.cost) / v.cost : 0 }))
    .sort((a, b) => b.value - a.value);

  // Carteira ordenável
  const sorted = [...investments].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "gain") return (b.value - costOf(b)) - (a.value - costOf(a));
    return Number(b.value) - Number(a.value);
  });

  return (
    <>
      <Modal open={!!editInv} onClose={() => setEditInv(null)} title="Editar investimento"><InvForm initial={editInv ?? undefined} onSave={handleSave} onCancel={() => setEditInv(null)} loading={saving} /></Modal>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Novo investimento"><InvForm onSave={handleSave} onCancel={() => setShowNew(false)} loading={saving} /></Modal>

      <div className="topbar">
        <div className="topbar-l"><div className="crumb">Carteiras</div><div className="page-title">Investimentos</div></div>
        <div className="topbar-r">
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><OrcaIcon name="plus" size={16} />Novo aporte</button>
        </div>
      </div>

      <div className="content">
        <div className="r-kpi-4" style={{ marginBottom: 18 }}>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} style={{ color: "var(--accent)" }} />Patrimônio</div>
            <div className="kpi-val num">{formatBRL(total)}</div>
            {series.length >= 2 && (
              <div className="kpi-delta num" style={{ color: prevDelta >= 0 ? "var(--pos)" : "var(--neg)" }}>{formatBRL(prevDelta, { sign: true })} vs mês anterior</div>
            )}
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="trend" size={14} style={{ color: gain >= 0 ? "var(--pos)" : "var(--neg)" }} />Ganho / Perda</div>
            <div className="kpi-val sm num" style={{ color: gain >= 0 ? "var(--pos)" : "var(--neg)" }}>{formatBRL(gain, { sign: true })}</div>
            <div className="kpi-delta num" style={{ color: gain >= 0 ? "var(--pos)" : "var(--neg)" }}>{(gainPct * 100).toFixed(1)}% sobre o custo · {(wReturn * 100).toFixed(1)}% a.a. projetado</div>
          </div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="repeat" size={14} />Aporte mensal</div><div className="kpi-val sm num">{formatBRL(aporte)}</div><div className="kpi-delta muted">custo total {formatBRL(invested)}</div></div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="coins" size={14} />Ativos</div><div className="kpi-val sm num">{investments.length}</div><div className="kpi-delta muted">{types.length} classes</div></div>
        </div>

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 80 }}><div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} /></div>
        ) : investments.length === 0 ? (
          <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 60 }}>
            <OrcaIcon name="trend" size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontWeight: 600, margin: 0 }}>Nenhum investimento cadastrado</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowNew(true)}><OrcaIcon name="plus" size={15} />Adicionar ativo</button>
          </div>
        ) : (
          <>
          {/* Totalizadores por instituição (banco) */}
          <div className="card" style={{ marginBottom: 18, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px 8px", borderBottom: "1px solid var(--line-2)" }}>
              <div className="section-label">Por instituição</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 0 }}>
              {byBank.map((b, idx) => {
                const isNone = b.key === "__none__";
                const name = isNone ? "Sem banco" : (BANKS[b.key as BankKey]?.name ?? b.key);
                const pct  = total > 0 ? Math.round((b.value / total) * 100) : 0;
                const hasGain = b.cost > 0 && Math.abs(b.gain) >= 0.01;
                return (
                  <div key={b.key} style={{ padding: "12px 16px", borderRight: (idx + 1) % 4 !== 0 ? "1px solid var(--line-2)" : "none", borderBottom: "1px solid var(--line-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      {isNone
                        ? <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-3)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><OrcaIcon name="coins" size={14} style={{ color: "var(--ink-3)" }} /></div>
                        : <BankBadge id={b.key as BankKey} size={28} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                        <div className="row-meta" style={{ fontSize: 10.5 }}>{b.count} ativo{b.count > 1 ? "s" : ""} · {pct}% do patrimônio</div>
                      </div>
                      {hasGain && (
                        <span className="chip" style={{ background: b.gain >= 0 ? "var(--pos-soft)" : "var(--neg-soft)", color: b.gain >= 0 ? "var(--pos)" : "var(--neg)", flexShrink: 0 }}><OrcaIcon name="trend" size={11} />{(b.gainPct * 100).toFixed(1)}%</span>
                      )}
                    </div>
                    <div className="bar" style={{ marginBottom: 6 }}>
                      <span style={{ width: `${pct}%`, background: "var(--accent)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700 }}>
                      <span className="num">{formatBRL(b.value)}</span>
                      {b.aporte > 0 && <span className="num muted">{formatBRL(b.aporte)}/mês</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Evolução do patrimônio */}
          {series.length >= 2 && (
            <div className="card card-pad" style={{ marginBottom: 18 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Evolução do patrimônio</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line-2)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis width={64} tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v)} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={(v: any) => [formatBRL(Number(v)), "Patrimônio"]} labelStyle={{ fontWeight: 700 }} />
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#invGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="r-grid-sidebar" style={{ gap: 16 }}>
            <div className="card card-pad">
              <div className="section-label" style={{ marginBottom: 16 }}>Alocação por classe</div>
              {total > 0 && (
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 20px" }}>
                  <div style={{ width: 168, height: 168, borderRadius: "50%", background: `conic-gradient(${stops})`, display: "grid", placeItems: "center" }}>
                    <div style={{ width: 108, height: 108, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", textAlign: "center" }}>
                      <div><div className="row-meta">Total</div><div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>R$ {totalK}</div></div>
                    </div>
                  </div>
                </div>
              )}
              {types.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--line-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: investmentTypeColor(k) }} /><span style={{ fontSize: 13, fontWeight: 700 }}>{k}</span></div>
                  <div style={{ textAlign: "right" }}><span className="num" style={{ fontWeight: 700, fontSize: 13 }}>{formatBRL(v)}</span><span className="row-meta num" style={{ marginLeft: 8 }}>{Math.round((v / total) * 100)}%</span></div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-head">
                <div className="card-title">Carteira</div>
                <div className="seg" style={{ fontSize: 12 }}>
                  <button className={sortKey === "value" ? "on" : ""} onClick={() => setSortKey("value")}>Valor</button>
                  <button className={sortKey === "gain"  ? "on" : ""} onClick={() => setSortKey("gain")}>Ganho</button>
                  <button className={sortKey === "name"  ? "on" : ""} onClick={() => setSortKey("name")}>Nome</button>
                </div>
              </div>
              {sorted.map(it => {
                const w = total > 0 ? Math.round((Number(it.value) / total) * 100) : 0;
                const g = Number(it.value) - costOf(it);
                const gPct = costOf(it) > 0 ? g / costOf(it) : 0;
                const hasGain = Math.abs(g) >= 0.01;
                return (
                  <div className="row" key={it.id} style={{ padding: "13px 20px" }}>
                    <div className="row-l">
                      {it.institution ? <BankBadge id={it.institution as BankKey} size={36} /> : <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-3)", display: "grid", placeItems: "center" }}><OrcaIcon name="coins" size={18} style={{ color: "var(--ink-3)" }} /></div>}
                      <div><div className="row-name">{it.name}</div><div className="row-meta">{it.type}{it.institution ? ` · ${BANKS[it.institution as BankKey]?.name}` : ""} · {w}% da carteira{it.monthlyAdd ? ` · aporte ${formatBRL(Number(it.monthlyAdd))}/mês` : ""}</div></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {hasGain && <span className="chip" style={{ background: g >= 0 ? "var(--pos-soft)" : "var(--neg-soft)", color: g >= 0 ? "var(--pos)" : "var(--neg)" }}><OrcaIcon name="trend" size={12} />{(gPct * 100).toFixed(1)}%</span>}
                      <div style={{ textAlign: "right", minWidth: 100 }}>
                        <div className="amt num" style={{ fontSize: 15 }}>{formatBRL(Number(it.value))}</div>
                        {hasGain && <div className="num" style={{ fontSize: 11, fontWeight: 700, color: g >= 0 ? "var(--pos)" : "var(--neg)" }}>{formatBRL(g, { sign: true })}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setEditInv(it)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, borderRadius: 6 }}><OrcaIcon name="edit" size={15} /></button>
                        <button onClick={() => handleDelete(it.id, it.name)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4, borderRadius: 6 }}><OrcaIcon name="trash" size={15} /></button>
                      </div>
                    </div>
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
