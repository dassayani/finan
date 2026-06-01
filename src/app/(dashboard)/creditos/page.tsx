"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { Modal } from "@/components/ui/modal";
import { CATEGORIES, formatBRL } from "@/lib/constants";
import type { CategoryKey } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SalaryItem {
  id?: string;
  name: string;
  amount: number;
  type: "PROVENTO" | "DESCONTO";
  order?: number;
}

interface Salary {
  id: string;
  month: number;
  year: number;
  baseAmount: number;
  netAmount: number;
  payDay: number | null;
  notes: string | null;
  items: SalaryItem[];
}

interface SalaryResponse {
  template: Salary | null;
  monthSalary: Salary | null;
  effective: Salary | null;
  source: "month" | "prev" | "template" | null;
}

interface Credit {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  date: string;
  notes: string | null;
}

// ─── Salary Form ─────────────────────────────────────────────────────────────

const DEFAULT_PROVENTOS: SalaryItem[] = [
  { name: "Salário base", amount: 0, type: "PROVENTO" },
  { name: "Horas extras", amount: 0, type: "PROVENTO" },
  { name: "PLR / Participação", amount: 0, type: "PROVENTO" },
  { name: "Férias (1/3 constitucional)", amount: 0, type: "PROVENTO" },
  { name: "13º Salário", amount: 0, type: "PROVENTO" },
];

const DEFAULT_DESCONTOS: SalaryItem[] = [
  { name: "INSS", amount: 0, type: "DESCONTO" },
  { name: "IRRF", amount: 0, type: "DESCONTO" },
  { name: "Plano de Saúde", amount: 0, type: "DESCONTO" },
  { name: "Plano Dental", amount: 0, type: "DESCONTO" },
  { name: "Vale Transporte", amount: 0, type: "DESCONTO" },
];

function SalaryForm({
  initial,
  month,
  year,
  isTemplate,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Salary | null;
  month: number;
  year: number;
  isTemplate: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const initItems = initial?.items ?? [];
  const [proventos, setProventos] = useState<SalaryItem[]>(
    initItems.filter(i => i.type === "PROVENTO").length > 0
      ? initItems.filter(i => i.type === "PROVENTO")
      : DEFAULT_PROVENTOS
  );
  const [descontos, setDescontos] = useState<SalaryItem[]>(
    initItems.filter(i => i.type === "DESCONTO").length > 0
      ? initItems.filter(i => i.type === "DESCONTO")
      : DEFAULT_DESCONTOS
  );
  const [payDay, setPayDay] = useState(initial?.payDay ? String(initial.payDay) : "5");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const totalP = proventos.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const totalD = descontos.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const liquido = totalP - totalD;

  function setItem(list: SalaryItem[], setList: (l: SalaryItem[]) => void, idx: number, field: "name" | "amount", value: string) {
    setList(list.map((it, i) => i === idx ? { ...it, [field]: field === "amount" ? value : value } : it));
  }

  function addItem(type: "PROVENTO" | "DESCONTO") {
    const item: SalaryItem = { name: "", amount: 0, type };
    if (type === "PROVENTO") setProventos(p => [...p, item]);
    else setDescontos(d => [...d, item]);
  }

  function removeItem(type: "PROVENTO" | "DESCONTO", idx: number) {
    if (type === "PROVENTO") setProventos(p => p.filter((_, i) => i !== idx));
    else setDescontos(d => d.filter((_, i) => i !== idx));
  }

  function handleSave() {
    const items = [
      ...proventos.map((it, i) => ({ ...it, amount: Number(it.amount) || 0, order: i })),
      ...descontos.map((it, i) => ({ ...it, amount: Number(it.amount) || 0, order: i })),
    ];
    onSave({
      month: isTemplate ? 0 : month,
      year: isTemplate ? 0 : year,
      baseAmount: proventos[0]?.amount ? Number(proventos[0].amount) : totalP,
      netAmount: liquido,
      payDay: payDay ? Number(payDay) : null,
      notes: notes || null,
      items,
    });
  }

  const rowStyle = { display: "grid", gridTemplateColumns: "1fr 110px 28px", alignItems: "center", gap: 8, marginBottom: 6 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {isTemplate && (
        <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: "var(--r-md)", padding: "10px 14px", marginBottom: 18, fontSize: 12.5, color: "var(--accent)", fontWeight: 600, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <OrcaIcon name="repeat" size={15} style={{ flex: "0 0 auto", marginTop: 1 }} />
          <span>Este é o <b>modelo base</b>. Meses sem alteração herdarão esses valores automaticamente.</span>
        </div>
      )}

      {/* Proventos */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pos)" }}>Proventos</span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => addItem("PROVENTO")}>
            <OrcaIcon name="plus" size={12} />Adicionar
          </button>
        </div>
        {proventos.map((it, i) => (
          <div key={i} style={rowStyle}>
            <input className="orça-input" style={{ fontSize: 13 }} value={it.name}
              onChange={e => setItem(proventos, setProventos, i, "name", e.target.value)} placeholder="Ex: Salário base" />
            <input className="orça-input num" style={{ fontSize: 13, textAlign: "right" }} type="number" step="0.01"
              value={it.amount || ""} placeholder="0,00"
              onChange={e => setItem(proventos, setProventos, i, "amount", e.target.value)} />
            <button onClick={() => removeItem("PROVENTO", i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 2 }}>
              <OrcaIcon name="dots" size={14} />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "1px solid var(--line-2)", marginTop: 6, fontSize: 13, fontWeight: 700 }}>
          <span>Total proventos</span>
          <span className="num" style={{ color: "var(--pos)" }}>{formatBRL(totalP)}</span>
        </div>
      </div>

      {/* Descontos */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--neg)" }}>Descontos</span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => addItem("DESCONTO")}>
            <OrcaIcon name="plus" size={12} />Adicionar
          </button>
        </div>
        {descontos.map((it, i) => (
          <div key={i} style={rowStyle}>
            <input className="orça-input" style={{ fontSize: 13 }} value={it.name}
              onChange={e => setItem(descontos, setDescontos, i, "name", e.target.value)} placeholder="Ex: INSS" />
            <input className="orça-input num" style={{ fontSize: 13, textAlign: "right" }} type="number" step="0.01"
              value={it.amount || ""} placeholder="0,00"
              onChange={e => setItem(descontos, setDescontos, i, "amount", e.target.value)} />
            <button onClick={() => removeItem("DESCONTO", i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 2 }}>
              <OrcaIcon name="dots" size={14} />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "1px solid var(--line-2)", marginTop: 6, fontSize: 13, fontWeight: 700 }}>
          <span>Total descontos</span>
          <span className="num" style={{ color: "var(--neg)" }}>{formatBRL(totalD)}</span>
        </div>
      </div>

      {/* Líquido */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "var(--pos-soft)", borderRadius: "var(--r-md)", marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Líquido recebido</span>
        <span className="num" style={{ fontWeight: 800, fontSize: 18, color: "var(--pos)" }}>{formatBRL(liquido)}</span>
      </div>

      {/* Extras */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="field">
          <label>Dia de pagamento</label>
          <input className="orça-input num" type="number" min="1" max="31" value={payDay} onChange={e => setPayDay(e.target.value)} placeholder="5" />
        </div>
        <div className="field">
          <label>Observações do mês</label>
          <input className="orça-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Inclui PLR de março" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading} onClick={handleSave}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />{isTemplate ? "Salvar modelo base" : "Salvar este mês"}</>}
        </button>
      </div>
    </div>
  );
}

// ─── Holerite display ─────────────────────────────────────────────────────────

function Holerite({
  salary,
  source,
  month,
  year,
  onEditMonth,
  onEditTemplate,
  onResetMonth,
  onConfirmMonth,
}: {
  salary: Salary;
  source: "month" | "prev" | "template" | null;
  month: number;
  year: number;
  onEditMonth: () => void;
  onEditTemplate: () => void;
  onResetMonth: () => void;
  onConfirmMonth: () => void;
}) {
  const proventos = salary.items.filter(i => i.type === "PROVENTO");
  const descontos = salary.items.filter(i => i.type === "DESCONTO");
  const totalP = proventos.reduce((a, i) => a + Number(i.amount), 0);
  const totalD = descontos.reduce((a, i) => a + Number(i.amount), 0);

  const sourceLabel = source === "month" ? null
    : source === "prev" ? "Herdado do mês anterior"
    : "Usando modelo base";

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: .75 }}>Salário CLT</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
            {new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}
          </div>
          {salary.payDay && <div style={{ fontSize: 11.5, opacity: .8, marginTop: 2 }}>Cai todo dia {salary.payDay}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: .75 }}>Líquido</div>
          <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24 }}>{formatBRL(Number(salary.netAmount))}</div>
        </div>
      </div>

      {/* Source banner */}
      {sourceLabel && (
        <div style={{ padding: "10px 20px", background: "var(--warn-soft)", borderBottom: "1px solid var(--line-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <OrcaIcon name="repeat" size={13} style={{ color: "var(--warn)", flex: "0 0 auto" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>{sourceLabel}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12, flex: 1 }} onClick={onConfirmMonth}>
              <OrcaIcon name="check" size={13} />Confirmar salário deste mês
            </button>
            <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={onEditMonth}>
              <OrcaIcon name="edit" size={12} />Editar antes
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      <div style={{ padding: "4px 0" }}>
        <div className="section-label" style={{ padding: "10px 20px 4px", color: "var(--pos)" }}>Proventos</div>
        {proventos.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 20px", fontSize: 13 }}>
            <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{it.name}</span>
            <span className="num" style={{ fontWeight: 700, color: Number(it.amount) > 0 ? "var(--pos)" : "var(--ink-3)" }}>
              {Number(it.amount) > 0 ? formatBRL(Number(it.amount)) : "—"}
            </span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 20px 10px", fontSize: 13, fontWeight: 800, borderBottom: "1px solid var(--line-2)" }}>
          <span>Total proventos</span>
          <span className="num" style={{ color: "var(--pos)" }}>{formatBRL(totalP)}</span>
        </div>

        <div className="section-label" style={{ padding: "10px 20px 4px", color: "var(--neg)" }}>Descontos</div>
        {descontos.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 20px", fontSize: 13 }}>
            <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{it.name}</span>
            <span className="num" style={{ fontWeight: 700, color: Number(it.amount) > 0 ? "var(--neg)" : "var(--ink-3)" }}>
              {Number(it.amount) > 0 ? formatBRL(-Number(it.amount)) : "—"}
            </span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 20px 10px", fontSize: 13, fontWeight: 800, borderBottom: "1px solid var(--line-2)" }}>
          <span>Total descontos</span>
          <span className="num" style={{ color: "var(--neg)" }}>{formatBRL(-totalD)}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "var(--pos-soft)" }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Líquido recebido</span>
        <span className="num" style={{ fontWeight: 800, fontSize: 20, color: "var(--pos)" }}>{formatBRL(Number(salary.netAmount))}</span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--line-2)" }}>
        {source === "month" && (
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", color: "var(--neg)" }} onClick={onResetMonth}>
            <OrcaIcon name="dots" size={13} />Remover override deste mês
          </button>
        )}
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", flex: 1 }} onClick={onEditMonth}>
          <OrcaIcon name="edit" size={13} />Editar este mês
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", flex: 1 }} onClick={onEditTemplate}>
          <OrcaIcon name="repeat" size={13} />Editar modelo base
        </button>
      </div>
    </div>
  );
}

// ─── Other Credits Form ───────────────────────────────────────────────────────

function CreditForm({ initial, onSave, onCancel, loading }: { initial?: Partial<Credit>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; loading: boolean; }) {
  const [form, setForm] = useState({
    description: initial?.description ?? "",
    amount: initial?.amount ? String(initial.amount) : "",
    category: initial?.category ?? "reemb",
    date: initial?.date ? new Date(initial.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    notes: initial?.notes ?? "",
    isRecurring: false,
    endDate: "",
  });
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    const base = {
      description: form.description,
      amount: parseFloat(form.amount),
      type: "INCOME",
      category: form.category || null,
      notes: form.notes || null,
      isPaid: true,
      isRecurring: form.isRecurring,
      endDate: form.isRecurring && form.endDate ? form.endDate : null,
      date: form.date,
    };
    onSave(base);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field"><label>Descrição</label><input className="orça-input" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Reembolso, aluguel, bônus..." /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Valor (R$)</label><input className="orça-input num" type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} /></div>
        <div className="field"><label>Data de início</label><input className="orça-input" type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
      </div>

      {/* Recorrência */}
      <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: form.isRecurring ? 12 : 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Crédito recorrente</div>
            <div className="row-meta">Lança automaticamente todo mês até a data final</div>
          </div>
          <span
            className={`switch${form.isRecurring ? " on" : ""}`}
            onClick={() => set("isRecurring", !form.isRecurring)}
            style={{ cursor: "pointer" }}
          />
        </div>
        {form.isRecurring && (
          <div className="field">
            <label>Data final (vencimento)</label>
            <input className="orça-input" type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} />
            <span className="row-meta">Deixe em branco para recorrência indefinida</span>
          </div>
        )}
      </div>

      <div className="field"><label>Categoria</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
            <span key={k} className={`opt${form.category === k ? " sel" : ""}`} onClick={() => set("category", k)} style={{ cursor: "pointer", fontSize: 12, padding: "5px 9px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />{c.label}
            </span>
          ))}
        </div>
      </div>
      <div className="field"><label>Observações</label><input className="orça-input" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Opcional..." /></div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !form.description || !form.amount} onClick={handleSave}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />{form.isRecurring ? "Salvar recorrência" : "Salvar"}</>}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreditosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Salary state
  const [salaryData, setSalaryData] = useState<SalaryResponse | null>(null);
  const [showSalaryMonth, setShowSalaryMonth] = useState(false);
  const [showSalaryTemplate, setShowSalaryTemplate] = useState(false);
  const [savingSalary, setSavingSalary] = useState(false);

  // Credits state
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [editCredit, setEditCredit] = useState<Credit | null>(null);
  const [showNewCredit, setShowNewCredit] = useState(false);
  const [savingCredit, setSavingCredit] = useState(false);

  const fetchSalary = useCallback(async () => {
    const res = await fetch(`/api/salary?month=${month}&year=${year}`);
    setSalaryData(await res.json());
  }, [month, year]);

  const fetchCredits = useCallback(async () => {
    setLoadingCredits(true);
    const res = await fetch(`/api/credits?month=${month}&year=${year}`);
    setCredits(await res.json());
    setLoadingCredits(false);
  }, [month, year]);

  useEffect(() => {
    fetchSalary();
    fetchCredits();
  }, [fetchSalary, fetchCredits]);

  async function handleSaveSalary(data: Record<string, unknown>) {
    setSavingSalary(true);
    try {
      await fetch("/api/salary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setShowSalaryMonth(false);
      setShowSalaryTemplate(false);
      fetchSalary();
    } finally { setSavingSalary(false); }
  }

  async function handleResetMonth() {
    if (!salaryData?.monthSalary) return;
    if (!confirm("Remover a edição deste mês? Ele voltará a herdar do mês anterior ou modelo base.")) return;
    await fetch(`/api/salary/${salaryData.monthSalary.id}`, { method: "DELETE" });
    fetchSalary();
  }

  // Confirms the inherited salary for the current month, creating the INCOME transaction
  async function handleConfirmMonth() {
    const effective = salaryData?.effective;
    if (!effective) return;
    await handleSaveSalary({
      month,
      year,
      baseAmount: Number(effective.baseAmount),
      netAmount: Number(effective.netAmount),
      payDay: effective.payDay,
      notes: effective.notes,
      items: effective.items.map((it, i) => ({ name: it.name, amount: Number(it.amount), type: it.type, order: i })),
    });
    fetchCredits();
  }

  async function handleSaveCredit(data: Record<string, unknown>) {
    setSavingCredit(true);
    try {
      if (editCredit) {
        await fetch(`/api/transactions/${editCredit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: data.description, amount: data.amount, category: data.category, date: data.date, notes: data.notes }),
        });
      } else if (data.isRecurring) {
        // Create one transaction per month from startDate to endDate
        const startDate = new Date(data.date as string);
        const endDate = data.endDate ? new Date(data.endDate as string) : new Date(startDate.getFullYear(), startDate.getMonth() + 23, startDate.getDate());
        const groupId = `recur-${Date.now()}`;

        const dates: Date[] = [];
        let d = new Date(startDate);
        while (d <= endDate) {
          dates.push(new Date(d));
          d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
        }

        await Promise.all(dates.map((dt, i) =>
          fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: data.description,
              amount: data.amount,
              type: "INCOME",
              category: data.category,
              date: dt.toISOString().split("T")[0],
              notes: data.notes,
              isPaid: i === 0,
              groupId,
            }),
          })
        ));
      } else {
        await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, isRecurring: undefined, endDate: undefined }),
        });
      }
      setEditCredit(null); setShowNewCredit(false); fetchCredits();
    } finally { setSavingCredit(false); }
  }

  async function handleDeleteCredit(id: string, desc: string) {
    if (!confirm(`Excluir "${desc}"?`)) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchCredits();
  }

  const salaryNet = salaryData?.effective ? Number(salaryData.effective.netAmount) : 0;
  const othersTotal = credits.reduce((a, c) => a + Number(c.amount), 0);
  const grandTotal = salaryNet + othersTotal;

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <>
      {/* Salary modals */}
      <Modal open={showSalaryMonth} onClose={() => setShowSalaryMonth(false)} title={`Editar salário — ${monthCap}`} width={580}>
        <SalaryForm
          initial={salaryData?.monthSalary ?? salaryData?.effective}
          month={month} year={year} isTemplate={false}
          onSave={handleSaveSalary} onCancel={() => setShowSalaryMonth(false)} loading={savingSalary}
        />
      </Modal>
      <Modal open={showSalaryTemplate} onClose={() => setShowSalaryTemplate(false)} title="Editar modelo base de salário" width={580}>
        <SalaryForm
          initial={salaryData?.template}
          month={0} year={0} isTemplate={true}
          onSave={handleSaveSalary} onCancel={() => setShowSalaryTemplate(false)} loading={savingSalary}
        />
      </Modal>

      {/* Credit modals */}
      <Modal open={!!editCredit} onClose={() => setEditCredit(null)} title="Editar crédito">
        {editCredit && <CreditForm initial={editCredit} onSave={handleSaveCredit} onCancel={() => setEditCredit(null)} loading={savingCredit} />}
      </Modal>
      <Modal open={showNewCredit} onClose={() => setShowNewCredit(false)} title="Novo crédito / receita">
        <CreditForm onSave={handleSaveCredit} onCancel={() => setShowNewCredit(false)} loading={savingCredit} />
      </Modal>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Lançamentos · Créditos</div>
          <div className="page-title">Créditos</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary" onClick={() => setShowNewCredit(true)}>
            <OrcaIcon name="plus" size={16} />Outro crédito
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowDown" size={14} style={{ color: "var(--pos)" }} />Total de entradas</div>
            <div className="kpi-val num" style={{ color: "var(--pos)" }}>{formatBRL(grandTotal)}</div>
            <div className="kpi-delta" style={{ color: "var(--pos)" }}>salário + {credits.length} outros</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} />Salário líquido</div>
            <div className="kpi-val num">{salaryData?.effective ? formatBRL(salaryNet) : "—"}</div>
            {salaryData?.effective?.payDay && <div className="kpi-delta muted">CLT · cai dia {salaryData.effective.payDay}</div>}
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="coins" size={14} />Outros recebimentos</div>
            <div className="kpi-val num">{formatBRL(othersTotal)}</div>
            <div className="kpi-delta muted">{credits.length} lançamentos</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16, alignItems: "start" }}>
          {/* Holerite */}
          {salaryData?.effective ? (
            <Holerite
              salary={salaryData.effective}
              source={salaryData.source}
              month={month} year={year}
              onEditMonth={() => setShowSalaryMonth(true)}
              onEditTemplate={() => setShowSalaryTemplate(true)}
              onResetMonth={handleResetMonth}
              onConfirmMonth={handleConfirmMonth}
            />
          ) : (
            <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 48 }}>
              <OrcaIcon name="wallet" size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Holerite não configurado</p>
              <p style={{ fontSize: 13, margin: "0 0 16px" }}>Configure o modelo base uma vez e ele se repete todo mês</p>
              <button className="btn btn-primary" style={{ margin: "0 auto" }} onClick={() => setShowSalaryTemplate(true)}>
                <OrcaIcon name="plus" size={15} />Configurar salário base
              </button>
            </div>
          )}

          {/* Outros recebimentos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div className="card-head">
                <div className="card-title"><span className="dot" style={{ background: "var(--accent)" }} />Outros recebimentos</div>
                <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setShowNewCredit(true)}>
                  <OrcaIcon name="plus" size={14} />Adicionar
                </button>
              </div>

              {loadingCredits ? (
                <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                </div>
              ) : credits.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "32px 20px", fontSize: 13 }}>
                  Nenhum outro recebimento neste mês
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="amt pos num">{formatBRL(Number(c.amount), { sign: true })}</span>
                        <button onClick={() => setEditCredit(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, borderRadius: 6 }}><OrcaIcon name="edit" size={14} /></button>
                        <button onClick={() => handleDeleteCredit(c.id, c.description)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4, borderRadius: 6 }}><OrcaIcon name="dots" size={14} /></button>
                      </div>
                    </div>
                  );
                })
              )}

              {credits.length > 0 && (
                <div className="row" style={{ background: "var(--pos-soft)", borderRadius: "0 0 var(--r-lg) var(--r-lg)" }}>
                  <span style={{ fontWeight: 800 }}>Total outros</span>
                  <span className="amt pos num" style={{ fontSize: 16 }}>{formatBRL(othersTotal)}</span>
                </div>
              )}
            </div>

            {/* Nota sobre herança */}
            {salaryData?.effective && salaryData.source !== "month" && (
              <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "var(--accent-soft)", borderRadius: "var(--r-md)", border: "1px solid var(--accent-soft)" }}>
                <OrcaIcon name="repeat" size={16} style={{ color: "var(--accent)", flex: "0 0 auto", marginTop: 1 }} />
                <div style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600, lineHeight: 1.5 }}>
                  O holerite exibido é {salaryData.source === "prev" ? "do mês anterior" : "do modelo base"}.
                  Se houve alteração neste mês (férias, PLR, mudança de plano), clique em{" "}
                  <b>"Editar este mês"</b> para registrar.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
