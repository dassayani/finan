"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { Modal } from "@/components/ui/modal";
import { BankBadge } from "@/components/ui/bank-badge";
import { BANKS, CATEGORIES, formatBRL } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface CustomBank { id: string; name: string; short: string; color: string; }

const BANK_IDS = Object.keys(BANKS) as BankKey[];

// ─── Expense Form ─────────────────────────────────────────────────────────────

function ExpenseForm({
  initial,
  onSave,
  onCancel,
  loading,
  customBanks,
}: {
  initial?: Partial<Transaction>;
  onSave: (data: Partial<Transaction> & { customBankId?: string | null; repeat?: boolean; repeatUntil?: string }) => void;
  onCancel: () => void;
  loading: boolean;
  customBanks: CustomBank[];
}) {
  const [mode, setMode]           = useState<"FIXED" | "VARIABLE">(initial?.expenseType === "VARIABLE" ? "VARIABLE" : "FIXED");
  const [description, setDesc]    = useState(initial?.description ?? "");
  const [amount, setAmount]       = useState(initial?.amount ? String(initial.amount) : "");
  const [date, setDate]           = useState(
    initial?.date ? formatLocalDate(parseLocalDate(initial.date.split("T")[0])) : formatLocalDate(new Date())
  );
  const [selectedCat, setCat]     = useState<CategoryKey>((initial?.category as CategoryKey) ?? "compras");
  const [bankMode, setBankMode]   = useState<"none" | "bank">(initial?.bank ? "bank" : "none");
  const [bankValue, setBankValue] = useState(initial?.bank ? `std:${initial.bank}` : "");
  const [isPaid, setIsPaid]       = useState(initial?.isPaid ?? false);
  const [notes, setNotes]         = useState(initial?.notes ?? "");
  const [repeat, setRepeat]       = useState(false);
  const [repeatPreset, setPreset] = useState<"year" | "custom">("year");
  const [repeatUntil, setUntil]   = useState("");
  const [error, setError]         = useState("");

  const isEdit = !!initial?.id;
  const endOfYear = `${new Date().getFullYear()}-12-31`;
  const repeatEnd = repeat ? (repeatPreset === "year" ? endOfYear : repeatUntil) : null;
  const bankKey      = bankMode === "bank" && bankValue.startsWith("std:") ? bankValue.slice(4) as BankKey : null;
  const customBankId = bankMode === "bank" && bankValue.startsWith("cst:") ? bankValue.slice(4) : null;

  function handleSave() {
    if (!description || !amount) { setError("Preencha descrição e valor"); return; }
    onSave({
      description, amount: parseFloat(amount), type: "EXPENSE", expenseType: mode,
      category: selectedCat, bank: bankKey, customBankId, date, isPaid,
      notes: notes || null,
      repeat, repeatUntil: repeatEnd ?? undefined,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tipo */}
      <div className="field-row-2" style={{ gap: 10 }}>
        {(["FIXED", "VARIABLE"] as const).map(m => {
          const cfg = m === "FIXED"
            ? { label: "Gasto Fixo", icon: "repeat", desc: "Boleto ou PIX fixo mensal" }
            : { label: "Gasto Variável", icon: "flame", desc: "Gasto avulso ou eventual" };
          const active = mode === m;
          return (
            <div key={m} onClick={() => setMode(m)} style={{
              padding: "10px 12px", borderRadius: "var(--r-md)", cursor: "pointer",
              border: `2px solid ${active ? "var(--accent)" : "var(--line)"}`,
              background: active ? "var(--accent-soft)" : "var(--surface)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                <OrcaIcon name={cfg.icon} size={14} style={{ color: active ? "var(--accent)" : "var(--ink-3)" }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: active ? "var(--accent)" : "var(--ink)" }}>{cfg.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: active ? "var(--accent)" : "var(--ink-3)", lineHeight: 1.4 }}>{cfg.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Descrição + Valor + Data + Categoria */}
      <div className="field">
        <label>Descrição <span style={{ color: "var(--neg)" }}>*</span></label>
        <input className="orça-input" value={description}
          onChange={e => { setDesc(e.target.value); setError(""); }}
          placeholder="Ex: Condomínio, Spotify..." />
      </div>
      <div className="field-row-2">
        <div className="field">
          <label>Valor <span style={{ color: "var(--neg)" }}>*</span></label>
          <div className="input-prefix">
            <span className="pf">R$</span>
            <input className="orça-input num" type="number" step="0.01" value={amount}
              onChange={e => { setAmount(e.target.value); setError(""); }}
              style={{ paddingLeft: 34 }} placeholder="0,00" />
          </div>
        </div>
        <div className="field">
          <label>Data de vencimento</label>
          <input className="orça-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Categoria</label>
        <select className="orça-input" value={selectedCat} onChange={e => setCat(e.target.value as CategoryKey)}>
          {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Banco */}
      <div className="field">
        <label>Banco de débito <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(opcional)</span></label>
        <div style={{ display: "flex", gap: 8, marginBottom: bankMode === "bank" ? 8 : 0 }}>
          {(["none", "bank"] as const).map(opt => (
            <button key={opt}
              onClick={() => { setBankMode(opt); if (opt === "none") setBankValue(""); }}
              style={{
                padding: "7px 18px", borderRadius: "var(--r-sm)", cursor: "pointer",
                fontWeight: 700, fontSize: 13, border: "none",
                background: bankMode === opt ? "var(--accent)" : "var(--surface-3)",
                color: bankMode === opt ? "#fff" : "var(--ink-2)",
              }}>
              {opt === "none" ? "Nenhum" : "Banco"}
            </button>
          ))}
        </div>
        {bankMode === "bank" && (
          <select className="orça-input" value={bankValue} onChange={e => setBankValue(e.target.value)}>
            <option value="">Selecione um banco...</option>
            {BANK_IDS.map(k => <option key={k} value={`std:${k}`}>{BANKS[k].name}</option>)}
            {customBanks.length > 0 && (
              <optgroup label="Bancos personalizados">
                {customBanks.map(cb => <option key={cb.id} value={`cst:${cb.id}`}>{cb.name}</option>)}
              </optgroup>
            )}
          </select>
        )}
      </div>

      {/* Repetir — só ao criar */}
      {!isEdit && (
        <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: repeat ? 12 : 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Repetir mensalmente</div>
              <div className="row-meta">Cria automaticamente nos meses seguintes</div>
            </div>
            <span className={`switch${repeat ? " on" : ""}`} onClick={() => setRepeat(v => !v)} style={{ cursor: "pointer" }} />
          </div>
          {repeat && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="seg" style={{ width: "100%" }}>
                <button style={{ flex: 1 }} className={repeatPreset === "year" ? "on" : ""} onClick={() => setPreset("year")}>
                  Até fim do ano ({new Date().getFullYear()})
                </button>
                <button style={{ flex: 1 }} className={repeatPreset === "custom" ? "on" : ""} onClick={() => setPreset("custom")}>
                  Outra data
                </button>
              </div>
              {repeatPreset === "custom" && (
                <div className="field"><label>Repetir até</label>
                  <input className="orça-input" type="date" value={repeatUntil} onChange={e => setUntil(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Já pago */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Já paguei?</div>
          <div className="row-meta">Marca como pago no fluxo de caixa</div>
        </div>
        <span className={`switch${isPaid ? " on" : ""}`} onClick={() => setIsPaid(v => !v)} style={{ cursor: "pointer" }} />
      </div>

      {/* Observação */}
      <div className="field">
        <label>Observação <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(opcional)</span></label>
        <textarea className="orça-input" style={{ resize: "vertical", minHeight: 60, fontFamily: "var(--font-body)", fontSize: 13 }}
          value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalhes ou lembretes" />
      </div>

      {error && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--neg)" }}>✕ {error}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading} onClick={handleSave}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />{isEdit ? "Salvar" : (repeat ? "Criar lançamentos" : "Salvar")}</>}
        </button>
      </div>
    </div>
  );
}

// ─── DenseRow ─────────────────────────────────────────────────────────────────

function DenseRow({ tx, last, onEdit, onDelete, onTogglePaid }: {
  tx: Transaction; last: boolean;
  onEdit: () => void; onDelete: () => void; onTogglePaid: () => void;
}) {
  const cat = tx.category ? CATEGORIES[tx.category as CategoryKey] : null;
  const bankKey = tx.bank && tx.bank in BANKS ? tx.bank as BankKey : null;
  const [showNote, setShowNote] = useState(false);

  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--line-2)" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 10,
        padding: "8px 16px", fontSize: 13,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: cat?.color ?? "var(--ink-3)", flex: "0 0 auto" }} />
          <span className="row-name" style={{ fontWeight: 600 }}>{tx.description}</span>
          {cat && <span className="row-meta" style={{ flex: "0 0 auto" }}>{cat.label}</span>}
          {bankKey && <BankBadge id={bankKey} size={16} />}
          {tx.notes && (
            <button onClick={() => setShowNote(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: showNote ? "var(--warn)" : "var(--ink-3)", padding: "0 2px", display: "flex", alignItems: "center" }}>
              <OrcaIcon name="edit" size={12} />
            </button>
          )}
        </div>
        <button onClick={onTogglePaid} className={`status ${tx.isPaid ? "paid" : "pending"}`}
          style={{ fontSize: 10.5, padding: "3px 8px", border: "none", cursor: "pointer" }}>
          <span className="sd" />{tx.isPaid ? "Pago" : "Pagar"}
        </button>
        <span className="num" style={{ minWidth: 80, textAlign: "right", fontSize: 13, color: "var(--neg)" }}>
          {formatBRL(-tx.amount)}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4, borderRadius: 6, display: "grid", placeItems: "center" }}>
            <OrcaIcon name="edit" size={14} />
          </button>
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4, borderRadius: 6, display: "grid", placeItems: "center" }}>
            <OrcaIcon name="trash" size={14} />
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

// ─── DenseSection ─────────────────────────────────────────────────────────────

function DenseSection({ title, badge, color, items, total, paidVal, onMarkAllPaid, onEdit, onDelete, onTogglePaid }: {
  title: string; badge: React.ReactNode; color: string;
  items: Transaction[]; total: number; paidVal: number;
  onMarkAllPaid?: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onTogglePaid: (tx: Transaction) => void;
}) {
  const pending = total - paidVal;
  const hasUnpaid = items.some(t => !t.isPaid);

  return (
    <div className="card" style={{ marginBottom: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderLeft: `3px solid ${color}`, background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {badge}
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{title}</span>
          <span className="row-meta">{items.length} lançamento{items.length !== 1 ? "s" : ""}</span>
        </div>
        <span className="amt neg num" style={{ fontSize: 14 }}>{formatBRL(-pending)}</span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "20px", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Nenhum lançamento neste mês</div>
      ) : (
        items.map((tx, i) => (
          <DenseRow key={tx.id} tx={tx} last={i === items.length - 1}
            onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)} onTogglePaid={() => onTogglePaid(tx)} />
        ))
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 16px", borderTop: "1px solid var(--line-2)", background: "var(--surface-2)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>Total</span>
          <span className="num" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>{formatBRL(total)}</span>
        </div>
      )}

      {onMarkAllPaid && hasUnpaid && (
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--line-2)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onMarkAllPaid} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px", color, gap: 5 }}>
            <OrcaIcon name="check" size={13} />Pagar todos
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DebitoPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<"all" | "pending" | "paid">("all");

  const [showNew, setShowNew]   = useState(false);
  const [editTx, setEditTx]     = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [saving, setSaving]     = useState(false);

  const [customBanks, setCustomBanks] = useState<CustomBank[]>([]);

  const fetchTx = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions?month=${month}&year=${year}&type=EXPENSE`);
      if (res.ok) setTransactions(await res.json());
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchTx(); }, [fetchTx]);
  useEffect(() => {
    fetch("/api/custom-banks").then(r => r.ok ? r.json() : []).then(setCustomBanks).catch(() => {});
  }, []);

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const applyFilter = (items: Transaction[]) => {
    if (filter === "pending") return items.filter(t => !t.isPaid);
    if (filter === "paid")    return items.filter(t => t.isPaid);
    return items;
  };

  const fixosAll    = transactions.filter(t => t.expenseType === "FIXED");
  const variaveisAll = transactions.filter(t => t.expenseType === "VARIABLE");
  const fixos       = applyFilter(fixosAll).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.description.localeCompare(b.description, "pt-BR"));
  const variaveis   = applyFilter(variaveisAll).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.description.localeCompare(b.description, "pt-BR"));

  const sum     = (items: Transaction[]) => items.reduce((a, t) => a + Number(t.amount), 0);
  const sumPaid = (items: Transaction[]) => items.filter(t => t.isPaid).reduce((a, t) => a + Number(t.amount), 0);

  const fixosTotal    = sum(fixosAll);
  const variaveisTotal = sum(variaveisAll);
  const totalGeral    = fixosTotal + variaveisTotal;
  const totalPago     = sumPaid(transactions.filter(t => t.expenseType === "FIXED" || t.expenseType === "VARIABLE"));
  const totalPendente = totalGeral - totalPago;

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap   = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  function optimisticToggle(id: string, isPaid: boolean) {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, isPaid } : t));
  }

  async function handleTogglePaid(tx: Transaction) {
    const next = !tx.isPaid;
    optimisticToggle(tx.id, next);
    await fetch(`/api/transactions/${tx.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPaid: next }) });
    fetchTx();
  }

  async function markAllPaid(items: Transaction[]) {
    const unpaid = items.filter(t => !t.isPaid);
    unpaid.forEach(t => optimisticToggle(t.id, true));
    await Promise.all(unpaid.map(t =>
      fetch(`/api/transactions/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPaid: true }) })
    ));
    fetchTx();
  }

  async function handleSave(data: Partial<Transaction> & { customBankId?: string | null; repeat?: boolean; repeatUntil?: string }) {
    setSaving(true);
    try {
      if (editTx) {
        const { repeat: _r, repeatUntil: _ru, customBankId: _cb, ...txData } = data;
        await fetch(`/api/transactions/${editTx.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(txData),
        });
        setEditTx(null);
      } else {
        const { repeat, repeatUntil, customBankId, ...base } = data;
        const startDate = parseLocalDate(base.date as string);
        const endDate   = repeat && repeatUntil ? parseLocalDate(repeatUntil) : null;
        const dates: Date[] = [startDate];
        if (repeat && endDate) {
          let d = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
          while (d <= endDate) { dates.push(new Date(d)); d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
        }
        const groupId = dates.length > 1 ? `grp-${Date.now()}` : null;

        const txReqs = dates.map((d, i) =>
          fetch("/api/transactions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...base, date: formatLocalDate(d), isPaid: i === 0 ? base.isPaid : false, groupId }),
          })
        );
        const stdBankKey = base.bank as BankKey | null;
        const bankReqs = (stdBankKey || customBankId) ? dates.map(d =>
          fetch("/api/bank-entries", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bank: stdBankKey ?? null,
              customBankId: customBankId ?? null,
              month: d.getMonth() + 1, year: d.getFullYear(),
              description: base.description, amount: base.amount,
              type: "EXPENSE", category: base.category, groupId,
            }),
          })
        ) : [];

        await Promise.all([...txReqs, ...bankReqs]);
        setShowNew(false);
      }
      fetchTx();
    } finally { setSaving(false); }
  }

  async function confirmDeleteOne() {
    if (!deleteTx) return;
    await fetch(`/api/transactions/${deleteTx.id}`, { method: "DELETE" });
    setDeleteTx(null);
    fetchTx();
  }

  async function confirmDeleteGroup() {
    if (!deleteTx?.groupId) return;
    await fetch(`/api/transactions?groupId=${deleteTx.groupId}`, { method: "DELETE" });
    setDeleteTx(null);
    fetchTx();
  }

  const sectionProps = {
    onEdit: (tx: Transaction) => setEditTx(tx),
    onDelete: (tx: Transaction) => setDeleteTx(tx),
    onTogglePaid: handleTogglePaid,
  };

  return (
    <>
      {/* Modals */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Novo lançamento" width={560}>
        <ExpenseForm onSave={handleSave} onCancel={() => setShowNew(false)} loading={saving} customBanks={customBanks} />
      </Modal>

      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Editar lançamento" width={560}>
        {editTx && <ExpenseForm initial={editTx} onSave={handleSave} onCancel={() => setEditTx(null)} loading={saving} customBanks={customBanks} />}
      </Modal>

      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title="Excluir lançamento" width={420}>
        {deleteTx && (() => {
          const isInstallment = deleteTx.groupId && deleteTx.installments && deleteTx.installments > 1;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
                Excluir <b style={{ color: "var(--ink)" }}>&quot;{deleteTx.description}&quot;</b>?
              </p>
              {isInstallment && (
                <div style={{ padding: "12px 14px", background: "var(--warn-soft)", borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--warn)", fontWeight: 600, lineHeight: 1.5 }}>
                  Este lançamento faz parte de uma recorrência. Excluir só este mês ou todos os meses?
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => setDeleteTx(null)}>Cancelar</button>
                {isInstallment && (
                  <button className="btn btn-ghost" style={{ color: "var(--neg)" }} onClick={confirmDeleteOne}>
                    Só este mês
                  </button>
                )}
                <button className="btn btn-primary" style={{ background: "var(--neg)" }}
                  onClick={isInstallment ? confirmDeleteGroup : confirmDeleteOne}>
                  {isInstallment ? "Excluir todos" : "Excluir"}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Lançamentos · Despesas</div>
          <div className="page-title">{monthCap}</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <OrcaIcon name="plus" size={16} />Lançar despesa
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="content">
        {/* KPIs */}
        <div className="r-kpi-4" style={{ marginBottom: 24 }}>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="repeat" size={14} style={{ color: "var(--accent)" }} />Gastos Fixos</div>
            <div className="kpi-val num" style={{ color: "var(--accent)" }}>{fixosTotal > 0 ? formatBRL(fixosTotal) : "—"}</div>
            <div className="kpi-delta muted">{fixosAll.length} lançamento{fixosAll.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="flame" size={14} style={{ color: "#5B49C9" }} />Gastos Variáveis</div>
            <div className="kpi-val num" style={{ color: "#5B49C9" }}>{variaveisTotal > 0 ? formatBRL(variaveisTotal) : "—"}</div>
            <div className="kpi-delta muted">{variaveisAll.length} lançamento{variaveisAll.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="check" size={14} style={{ color: "var(--pos)" }} />Já pago</div>
            <div className="kpi-val num" style={{ color: "var(--pos)" }}>{totalPago > 0 ? formatBRL(totalPago) : "—"}</div>
            <div className="kpi-delta muted">{transactions.filter(t => (t.expenseType === "FIXED" || t.expenseType === "VARIABLE") && t.isPaid).length} quitados</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowUp" size={14} style={{ color: "var(--neg)" }} />Pendente</div>
            <div className="kpi-val num" style={{ color: totalPendente > 0 ? "var(--neg)" : "var(--ink-3)" }}>{totalPendente > 0 ? formatBRL(totalPendente) : "—"}</div>
            <div className="kpi-delta muted">{transactions.filter(t => (t.expenseType === "FIXED" || t.expenseType === "VARIABLE") && !t.isPaid).length} pendentes</div>
          </div>
        </div>

        {/* Filtro */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="section-label">Razão do mês</div>
          <div className="seg">
            <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>Tudo</button>
            <button className={filter === "pending" ? "on" : ""} onClick={() => setFilter("pending")}>Pendentes</button>
            <button className={filter === "paid" ? "on" : ""} onClick={() => setFilter("paid")}>Pagos</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : (
          <>
            <DenseSection title="Gastos Fixos" color="var(--accent)"
              badge={<span style={{ color: "var(--accent)" }}><OrcaIcon name="repeat" size={16} /></span>}
              items={fixos} total={fixosTotal} paidVal={sumPaid(fixosAll)}
              onMarkAllPaid={() => markAllPaid(fixos)}
              {...sectionProps}
            />
            <DenseSection title="Gastos Variáveis" color="#5B49C9"
              badge={<span style={{ color: "#5B49C9" }}><OrcaIcon name="flame" size={16} /></span>}
              items={variaveis} total={variaveisTotal} paidVal={sumPaid(variaveisAll)}
              onMarkAllPaid={() => markAllPaid(variaveis)}
              {...sectionProps}
            />

            {fixosAll.length === 0 && variaveisAll.length === 0 && (
              <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 56 }}>
                <OrcaIcon name="arrowUp" size={36} style={{ margin: "0 auto 14px", opacity: 0.18 }} />
                <p style={{ fontWeight: 700, margin: "0 0 6px", color: "var(--ink-2)", fontSize: 15 }}>Nenhuma despesa em {monthCap}</p>
                <p style={{ fontSize: 13, margin: 0 }}>Clique em <b>Lançar despesa</b> para começar.</p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
