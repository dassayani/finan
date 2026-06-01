"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { BankBadge } from "@/components/ui/bank-badge";
import { Modal } from "@/components/ui/modal";
import { BANKS, formatBRL } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

interface Investment { id: string; name: string; type: string; institution: string | null; value: number; returnRate: number | null; monthlyAdd: number | null; }

const TYPE_COLORS: Record<string, string> = { "Renda Fixa": "#15543D", "FII": "#EC7000", "Ações": "#820AD1", "Cripto": "#F7931A", "Outro": "#6b7280" };
const TYPES = ["Renda Fixa", "FII", "Ações", "Cripto", "Outro"];
const BANK_IDS = Object.keys(BANKS) as BankKey[];

function InvForm({ initial, onSave, onCancel, loading }: { initial?: Partial<Investment>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; loading: boolean; }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? "Renda Fixa",
    institution: initial?.institution ?? "",
    value: initial?.value ? String(initial.value) : "",
    returnRate: initial?.returnRate ? String(Number(initial.returnRate) * 100) : "",
    monthlyAdd: initial?.monthlyAdd ? String(initial.monthlyAdd) : "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field"><label>Nome do ativo</label><input className="orça-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Tesouro Selic 2029" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Tipo</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TYPES.map(t => <span key={t} className={`opt${form.type === t ? " sel" : ""}`} onClick={() => set("type", t)} style={{ cursor: "pointer", fontSize: 12 }}>{t}</span>)}
          </div>
        </div>
        <div className="field"><label>Valor atual (R$)</label><input className="orça-input num" type="number" step="0.01" value={form.value} onChange={e => set("value", e.target.value)} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Rentabilidade anual (%)</label><input className="orça-input num" type="number" step="0.1" value={form.returnRate} onChange={e => set("returnRate", e.target.value)} placeholder="10.5" /></div>
        <div className="field"><label>Aporte mensal (R$)</label><input className="orça-input num" type="number" step="0.01" value={form.monthlyAdd} onChange={e => set("monthlyAdd", e.target.value)} placeholder="0" /></div>
      </div>
      <div className="field"><label>Instituição (banco)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span className={`opt${form.institution === "" ? " sel" : ""}`} onClick={() => set("institution", "")} style={{ cursor: "pointer", fontSize: 12 }}>Nenhuma</span>
          {BANK_IDS.map(id => <span key={id} className={`opt${form.institution === id ? " sel" : ""}`} onClick={() => set("institution", id)} style={{ cursor: "pointer", padding: "6px 8px", fontSize: 12 }}><BankBadge id={id} size={16} />{BANKS[id].name}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !form.name || !form.value}
          onClick={() => onSave({ name: form.name, type: form.type, institution: form.institution || null, value: parseFloat(form.value), returnRate: form.returnRate ? parseFloat(form.returnRate) / 100 : null, monthlyAdd: form.monthlyAdd ? parseFloat(form.monthlyAdd) : null })}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />Salvar</>}
        </button>
      </div>
    </div>
  );
}

export default function InvestimentosPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editInv, setEditInv] = useState<Investment | null>(null);
  const [showNew, setShowNew] = useState(false);

  const fetchInvs = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/investments");
    setInvestments(await res.json());
    setLoading(false);
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

  const total = investments.reduce((s, i) => s + Number(i.value), 0);
  const aporte = investments.reduce((s, i) => s + Number(i.monthlyAdd ?? 0), 0);
  const wReturn = total > 0 ? investments.reduce((s, i) => s + Number(i.returnRate ?? 0) * Number(i.value), 0) / total : 0;
  const rendimento = (total * wReturn) / 12;

  const byType: Record<string, number> = {};
  investments.forEach(i => { byType[i.type] = (byType[i.type] || 0) + Number(i.value); });
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  let acc = 0;
  const stops = types.map(([k, v]) => { const s = (acc / total) * 360; acc += v; return `${TYPE_COLORS[k] ?? "#6b7280"} ${s}deg ${(acc / total) * 360}deg`; }).join(", ");
  const totalK = total.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="wallet" size={14} style={{ color: "var(--accent)" }} />Patrimônio</div><div className="kpi-val num">{formatBRL(total)}</div></div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="trend" size={14} style={{ color: "var(--pos)" }} />Rend. no mês</div><div className="kpi-val sm num" style={{ color: "var(--pos)" }}>{formatBRL(rendimento, { sign: true })}</div><div className="kpi-delta" style={{ color: "var(--pos)" }}>{(wReturn * 100).toFixed(1)}% a.a. médio</div></div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="repeat" size={14} />Aporte mensal</div><div className="kpi-val sm num">{formatBRL(aporte)}</div></div>
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
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: TYPE_COLORS[k] ?? "#6b7280" }} /><span style={{ fontSize: 13, fontWeight: 700 }}>{k}</span></div>
                  <div style={{ textAlign: "right" }}><span className="num" style={{ fontWeight: 700, fontSize: 13 }}>{formatBRL(v)}</span><span className="row-meta num" style={{ marginLeft: 8 }}>{Math.round((v / total) * 100)}%</span></div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-head"><div className="card-title">Carteira</div><span className="chip">{investments.length} ativos</span></div>
              {investments.map(it => (
                <div className="row" key={it.id} style={{ padding: "13px 20px" }}>
                  <div className="row-l">
                    {it.institution ? <BankBadge id={it.institution as BankKey} size={36} /> : <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-3)", display: "grid", placeItems: "center" }}><OrcaIcon name="coins" size={18} style={{ color: "var(--ink-3)" }} /></div>}
                    <div><div className="row-name">{it.name}</div><div className="row-meta">{it.type}{it.institution ? ` · ${BANKS[it.institution as BankKey]?.name}` : ""}{it.monthlyAdd ? ` · aporte ${formatBRL(Number(it.monthlyAdd))}/mês` : ""}</div></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {it.returnRate && <span className="chip" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}><OrcaIcon name="trend" size={12} />{(Number(it.returnRate) * 100).toFixed(1)}%</span>}
                    <span className="amt num" style={{ minWidth: 100, textAlign: "right", fontSize: 15 }}>{formatBRL(Number(it.value))}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setEditInv(it)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, borderRadius: 6 }}><OrcaIcon name="edit" size={15} /></button>
                      <button onClick={() => handleDelete(it.id, it.name)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4, borderRadius: 6 }}><OrcaIcon name="dots" size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
