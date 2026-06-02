"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { BankBadge } from "@/components/ui/bank-badge";
import { Modal } from "@/components/ui/modal";
import { BANKS, CATEGORIES, formatBRL } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  expenseType: "FIXED" | "VARIABLE" | "BANK_BILL" | null;
  category: string | null;
  bank: string | null;
  date: string;
  isPaid: boolean;
  notes: string | null;
  installments: number | null;
  installmentIndex: number | null;
  groupId: string | null;
}

interface BankFee {
  id: string;
  bank: string;
  name: string;
  amount: number;
  billingDay: number;
}

interface BankBalance {
  id: string;
  bank: string;
  balance: number;
}

interface BankEntry {
  id: string;
  bank: string | null;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
}

const BANK_IDS: BankKey[] = ["caixa", "itau", "bb", "nubank", "picpay", "inter", "mp"];

// ---------- Form de edição ----------
function TxForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<Transaction>;
  onSave: (data: Partial<Transaction>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    description: initial?.description ?? "",
    amount: initial?.amount ? String(initial.amount) : "",
    type: initial?.type ?? "EXPENSE",
    expenseType: initial?.expenseType ?? "VARIABLE",
    category: initial?.category ?? "",
    bank: initial?.bank ?? "",
    date: initial?.date ? new Date(initial.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    isPaid: initial?.isPaid ?? false,
    notes: initial?.notes ?? "",
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label>Descrição</label>
        <input className="orça-input" value={form.description} onChange={e => set("description", e.target.value)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label>Valor (R$)</label>
          <input className="orça-input num" type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} />
        </div>
        <div className="field">
          <label>Data</label>
          <input className="orça-input" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label>Tipo</label>
          <div className="seg" style={{ width: "100%" }}>
            <button style={{ flex: 1 }} className={form.type === "INCOME" ? "on" : ""} onClick={() => set("type", "INCOME")}>Receita</button>
            <button style={{ flex: 1 }} className={form.type === "EXPENSE" ? "on" : ""} onClick={() => set("type", "EXPENSE")}>Despesa</button>
          </div>
        </div>
        {form.type === "EXPENSE" && (
          <div className="field">
            <label>Tipo de gasto</label>
            <div className="seg" style={{ width: "100%" }}>
              <button style={{ flex: 1 }} className={form.expenseType === "FIXED" ? "on" : ""} onClick={() => set("expenseType", "FIXED")}>Fixo</button>
              <button style={{ flex: 1 }} className={form.expenseType === "VARIABLE" ? "on" : ""} onClick={() => set("expenseType", "VARIABLE")}>Variável</button>
              <button style={{ flex: 1 }} className={form.expenseType === "BANK_BILL" ? "on" : ""} onClick={() => set("expenseType", "BANK_BILL")}>Fatura</button>
            </div>
          </div>
        )}
      </div>

      <div className="field">
        <label>Categoria</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
            <span key={k} className={`opt${form.category === k ? " sel" : ""}`} onClick={() => set("category", k)} style={{ cursor: "pointer", fontSize: 12, padding: "6px 10px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />{c.label}
            </span>
          ))}
        </div>
      </div>

      {form.type === "EXPENSE" && (
        <div className="field">
          <label>Banco</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {BANK_IDS.map(id => (
              <span key={id} className={`opt${form.bank === id ? " sel" : ""}`} onClick={() => set("bank", id)} style={{ cursor: "pointer", padding: "6px 8px", fontSize: 12 }}>
                <BankBadge id={id} size={18} />{BANKS[id].name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label>Observações</label>
        <input className="orça-input" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Opcional..." />
      </div>

      {form.type === "EXPENSE" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
          <span className={`switch${form.isPaid ? " on" : ""}`} onClick={() => set("isPaid", !form.isPaid)} style={{ cursor: "pointer" }} />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{form.isPaid ? "Marcado como pago" : "Marcar como pago"}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          disabled={loading || !form.description || !form.amount}
          onClick={() => onSave({ ...form, amount: parseFloat(form.amount), category: form.category || null, bank: form.bank || null, notes: form.notes || null })}
        >
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />Salvar</>}
        </button>
      </div>
    </div>
  );
}

// ---------- Row densa com ações ----------
function DenseRow({
  tx,
  last,
  onEdit,
  onDelete,
  onTogglePaid,
}: {
  tx: Transaction;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaid: () => void;
}) {
  const cat = tx.category ? CATEGORIES[tx.category as CategoryKey] : null;
  const [showNote, setShowNote] = useState(false);

  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--line-2)" }}>
    <div
      style={{
        display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 10,
        padding: "8px 16px", fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: cat?.color ?? "var(--ink-3)", flex: "0 0 auto" }} />
        <span className="row-name" style={{ fontWeight: 600 }}>{tx.description}</span>
        {cat && <span className="row-meta" style={{ flex: "0 0 auto" }}>{cat.label}</span>}
        {tx.notes && (
          <button onClick={() => setShowNote(v => !v)} title="Ver observação" style={{ background: "none", border: "none", cursor: "pointer", color: showNote ? "var(--warn)" : "var(--ink-3)", padding: "0 2px", display: "flex", alignItems: "center" }}>
            <OrcaIcon name="edit" size={12} />
          </button>
        )}
      </div>

      <button
        onClick={onTogglePaid}
        className={`status ${tx.isPaid ? "paid" : "pending"}`}
        style={{ fontSize: 10.5, padding: "3px 8px", border: "none", cursor: "pointer" }}
      >
        <span className="sd" />
        {tx.type === "INCOME"
          ? (tx.isPaid ? "Recebido" : "A receber")
          : (tx.isPaid ? "Pago" : "Pagar")}
      </button>

      <span className="num" style={{ minWidth: 80, textAlign: "right", fontSize: 13, color: tx.type === "INCOME" ? "var(--pos, #1a7c3a)" : "var(--neg)" }}>
        {tx.type === "INCOME" ? formatBRL(tx.amount) : formatBRL(-tx.amount)}
      </span>

      <div style={{ display: "flex", gap: 2 }}>
        <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, borderRadius: 6, display: "grid", placeItems: "center" }}
          title="Editar">
          <OrcaIcon name="edit" size={14} />
        </button>
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4, borderRadius: 6, display: "grid", placeItems: "center" }}
          title="Excluir">
          <OrcaIcon name="dots" size={14} />
        </button>
      </div>
    </div>
    {showNote && tx.notes && (
      <div style={{ padding: "6px 16px 10px 32px", fontSize: 12, color: "var(--warn)", fontWeight: 600, background: "var(--warn-soft)", display: "flex", gap: 6, alignItems: "flex-start" }}>
        <OrcaIcon name="edit" size={12} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span>{tx.notes}</span>
      </div>
    )}
    </div>
  );
}

function DenseSection({
  title, badge, color, items, fees, estornos, total, paidVal, paidEstornosVal, markAllLabel, onMarkAllPaid, onEdit, onDelete, onTogglePaid,
  saldoInicial, bankEntradas, bankSaidas,
}: {
  title: string; badge: React.ReactNode; color: string;
  items: Transaction[]; fees?: BankFee[]; estornos?: Transaction[]; total: number; paidVal: number; paidEstornosVal?: number;
  markAllLabel?: string;
  onMarkAllPaid?: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onTogglePaid: (tx: Transaction) => void;
  saldoInicial?: number | null;
  bankEntradas?: BankEntry[];
  bankSaidas?: BankEntry[];
}) {
  const pct = total > 0 ? Math.round((paidVal / total) * 100) : 0;
  const hasContent = items.length > 0 || (fees && fees.length > 0) || (estornos && estornos.length > 0);
  const hasUnpaid = items.some(t => !t.isPaid);

  return (
    <div className="card" style={{ marginBottom: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderLeft: `3px solid ${color}`, background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {badge}
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{title}</span>
          <span className="row-meta">{items.length} lançamentos{fees && fees.length > 0 ? ` · ${fees.length} taxa${fees.length > 1 ? "s" : ""}` : ""}</span>
        </div>
        <span className="amt neg num" style={{ fontSize: 14 }}>{formatBRL(-(total - paidVal))}</span>
      </div>

      {!hasContent && (
        <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Nenhum lançamento</div>
      )}

      {items.map((tx, i) => (
        <DenseRow
          key={tx.id} tx={tx}
          last={i === items.length - 1 && (!fees || fees.length === 0)}
          onEdit={() => onEdit(tx)}
          onDelete={() => onDelete(tx)}
          onTogglePaid={() => onTogglePaid(tx)}
        />
      ))}

      {/* Bank fees */}
      {fees && fees.length > 0 && (
        <div style={{ borderTop: items.length > 0 ? "1px dashed var(--line-2)" : "none" }}>
          <div style={{ padding: "5px 16px 2px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-3)" }}>
            Taxas do banco
          </div>
          {fees.map((fee, i) => (
            <div key={fee.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", padding: "7px 16px", borderBottom: i === fees.length - 1 ? "none" : "1px solid var(--line-2)", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, opacity: .5 }} />
                <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{fee.name}</span>
                <span className="row-meta">dia {fee.billingDay}</span>
              </div>
              <span className="amt neg num" style={{ fontSize: 13 }}>{formatBRL(-Number(fee.amount))}</span>
            </div>
          ))}
        </div>
      )}

      {/* Estornos / créditos do banco */}
      {estornos && estornos.length > 0 && (
        <div style={{ borderTop: "1px dashed var(--line-2)", background: "var(--pos-soft, #e6f4ea)" }}>
          <div style={{ padding: "5px 16px 2px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--pos, #1a7c3a)" }}>
            Estornos / créditos
          </div>
          {estornos.map((tx, i) => (
            <div key={tx.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 8, padding: "7px 16px", borderBottom: i === estornos.length - 1 ? "none" : "1px solid rgba(0,0,0,.06)", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pos, #1a7c3a)", flex: "0 0 auto" }} />
                <span style={{ fontWeight: 600, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</span>
              </div>
              <button onClick={() => onTogglePaid(tx)} className={`status ${tx.isPaid ? "paid" : "pending"}`} style={{ fontSize: 10.5, padding: "3px 8px", border: "none", cursor: "pointer" }}>
                <span className="sd" />{tx.isPaid ? "Recebido" : "A receber"}
              </button>
              <span className="num" style={{ fontSize: 13, fontWeight: 700, color: "var(--pos, #1a7c3a)" }}>+{formatBRL(Number(tx.amount))}</span>
              <button onClick={() => onDelete(tx)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4, borderRadius: 6, display: "grid", placeItems: "center" }} title="Excluir">
                <OrcaIcon name="dots" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Rodapé informativo: saldo do banco (da tela Bancos) */}
      {saldoInicial !== undefined && (
        (() => {
          const totalEnt = (bankEntradas ?? []).reduce((s, e) => s + Number(e.amount), 0);
          const totalSai = (bankSaidas ?? []).reduce((s, e) => s + Number(e.amount), 0);
          const paidBills = paidVal;
          const paidEst = paidEstornosVal ?? 0;
          const saldoTotal = (saldoInicial ?? 0) + totalEnt - totalSai - paidBills + paidEst;
          const row = (label: string, value: number | null, c: string) => (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>{label}</span>
              <span className="num" style={{ fontWeight: 700, color: c }}>{value !== null ? formatBRL(value) : "—"}</span>
            </div>
          );
          return (
            <div style={{ padding: "10px 16px", borderTop: "1px dashed var(--line-2)", background: "var(--surface-2)" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 6 }}>
                Posição do banco
              </div>
              {row("Saldo do banco", saldoInicial, saldoInicial !== null && saldoInicial >= 0 ? "var(--pos)" : "var(--neg)")}
              {totalEnt > 0 && row("Entradas", totalEnt, "var(--pos)")}
              {totalSai > 0 && row("Saídas", -totalSai, "var(--neg)")}
              {paidBills > 0 && row("Faturas pagas", -paidBills, "var(--neg)")}
              {paidEst > 0 && row("Créditos recebidos", paidEst, "var(--pos)")}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0 0", borderTop: "1px solid var(--line-2)", marginTop: 5 }}>
                <span style={{ fontWeight: 800 }}>Saldo total</span>
                <span className="num" style={{ fontWeight: 800, color: saldoTotal >= 0 ? "var(--pos)" : "var(--neg)" }}>{formatBRL(saldoTotal)}</span>
              </div>
            </div>
          );
        })()
      )}

      {onMarkAllPaid && hasUnpaid && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--line-2)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onMarkAllPaid} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px", color, gap: 5 }}>
            <OrcaIcon name="check" size={13} />{markAllLabel ?? "Pagar todos"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function MesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomes, setIncomes] = useState<Transaction[]>([]);
  const [bankFees, setBankFees] = useState<BankFee[]>([]);
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([]);
  const [bankEntriesList, setBankEntriesList] = useState<BankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  function toggleCategory(cat: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, incRes, feesRes, balRes, entRes] = await Promise.all([
        fetch(`/api/transactions?month=${month}&year=${year}&type=EXPENSE`),
        fetch(`/api/credits?month=${month}&year=${year}`),
        fetch("/api/bank-fees"),
        fetch(`/api/bank-balances?month=${month}&year=${year}`),
        fetch(`/api/bank-entries?month=${month}&year=${year}`),
      ]);
      if (txRes.ok)  setTransactions(await txRes.json());
      if (incRes.ok) setIncomes(await incRes.json());
      if (feesRes.ok) setBankFees(await feesRes.json());
      if (balRes.ok)  setBankBalances(await balRes.json());
      if (entRes.ok)  setBankEntriesList(await entRes.json());
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const applyFilter = (items: Transaction[]) => {
    let result = items;
    if (filter === "pending") result = result.filter(t => !t.isPaid);
    if (filter === "paid") result = result.filter(t => t.isPaid);
    if (selectedCategories.size > 0) result = result.filter(t => t.category && selectedCategories.has(t.category));
    return result;
  };

  const fixos = applyFilter(transactions.filter(t => t.expenseType === "FIXED"));
  const variaveis = applyFilter(transactions.filter(t => t.expenseType === "VARIABLE"));

  const sum = (items: Transaction[]) => items.reduce((a, t) => a + Number(t.amount), 0);
  const sumPaid = (items: Transaction[]) => items.filter(t => t.isPaid).reduce((a, t) => a + Number(t.amount), 0);

  const sumFees = (bankId: string) => bankFees.filter(f => f.bank === bankId).reduce((a, f) => a + Number(f.amount), 0);

  // Estornos = INCOME transactions with a bank set — only shown inside the bank card, not in Receitas
  const bankEstornos   = incomes.filter(t => t.bank !== null);
  const regularIncomes = incomes.filter(t => t.bank === null);
  const credits = regularIncomes.reduce((a, t) => a + Number(t.amount), 0);
  const sumEstornos = (bankId: string) => bankEstornos.filter(t => t.bank === bankId).reduce((a, t) => a + Number(t.amount), 0);
  const sumPaidEstornos = (bankId: string) => bankEstornos.filter(t => t.bank === bankId && t.isPaid).reduce((a, t) => a + Number(t.amount), 0);

  const allBankIds = BANK_IDS.filter(id =>
    transactions.some(t => t.expenseType === "BANK_BILL" && t.bank === id) ||
    bankFees.some(f => f.bank === id) ||
    bankEstornos.some(t => t.bank === id) ||
    bankBalances.some(b => b.bank === id) ||
    bankEntriesList.some(e => e.bank === id)
  );

  const fixosTotal = sum(transactions.filter(t => t.expenseType === "FIXED"));
  const varsTotal = sum(transactions.filter(t => t.expenseType === "VARIABLE"));
  const banksTotals = Object.fromEntries(BANK_IDS.map(id => [
    id,
    Math.max(0, sum(transactions.filter(t => t.expenseType === "BANK_BILL" && t.bank === id)) + sumFees(id) - sumEstornos(id)),
  ]));
  const totalFees = bankFees.reduce((a, f) => a + Number(f.amount), 0);
  const debits = fixosTotal + varsTotal + Object.values(banksTotals).reduce((a, v) => a + v, 0);
  const paid = sumPaid(transactions);
  const pending = debits - paid;
  const saldo = credits - debits;
  const pct = debits > 0 ? Math.round((paid / debits) * 100) : 0;

  const receivedIncome = regularIncomes.filter(t => t.isPaid).reduce((a, t) => a + Number(t.amount), 0);
  const pendingIncome = credits - receivedIncome;
  const realSaldo = receivedIncome - paid;

  const buckets = [
    { label: "Gastos Fixos", v: fixosTotal, c: "var(--accent)" },
    { label: "Variáveis", v: varsTotal, c: "#5B49C9" },
    ...allBankIds.map(id => ({ label: BANKS[id].name, v: banksTotals[id], c: BANKS[id].color })),
  ].filter(b => b.v > 0).sort((a, b) => b.v - a.v);

  // suppress unused warning
  void totalFees;
  const maxB = Math.max(...buckets.map(b => b.v), 1);

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  async function handleSave(data: Partial<Transaction>) {
    setSaving(true);
    try {
      if (editTx) {
        await fetch(`/api/transactions/${editTx.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      } else {
        await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, type: data.type ?? "EXPENSE" }) });
      }
      setEditTx(null);
      setShowNew(false);
      fetchTransactions();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(tx: Transaction) {
    setDeleteTx(tx);
  }

  async function confirmDeleteOne() {
    if (!deleteTx) return;
    await fetch(`/api/transactions/${deleteTx.id}`, { method: "DELETE" });
    setDeleteTx(null);
    fetchTransactions();
  }

  async function confirmDeleteGroup() {
    if (!deleteTx?.groupId) return;
    await fetch(`/api/transactions?groupId=${deleteTx.groupId}`, { method: "DELETE" });
    setDeleteTx(null);
    fetchTransactions();
  }

  async function confirmDeleteSalaryYear() {
    if (!deleteTx?.groupId) return;
    await fetch(`/api/transactions?groupId=${deleteTx.groupId}&year=${year}`, { method: "DELETE" });
    setDeleteTx(null);
    fetchTransactions();
  }

  function optimisticToggle(tx: Transaction, isPaid: boolean) {
    if (tx.type === "INCOME") {
      setIncomes(prev => prev.map(t => t.id === tx.id ? { ...t, isPaid } : t));
    } else {
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, isPaid } : t));
    }
  }

  async function handleTogglePaid(tx: Transaction) {
    const next = !tx.isPaid;
    optimisticToggle(tx, next);
    await fetch(`/api/transactions/${tx.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPaid: next }) });
    fetchTransactions();
  }

  async function markAllPaid(items: Transaction[]) {
    const unpaid = items.filter(t => !t.isPaid);
    unpaid.forEach(t => optimisticToggle(t, true));
    await Promise.all(unpaid.map(t =>
      fetch(`/api/transactions/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: true }),
      })
    ));
    fetchTransactions();
  }

  function sortTx(items: Transaction[]) {
    return [...items].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.description.localeCompare(b.description, "pt-BR");
    });
  }

  const sectionProps = { onEdit: (tx: Transaction) => setEditTx(tx), onDelete: handleDelete, onTogglePaid: handleTogglePaid };

  return (
    <>
      {/* Modals */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Editar lançamento">
        {editTx && <TxForm initial={editTx} onSave={handleSave} onCancel={() => setEditTx(null)} loading={saving} />}
      </Modal>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Novo lançamento">
        <TxForm onSave={handleSave} onCancel={() => setShowNew(false)} loading={saving} />
      </Modal>
      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title="Excluir lançamento" width={440}>
        {deleteTx && (() => {
          const isSalary = deleteTx.groupId?.startsWith("salary-");
          const isInstallment = !isSalary && deleteTx.groupId && deleteTx.installments && deleteTx.installments > 1;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
                Tem certeza que deseja excluir{" "}
                <b style={{ color: "var(--ink)" }}>&quot;{deleteTx.description}&quot;</b>?
              </p>

              {isSalary && (
                <div style={{ padding: "12px 14px", background: "var(--warn-soft)", borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--warn)", fontWeight: 600, lineHeight: 1.5 }}>
                  Este é um lançamento de salário. Deseja excluir apenas o de {year} de {new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", { month: "long" })} ou todos os salários confirmados de {year}?
                </div>
              )}

              {isInstallment && (
                <div style={{ padding: "12px 14px", background: "var(--warn-soft)", borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--warn)", fontWeight: 600, lineHeight: 1.5 }}>
                  Este lançamento faz parte de um parcelamento de {deleteTx.installments}x. Deseja excluir apenas esta parcela ou todas as {deleteTx.installments} parcelas?
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => setDeleteTx(null)}>Cancelar</button>

                {isSalary && (
                  <>
                    <button className="btn btn-ghost" style={{ color: "var(--neg)" }} onClick={confirmDeleteOne}>
                      Só este mês
                    </button>
                    <button className="btn btn-primary" style={{ background: "var(--neg)" }} onClick={confirmDeleteSalaryYear}>
                      Todos os meses de {year}
                    </button>
                  </>
                )}

                {isInstallment && (
                  <>
                    <button className="btn btn-ghost" style={{ color: "var(--neg)" }} onClick={confirmDeleteOne}>
                      Só esta parcela
                    </button>
                    <button className="btn btn-primary" style={{ background: "var(--neg)" }} onClick={confirmDeleteGroup}>
                      Todas as {deleteTx.installments} parcelas
                    </button>
                  </>
                )}

                {!isSalary && !isInstallment && (
                  <button className="btn btn-primary" style={{ background: "var(--neg)" }} onClick={confirmDeleteOne}>
                    Excluir
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Visão do Mês</div>
          <div className="page-title">{monthCap}</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-ghost"
              style={selectedCategories.size > 0 ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
              onClick={() => setShowCategoryFilter(v => !v)}
            >
              <OrcaIcon name="filter" size={16} />
              {selectedCategories.size === 0 ? "Categorias" : `${selectedCategories.size} categoria${selectedCategories.size > 1 ? "s" : ""}`}
            </button>
            {showCategoryFilter && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowCategoryFilter(false)} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)", padding: "14px 16px", width: 240 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>Filtrar por categoria</span>
                    {selectedCategories.size > 0 && (
                      <button onClick={() => setSelectedCategories(new Set())} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--neg)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
                        Limpar
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
                      <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "5px 8px", borderRadius: "var(--r-sm)", background: selectedCategories.has(k) ? "var(--surface-2)" : "none" }}>
                        <input type="checkbox" checked={selectedCategories.has(k)} onChange={() => toggleCategory(k)} style={{ cursor: "pointer", accentColor: c.color, width: 14, height: 14, flexShrink: 0 }} />
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : (
        <div className="content" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, alignItems: "start" }}>
          {/* LEFT RAIL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Bloco 1 — Saldo projetado */}
            <div className="card" style={{ padding: 22, background: "var(--accent)", color: "#fff", border: "none" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .8 }}>Saldo projetado</div>
              <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-.03em", margin: "4px 0 14px" }}>
                {formatBRL(saldo)}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>A receber</div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{formatBRL(pendingIncome)}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>A pagar</div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{formatBRL(pending)}</div>
                </div>
              </div>
            </div>

            {/* Bloco 2 — Saldo real */}
            <div className="card" style={{ padding: 20, border: "none", background: realSaldo >= 0 ? "var(--pos-soft, #e6f4ea)" : "var(--neg-soft, #fdecea)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", marginBottom: 4 }}>Saldo real</div>
              <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: realSaldo >= 0 ? "var(--pos, #1a7c3a)" : "var(--neg)", marginBottom: 12 }}>
                {formatBRL(realSaldo)}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, background: "rgba(0,0,0,.05)", borderRadius: 10, padding: "9px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>Recebido</div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 15, marginTop: 2, color: "var(--pos, #1a7c3a)" }}>{formatBRL(receivedIncome)}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(0,0,0,.05)", borderRadius: 10, padding: "9px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>Pago</div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 15, marginTop: 2, color: "var(--neg)" }}>{formatBRL(paid)}</div>
                </div>
              </div>
            </div>

            {buckets.length > 0 && (
              <div className="card card-pad">
                <div className="section-label" style={{ color: "var(--ink-2)", marginBottom: 14 }}>Para onde foi</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
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
          </div>

          {/* RIGHT — ledger */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="section-label">Razão do mês · por bloco</div>
              <div className="seg">
                <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>Tudo</button>
                <button className={filter === "pending" ? "on" : ""} onClick={() => setFilter("pending")}>Pendentes</button>
                <button className={filter === "paid" ? "on" : ""} onClick={() => setFilter("paid")}>Pagos</button>
              </div>
            </div>

            {regularIncomes.length > 0 && (
              <DenseSection
                title="Receitas" color="var(--pos, #1a7c3a)"
                badge={<span style={{ color: "var(--pos, #1a7c3a)", fontWeight: 900, fontSize: 18, lineHeight: 1 }}>↑</span>}
                items={sortTx(applyFilter(regularIncomes))}
                total={credits}
                paidVal={sumPaid(regularIncomes)}
                markAllLabel="Receber todos"
                onMarkAllPaid={() => markAllPaid(applyFilter(regularIncomes))}
                {...sectionProps}
              />
            )}

            <DenseSection title="Gastos Fixos" color="var(--accent)"
              items={sortTx(fixos)}
              total={sum(transactions.filter(t => t.expenseType === "FIXED"))}
              paidVal={sumPaid(transactions.filter(t => t.expenseType === "FIXED"))}
              badge={<span style={{ color: "var(--accent)" }}><OrcaIcon name="repeat" size={16} /></span>}
              onMarkAllPaid={() => markAllPaid(fixos)}
              {...sectionProps}
            />

            <DenseSection title="Gastos Variáveis" color="#5B49C9"
              items={sortTx(variaveis)}
              total={sum(transactions.filter(t => t.expenseType === "VARIABLE"))}
              paidVal={sumPaid(transactions.filter(t => t.expenseType === "VARIABLE"))}
              badge={<span style={{ color: "#5B49C9" }}><OrcaIcon name="flame" size={16} /></span>}
              onMarkAllPaid={() => markAllPaid(variaveis)}
              {...sectionProps}
            />

            {allBankIds.length > 0 && (
              <>
                <div className="section-label" style={{ margin: "18px 0 10px" }}>Faturas por banco</div>
                <div style={{ columnCount: 2, columnGap: 14 }}>
                  {allBankIds.map(id => {
                    const bankItemsAll = transactions.filter(t => t.expenseType === "BANK_BILL" && t.bank === id);
                    const bankItemsFiltered = applyFilter(bankItemsAll);
                    const bankFeeItems = bankFees.filter(f => f.bank === id);
                    const bankEstornoItems = bankEstornos.filter(t => t.bank === id);
                    const balRecord = bankBalances.find(b => b.bank === id);
                    const entradas  = bankEntriesList.filter(e => e.bank === id && e.type === "INCOME");
                    const saidas    = bankEntriesList.filter(e => e.bank === id && e.type === "EXPENSE");
                    return (
                      <div key={id} style={{ breakInside: "avoid" }}>
                        <DenseSection
                          title={BANKS[id].name} color={BANKS[id].color}
                          items={sortTx(bankItemsFiltered)}
                          fees={selectedCategories.size === 0 ? bankFeeItems : []}
                          estornos={selectedCategories.size === 0 ? sortTx(bankEstornoItems) : []}
                          total={banksTotals[id]}
                          paidVal={sumPaid(bankItemsAll)}
                          badge={<BankBadge id={id} size={24} />}
                          onMarkAllPaid={() => markAllPaid(bankItemsFiltered)}
                          saldoInicial={balRecord ? Number(balRecord.balance) : null}
                          bankEntradas={entradas.length > 0 ? entradas : undefined}
                          bankSaidas={saidas.length > 0 ? saidas : undefined}
                          paidEstornosVal={sumPaidEstornos(id)}
                          {...sectionProps}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {transactions.length === 0 && !loading && (
              <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 48 }}>
                <OrcaIcon name="plus" size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontWeight: 600, margin: 0 }}>Nenhum lançamento neste mês</p>
                <p style={{ fontSize: 13, margin: "6px 0 0" }}>Clique em "Lançar" para adicionar</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
