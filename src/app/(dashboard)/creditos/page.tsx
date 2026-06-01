"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { Modal } from "@/components/ui/modal";
import { CATEGORIES, formatBRL } from "@/lib/constants";
import type { CategoryKey } from "@/lib/constants";

interface Credit { id: string; description: string; amount: number; category: string | null; date: string; notes: string | null; }

function CreditForm({ initial, onSave, onCancel, loading }: { initial?: Partial<Credit>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; loading: boolean; }) {
  const [form, setForm] = useState({
    description: initial?.description ?? "",
    amount: initial?.amount ? String(initial.amount) : "",
    category: initial?.category ?? "trab",
    date: initial?.date ? new Date(initial.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    notes: initial?.notes ?? "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field"><label>Descrição</label><input className="orça-input" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Salário, reembolso..." /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Valor (R$)</label><input className="orça-input num" type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} /></div>
        <div className="field"><label>Data</label><input className="orça-input" type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
      </div>
      <div className="field"><label>Categoria</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
            <span key={k} className={`opt${form.category === k ? " sel" : ""}`} onClick={() => set("category", k)} style={{ cursor: "pointer", fontSize: 12, padding: "6px 10px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />{c.label}
            </span>
          ))}
        </div>
      </div>
      <div className="field"><label>Observações</label><input className="orça-input" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Opcional..." /></div>
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !form.description || !form.amount}
          onClick={() => onSave({ description: form.description, amount: parseFloat(form.amount), type: "INCOME", category: form.category || null, date: form.date, notes: form.notes || null, isPaid: true })}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />Salvar</>}
        </button>
      </div>
    </div>
  );
}

export default function CreditosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editCredit, setEditCredit] = useState<Credit | null>(null);
  const [showNew, setShowNew] = useState(false);

  const fetchCredits = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/credits?month=${month}&year=${year}`);
    setCredits(await res.json());
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    try {
      if (editCredit) {
        await fetch(`/api/transactions/${editCredit.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      } else {
        await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      }
      setEditCredit(null); setShowNew(false); fetchCredits();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, desc: string) {
    if (!confirm(`Excluir "${desc}"?`)) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchCredits();
  }

  const total = credits.reduce((a, c) => a + Number(c.amount), 0);

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <>
      <Modal open={!!editCredit} onClose={() => setEditCredit(null)} title="Editar crédito">
        {editCredit && <CreditForm initial={editCredit} onSave={handleSave} onCancel={() => setEditCredit(null)} loading={saving} />}
      </Modal>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Novo crédito / receita">
        <CreditForm onSave={handleSave} onCancel={() => setShowNew(false)} loading={saving} />
      </Modal>

      <div className="topbar">
        <div className="topbar-l"><div className="crumb">Lançamentos · Créditos</div><div className="page-title">Créditos</div></div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><OrcaIcon name="plus" size={16} />Lançar crédito</button>
        </div>
      </div>

      <div className="content">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="arrowDown" size={14} style={{ color: "var(--pos)" }} />Total de entradas</div><div className="kpi-val num" style={{ color: "var(--pos)" }}>{formatBRL(total)}</div><div className="kpi-delta" style={{ color: "var(--pos)" }}>em {credits.length} lançamentos</div></div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="wallet" size={14} />Mês</div><div className="kpi-val num">{monthCap}</div></div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="coins" size={14} />Fontes</div><div className="kpi-val sm num">{credits.length}</div><div className="kpi-delta muted">recebimentos</div></div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><span className="dot" style={{ background: "var(--pos)" }} />Receitas de {monthCap}</div>
            <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setShowNew(true)}><OrcaIcon name="plus" size={14} />Adicionar</button>
          </div>

          {loading ? (
            <div style={{ display: "grid", placeItems: "center", padding: 60 }}><div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} /></div>
          ) : credits.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--ink-3)", padding: 60 }}>
              <OrcaIcon name="arrowDown" size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontWeight: 600, margin: 0 }}>Nenhum crédito neste mês</p>
            </div>
          ) : (
            credits.map(c => {
              const cat = c.category ? CATEGORIES[c.category as CategoryKey] : null;
              return (
                <div className="row" key={c.id}>
                  <div className="row-l">
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: cat?.color ?? "var(--pos)", flex: "0 0 auto" }} />
                    <div>
                      <div className="row-name">{c.description}</div>
                      <div className="row-meta">{cat?.label ?? "Receita"} · {new Date(c.date).toLocaleDateString("pt-BR")}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="amt pos num">{formatBRL(Number(c.amount), { sign: true })}</span>
                    <button onClick={() => setEditCredit(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, borderRadius: 6 }}><OrcaIcon name="edit" size={15} /></button>
                    <button onClick={() => handleDelete(c.id, c.description)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4, borderRadius: 6 }}><OrcaIcon name="dots" size={15} /></button>
                  </div>
                </div>
              );
            })
          )}

          {!loading && credits.length > 0 && (
            <div className="row" style={{ background: "var(--pos-soft)", borderRadius: "0 0 var(--r-lg) var(--r-lg)" }}>
              <span style={{ fontWeight: 800 }}>Total recebido</span>
              <span className="amt pos num" style={{ fontSize: 17 }}>{formatBRL(total)}</span>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
