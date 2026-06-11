"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { Modal } from "@/components/ui/modal";
import { PayToggle } from "@/components/ui/pay-toggle";
import { BANKS, formatBRL } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

// ─── Loan types ──────────────────────────────────────────────────────────────

const LOAN_TYPES = {
  pessoal:    { label: "Pessoal",    icon: "wallet" as const, color: "#6366f1" },
  veiculo:    { label: "Veículo",    icon: "card"   as const, color: "#0284c7" },
  consignado: { label: "Consignado", icon: "coins"  as const, color: "#d97706" },
  educacao:   { label: "Educação",   icon: "book"   as const, color: "#059669" },
  imovel:     { label: "Imóvel",     icon: "star"   as const, color: "#7c3aed" },
  outro:      { label: "Outro",      icon: "dots"   as const, color: "#6b7280" },
} as const;
type LoanType = keyof typeof LOAN_TYPES;

const BANK_IDS = Object.keys(BANKS) as BankKey[];
const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTH_FULL  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoanPayment {
  month: number;
  year: number;
  paidAt: string;
}

interface Loan {
  id: string;
  name: string;
  type: string;
  creditor: string;
  owner: string;
  totalAmount: number;
  installment: number;
  installments: number;
  excludedMonths: { month: number; year: number }[];
  startDate: string;
  bank: BankKey | null;
  customBankId: string | null;
  notes: string | null;
  payments: LoanPayment[];
}

interface CustomBank {
  id: string;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLoanRange(loan: Loan) {
  const start = new Date(loan.startDate);
  const startYear  = start.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  let endMonth = startMonth + loan.installments - 1;
  let endYear  = startYear;
  while (endMonth > 12) { endMonth -= 12; endYear++; }
  return { startYear, startMonth, endYear, endMonth };
}

function isLoanActiveInMonth(loan: Loan, month: number, year: number) {
  const { startYear, startMonth, endYear, endMonth } = getLoanRange(loan);
  if (year < startYear || (year === startYear && month < startMonth)) return false;
  if (year > endYear   || (year === endYear   && month > endMonth))   return false;
  return true;
}

function getInstallmentMonths(loan: Loan): { month: number; year: number; index: number }[] {
  const start = new Date(loan.startDate);
  const startYear  = start.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  const excluded = new Set((loan.excludedMonths ?? []).map(e => `${e.year}-${e.month}`));
  const result = [];
  let idx = 1;
  for (let i = 0; i < loan.installments; i++) {
    let m = startMonth + i;
    let y = startYear;
    while (m > 12) { m -= 12; y++; }
    if (!excluded.has(`${y}-${m}`)) {
      result.push({ month: m, year: y, index: idx++ });
    }
  }
  return result;
}

function getOverdueMonths(loan: Loan): { month: number; year: number }[] {
  const paidSet = new Set(loan.payments.map(p => `${p.year}-${p.month}`));
  const { startYear, startMonth, endYear, endMonth } = getLoanRange(loan);
  const now = new Date();
  const nowYear  = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const result: { month: number; year: number }[] = [];
  let y = startYear, m = startMonth;
  while (y < nowYear || (y === nowYear && m < nowMonth)) {
    if ((y < endYear || (y === endYear && m <= endMonth)) && !paidSet.has(`${y}-${m}`)) {
      result.push({ month: m, year: y });
    }
    m++; if (m > 12) { m = 1; y++; }
  }
  return result;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface LoanFormData {
  name: string;
  type: LoanType;
  creditor: string;
  owner: string;
  totalAmount: string;
  installment: string;
  installments: string;
  startDate: string;
  bank: string;
  notes: string;
}

const emptyForm = (): LoanFormData => ({
  name: "", type: "pessoal", creditor: "", owner: "",
  totalAmount: "", installment: "", installments: "",
  startDate: "", bank: "", notes: "",
});

function loanToForm(loan: Loan): LoanFormData {
  const sd = loan.startDate.split("T")[0];
  let bank = "";
  if (loan.bank) bank = `std:${loan.bank}`;
  else if (loan.customBankId) bank = `cst:${loan.customBankId}`;
  return {
    name: loan.name, type: (loan.type as LoanType) || "pessoal",
    creditor: loan.creditor, owner: loan.owner,
    totalAmount: String(loan.totalAmount), installment: String(loan.installment),
    installments: String(loan.installments), startDate: sd,
    bank, notes: loan.notes ?? "",
  };
}

interface LoanFormProps {
  initial: LoanFormData;
  customBanks: CustomBank[];
  onSave: (data: LoanFormData) => void;
  onCancel: () => void;
  saving: boolean;
  errorMsg: string;
}

function LoanForm({ initial, customBanks, onSave, onCancel, saving, errorMsg }: LoanFormProps) {
  const [form, setForm] = useState<LoanFormData>(initial);

  const set = (field: keyof LoanFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const handleInstallmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(f => {
      const inst  = parseFloat(val) || 0;
      const count = parseInt(f.installments) || 0;
      return { ...f, installment: val, totalAmount: count > 0 && inst > 0 ? (inst * count).toFixed(2) : f.totalAmount };
    });
  };

  const handleInstallmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(f => {
      const count = parseInt(val) || 0;
      const inst  = parseFloat(f.installment) || 0;
      return { ...f, installments: val, totalAmount: count > 0 && inst > 0 ? (inst * count).toFixed(2) : f.totalAmount };
    });
  };

  return (
    <div>
      {/* Type picker */}
      <div className="field">
        <label>Tipo</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.entries(LOAN_TYPES) as [LoanType, (typeof LOAN_TYPES)[LoanType]][]).map(([key, lt]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: key }))}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: "var(--r-md)", border: "1.5px solid",
                borderColor: form.type === key ? lt.color : "var(--line)",
                background: form.type === key ? `${lt.color}18` : "var(--surface)",
                color: form.type === key ? lt.color : "var(--ink-2)",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}
            >
              <OrcaIcon name={lt.icon} size={13} style={{ color: lt.color }} />
              {lt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row-2">
        <div className="field">
          <label>Nome <span style={{ color: "var(--neg)" }}>*</span></label>
          <input className="orça-input" value={form.name} onChange={set("name")} placeholder="Ex: Financiamento carro" />
        </div>
        <div className="field">
          <label>Credor <span style={{ color: "var(--neg)" }}>*</span></label>
          <input className="orça-input" value={form.creditor} onChange={set("creditor")} placeholder="Ex: Banco Bradesco" />
        </div>
      </div>

      <div className="field-row-2">
        <div className="field">
          <label>Responsável <span style={{ color: "var(--neg)" }}>*</span></label>
          <input className="orça-input" value={form.owner} onChange={set("owner")} placeholder="Ex: João" />
        </div>
        <div className="field">
          <label>Início das parcelas <span style={{ color: "var(--neg)" }}>*</span></label>
          <input type="date" className="orça-input" value={form.startDate} onChange={set("startDate")} />
        </div>
      </div>

      <div className="field-row-3">
        <div className="field">
          <label>Parcela (R$) <span style={{ color: "var(--neg)" }}>*</span></label>
          <input type="number" step="0.01" min="0" className="orça-input"
            value={form.installment} onChange={handleInstallmentChange} placeholder="0,00" />
        </div>
        <div className="field">
          <label>Nº de parcelas <span style={{ color: "var(--neg)" }}>*</span></label>
          <input type="number" min="1" className="orça-input"
            value={form.installments} onChange={handleInstallmentsChange} placeholder="12" />
        </div>
        <div className="field">
          <label>Total (R$)</label>
          <input type="number" step="0.01" min="0" className="orça-input"
            value={form.totalAmount} onChange={set("totalAmount")} placeholder="0,00" />
        </div>
      </div>

      <div className="field">
        <label>Banco de débito <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(opcional)</span></label>
        <select className="orça-input" value={form.bank} onChange={set("bank")}>
          <option value="">Sem banco (não lançar no extrato)</option>
          {BANK_IDS.map(k => <option key={k} value={`std:${k}`}>{BANKS[k].name}</option>)}
          {customBanks.length > 0 && (
            <optgroup label="Bancos personalizados">
              {customBanks.map(cb => <option key={cb.id} value={`cst:${cb.id}`}>{cb.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      <div className="field">
        <label>Observações <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(opcional)</span></label>
        <textarea className="orça-input" value={form.notes} onChange={set("notes")}
          rows={2} placeholder="Anotações sobre este empréstimo" style={{ resize: "vertical" }} />
      </div>

      {errorMsg && <p style={{ color: "var(--neg)", fontSize: 13, marginBottom: 8 }}>{errorMsg}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmprestimosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customBanks, setCustomBanks] = useState<CustomBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [payingDebt, setPayingDebt] = useState<string | null>(null);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }
  const monthLabel = `${MONTH_FULL[month - 1]} ${year}`;
  const [modal, setModal] = useState<"none" | "create" | "edit">("none");
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteInstallment, setDeleteInstallment] = useState<{
    loanId: string; loanName: string; month: number; year: number; index: number;
  } | null>(null);

  const fetchLoans = useCallback(async () => {
    const res = await fetch("/api/loans");
    if (res.ok) setLoans(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);
  useEffect(() => {
    fetch("/api/custom-banks").then(r => r.ok ? r.json() : []).then(setCustomBanks).catch(() => {});
  }, []);

  // KPIs based on nav month
  const activeLoans    = loans.filter(l => isLoanActiveInMonth(l, month, year));
  const overdueByLoan  = loans.map(l => ({ loan: l, months: getOverdueMonths(l) })).filter(x => x.months.length > 0);
  const totalDebt      = loans.reduce((s, l) => s + l.totalAmount, 0);
  const monthlyDue     = activeLoans.reduce((s, l) => s + l.installment, 0);
  const paidThisMonth  = activeLoans.filter(l => l.payments.some(p => p.month === month && p.year === year));
  const paidAmount     = paidThisMonth.reduce((s, l) => s + l.installment, 0);
  const overdueCount   = overdueByLoan.reduce((s, x) => s + x.months.length, 0);

  async function handleToggle(loanId: string, mo: number, yr: number, paid: boolean) {
    const key = `${loanId}-${mo}-${yr}`;
    setTogglingId(key);
    try {
      await fetch(`/api/loans/${loanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid, month: mo, year: yr }),
      });
      await fetchLoans();
    } finally { setTogglingId(null); }
  }

  async function handlePayDebt(loan: Loan) {
    setPayingDebt(loan.id);
    try {
      const overdue = getOverdueMonths(loan);
      if (overdue.length > 0) {
        await Promise.all(overdue.map(({ month: mo, year: yr }) =>
          fetch(`/api/loans/${loan.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paid: true, month: mo, year: yr }),
          })
        ));
        await fetchLoans();
      }
    } finally { setPayingDebt(null); }
  }

  async function handleSave(form: LoanFormData) {
    const totalAmount  = parseFloat(form.totalAmount);
    const installment  = parseFloat(form.installment);
    const installments = parseInt(form.installments);

    if (!form.name.trim() || !form.creditor.trim() || !form.owner.trim() || !form.startDate) {
      setFormError("Preencha todos os campos obrigatórios."); return;
    }
    if (isNaN(totalAmount) || totalAmount <= 0 || isNaN(installment) || installment <= 0 || isNaN(installments) || installments <= 0) {
      setFormError("Valores e número de parcelas devem ser positivos."); return;
    }

    let bank: string | null = null;
    let customBankId: string | null = null;
    if (form.bank.startsWith("std:")) bank = form.bank.slice(4);
    else if (form.bank.startsWith("cst:")) customBankId = form.bank.slice(4);

    const payload = {
      name: form.name.trim(), type: form.type,
      creditor: form.creditor.trim(), owner: form.owner.trim(),
      totalAmount, installment, installments,
      startDate: form.startDate, bank, customBankId,
      notes: form.notes.trim() || null,
    };

    setSaving(true); setFormError("");
    try {
      const url    = modal === "edit" && editingLoan ? `/api/loans/${editingLoan.id}` : "/api/loans";
      const method = modal === "edit" ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError((err as { error?: string }).error ?? "Erro ao salvar."); return;
      }
      setModal("none"); setEditingLoan(null);
      await fetchLoans();
    } catch { setFormError("Erro de conexão."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch(`/api/loans/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      await fetchLoans();
    } finally { setDeleting(false); }
  }

  async function handleDeleteInstallmentOnly() {
    if (!deleteInstallment) return;
    setDeleting(true);
    try {
      const { loanId, month, year } = deleteInstallment;
      await fetch(`/api/loans/${loanId}?month=${month}&year=${year}`, { method: "DELETE" });
      setDeleteInstallment(null);
      await fetchLoans();
    } finally { setDeleting(false); }
  }

  async function handleDeleteLoanFromInstallment() {
    if (!deleteInstallment) return;
    setDeleting(true);
    try {
      await fetch(`/api/loans/${deleteInstallment.loanId}`, { method: "DELETE" });
      setDeleteInstallment(null);
      await fetchLoans();
    } finally { setDeleting(false); }
  }

  function openCreate() { setEditingLoan(null); setFormError(""); setModal("create"); }
  function openEdit(loan: Loan) { setEditingLoan(loan); setFormError(""); setModal("edit"); }

  const loanToDelete = loans.find(l => l.id === deleteConfirm);

  return (
    <>
      {/* Modals */}
      <Modal
        open={modal !== "none"}
        onClose={() => { setModal("none"); setEditingLoan(null); }}
        title={modal === "edit" ? "Editar empréstimo" : "Novo empréstimo"}
      >
        <LoanForm
          initial={modal === "edit" && editingLoan ? loanToForm(editingLoan) : emptyForm()}
          customBanks={customBanks}
          onSave={handleSave}
          onCancel={() => { setModal("none"); setEditingLoan(null); }}
          saving={saving}
          errorMsg={formError}
        />
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Excluir empréstimo">
        <p style={{ marginBottom: 16 }}>
          Tem certeza que deseja excluir <strong>{loanToDelete?.name}</strong>?{" "}
          Todos os pagamentos, transações e lançamentos bancários associados serão removidos.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancelar</button>
          <button
            className="btn"
            style={{ background: "var(--neg)", color: "#fff" }}
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            disabled={deleting}
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!deleteInstallment}
        onClose={() => setDeleteInstallment(null)}
        title="Excluir parcela"
        width={420}
      >
        {deleteInstallment && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
              Excluir a parcela <b style={{ color: "var(--ink)" }}>
                {String(deleteInstallment.index).padStart(2, "0")} — {MONTH_FULL[deleteInstallment.month - 1]} {deleteInstallment.year}
              </b> de <b style={{ color: "var(--ink)" }}>{deleteInstallment.loanName}</b>?
            </p>
            <div style={{
              padding: "12px 14px", background: "var(--warn-soft)",
              borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--warn)",
              fontWeight: 600, lineHeight: 1.5,
            }}>
              Esta parcela faz parte de um empréstimo. Excluir só esta parcela ou o empréstimo inteiro?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={() => setDeleteInstallment(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="btn btn-ghost" style={{ color: "var(--neg)" }}
                onClick={handleDeleteInstallmentOnly} disabled={deleting}>
                Só esta parcela
              </button>
              <button className="btn btn-primary" style={{ background: "var(--neg)" }}
                onClick={handleDeleteLoanFromInstallment} disabled={deleting}>
                {deleting ? "Excluindo…" : "Excluir empréstimo"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Topbar — fora do content, sticky */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Carteiras</div>
          <div className="page-title">Empréstimos</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthLabel} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary" onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <OrcaIcon name="plus" size={14} /> Novo
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div className="r-kpi-4">
          <div className="card kpi">
            <div className="kpi-label">Dívida total</div>
            <div className="kpi-val num">{formatBRL(totalDebt)}</div>
            <div className="kpi-delta muted">{loans.length} empréstimo{loans.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">A pagar este mês</div>
            <div className="kpi-val num">{formatBRL(monthlyDue)}</div>
            <div className="kpi-delta muted">{activeLoans.length} ativo{activeLoans.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Pago este mês</div>
            <div className="kpi-val num" style={{ color: paidAmount > 0 ? "var(--pos)" : undefined }}>
              {formatBRL(paidAmount)}
            </div>
            <div className="kpi-delta muted">{paidThisMonth.length} de {activeLoans.length}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Parcelas em atraso</div>
            <div className="kpi-val num" style={{ color: overdueCount > 0 ? "var(--neg)" : undefined }}>
              {overdueCount}
            </div>
            <div className="kpi-delta muted">{overdueByLoan.length} com atraso</div>
          </div>
        </div>

        <div className="r-grid-credits">
          {/* Left: loans list — all loans, each showing all installments */}
          <div>
            {loading ? (
              <div className="card card-pad" style={{ textAlign: "center", padding: 40, color: "var(--ink-3)" }}>
                Carregando…
              </div>
            ) : loans.length === 0 ? (
              <div className="card card-pad" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 12 }}>
                  Nenhum empréstimo cadastrado.
                </div>
                <button className="btn btn-primary" onClick={openCreate}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <OrcaIcon name="plus" size={14} /> Adicionar empréstimo
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {loans.filter(l => l.payments.length < l.installments).length === 0 && (
                  <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                    Nenhum empréstimo ativo.
                  </div>
                )}
                {loans.map(loan => {
                  const lt          = LOAN_TYPES[loan.type as LoanType] ?? LOAN_TYPES.outro;
                  const paidCount   = loan.payments.length;
                  const pctPaid     = Math.min(1, paidCount / loan.installments);
                  const isFullyPaid = paidCount >= loan.installments;
                  if (isFullyPaid) return null;
                  const paidSet     = new Set(loan.payments.map(p => `${p.year}-${p.month}`));
                  const instMonths  = getInstallmentMonths(loan);
                  const loanOverdue = getOverdueMonths(loan);
                  const bankLabel   = loan.bank
                    ? (BANKS[loan.bank]?.name ?? loan.bank)
                    : loan.customBankId
                      ? (customBanks.find(cb => cb.id === loan.customBankId)?.name ?? "Banco")
                      : null;
                  const todayNow    = new Date();
                  const todayY      = todayNow.getFullYear();
                  const todayM      = todayNow.getMonth() + 1;

                  return (
                    <div key={loan.id} className="card">
                      {/* Header */}
                      <div className="card-head">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "var(--r-md)", flexShrink: 0,
                            background: `${lt.color}18`, display: "grid", placeItems: "center",
                          }}>
                            <OrcaIcon name={lt.icon} size={16} style={{ color: lt.color }} />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "var(--font-display)" }}>{loan.name}</span>
                              <span className="chip" style={{ background: `${lt.color}18`, color: lt.color }}>{lt.label}</span>
                              {loanOverdue.length > 0 && (
                                <span className="chip" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}>
                                  {loanOverdue.length} em atraso
                                </span>
                              )}
                              {isFullyPaid && <span className="chip" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}>Quitado</span>}
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                              {loan.creditor} · Resp: {loan.owner}
                              {bankLabel && <> · {bankLabel}</>}
                              {" · "}{paidCount} de {loan.installments} parcelas · {formatBRL(loan.installment)}/mês
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-icon" title="Editar" onClick={() => openEdit(loan)}>
                            <OrcaIcon name="edit" size={15} />
                          </button>
                          <button className="btn btn-icon" title="Excluir" style={{ color: "var(--neg)" }}
                            onClick={() => setDeleteConfirm(loan.id)}>
                            <OrcaIcon name="trash" size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--line-2)" }}>
                        <div className="bar">
                          <span style={{ width: `${(pctPaid * 100).toFixed(1)}%`, background: isFullyPaid ? "var(--pos)" : lt.color }} />
                        </div>
                      </div>

                      {/* Installment rows */}
                      {instMonths.map(({ month: mo, year: yr, index }) => {
                        const isPaid    = paidSet.has(`${yr}-${mo}`);
                        const isOverdue = !isPaid && (yr < todayY || (yr === todayY && mo < todayM));
                        const togKey    = `${loan.id}-${mo}-${yr}`;
                        return (
                          <div key={togKey} className="row">
                            <div className="row-l">
                              <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700, minWidth: 22, textAlign: "right" }}>
                                {String(index).padStart(2, "0")}
                              </span>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>
                                  {MONTH_FULL[mo - 1]} {yr}
                                </span>
                                {isOverdue && (
                                  <span className="chip" style={{ background: "var(--neg-soft)", color: "var(--neg)", fontSize: 10, marginLeft: 6 }}>
                                    Atraso
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="num amt" style={{ fontSize: 13, color: "var(--ink-2)" }}>
                                {formatBRL(loan.installment)}
                              </span>
                              <PayToggle
                                paid={isPaid}
                                onToggle={() => handleToggle(loan.id, mo, yr, !isPaid)}
                              />
                              <button
                                className="btn btn-icon"
                                title="Excluir parcela"
                                style={{ color: "var(--neg)", opacity: togglingId === togKey ? 0.4 : 1 }}
                                disabled={togglingId === togKey}
                                onClick={() => setDeleteInstallment({
                                  loanId: loan.id, loanName: loan.name,
                                  month: mo, year: yr, index,
                                })}
                              >
                                <OrcaIcon name="trash" size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Completed loans — compact block at the bottom */}
                {(() => {
                  const completed = loans.filter(l => l.payments.length >= l.installments);
                  if (completed.length === 0) return null;
                  return (
                    <details>
                      <summary style={{
                        cursor: "pointer", listStyle: "none", display: "flex",
                        alignItems: "center", gap: 8, padding: "10px 16px",
                        background: "var(--surface-2)", border: "1px solid var(--line)",
                        borderRadius: "var(--r-lg)", fontSize: 13, fontWeight: 700,
                        color: "var(--ink-3)",
                      }}>
                        <OrcaIcon name="check" size={14} style={{ color: "var(--pos)" }} />
                        {completed.length} empréstimo{completed.length !== 1 ? "s" : ""} concluído{completed.length !== 1 ? "s" : ""}
                        <span className="chip" style={{ background: "var(--pos-soft)", color: "var(--pos)", marginLeft: "auto" }}>
                          Quitado{completed.length !== 1 ? "s" : ""}
                        </span>
                      </summary>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {completed.map(loan => {
                          const lt = LOAN_TYPES[loan.type as LoanType] ?? LOAN_TYPES.outro;
                          return (
                            <div key={loan.id} className="card card-pad" style={{ opacity: 0.7 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{
                                  width: 32, height: 32, borderRadius: "var(--r-md)", flexShrink: 0,
                                  background: "var(--pos-soft)", display: "grid", placeItems: "center",
                                }}>
                                  <OrcaIcon name={lt.icon} size={14} style={{ color: "var(--pos)" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>{loan.name}</div>
                                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                                    {loan.creditor} · {loan.installments} parcelas · {formatBRL(loan.totalAmount)}
                                  </div>
                                </div>
                                <span className="chip" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}>Quitado</span>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button className="btn btn-icon" title="Editar" onClick={() => openEdit(loan)}>
                                    <OrcaIcon name="edit" size={15} />
                                  </button>
                                  <button className="btn btn-icon" title="Excluir" style={{ color: "var(--neg)" }}
                                    onClick={() => setDeleteConfirm(loan.id)}>
                                    <OrcaIcon name="trash" size={15} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Right: panels */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card">
              <div className="card-head">
                <span className="card-title">Inadimplência</span>
                {overdueCount > 0 && (
                  <span className="chip" style={{ background: "var(--neg-soft)", color: "var(--neg)" }}>
                    {overdueCount} atraso{overdueCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div style={{ padding: "16px 20px" }}>
                {overdueByLoan.length === 0 ? (
                  <div style={{ color: "var(--ink-3)", fontSize: 13, textAlign: "center", padding: "8px 0" }}>
                    Sem parcelas em atraso
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {overdueByLoan.map(({ loan, months: overdueMonths }) => {
                      const lt = LOAN_TYPES[loan.type as LoanType] ?? LOAN_TYPES.outro;
                      return (
                        <div key={loan.id}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <OrcaIcon name={lt.icon} size={13} style={{ color: lt.color }} />
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{loan.name}</span>
                            </div>
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: "2px 8px" }}
                              disabled={payingDebt === loan.id}
                              onClick={() => handlePayDebt(loan)}
                            >
                              {payingDebt === loan.id ? "Pagando…" : "Pagar tudo"}
                            </button>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {overdueMonths.map(({ month: mo, year: yr }) => (
                              <span
                                key={`${yr}-${mo}`}
                                className="chip"
                                style={{ background: "var(--neg-soft)", color: "var(--neg)", fontSize: 11, cursor: "pointer" }}
                                title={`Ir para ${MONTH_NAMES[mo - 1]}/${yr}`}
                                onClick={() => { setMonth(mo); setYear(yr); }}
                              >
                                {MONTH_NAMES[mo - 1]}/{yr}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {activeLoans.some(l => l.notes) && (
              <div className="card">
                <div className="card-head">
                  <span className="card-title">Observações</span>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  {activeLoans.filter(l => l.notes).map(l => (
                    <div key={l.id} style={{ fontSize: 13, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid var(--line-2)" }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{l.name}</div>
                      <div style={{ color: "var(--ink-2)" }}>{l.notes}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
