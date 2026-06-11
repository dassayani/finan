"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { Modal } from "@/components/ui/modal";
import { PayToggle } from "@/components/ui/pay-toggle";
import { BANKS, CATEGORIES, categoriesFor, formatBRL } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";

// ─── Date helpers (local timezone, avoiding UTC day-shift) ───────────────────

function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  salaryBank: string | null;
  salaryCustomBankId: string | null;
  salaryBankSinceMonth: number | null;
  salaryBankSinceYear: number | null;
  items: SalaryItem[];
}

interface CustomBank {
  id: string;
  name: string;
}

interface SalaryBankEntry {
  id: string;
  bank: string | null;
  customBankId: string | null;
  isPaid: boolean;
}

interface SalaryResponse {
  template: Salary | null;
  monthSalary: Salary | null;
  effective: Salary | null;
  source: "month" | "prev" | "template" | null;
  bankEntry: SalaryBankEntry | null;
}

interface Credit {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  bank: string | null;
  date: string;
  notes: string | null;
  groupId: string | null;
  isPaid: boolean;
}

interface BonusEntry {
  id: string;
  month: number;
  year: number;
  baseAmount: number;
  netAmount: number;
  notes: string | null;
  salaryBank: string | null;
  salaryCustomBankId: string | null;
  items: SalaryItem[];
}

const BONUS_DEFAULTS = {
  plr: {
    label: "PLR",
    proventos: [{ name: "Participação resultados", amount: 0, type: "PROVENTO" as const }],
    descontos: [{ name: "Taxa negociável - PLR", amount: 0, type: "DESCONTO" as const }],
  },
  decimo: {
    label: "Décimo Terceiro",
    proventos: [{ name: "Parcela do Décimo", amount: 0, type: "PROVENTO" as const }],
    descontos: [
      { name: "INSS", amount: 0, type: "DESCONTO" as const },
      { name: "IRRF", amount: 0, type: "DESCONTO" as const },
      { name: "Desconto adiantamento da parcela", amount: 0, type: "DESCONTO" as const },
    ],
  },
} as const;

type BonusType = keyof typeof BONUS_DEFAULTS;

// ─── Salary Form ─────────────────────────────────────────────────────────────

const DEFAULT_PROVENTOS: SalaryItem[] = [
  { name: "Salário base", amount: 0, type: "PROVENTO" },
  { name: "Horas extras", amount: 0, type: "PROVENTO" },
];

const DEFAULT_DESCONTOS: SalaryItem[] = [
  { name: "INSS", amount: 0, type: "DESCONTO" },
  { name: "IRRF", amount: 0, type: "DESCONTO" },
  { name: "Plano de Saúde", amount: 0, type: "DESCONTO" },
  { name: "Plano Dental", amount: 0, type: "DESCONTO" },
  { name: "Vale Transporte", amount: 0, type: "DESCONTO" },
];


// When editing the template, align saved items with the current defaults:
// preserve amounts for matching names, drop removed items, add new items at 0.
function mergeWithDefaults(saved: SalaryItem[], defaults: SalaryItem[]): SalaryItem[] {
  return defaults.map(def => {
    const existing = saved.find(s => s.name === def.name);
    return existing ? { ...existing } : { ...def };
  });
}

const BANK_IDS = Object.keys(BANKS) as BankKey[];

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const BANK_YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

function SalaryForm({
  initial,
  bankEntry,
  month,
  year,
  isTemplate,
  onSave,
  onCancel,
  loading,
  customBanks = [],
}: {
  initial?: Salary | null;
  bankEntry?: SalaryBankEntry | null;
  month: number;
  year: number;
  isTemplate: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
  customBanks?: CustomBank[];
}) {
  const initItems = initial?.items ?? [];
  const savedP = initItems.filter(i => i.type === "PROVENTO");
  const savedD = initItems.filter(i => i.type === "DESCONTO");

  // Bank: for template use Salary.salaryBank; for month use BankEntry bank (month-specific)
  const initBankValue = isTemplate
    ? (initial?.salaryCustomBankId ? `cst:${initial.salaryCustomBankId}` : initial?.salaryBank ? `std:${initial.salaryBank}` : "")
    : (bankEntry?.customBankId ? `cst:${bankEntry.customBankId}` : bankEntry?.bank ? `std:${bankEntry.bank}` : "");

  // Since date (template only) — from which month the bank is effective
  const initSinceMonth = String(initial?.salaryBankSinceMonth ?? month);
  const initSinceYear  = String(initial?.salaryBankSinceYear  ?? year);

  const [proventos, setProventos] = useState<SalaryItem[]>(
    savedP.length === 0 ? DEFAULT_PROVENTOS
      : isTemplate ? mergeWithDefaults(savedP, DEFAULT_PROVENTOS)
      : savedP
  );
  const [descontos, setDescontos] = useState<SalaryItem[]>(
    savedD.length === 0 ? DEFAULT_DESCONTOS
      : isTemplate ? mergeWithDefaults(savedD, DEFAULT_DESCONTOS)
      : savedD
  );
  const [payDay, setPayDay] = useState(initial?.payDay ? String(initial.payDay) : "5");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [salaryBankValue, setSalaryBankValue] = useState(initBankValue);
  const [sinceMonth, setSinceMonth] = useState(initSinceMonth);
  const [sinceYear, setSinceYear] = useState(initSinceYear);

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
    const salaryBank = salaryBankValue.startsWith("std:") ? salaryBankValue.slice(4) : null;
    const salaryCustomBankId = salaryBankValue.startsWith("cst:") ? salaryBankValue.slice(4) : null;
    onSave({
      month: isTemplate ? 0 : month,
      year: isTemplate ? 0 : year,
      baseAmount: proventos[0]?.amount ? Number(proventos[0].amount) : totalP,
      netAmount: liquido,
      payDay: payDay ? Number(payDay) : null,
      notes: notes || null,
      salaryBank,
      salaryCustomBankId,
      ...(isTemplate && salaryBankValue ? {
        salaryBankSinceMonth: Number(sinceMonth) || null,
        salaryBankSinceYear: Number(sinceYear) || null,
      } : {}),
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
              <OrcaIcon name="trash" size={14} />
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
              <OrcaIcon name="trash" size={14} />
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
      <div className="field-row-2" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Dia de pagamento</label>
          <input className="orça-input num" type="number" min="1" max="31" value={payDay} onChange={e => setPayDay(e.target.value)} placeholder="5" />
        </div>
        <div className="field">
          <label>Observações do mês</label>
          <input className="orça-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Inclui PLR de março" />
        </div>
      </div>

      {/* Banco de recebimento — template: com data de início; mês: override pontual */}
      <div className="field" style={{ marginBottom: salaryBankValue ? 8 : 16 }}>
        <label>{isTemplate ? "Banco de recebimento padrão" : "Banco de recebimento (este mês)"}</label>
        <select className="orça-input" value={salaryBankValue} onChange={e => setSalaryBankValue(e.target.value)}>
          <option value="">{isTemplate ? "Sem banco configurado" : "Sem banco (não lançar no extrato)"}</option>
          {BANK_IDS.map(k => <option key={k} value={`std:${k}`}>{BANKS[k].name}</option>)}
          {customBanks.length > 0 && (
            <optgroup label="Bancos personalizados">
              {customBanks.map(cb => <option key={cb.id} value={`cst:${cb.id}`}>{cb.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      {isTemplate && salaryBankValue && (
        <div className="field-row-2" style={{ marginBottom: 16 }}>
          <div className="field">
            <label style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Recebimento neste banco desde</label>
            <select className="orça-input" value={sinceMonth} onChange={e => setSinceMonth(e.target.value)}>
              {MONTH_NAMES.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Ano</label>
            <select className="orça-input" value={sinceYear} onChange={e => setSinceYear(e.target.value)}>
              {BANK_YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading} onClick={handleSave}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />{isTemplate ? "Salvar modelo base" : "Salvar este mês"}</>}
        </button>
      </div>
    </div>
  );
}

// ─── Bonus Form ──────────────────────────────────────────────────────────────

function BonusForm({ bonusType: initialType, year, month, initial, onSave, onCancel, loading, customBanks = [] }: {
  bonusType: BonusType | null;
  year: number;
  month: number;
  initial?: BonusEntry | null;
  onSave: (d: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
  customBanks?: CustomBank[];
}) {
  const [bonusType, setBonusType] = useState<BonusType>(initialType ?? "plr");
  const isEditing = !!initial;

  const defaults = BONUS_DEFAULTS[bonusType];
  const initItems = initial?.items ?? [];
  const savedP = initItems.filter(i => i.type === "PROVENTO");
  const savedD = initItems.filter(i => i.type === "DESCONTO");

  const initBankValue = initial?.salaryCustomBankId
    ? `cst:${initial.salaryCustomBankId}`
    : initial?.salaryBank ? `std:${initial.salaryBank}` : "";

  const [proventos, setProventos] = useState<SalaryItem[]>(savedP.length > 0 ? savedP : defaults.proventos.map(i => ({ ...i })));
  const [descontos, setDescontos] = useState<SalaryItem[]>(savedD.length > 0 ? savedD : defaults.descontos.map(i => ({ ...i })));
  const [payDate, setPayDate]     = useState(`${year}-${String(month).padStart(2, "0")}-01`);
  const [notes, setNotes]         = useState(initial?.notes ?? "");
  const [bankValue, setBankValue] = useState(initBankValue);

  function handleTypeChange(t: BonusType) {
    if (isEditing) return;
    setBonusType(t);
    setProventos(BONUS_DEFAULTS[t].proventos.map(i => ({ ...i })));
    setDescontos(BONUS_DEFAULTS[t].descontos.map(i => ({ ...i })));
  }

  function setItem(list: SalaryItem[], setList: (l: SalaryItem[]) => void, idx: number, field: "name" | "amount", value: string) {
    setList(list.map((it, i) => i === idx ? { ...it, [field]: field === "amount" ? Number(value) || 0 : value } : it));
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

  const totalP  = proventos.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const totalD  = descontos.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const liquido = totalP - totalD;
  const rowStyle = { display: "grid", gridTemplateColumns: "1fr 110px 28px", alignItems: "center", gap: 8, marginBottom: 6 };

  function handleSave() {
    const items = [
      ...proventos.map((it, i) => ({ ...it, amount: Number(it.amount) || 0, order: i })),
      ...descontos.map((it, i) => ({ ...it, amount: Number(it.amount) || 0, order: i })),
    ];
    const bank = bankValue.startsWith("std:") ? bankValue.slice(4) : null;
    const customBankId = bankValue.startsWith("cst:") ? bankValue.slice(4) : null;
    onSave({ type: bonusType, year, payDate, baseAmount: totalP, netAmount: Math.max(0, liquido), notes: notes || null, bank, customBankId, items });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {!isEditing && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", display: "block", marginBottom: 7 }}>Tipo</label>
          <div className="seg" style={{ width: "100%" }}>
            <button style={{ flex: 1 }} className={bonusType === "plr" ? "on" : ""} onClick={() => handleTypeChange("plr")}>PLR</button>
            <button style={{ flex: 1 }} className={bonusType === "decimo" ? "on" : ""} onClick={() => handleTypeChange("decimo")}>Décimo Terceiro</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div className="field">
          <label>Data de recebimento</label>
          <input className="orça-input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
        </div>
      </div>

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
            <input className="orça-input" style={{ fontSize: 13 }} value={it.name} onChange={e => setItem(proventos, setProventos, i, "name", e.target.value)} placeholder="Provento" />
            <input className="orça-input num" style={{ fontSize: 13, textAlign: "right" }} type="number" step="0.01" value={it.amount || ""} placeholder="0,00" onChange={e => setItem(proventos, setProventos, i, "amount", e.target.value)} />
            <button onClick={() => removeItem("PROVENTO", i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 2 }}><OrcaIcon name="trash" size={14} /></button>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "1px solid var(--line-2)", marginTop: 6, fontSize: 13, fontWeight: 700 }}>
          <span>Total proventos</span><span className="num" style={{ color: "var(--pos)" }}>{formatBRL(totalP)}</span>
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
            <input className="orça-input" style={{ fontSize: 13 }} value={it.name} onChange={e => setItem(descontos, setDescontos, i, "name", e.target.value)} placeholder="Desconto" />
            <input className="orça-input num" style={{ fontSize: 13, textAlign: "right" }} type="number" step="0.01" value={it.amount || ""} placeholder="0,00" onChange={e => setItem(descontos, setDescontos, i, "amount", e.target.value)} />
            <button onClick={() => removeItem("DESCONTO", i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 2 }}><OrcaIcon name="trash" size={14} /></button>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "1px solid var(--line-2)", marginTop: 6, fontSize: 13, fontWeight: 700 }}>
          <span>Total descontos</span><span className="num" style={{ color: "var(--neg)" }}>{formatBRL(totalD)}</span>
        </div>
      </div>

      {/* Líquido */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: liquido >= 0 ? "var(--pos-soft)" : "var(--warn-soft)", borderRadius: "var(--r-md)", marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Líquido {defaults.label}</span>
        <span className="num" style={{ fontWeight: 800, fontSize: 18, color: liquido >= 0 ? "var(--pos)" : "var(--warn)" }}>{formatBRL(liquido)}</span>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Observações</label>
        <input className="orça-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional..." />
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Banco de recebimento</label>
        <select className="orça-input" value={bankValue} onChange={e => setBankValue(e.target.value)}>
          <option value="">Sem banco (não lançar no extrato)</option>
          {BANK_IDS.map(k => <option key={k} value={`std:${k}`}>{BANKS[k].name}</option>)}
          {customBanks.length > 0 && (
            <optgroup label="Bancos personalizados">
              {customBanks.map(cb => <option key={cb.id} value={`cst:${cb.id}`}>{cb.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading} onClick={handleSave}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />Salvar {defaults.label}</>}
        </button>
      </div>
    </div>
  );
}

// ─── Bonus Display ────────────────────────────────────────────────────────────

function BonusDisplay({ entry, bonusType, isPaid, onEdit, onDelete, onTogglePaid }: {
  entry: BonusEntry;
  bonusType: BonusType;
  isPaid: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaid: () => void;
}) {
  const defaults = BONUS_DEFAULTS[bonusType];
  const proventos = entry.items.filter(i => i.type === "PROVENTO");
  const descontos = entry.items.filter(i => i.type === "DESCONTO");
  const totalP = proventos.reduce((a, i) => a + Number(i.amount), 0);
  const totalD = descontos.reduce((a, i) => a + Number(i.amount), 0);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", background: "var(--warn, #C98A1E)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: .75 }}>Bonificação · {entry.year}</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{defaults.label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: .75 }}>Líquido</div>
          <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24 }}>{formatBRL(Number(entry.netAmount))}</div>
        </div>
      </div>

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
          <span>Total proventos</span><span className="num" style={{ color: "var(--pos)" }}>{formatBRL(totalP)}</span>
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
          <span>Total descontos</span><span className="num" style={{ color: "var(--neg)" }}>{formatBRL(-totalD)}</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "var(--warn-soft)" }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Líquido {defaults.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PayToggle paid={isPaid} onToggle={onTogglePaid} label={{ paid: "Recebido", pending: "A receber" }} />
          <span className="num" style={{ fontWeight: 800, fontSize: 20, color: "var(--warn)" }}>{formatBRL(Number(entry.netAmount))}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--line-2)" }}>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", color: "var(--neg)" }} onClick={onDelete}>
          <OrcaIcon name="trash" size={13} />Remover
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", flex: 1 }} onClick={onEdit}>
          <OrcaIcon name="edit" size={13} />Editar {defaults.label}
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
  isPaid,
  onEditMonth,
  onEditTemplate,
  onResetMonth,
  onConfirmMonth,
  onAddBonus,
  onTogglePaid,
}: {
  salary: Salary;
  source: "month" | "prev" | "template" | null;
  month: number;
  year: number;
  isPaid: boolean;
  onEditMonth: () => void;
  onEditTemplate: () => void;
  onResetMonth: () => void;
  onConfirmMonth: () => void;
  onAddBonus: () => void;
  onTogglePaid: () => void;
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
        <div style={{ padding: "8px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
            <OrcaIcon name="repeat" size={13} style={{ flex: "0 0 auto" }} />
            {sourceLabel}
          </span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={onEditMonth}>
            <OrcaIcon name="edit" size={12} />Editar este mês
          </button>
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PayToggle paid={isPaid} onToggle={onTogglePaid} label={{ paid: "Recebido", pending: "A receber" }} />
          <span className="num" style={{ fontWeight: 800, fontSize: 20, color: "var(--pos)" }}>{formatBRL(Number(salary.netAmount))}</span>
        </div>
      </div>

      {/* Actions — order: Editar modelo base | Editar este mês | Outros recebimentos | Remover Salário deste mês */}
      <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--line-2)", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={onEditTemplate}>
          <OrcaIcon name="repeat" size={13} />Editar modelo base
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={onEditMonth}>
          <OrcaIcon name="edit" size={13} />Editar este mês
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={onAddBonus}>
          <OrcaIcon name="coins" size={13} />Outros recebimentos
        </button>
        {source === "month" && (
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", color: "var(--neg)" }} onClick={onResetMonth}>
            <OrcaIcon name="trash" size={13} />Remover Salário deste mês
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Other Credits Form ───────────────────────────────────────────────────────

function CreditForm({ initial, onSave, onCancel, loading, customBanks = [] }: { initial?: Partial<Credit>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; loading: boolean; customBanks?: CustomBank[]; }) {
  const initBankValue = initial?.bank ? `std:${initial.bank}` : "";
  const [form, setForm] = useState({
    description: initial?.description ?? "",
    amount: initial?.amount ? String(initial.amount) : "",
    category: initial?.category ?? "salario",
    date: initial?.date ? formatLocalDate(parseLocalDate(initial.date.split("T")[0])) : formatLocalDate(new Date()),
    notes: initial?.notes ?? "",
    isRecurring: false,
    endDate: "",
  });
  const [bankValue, setBankValue] = useState(initBankValue);
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    const base = {
      description: form.description,
      amount: parseFloat(form.amount),
      type: "INCOME",
      category: form.category || null,
      notes: form.notes || null,
      isPaid: false,
      isRecurring: form.isRecurring,
      endDate: form.isRecurring && form.endDate ? form.endDate : null,
      date: form.date,
      bankValue,
    };
    onSave(base);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field"><label>Descrição</label><input className="orça-input" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Reembolso, aluguel, bônus..." /></div>
      <div className="field-row-2">
        <div className="field"><label>Valor (R$)</label><input className="orça-input num" type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} /></div>
        <div className="field"><label>Data de início</label><input className="orça-input" type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
      </div>

      {/* Recorrência — só disponível ao criar, não ao editar */}
      {!initial?.id && <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
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
      </div>}

      <div className="field"><label>Categoria</label>
        <select className="orça-input" value={form.category} onChange={e => set("category", e.target.value)}>
          {categoriesFor('income').map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="field"><label>Observações</label><input className="orça-input" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Opcional..." /></div>
      <div className="field">
        <label>Banco de recebimento</label>
        <select className="orça-input" value={bankValue} onChange={e => setBankValue(e.target.value)}>
          <option value="">Sem banco (não lançar no extrato)</option>
          {BANK_IDS.map(k => <option key={k} value={`std:${k}`}>{BANKS[k].name}</option>)}
          {customBanks.length > 0 && (
            <optgroup label="Bancos personalizados">
              {customBanks.map(cb => <option key={cb.id} value={`cst:${cb.id}`}>{cb.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>
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

type NewReceita = "holerite" | "servicos" | "empresa" | "outras";

const RECEITA_MENU: { type: NewReceita; label: string; icon: string }[] = [
  { type: "holerite", label: "Holerite",      icon: "wallet"   },
  { type: "servicos", label: "Serviços",       icon: "arrowDown"},
  { type: "empresa",  label: "Empresa",        icon: "coins"    },
  { type: "outras",   label: "Outras Receitas",icon: "plus"     },
];

export default function CreditosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Salary state
  const [salaryData, setSalaryData] = useState<SalaryResponse | null>(null);
  const [showSalaryMonth, setShowSalaryMonth] = useState(false);
  const [showSalaryTemplate, setShowSalaryTemplate] = useState(false);
  const [savingSalary, setSavingSalary] = useState(false);
  const [customBanks, setCustomBanks] = useState<CustomBank[]>([]);

  // Credits state
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [editCredit, setEditCredit] = useState<Credit | null>(null);
  const [showNewReceita, setShowNewReceita] = useState<NewReceita | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [savingCredit, setSavingCredit] = useState(false);

  // Bonus (PLR / Décimo Terceiro) state
  const [bonusPlr,    setBonusPlr]    = useState<BonusEntry | null>(null);
  const [bonusDecimo, setBonusDecimo] = useState<BonusEntry | null>(null);
  const [showBonusForm, setShowBonusForm] = useState<BonusType | null>(null);
  const [savingBonus,   setSavingBonus]   = useState(false);

  const fetchSalary = useCallback(async () => {
    try {
      const res = await fetch(`/api/salary?month=${month}&year=${year}`);
      if (!res.ok) return;
      setSalaryData(await res.json());
    } catch {
      // silently ignore — UI will show "não configurado"
    }
  }, [month, year]);

  const fetchCredits = useCallback(async () => {
    setLoadingCredits(true);
    try {
      const res = await fetch(`/api/credits?month=${month}&year=${year}`);
      if (res.ok) setCredits(await res.json());
    } catch {
      // ignore
    } finally {
      setLoadingCredits(false);
    }
  }, [month, year]);

  const fetchBonus = useCallback(async () => {
    try {
      const res = await fetch(`/api/bonus?year=${year}&month=${month}`);
      if (!res.ok) return;
      const data = await res.json();
      setBonusPlr(data.plr ?? null);
      setBonusDecimo(data.decimo ?? null);
    } catch { /* ignore */ }
  }, [year, month]);

  useEffect(() => {
    fetchSalary();
    fetchCredits();
    fetchBonus();
  }, [fetchSalary, fetchCredits, fetchBonus]);

  useEffect(() => {
    fetch("/api/custom-banks").then(r => r.ok ? r.json() : []).then(d => setCustomBanks(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function handleSaveSalary(data: Record<string, unknown>) {
    setSavingSalary(true);
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { alert("Erro ao salvar salário — tente novamente"); return; }

      // If saving the template and no salary transaction exists for the current
      // month yet, auto-confirm so the INCOME entry is created immediately.
      // Skip if a transaction already exists — preserves the user's paid status.
      if (data.month === 0) {
        const hasSalaryTx = credits.some(c => c.groupId?.startsWith("salary-"));
        if (!hasSalaryTx) {
          await fetch("/api/salary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, month, year }),
          });
        }
      }

      setShowSalaryMonth(false);
      setShowSalaryTemplate(false);
      await fetchSalary();
      await fetchCredits();
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
      const bv = (data.bankValue as string) ?? "";
      const bank = bv.startsWith("std:") ? bv.slice(4) : null;
      const customBankId = bv.startsWith("cst:") ? bv.slice(4) : null;
      const hasBank = !!(bank || customBankId);

      async function createBankEntry(txId: string, date: Date, amount: number) {
        await fetch("/api/bank-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bank: bank || null, customBankId: customBankId || null,
            month: date.getMonth() + 1, year: date.getFullYear(),
            description: data.description, amount,
            type: "INCOME", category: data.category || null,
            groupId: `credit-entry-${txId}`,
          }),
        });
      }

      if (editCredit) {
        await fetch(`/api/transactions/${editCredit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: data.description, amount: data.amount, category: data.category, date: data.date, notes: data.notes, bank: bank || null }),
        });
        // Replace BankEntry: delete old (if any), create new if bank selected
        await fetch(`/api/bank-entries?groupId=credit-entry-${editCredit.id}`, { method: "DELETE" });
        if (hasBank) {
          await createBankEntry(editCredit.id, parseLocalDate(data.date as string), Number(data.amount));
        }
      } else if (data.isRecurring) {
        const startDate = parseLocalDate(data.date as string);
        const endDate = data.endDate ? parseLocalDate(data.endDate as string) : new Date(startDate.getFullYear(), startDate.getMonth() + 23, startDate.getDate());
        const groupId = `recur-${Date.now()}`;

        const dates: Date[] = [];
        let d = new Date(startDate);
        while (d <= endDate) {
          dates.push(new Date(d));
          d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
        }

        const txResponses = await Promise.all(dates.map((dt, i) =>
          fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: data.description, amount: data.amount, type: "INCOME", category: data.category, date: formatLocalDate(dt), notes: data.notes, isPaid: i === 0, groupId, bank: bank || null }),
          })
        ));

        if (hasBank) {
          await Promise.all(txResponses.map(async (res, i) => {
            if (!res.ok) return;
            const tx = await res.json();
            await createBankEntry(tx.id, dates[i], Number(data.amount));
          }));
        }
      } else {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, bankValue: undefined, isRecurring: undefined, endDate: undefined, bank: bank || null }),
        });
        if (hasBank && res.ok) {
          const tx = await res.json();
          await createBankEntry(tx.id, parseLocalDate(data.date as string), Number(data.amount));
        }
      }
      setEditCredit(null); setShowNewReceita(null); fetchCredits();
    } finally { setSavingCredit(false); }
  }

  async function handleDeleteCredit(id: string, desc: string) {
    if (!confirm(`Excluir "${desc}"?`)) return;
    await Promise.all([
      fetch(`/api/transactions/${id}`, { method: "DELETE" }),
      fetch(`/api/bank-entries?groupId=credit-entry-${id}`, { method: "DELETE" }),
    ]);
    fetchCredits();
  }

  async function handleSaveBonus(data: Record<string, unknown>) {
    setSavingBonus(true);
    try {
      const res = await fetch("/api/bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        alert(`Erro: ${err.error}`);
        return;
      }
      setShowBonusForm(null);
      await fetchBonus();
      await fetchCredits();
    } finally { setSavingBonus(false); }
  }

  async function handleTogglePaid(id: string) {
    const credit = credits.find(c => c.id === id);
    if (!credit) return;
    const next = !credit.isPaid;
    setCredits(prev => prev.map(c => c.id === id ? { ...c, isPaid: next } : c));
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: next }),
    });
    if (!res.ok) setCredits(prev => prev.map(c => c.id === id ? { ...c, isPaid: credit.isPaid } : c));
  }

  async function handleDeleteBonus(type: BonusType) {
    if (!confirm(`Remover lançamento de ${BONUS_DEFAULTS[type].label} em ${monthCap}?`)) return;
    await fetch(`/api/bonus?type=${type}&year=${year}&payMonth=${month}`, { method: "DELETE" });
    await fetchBonus();
    await fetchCredits();
  }

  const salaryCredit = credits.find(c => c.groupId?.startsWith("salary-"));
  const plrCredit    = credits.find(c => c.groupId?.startsWith("bonus-plr-"));
  const decimoCredit = credits.find(c => c.groupId?.startsWith("bonus-decimo-"));

  const salaryNet    = salaryData?.effective ? Number(salaryData.effective.netAmount) : 0;
  const bonusTotal   = (bonusPlr ? Number(bonusPlr.netAmount) : 0) + (bonusDecimo ? Number(bonusDecimo.netAmount) : 0);
  const otherCredits = credits.filter(c => !c.groupId?.startsWith("salary-") && !c.groupId?.startsWith("bonus-"));
  const othersTotal  = otherCredits.reduce((a, c) => a + Number(c.amount), 0);
  const grandTotal   = salaryNet + bonusTotal + othersTotal;

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const hasAnyData = !!(
    salaryData?.effective || bonusPlr || bonusDecimo || otherCredits.length > 0
  );

  const creditModalTitle =
    showNewReceita === "servicos" ? "Lançar Serviços" :
    showNewReceita === "empresa"  ? "Lançar Empresa"  :
    "Outras Receitas";

  return (
    <>
      {/* Salary modals */}
      <Modal open={showSalaryMonth} onClose={() => setShowSalaryMonth(false)} title={`Editar salário — ${monthCap}`} width={580}>
        <SalaryForm
          initial={salaryData?.monthSalary ?? salaryData?.effective}
          bankEntry={salaryData?.bankEntry}
          month={month} year={year} isTemplate={false}
          onSave={handleSaveSalary} onCancel={() => setShowSalaryMonth(false)} loading={savingSalary}
          customBanks={customBanks}
        />
      </Modal>
      <Modal open={showSalaryTemplate} onClose={() => setShowSalaryTemplate(false)} title="Editar modelo base de salário" width={580}>
        <SalaryForm
          initial={salaryData?.template}
          month={0} year={0} isTemplate={true}
          onSave={handleSaveSalary} onCancel={() => setShowSalaryTemplate(false)} loading={savingSalary}
          customBanks={customBanks}
        />
      </Modal>

      {/* Holerite modal (via menu) */}
      <Modal open={showNewReceita === "holerite"} onClose={() => setShowNewReceita(null)} title="Lançar Holerite" width={580}>
        <SalaryForm
          initial={salaryData?.monthSalary ?? salaryData?.effective ?? salaryData?.template}
          month={month} year={year} isTemplate={!salaryData?.template}
          onSave={async (data) => { await handleSaveSalary(data); setShowNewReceita(null); }}
          onCancel={() => setShowNewReceita(null)} loading={savingSalary}
          customBanks={customBanks}
        />
      </Modal>

      {/* Bonus modal */}
      <Modal
        open={!!showBonusForm}
        onClose={() => setShowBonusForm(null)}
        title={showBonusForm ? `${BONUS_DEFAULTS[showBonusForm].label} — ${year}` : "Outros recebimentos"}
        width={520}
      >
        {showBonusForm && (
          <BonusForm
            bonusType={showBonusForm}
            year={year} month={month}
            initial={showBonusForm === "plr" ? bonusPlr : bonusDecimo}
            onSave={handleSaveBonus}
            onCancel={() => setShowBonusForm(null)}
            loading={savingBonus}
            customBanks={customBanks}
          />
        )}
      </Modal>

      {/* Credit modals (serviços / empresa / outras) */}
      <Modal
        open={showNewReceita === "servicos" || showNewReceita === "empresa" || showNewReceita === "outras"}
        onClose={() => setShowNewReceita(null)}
        title={creditModalTitle}
      >
        <CreditForm
          onSave={handleSaveCredit}
          onCancel={() => setShowNewReceita(null)}
          loading={savingCredit}
          customBanks={customBanks}
        />
      </Modal>

      {/* Edit credit modal */}
      <Modal open={!!editCredit} onClose={() => setEditCredit(null)} title="Editar receita">
        {editCredit && <CreditForm initial={editCredit} onSave={handleSaveCredit} onCancel={() => setEditCredit(null)} loading={savingCredit} customBanks={customBanks} />}
      </Modal>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Lançamentos · Receitas</div>
          <div className="page-title">Receitas</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />

          {/* "Incluir Nova Receita" com dropdown */}
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowMenu(m => !m)}
            >
              <OrcaIcon name="plus" size={16} />Incluir Nova Receita
            </button>
            {showMenu && (
              <>
                {/* backdrop para fechar o menu */}
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 98 }}
                  onClick={() => setShowMenu(false)}
                />
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)",
                  background: "var(--surface)", border: "1px solid var(--line)",
                  borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)",
                  zIndex: 99, minWidth: 200, overflow: "hidden",
                }}>
                  {RECEITA_MENU.map((opt, i) => (
                    <button
                      key={opt.type}
                      onClick={() => { setShowNewReceita(opt.type); setShowMenu(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", padding: "11px 16px",
                        background: "none",
                        borderBottom: i < RECEITA_MENU.length - 1 ? "1px solid var(--line-2)" : "none",
                        border: "none", cursor: "pointer",
                        fontSize: 13, fontWeight: 600, color: "var(--ink)", textAlign: "left",
                      }}
                    >
                      <OrcaIcon name={opt.icon} size={15} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div className="r-kpi-2">
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowDown" size={14} style={{ color: "var(--pos)" }} />Total de entradas</div>
            <div className="kpi-val num" style={{ color: grandTotal > 0 ? "var(--pos)" : undefined }}>
              {grandTotal > 0 ? formatBRL(grandTotal) : "—"}
            </div>
            <div className="kpi-delta muted">
              {salaryData?.effective ? "salário + " : ""}{otherCredits.length + (bonusPlr ? 1 : 0) + (bonusDecimo ? 1 : 0)} lançamentos
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="coins" size={14} />Outros recebimentos</div>
            <div className="kpi-val num">
              {(othersTotal + bonusTotal) > 0 ? formatBRL(othersTotal + bonusTotal) : "—"}
            </div>
            <div className="kpi-delta muted">
              {otherCredits.length + (bonusPlr ? 1 : 0) + (bonusDecimo ? 1 : 0)} lançamentos
            </div>
          </div>
        </div>

        {/* Conteúdo — só aparece quando há dados */}
        {hasAnyData ? (() => {
          const hasSalary = !!salaryData?.effective;
          const rightCol = (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {bonusPlr && (
                <BonusDisplay entry={bonusPlr} bonusType="plr"
                  isPaid={plrCredit?.isPaid ?? false}
                  onEdit={() => setShowBonusForm("plr")}
                  onDelete={() => handleDeleteBonus("plr")}
                  onTogglePaid={() => plrCredit && handleTogglePaid(plrCredit.id)} />
              )}
              {bonusDecimo && (
                <BonusDisplay entry={bonusDecimo} bonusType="decimo"
                  isPaid={decimoCredit?.isPaid ?? false}
                  onEdit={() => setShowBonusForm("decimo")}
                  onDelete={() => handleDeleteBonus("decimo")}
                  onTogglePaid={() => decimoCredit && handleTogglePaid(decimoCredit.id)} />
              )}

              {otherCredits.length > 0 && (
                <div className="card">
                  <div className="card-head">
                    <div className="card-title"><span className="dot" style={{ background: "var(--accent)" }} />Outros recebimentos</div>
                  </div>
                  {loadingCredits ? (
                    <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                    </div>
                  ) : (
                    otherCredits.map(c => {
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
                            <PayToggle paid={c.isPaid} onToggle={() => handleTogglePaid(c.id)} label={{ paid: "Recebido", pending: "A receber" }} />
                            <span className="amt pos num">{formatBRL(Number(c.amount), { sign: true })}</span>
                            <button onClick={() => setEditCredit(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, borderRadius: 6 }}><OrcaIcon name="edit" size={14} /></button>
                            <button onClick={() => handleDeleteCredit(c.id, c.description)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4, borderRadius: 6 }}><OrcaIcon name="trash" size={14} /></button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div className="row" style={{ background: "var(--pos-soft)", borderRadius: "0 0 var(--r-lg) var(--r-lg)" }}>
                    <span style={{ fontWeight: 800 }}>Total outros</span>
                    <span className="amt pos num" style={{ fontSize: 16 }}>{formatBRL(othersTotal)}</span>
                  </div>
                </div>
              )}

              {hasSalary && salaryData!.source !== "month" && (
                <div style={{ display: "flex", gap: 10, padding: "11px 14px", background: "var(--accent-soft)", borderRadius: "var(--r-md)" }}>
                  <OrcaIcon name="repeat" size={15} style={{ color: "var(--accent)", flex: "0 0 auto", marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600, lineHeight: 1.5 }}>
                    Valores herdados {salaryData!.source === "prev" ? "do mês anterior" : "do modelo base"}.
                    Se houve férias, PLR ou mudança de plano neste mês, clique em <b>"Editar este mês"</b>.
                  </span>
                </div>
              )}
            </div>
          );

          // Com holerite: grid de 2 colunas (holerite à esq, resto à dir)
          if (hasSalary) {
            return (
              <div className="r-grid-credits" style={{ marginTop: 24 }}>
                <Holerite
                  salary={salaryData!.effective!}
                  source={salaryData!.source}
                  month={month} year={year}
                  isPaid={salaryCredit?.isPaid ?? false}
                  onEditMonth={() => setShowSalaryMonth(true)}
                  onEditTemplate={() => setShowSalaryTemplate(true)}
                  onResetMonth={handleResetMonth}
                  onConfirmMonth={handleConfirmMonth}
                  onAddBonus={() => setShowBonusForm(!bonusPlr ? "plr" : !bonusDecimo ? "decimo" : "plr")}
                  onTogglePaid={() => salaryCredit && handleTogglePaid(salaryCredit.id)}
                />
                {rightCol}
              </div>
            );
          }

          // Sem holerite: coluna única
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
              {rightCol}
            </div>
          );
        })() : (
          /* Estado vazio */
          !loadingCredits && (
            <div style={{ textAlign: "center", padding: "72px 0", color: "var(--ink-3)" }}>
              <OrcaIcon name="arrowDown" size={40} style={{ opacity: 0.18, margin: "0 auto 16px" }} />
              <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 6px", color: "var(--ink-2)" }}>
                Nenhuma receita registrada
              </p>
              <p style={{ fontSize: 13, margin: "0 0 20px" }}>
                Clique em <b>Incluir Nova Receita</b> para adicionar um holerite, serviço ou outro recebimento.
              </p>
            </div>
          )
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
