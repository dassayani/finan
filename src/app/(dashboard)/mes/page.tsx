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

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
        <span className={`switch${form.isPaid ? " on" : ""}`} onClick={() => set("isPaid", !form.isPaid)} style={{ cursor: "pointer" }} />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{form.isPaid ? "Marcado como pago" : "Marcar como pago"}</span>
      </div>

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
        <span className="sd" />{tx.isPaid ? "Pago" : "Pend."}
      </button>

      <span className="amt neg num" style={{ minWidth: 80, textAlign: "right", fontSize: 13 }}>
        {formatBRL(-tx.amount)}
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
  title, badge, color, items, total, paidVal, taxa, onEdit, onDelete, onTogglePaid,
}: {
  title: string; badge: React.ReactNode; color: string;
  items: Transaction[]; total: number; paidVal: number; taxa?: number;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onTogglePaid: (tx: Transaction) => void;
}) {
  const pct = total > 0 ? Math.round((paidVal / total) * 100) : 0;
  return (
    <div className="card" style={{ marginBottom: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderLeft: `3px solid ${color}`, background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {badge}
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{title}</span>
          <span className="row-meta">{items.length} lançamentos</span>
        </div>
        <span className="amt neg num" style={{ fontSize: 14 }}>{formatBRL(-total)}</span>
      </div>

      {items.length === 0 && (
        <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Nenhum lançamento</div>
      )}

      {items.map((tx, i) => (
        <DenseRow
          key={tx.id}
          tx={tx}
          last={!taxa && i === items.length - 1}
          onEdit={() => onEdit(tx)}
          onDelete={() => onDelete(tx)}
          onTogglePaid={() => onTogglePaid(tx)}
        />
      ))}

      {taxa ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "8px 16px", fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 }}>
          <span>Taxa do banco</span><span className="num">{formatBRL(-taxa)}</span>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 16px", borderTop: "1px solid var(--line-2)" }}>
        <span className="row-meta num">{formatBRL(paidVal)} de {formatBRL(total)} pago</span>
        <div className="bar" style={{ width: 120 }}><span style={{ width: `${pct}%`, background: color }} /></div>
      </div>
    </div>
  );
}

export default function MesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions?month=${month}&year=${year}&type=EXPENSE`);
      const data = await res.json();
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const credits = 0; // TODO: fetch income separately

  const applyFilter = (items: Transaction[]) => {
    if (filter === "pending") return items.filter(t => !t.isPaid);
    if (filter === "paid") return items.filter(t => t.isPaid);
    return items;
  };

  const fixos = applyFilter(transactions.filter(t => t.expenseType === "FIXED"));
  const variaveis = applyFilter(transactions.filter(t => t.expenseType === "VARIABLE"));
  const allBankIds = BANK_IDS.filter(id => transactions.some(t => t.expenseType === "BANK_BILL" && t.bank === id));

  const sum = (items: Transaction[]) => items.reduce((a, t) => a + Number(t.amount), 0);
  const sumPaid = (items: Transaction[]) => items.filter(t => t.isPaid).reduce((a, t) => a + Number(t.amount), 0);

  const fixosTotal = sum(transactions.filter(t => t.expenseType === "FIXED"));
  const varsTotal = sum(transactions.filter(t => t.expenseType === "VARIABLE"));
  const banksTotals = Object.fromEntries(BANK_IDS.map(id => [id, sum(transactions.filter(t => t.expenseType === "BANK_BILL" && t.bank === id))]));
  const debits = fixosTotal + varsTotal + Object.values(banksTotals).reduce((a, v) => a + v, 0);
  const paid = sumPaid(transactions);
  const pending = debits - paid;
  const saldo = credits - debits;
  const pct = debits > 0 ? Math.round((paid / debits) * 100) : 0;

  const buckets = [
    { label: "Gastos Fixos", v: fixosTotal, c: "var(--accent)" },
    { label: "Variáveis", v: varsTotal, c: "#5B49C9" },
    ...allBankIds.map(id => ({ label: BANKS[id].name, v: banksTotals[id], c: BANKS[id].color })),
  ].filter(b => b.v > 0).sort((a, b) => b.v - a.v);
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

  async function handleDelete(tx: Transaction) {
    if (!confirm(`Excluir "${tx.description}"?`)) return;
    await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    fetchTransactions();
  }

  async function handleTogglePaid(tx: Transaction) {
    await fetch(`/api/transactions/${tx.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPaid: !tx.isPaid }) });
    fetchTransactions();
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

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Visão do Mês</div>
          <div className="page-title">{monthCap}</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-ghost" onClick={() => setFilter(f => f === "all" ? "pending" : f === "pending" ? "paid" : "all")}>
            <OrcaIcon name="filter" size={16} />
            {filter === "all" ? "Filtrar" : filter === "pending" ? "Pendentes" : "Pagos"}
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <OrcaIcon name="plus" size={16} />Lançar
          </button>
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
            <div className="card" style={{ padding: 22, background: "var(--accent)", color: "#fff", border: "none" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .8 }}>Saídas do mês</div>
              <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-.03em", margin: "4px 0 14px" }}>
                {formatBRL(debits)}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>Pago</div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{formatBRL(paid)}</div>
                </div>
                <div style={{ flex: 1, background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>Pendente</div>
                  <div className="num" style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{formatBRL(pending)}</div>
                </div>
              </div>
            </div>

            <div className="card card-pad">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span className="section-label" style={{ color: "var(--ink-2)" }}>Pago no mês</span>
                <span className="num" style={{ fontWeight: 800, fontFamily: "var(--font-display)" }}>{pct}%</span>
              </div>
              <div className="bar" style={{ height: 10, marginBottom: 10 }}>
                <span style={{ width: `${pct}%`, background: "var(--pos)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                <span className="num" style={{ color: "var(--pos)" }}>{formatBRL(paid)}</span>
                <span className="num" style={{ color: "var(--warn)" }}>{formatBRL(pending)} a pagar</span>
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

            <DenseSection title="Gastos Fixos" color="var(--accent)" items={fixos}
              total={sum(transactions.filter(t => t.expenseType === "FIXED"))}
              paidVal={sumPaid(transactions.filter(t => t.expenseType === "FIXED"))}
              badge={<span style={{ color: "var(--accent)" }}><OrcaIcon name="repeat" size={16} /></span>}
              {...sectionProps}
            />

            <DenseSection title="Gastos Variáveis" color="#5B49C9" items={variaveis}
              total={sum(transactions.filter(t => t.expenseType === "VARIABLE"))}
              paidVal={sumPaid(transactions.filter(t => t.expenseType === "VARIABLE"))}
              badge={<span style={{ color: "#5B49C9" }}><OrcaIcon name="flame" size={16} /></span>}
              {...sectionProps}
            />

            {allBankIds.length > 0 && (
              <>
                <div className="section-label" style={{ margin: "18px 0 10px" }}>Faturas por banco</div>
                <div style={{ columnCount: 2, columnGap: 14 }}>
                  {allBankIds.map(id => {
                    const bankItems = applyFilter(transactions.filter(t => t.expenseType === "BANK_BILL" && t.bank === id));
                    return (
                      <div key={id} style={{ breakInside: "avoid" }}>
                        <DenseSection
                          title={BANKS[id].name} color={BANKS[id].color}
                          items={bankItems}
                          total={sum(transactions.filter(t => t.expenseType === "BANK_BILL" && t.bank === id))}
                          paidVal={sumPaid(transactions.filter(t => t.expenseType === "BANK_BILL" && t.bank === id))}
                          badge={<BankBadge id={id} size={24} />}
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
