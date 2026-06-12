"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { Modal } from "@/components/ui/modal";
import { PayToggle } from "@/components/ui/pay-toggle";
import { BatchFeedbackContent } from "@/components/dashboard/batch-feedback-content";
import { BANKS, CATEGORIES, categoriesFor, formatBRL } from "@/lib/constants";
import { fetchWithTimeoutAndRetry } from "@/lib/network";
import type { BankKey, CategoryKey } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankBalance { id: string; bank: BankKey; month: number; year: number; balance: number; }
interface BankFee     { id: string; bank: BankKey; name: string; amount: number; billingDay: number; }
interface FullBillTx  {
  id: string; bank: string | null; date: string; description: string;
  amount: number; type: "INCOME" | "EXPENSE"; category: string | null;
  isPaid: boolean; installments: number | null; installmentIndex: number | null; groupId: string | null;
}
interface Investment  { id: string; name: string; institution: string | null; value: number; }
interface BankEntry   { id: string; bank: string | null; customBankId: string | null; description: string; amount: number; type: "INCOME" | "EXPENSE"; isPaid?: boolean; groupId?: string | null; installments?: number | null; category?: string | null; }

interface CustomBank  { id: string; name: string; short: string; color: string; agency?: string | null; account?: string | null; accountType?: string | null; cutoffDay?: number | null; dueDay?: number | null; }
interface CustomBankBalance { id: string; customBankId: string; month: number; year: number; balance: number; }
interface CustomBankFee     { id: string; customBankId: string; name: string; amount: number; billingDay: number; }

interface CardFee        { id: string; name: string; amount: number; billingDay: number; }
interface CardEntry      { id: string; description: string; amount: number; type: "INCOME" | "EXPENSE"; isPaid?: boolean; groupId?: string | null; installments?: number | null; category?: string | null; }
interface CardInvestment { id: string; name: string; value: number; }
interface BankConfig     { id: string; bank: string; agency: string | null; account: string | null; accountType: string | null; cutoffDay: number | null; dueDay: number | null; }

const BANK_KEYS = Object.keys(BANKS) as BankKey[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textOnColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? "#1B1B16" : "#FFFFFF";
}

// ─── BankEntryForm (lançamento completo para entradas/saídas do banco) ─────────

const ENTRY_PARCEL_PRESETS = [1, 2, 3, 6, 12];

interface BatchEntryItem { description: string; amount: number; type: "INCOME" | "EXPENSE"; month: number; year: number; groupId?: string; installments?: number; category?: string; }

function BankEntryForm({ defaultType, cardMonth, cardYear, onSave, onCancel }: {
  defaultType: "INCOME" | "EXPENSE";
  cardMonth: number;
  cardYear: number;
  onSave: (items: BatchEntryItem[]) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [txType, setTxType]     = useState<"INCOME" | "EXPENSE">(defaultType);
  const [description, setDesc]  = useState("");
  const [amount, setAmount]     = useState("");
  const [category, setCategory] = useState<CategoryKey>(defaultType === "INCOME" ? "salario" : "compras");

  function handleTypeChange(t: "INCOME" | "EXPENSE") {
    setTxType(t);
    setCategory(t === "INCOME" ? "salario" : "compras");
  }
  const [mode, setMode]         = useState<"once" | "parcelas" | "mensal">("once");
  const [parcelas, setParcelas] = useState(1);
  const [repeatPreset, setRepeatPreset] = useState<"year" | "custom">("year");
  const [repeatUntil, setRepeatUntil]   = useState("");
  const [saving, setSaving]     = useState(false);

  const amountVal = parseFloat(amount) || 0;
  const endOfYear = `${cardYear}-12-31`;
  const repeatEndStr = mode === "mensal" ? (repeatPreset === "year" ? endOfYear : repeatUntil) : null;

  function advanceMonth(m: number, y: number, steps: number) {
    let rm = m + steps, ry = y;
    while (rm > 12) { rm -= 12; ry++; }
    return { month: rm, year: ry };
  }

  function buildItems(): BatchEntryItem[] {
    if (!description || amountVal <= 0) return [];
    const base = { amount: amountVal, type: txType, category };
    if (mode === "once") {
      return [{ ...base, description, month: cardMonth, year: cardYear }];
    }
    if (mode === "parcelas") {
      const n = Math.max(1, parcelas);
      if (n === 1) return [{ ...base, description, month: cardMonth, year: cardYear }];
      const gid = `grp-entry-${Date.now()}`;
      return Array.from({ length: n }, (_, i) => {
        const { month, year } = advanceMonth(cardMonth, cardYear, i);
        return { ...base, description: `${description} ${i + 1}/${n}`, month, year, groupId: gid, installments: n };
      });
    }
    // mensal
    if (!repeatEndStr) return [{ ...base, description, month: cardMonth, year: cardYear }];
    const [ey, em] = repeatEndStr.split("-").map(Number);
    const items: BatchEntryItem[] = [];
    let cm = cardMonth, cy = cardYear;
    while (cy < ey || (cy === ey && cm <= em)) {
      items.push({ ...base, description, month: cm, year: cy });
      const next = advanceMonth(cm, cy, 1);
      cm = next.month; cy = next.year;
    }
    if (items.length > 1) {
      const gid = `grp-entry-${Date.now()}`;
      return items.map(it => ({ ...it, groupId: gid, installments: items.length }));
    }
    return items;
  }

  const preview = buildItems();

  async function handleSave() {
    const items = buildItems();
    if (items.length === 0) return;
    setSaving(true);
    try {
      const ok = await onSave(items);
      if (ok) { setDesc(""); setAmount(""); setMode("once"); setParcelas(1); }
    } finally { setSaving(false); }
  }

  const isPos = txType === "INCOME";

  return (
    <div style={{ margin: "8px 0 4px", padding: 14, background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
      {/* Tipo */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {([["INCOME", "⬆ Entrada"], ["EXPENSE", "⬇ Saída"]] as const).map(([t, lbl]) => (
          <button key={t} type="button" onClick={() => handleTypeChange(t)} style={{
            padding: "5px 12px", fontSize: 12, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer",
            border: `1.5px solid ${txType === t ? (t === "INCOME" ? "var(--pos)" : "var(--neg)") : "var(--line)"}`,
            background: txType === t ? (t === "INCOME" ? "var(--pos-soft, #e6f4ea)" : "var(--neg-soft, #fdecea)") : "var(--surface)",
            color: txType === t ? (t === "INCOME" ? "var(--pos)" : "var(--neg)") : "var(--ink-3)",
          }}>{lbl}</button>
        ))}
      </div>

      {/* Descrição + Valor */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 10, marginBottom: 10 }}>
        <input className="orça-input" value={description} onChange={e => setDesc(e.target.value)} placeholder="Ex: Conta de água, Aluguel..." style={{ fontSize: 13 }} />
        <div className="input-prefix">
          <span className="pf" style={{ fontSize: 12 }}>R$</span>
          <input className="orça-input num" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" style={{ paddingLeft: 28, fontSize: 13 }} />
        </div>
      </div>

      {/* Categoria */}
      <div style={{ marginBottom: 10 }}>
        <select className="orça-input" value={category} onChange={e => setCategory(e.target.value as CategoryKey)} style={{ fontSize: 13, width: "100%" }}>
          {categoriesFor(txType === "INCOME" ? "income" : "expense").map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Modo */}
      <div style={{ marginBottom: 12 }}>
        <div className="seg" style={{ width: "100%" }}>
          {([["once", "À vista"], ["parcelas", "Parcelado"], ["mensal", "Mensal"]] as const).map(([m, lbl]) => (
            <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)} style={{ flex: 1 }}>{lbl}</button>
          ))}
        </div>

        {mode === "parcelas" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
              {ENTRY_PARCEL_PRESETS.map(n => (
                <button key={n} onClick={() => setParcelas(n)} style={{
                  padding: "5px 10px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: `1.5px solid ${parcelas === n ? (isPos ? "var(--pos)" : "var(--accent)") : "var(--line)"}`,
                  background: parcelas === n ? (isPos ? "var(--pos-soft, #e6f4ea)" : "var(--accent-soft)") : "var(--surface)",
                  color: parcelas === n ? (isPos ? "var(--pos)" : "var(--accent)") : "var(--ink-2)",
                }}>{n === 1 ? "À vista" : `${n}x`}</button>
              ))}
              <input className="orça-input num" type="number" min="1" max="120" value={parcelas}
                onChange={e => setParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 76, textAlign: "center", fontSize: 12 }} />
            </div>
            {amountVal > 0 && parcelas > 1 && (
              <div className="row-meta">{parcelas}x de <b className="num">{formatBRL(amountVal)}</b> · total {formatBRL(amountVal * parcelas)}</div>
            )}
          </div>
        )}

        {mode === "mensal" && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="seg" style={{ width: "100%" }}>
              <button className={repeatPreset === "year" ? "on" : ""} style={{ flex: 1 }} onClick={() => setRepeatPreset("year")}>Até fim de {cardYear}</button>
              <button className={repeatPreset === "custom" ? "on" : ""} style={{ flex: 1 }} onClick={() => setRepeatPreset("custom")}>Outra data</button>
            </div>
            {repeatPreset === "custom" && (
              <input className="orça-input" type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} style={{ fontSize: 13 }} />
            )}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 1 && (
        <div className="row-meta" style={{ marginBottom: 10, padding: "6px 10px", background: "var(--surface)", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)" }}>
          {preview.length} lançamentos · {new Date(preview[0].year, preview[0].month - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
          {" → "}
          {new Date(preview[preview.length - 1].year, preview[preview.length - 1].month - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
          {" · "}total <b className="num">{formatBRL(preview.reduce((s, i) => s + i.amount, 0))}</b>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 12 }} disabled={saving || !description || !amount} onClick={handleSave}>
        {saving ? "Salvando..." : <><OrcaIcon name="check" size={13} />{preview.length > 1 ? `Salvar ${preview.length} lançamentos` : "Salvar lançamento"}</>}
      </button>
    </div>
  );
}

// ─── DeleteEntryDialog ───────────────────────────────────────────────────────

function DeleteEntryDialog({ description, installments, onDeleteOne, onDeleteAll, onCancel }: {
  description: string;
  installments?: number | null;
  onDeleteOne: () => void;
  onDeleteAll?: () => void;
  onCancel: () => void;
}) {
  const countLabel = installments && installments > 1 ? ` (${installments})` : "";
  return (
    <div style={{ margin: "4px 0", padding: "10px 12px", background: "var(--neg-soft, #fdecea)", borderRadius: "var(--r-md)", border: "1px solid var(--neg)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--neg)", marginBottom: 8 }}>
        Remover &quot;{description}&quot;?
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onDeleteOne} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer", border: "1.5px solid var(--neg)", background: "var(--surface)", color: "var(--neg)" }}>
          Só este lançamento
        </button>
        {!!onDeleteAll && (
          <button onClick={onDeleteAll} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer", border: "1.5px solid var(--neg)", background: "var(--neg)", color: "#fff" }}>
            Todos os lançamentos{countLabel}
          </button>
        )}
        <button onClick={onCancel} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer", border: "1.5px solid var(--ink-2)", background: "var(--surface)", color: "var(--ink)" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Entry section (Entradas / Saídas) ───────────────────────────────────────

function EntrySection({
  label, type, entries, onAdd, onDelete, onUpdate, onDeleteGroup, onTotalChange, cardMonth, cardYear, onAddBatch, onTogglePaid,
}: {
  label: string;
  type: "INCOME" | "EXPENSE";
  entries: CardEntry[];
  onAdd: (desc: string, amount: number) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  onUpdate?: (id: string, desc: string, amount: number, category: string | null) => Promise<boolean>;
  onDeleteGroup?: (entry: CardEntry) => Promise<void>;
  onTotalChange?: (total: number) => void;
  cardMonth?: number;
  cardYear?: number;
  onAddBatch?: (items: BatchEntryItem[]) => Promise<boolean>;
  onTogglePaid?: (id: string, isPaid: boolean) => Promise<void>;
}) {
  const [local, setLocal] = useState<CardEntry[]>(entries);
  const [showAdd, setShowAdd] = useState(false);
  const [accOpen, setAccOpen] = useState(false);
  const [addError, setAddError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CardEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<CategoryKey>("compras");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(false);

  const entriesKey = entries.map(e => e.id).join(",");
  useEffect(() => { setLocal(entries); }, [entriesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = local.reduce((s, e) => s + Number(e.amount), 0);
  const isPos = type === "INCOME";

  useEffect(() => { onTotalChange?.(total); }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(e: CardEntry) {
    setEditingId(e.id);
    setEditDesc(e.description);
    setEditAmount(String(e.amount));
    setEditCategory((e.category as CategoryKey) ?? "compras");
    setEditError(false);
    setPendingDelete(null);
  }

  async function handleSaveEdit(e: CardEntry) {
    if (!onUpdate) return;
    const amt = parseFloat(editAmount);
    if (!editDesc || isNaN(amt) || amt <= 0) return;
    setEditSaving(true);
    setEditError(false);
    const ok = await onUpdate(e.id, editDesc, amt, editCategory);
    setEditSaving(false);
    if (ok) {
      setLocal(prev => prev.map(r => r.id === e.id ? { ...r, description: editDesc, amount: amt, category: editCategory } : r));
      setEditingId(null);
    } else {
      setEditError(true);
    }
  }

  async function handleDeleteOne(entry: CardEntry) {
    setLocal(prev => prev.filter(e => e.id !== entry.id));
    setPendingDelete(null);
    await onDelete(entry.id);
  }

  async function handleDeleteAll(entry: CardEntry) {
    if (!onDeleteGroup) return;
    if (entry.groupId) {
      setLocal(prev => prev.filter(e => e.groupId !== entry.groupId));
    } else if (entry.installments && entry.installments > 1) {
      const base = entry.description.replace(/\s+\d+\/\d+$/, "");
      setLocal(prev => prev.filter(e => e.description !== base && !e.description.startsWith(base + " ")));
    } else {
      setLocal(prev => prev.filter(e => e.id !== entry.id));
    }
    setPendingDelete(null);
    await onDeleteGroup(entry);
  }

  return (
    <div style={{ borderBottom: "1px solid var(--line-2)" }}>
      {/* Accordion header */}
      <div role="button" tabIndex={0} onClick={() => setAccOpen(o => !o)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && setAccOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
        <span style={{ display: "grid", placeItems: "center", color: "var(--ink-3)", transition: "transform .2s", transform: accOpen ? "rotate(90deg)" : "rotate(0)" }}>
          <OrcaIcon name="chevR" size={16} />
        </span>
        <span style={{ width: 8, height: 8, borderRadius: 3, flexShrink: 0, background: isPos ? "var(--pos)" : "var(--neg)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-2)" }}>{label}</span>
        {local.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", background: "var(--surface-2)", borderRadius: 999, padding: "2px 8px" }}>
            {local.length}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="num" style={{ fontWeight: 700, fontSize: 13.5, color: isPos ? (local.length === 0 ? "var(--ink-3)" : "var(--pos)") : (total === 0 ? "var(--ink-3)" : "var(--neg)") }}>
          {local.length === 0 ? <span style={{ fontWeight: 600, fontSize: 12.5 }}>Nenhum</span> : (isPos ? "+" : "−") + formatBRL(total)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); setShowAdd(o => !o); if (!accOpen) setAccOpen(true); }}
          style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line-2)", background: "var(--surface)", display: "grid", placeItems: "center", flexShrink: 0 }}
          title="Adicionar"
        >
          <OrcaIcon name="plus" size={14} style={{ color: "var(--ink-2)" }} />
        </button>
      </div>

      {/* Accordion body */}
      <div style={{ display: "grid", gridTemplateRows: accOpen ? "1fr" : "0fr", transition: "grid-template-rows .26s ease" }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ padding: "0 18px 12px" }}>
            {local.map(e => (
              <div key={e.id}>
                {editingId === e.id ? (
                  <div style={{ padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        className="orça-input"
                        value={editDesc}
                        onChange={ev => setEditDesc(ev.target.value)}
                        placeholder="Descrição"
                        style={{ flex: 2, fontSize: 13 }}
                      />
                      <div className="input-prefix" style={{ flex: 1 }}>
                        <span className="pf">R$</span>
                        <input
                          className="orça-input num"
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={ev => setEditAmount(ev.target.value)}
                          placeholder="0,00"
                          style={{ fontSize: 13 }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        className="orça-input"
                        value={editCategory}
                        onChange={ev => setEditCategory(ev.target.value as CategoryKey)}
                        style={{ flex: 1, fontSize: 12 }}
                      >
                        {(Object.keys(CATEGORIES) as CategoryKey[]).map(k => (
                          <option key={k} value={k}>{CATEGORIES[k].label}</option>
                        ))}
                      </select>
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        disabled={editSaving || !editDesc || !editAmount}
                        onClick={() => handleSaveEdit(e)}
                      >
                        {editSaving ? "..." : <><OrcaIcon name="check" size={13} />Salvar</>}
                      </button>
                    </div>
                    {editError && <div style={{ fontSize: 11.5, color: "var(--neg)", fontWeight: 700, marginTop: 5 }}>✕ Erro ao salvar — tente novamente</div>}
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: e.id.startsWith("__tmp") ? 0.5 : 1 }}>
                      {e.category && CATEGORIES[e.category as CategoryKey] && (
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: CATEGORIES[e.category as CategoryKey].color, flex: "0 0 auto" }} />
                      )}
                      <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{e.description}</span>
                      {e.installments && e.installments > 1 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>
                          {e.installments}x
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="num" style={{ fontWeight: 700, color: isPos ? "var(--pos)" : "var(--neg)" }}>
                        {isPos ? "+" : "−"}{formatBRL(Number(e.amount))}
                      </span>
                      {!e.id.startsWith("__tmp") && (
                        (e.groupId?.startsWith("salary-entry-") || e.groupId?.startsWith("bonus-entry-") || e.groupId?.startsWith("credit-entry-") || e.groupId?.startsWith("sub-entry-") || e.groupId?.startsWith("loan-entry-")) && onTogglePaid ? (
                          <PayToggle
                            paid={e.isPaid ?? false}
                            onToggle={() => {
                              const next = !(e.isPaid ?? false);
                              setLocal(prev => prev.map(r => r.id === e.id ? { ...r, isPaid: next } : r));
                              onTogglePaid(e.id, next);
                            }}
                            label={{ paid: "Recebido", pending: "Receber" }}
                          />
                        ) : (
                          <>
                            {onUpdate && (
                              <button onClick={() => startEdit(e)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 2 }}>
                                <OrcaIcon name="edit" size={13} />
                              </button>
                            )}
                            <button onClick={() => setPendingDelete(pendingDelete?.id === e.id ? null : e)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: pendingDelete?.id === e.id ? "var(--neg)" : "var(--ink-3)", padding: 2 }}>
                              <OrcaIcon name="trash" size={13} />
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </div>
                )}
                {pendingDelete?.id === e.id && (
                  <DeleteEntryDialog
                    description={e.description}
                    installments={e.installments}
                    onDeleteOne={() => handleDeleteOne(e)}
                    onDeleteAll={onDeleteGroup ? () => handleDeleteAll(e) : undefined}
                    onCancel={() => setPendingDelete(null)}
                  />
                )}
              </div>
            ))}

            {addError && (
              <div style={{ fontSize: 12, color: "var(--neg)", fontWeight: 700, marginTop: 8 }}>✕ Erro ao salvar — tente novamente</div>
            )}

            {showAdd && onAddBatch && cardMonth && cardYear && (
              <BankEntryForm
                defaultType={type}
                cardMonth={cardMonth}
                cardYear={cardYear}
                onSave={async items => {
                  setAddError(false);
                  const ok = await onAddBatch(items);
                  if (ok) { setShowAdd(false); return true; }
                  setAddError(true);
                  return false;
                }}
                onCancel={() => { setShowAdd(false); setAddError(false); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function normalizeStr(s: string) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }

function parseCsvDate(s: string): string {
  s = s.trim().replace(/"/g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m2) return `${2000 + Number(m2[3])}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseCsvAmount(s: string): number {
  let c = s.replace(/"/g, "").replace(/R\$\s?/g, "").replace(/\s/g, "");
  c = c.replace(/\.(?=\d{3}(?:[,.]|$))/g, "");
  c = c.replace(",", ".");
  return parseFloat(c) || 0;
}

function guessCategory(cat: string, desc: string): CategoryKey {
  const c = normalizeStr(cat + " " + desc);
  if (/restaur|aliment|mercado|lanch|food|padaria|sushi|pizza|burger/.test(c)) return "alim";
  if (/uber|99|taxi|onibus|metro|posto|combustiv|transporte|estacion/.test(c)) return "transp";
  if (/saude|farmac|medic|hospital|clinica|drogaria|odont/.test(c)) return "saude";
  if (/netflix|spotify|amazon|disney|youtube|prime|assinatura|streaming/.test(c)) return "assin";
  if (/viagem|hotel|aereo|passagem|airbnb|booking|hostel/.test(c)) return "viagem";
  if (/casa|moradia|aluguel|condomin|agua|luz|energia|internet|telefon/.test(c)) return "casa";
  if (/pet|veterinari|racao/.test(c)) return "pet";
  if (/academia|bem.estar|lazer|cinema|show|teatro|entreteniment/.test(c)) return "lazer";
  if (/curso|educac|livro|escola|faculdade/.test(c)) return "trab";
  if (/tarifa|imposto|taxa|iof/.test(c)) return "tarifas";
  if (/reembolso|devolu/.test(c)) return "reemb";
  return "compras";
}

interface ImportRow { id: number; date: string; description: string; amount: number; type: "EXPENSE" | "INCOME"; category: CategoryKey; include: boolean; }

function parseCsvText(text: string): ImportRow[] {
  // Strip UTF-8 BOM that some banks add to exports
  const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Detect separator: tab > semicolon > comma (count across first 8 lines)
  const countAll = (s: string) => lines.slice(0, 8).reduce((n, l) => n + l.split(s).length - 1, 0);
  const sep = countAll("\t") > 2 ? "\t" : countAll(";") > countAll(",") ? ";" : ",";

  const splitLine = (l: string) => {
    const res: string[] = []; let cur = "", inQ = false;
    for (const ch of l) {
      if (ch === '"') { inQ = !inQ; } else if (ch === sep && !inQ) { res.push(cur.trim()); cur = ""; } else cur += ch;
    }
    res.push(cur.trim()); return res;
  };

  // Auto-detect header line — some banks emit metadata rows before the real header
  const scoreKeys = ["data", "date", "dt", "lancamento", "titulo", "descricao", "historico", "valor", "amount", "credito", "debito", "tipo"];
  let headerLine = 0, bestScore = 0;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const score = splitLine(lines[i]).map(normalizeStr)
      .reduce((s, h) => s + (scoreKeys.some(k => h.includes(k)) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; headerLine = i; }
  }

  const headers = splitLine(lines[headerLine]).map(normalizeStr);
  const idx = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

  const dateIdx = idx(["data", "date", "dt"]);
  const descIdx = idx(["lancamento", "titulo", "descricao", "description", "historico", "title", "memo", "detalhe", "movimento"]);
  const amtIdx  = idx(["valor", "amount", "value", "montante"]);
  const catIdx  = idx(["categoria", "category"]);
  // "Tipo Lançamento" (BB), "Natureza", "Operação" — used to determine INCOME vs EXPENSE explicitly
  const typeIdx = idx(["tipo lancamento", "tipo", "natureza", "operacao"]);
  // Bradesco/some banks use separate credit/debit columns
  const credIdx = amtIdx < 0 ? idx(["credito"]) : -1;
  const debIdx  = amtIdx < 0 ? idx(["debito"])  : -1;

  if (dateIdx < 0 || descIdx < 0 || (amtIdx < 0 && (credIdx < 0 || debIdx < 0))) return [];

  const rows: ImportRow[] = [];
  for (let i = headerLine + 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const maxRequired = Math.max(dateIdx, descIdx, amtIdx >= 0 ? amtIdx : Math.max(credIdx, debIdx));
    if (cols.length <= maxRequired) continue;

    const description = cols[descIdx]?.replace(/"/g, "").trim() || "";
    if (!description) continue;

    // Skip balance summary rows ("Saldo Anterior", "Saldo do Dia", etc.)
    if (/\bsaldo\b/.test(normalizeStr(description))) continue;

    let amount: number;
    let inferredType: "EXPENSE" | "INCOME" | null = null;

    if (amtIdx >= 0) {
      amount = parseCsvAmount(cols[amtIdx] ?? "0");
    } else {
      const cred = parseCsvAmount(cols[credIdx] ?? "0");
      const deb  = parseCsvAmount(cols[debIdx]  ?? "0");
      amount = cred !== 0 ? cred : deb;
      inferredType = cred !== 0 ? "INCOME" : "EXPENSE";
    }
    if (amount === 0) continue;

    // Resolve type: explicit column > separate cred/deb > amount sign
    let type: "EXPENSE" | "INCOME";
    if (inferredType) {
      type = inferredType;
    } else if (typeIdx >= 0) {
      // Bank statement format (BB, Inter…): has a type column.
      // Convention: positive = income, negative = expense.
      const t = normalizeStr(cols[typeIdx] ?? "");
      if (t.includes("entrada") || t.includes("credito") || t.includes("recebido")) type = "INCOME";
      else if (t.includes("saida") || t.includes("debito") || t.includes("pagamento")) type = "EXPENSE";
      else type = amount < 0 ? "EXPENSE" : "INCOME"; // empty label → sign decides
    } else {
      // Credit card statement format (Nubank, etc.): positive = debit/expense.
      const descLow = normalizeStr(description);
      if ((descLow.includes("pagamento") || descLow.includes("payment")) && amount < 0) continue;
      type = amount > 0 ? "EXPENSE" : "INCOME";
    }

    const catRaw = catIdx >= 0 ? (cols[catIdx] ?? "") : "";
    rows.push({ id: i, date: parseCsvDate(cols[dateIdx] ?? ""), description, amount: Math.abs(amount), type, category: guessCategory(catRaw, description), include: type === "EXPENSE" });
  }
  return rows;
}

// ─── BillCsvModal (CSV import scoped to a bank card) ─────────────────────────

function BillCsvModal({ onImport, onClose }: { onImport: (rows: ImportRow[]) => Promise<void>; onClose: () => void; }) {
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  function handleTextChange(t: string) {
    setCsvText(t); setError("");
    if (t.trim()) {
      const parsed = parseCsvText(t);
      if (parsed.length === 0 && t.trim().split("\n").length > 1) setError("Formato não reconhecido. Verifique se tem colunas de data, descrição e valor.");
      setRows(parsed);
    } else setRows([]);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    handleTextChange(await file.text());
  }

  function updateRow(id: number, patch: Partial<ImportRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  async function handleImport() {
    const toCreate = rows.filter(r => r.include);
    if (toCreate.length === 0) return;
    setImporting(true);
    try { await onImport(toCreate); onClose(); }
    finally { setImporting(false); }
  }

  const included = rows.filter(r => r.include);
  const totalExp = included.filter(r => r.type === "EXPENSE").reduce((s, r) => s + r.amount, 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", width: "100%", maxWidth: 760, maxHeight: "90vh", overflow: "auto", padding: 24, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>Importar fatura CSV</div>
            <div className="row-meta">Cole o CSV exportado pelo banco — Nubank, Inter, Itaú e outros formatos padrão</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4 }}>
            <OrcaIcon name="close" size={20} />
          </button>
        </div>

        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Cole o CSV ou faça upload</label>
            <label style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--accent)", display: "flex", alignItems: "center", gap: 5 }}>
              <OrcaIcon name="plus" size={13} />Carregar arquivo
              <input type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: "none" }} />
            </label>
          </div>
          <textarea className="orça-input" style={{ minHeight: rows.length > 0 ? 70 : 120, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
            placeholder={"Exemplo (Nubank):\nData,Categoria,Título,Valor\n2024-06-01,Restaurantes,iFood,45.90"}
            value={csvText} onChange={e => handleTextChange(e.target.value)} />
          {error && <div style={{ fontSize: 12, color: "var(--neg)", fontWeight: 600, marginTop: 4 }}>{error}</div>}
        </div>

        {rows.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>{rows.length} lançamentos · {included.length} selecionados</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRows(r => r.map(x => ({ ...x, include: x.type === "EXPENSE" })))} style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer" }}>Só despesas</button>
                <button onClick={() => setRows(r => r.map(x => ({ ...x, include: true })))} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>Todos</button>
                <button onClick={() => setRows(r => r.map(x => ({ ...x, include: false })))} style={{ fontSize: 11, fontWeight: 700, color: "var(--neg)", background: "none", border: "none", cursor: "pointer" }}>Nenhum</button>
              </div>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
              {rows.map((row, i) => (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "28px 90px 1fr 110px 80px 68px", gap: 8, alignItems: "center", padding: "6px 12px", borderBottom: i < rows.length - 1 ? "1px solid var(--line-2)" : "none", background: row.include ? "var(--surface)" : "var(--surface-2)", opacity: row.include ? 1 : 0.5 }}>
                  <input type="checkbox" checked={row.include} onChange={e => updateRow(row.id, { include: e.target.checked })} style={{ cursor: "pointer", width: 15, height: 15, accentColor: "var(--accent)" }} />
                  <input className="orça-input" type="date" value={row.date} onChange={e => updateRow(row.id, { date: e.target.value })} style={{ fontSize: 11, padding: "4px 6px" }} />
                  <input className="orça-input" value={row.description} onChange={e => updateRow(row.id, { description: e.target.value })} style={{ fontSize: 12, padding: "4px 8px" }} />
                  <select className="orça-input" value={row.category} onChange={e => updateRow(row.id, { category: e.target.value as CategoryKey })} style={{ fontSize: 11, padding: "4px 6px" }}>
                    {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                  </select>
                  <input className="orça-input num" type="number" step="0.01" value={row.amount} onChange={e => updateRow(row.id, { amount: parseFloat(e.target.value) || 0 })} style={{ fontSize: 12, padding: "4px 8px", textAlign: "right" }} />
                  <span className={`status ${row.type === "INCOME" ? "paid" : "pending"}`} style={{ fontSize: 10, padding: "3px 7px", justifyContent: "center" }}>{row.type === "INCOME" ? "Estorno" : "Débito"}</span>
                </div>
              ))}
            </div>
            {included.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "8px 12px", background: "var(--surface-2)", borderRadius: "var(--r-sm)" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total a lançar</span>
                <span className="num" style={{ fontWeight: 800, fontSize: 15, color: "var(--neg)" }}>{formatBRL(-totalExp)}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={importing || included.length === 0} onClick={handleImport}>
            {importing ? "Lançando..." : <><OrcaIcon name="check" size={15} />Lançar {included.length} transações</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BillForm (inline form para lançamentos de fatura) ───────────────────────

const PARCEL_PRESETS = [1, 2, 3, 6, 12];

function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Calcula a data de faturamento a partir da data de compra, dia de corte e dia de vencimento.
// Compras até o dia de corte caem na fatura do mesmo mês; após o corte, na fatura do mês seguinte.
function getBillingDate(purchaseDate: Date, cutoffDay: number, dueDay: number, installmentOffset = 0): Date {
  let billingMonth = purchaseDate.getMonth();
  let billingYear  = purchaseDate.getFullYear();
  if (purchaseDate.getDate() >= cutoffDay) {
    billingMonth++;
    if (billingMonth > 11) { billingMonth = 0; billingYear++; }
  }
  billingMonth += installmentOffset;
  while (billingMonth > 11) { billingMonth -= 12; billingYear++; }
  return new Date(billingYear, billingMonth, dueDay);
}

function BillForm({ bank, cutoffDay, dueDay, month, year, onSave, onCancel }: {
  bank: string;
  cutoffDay?: number | null;
  dueDay?: number | null;
  month: number;
  year: number;
  onSave: (items: object[]) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [inputMode, setInputMode] = useState<"total" | "per_installment">("total");
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [parcelas, setParcelas] = useState(1);
  const [selectedCat, setSelectedCat] = useState<CategoryKey>("compras");
  const [saving, setSaving] = useState(false);
  const [showCsv, setShowCsv] = useState(false);

  function handleTxTypeChange(t: "EXPENSE" | "INCOME") {
    setTxType(t);
    setSelectedCat(t === "INCOME" ? "salario" : "compras");
  }

  const hasCutoff = !!(cutoffDay && dueDay);
  const amountVal = parseFloat(amount) || 0;
  const effectiveParcelas = Math.max(1, parcelas);
  const baseEach = inputMode === "total" ? amountVal / effectiveParcelas : amountVal;
  const baseDate = parseLocalDate(date);

  // Com data de corte: usa data de faturamento (dia de vencimento do ciclo correto)
  // Sem data de corte: usa data da compra + i meses (comportamento anterior)
  const months = Array.from({ length: effectiveParcelas }, (_, i) => {
    const d = hasCutoff
      ? getBillingDate(baseDate, cutoffDay!, dueDay!, i)
      : new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
    return { label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), date: d };
  });

  async function handleSave() {
    if (!description || !amount) return;
    setSaving(true);
    try {
      const groupId = effectiveParcelas > 1 ? `grp-${Date.now()}` : null;
      const records = months.map((m, i) => ({
        description: effectiveParcelas > 1 ? `${description} ${i + 1}/${effectiveParcelas}` : description,
        amount: baseEach,
        type: txType,
        expenseType: "BANK_BILL",
        category: selectedCat,
        bank,
        date: formatLocalDate(m.date),
        isPaid: false,
        installments: effectiveParcelas > 1 ? effectiveParcelas : null,
        installmentIndex: effectiveParcelas > 1 ? i + 1 : null,
        groupId,
      }));
      const ok = await onSave(records);
      if (ok) { setDescription(""); setAmount(""); setParcelas(1); setInputMode("total"); }
    } finally { setSaving(false); }
  }

  async function handleCsvImport(rows: ImportRow[]) {
    const items = rows.map(r => {
      let date: string;
      if (hasCutoff) {
        date = formatLocalDate(getBillingDate(parseLocalDate(r.date), cutoffDay!, dueDay!));
      } else {
        // Sem ciclo de cobrança configurado: força o mês/ano do contexto atual preservando o dia do CSV.
        // Evita que datas do extrato caiam em meses diferentes do que o usuário está visualizando.
        const [,, dayStr] = r.date.split("-");
        const rawDay = parseInt(dayStr, 10);
        const maxDay = new Date(year, month, 0).getDate();
        const day = Math.min(rawDay, maxDay);
        date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
      return {
        description: r.description, amount: r.amount, type: r.type,
        expenseType: "BANK_BILL", category: r.category, bank, date, isPaid: false,
      };
    });
    await onSave(items);
  }

  return (
    <>
      {showCsv && <BillCsvModal onImport={handleCsvImport} onClose={() => setShowCsv(false)} />}

      <div style={{ margin: "10px 0", padding: 14, background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
        {/* Tipo */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {([["EXPENSE", "⬇ Débito"], ["INCOME", "⬆ Estorno"]] as const).map(([t, lbl]) => (
            <button key={t} onClick={() => handleTxTypeChange(t)} style={{
              padding: "5px 12px", fontSize: 12, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer",
              border: `1.5px solid ${txType === t ? (t === "INCOME" ? "var(--pos)" : "var(--accent)") : "var(--line)"}`,
              background: txType === t ? (t === "INCOME" ? "var(--pos-soft, #e6f4ea)" : "var(--accent-soft)") : "var(--surface)",
              color: txType === t ? (t === "INCOME" ? "var(--pos)" : "var(--accent)") : "var(--ink-3)",
            }}>{lbl}</button>
          ))}
          <button onClick={() => setShowCsv(true)} style={{ marginLeft: "auto", padding: "5px 10px", fontSize: 11, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer", border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
            <OrcaIcon name="plus" size={12} />Importar CSV
          </button>
        </div>

        {/* Descrição + Valor */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 10, marginBottom: 10 }}>
          <input className="orça-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição" style={{ fontSize: 13 }} />
          <div style={{ display: "flex", gap: 4 }}>
            <div className="input-prefix" style={{ flex: 1 }}>
              <span className="pf" style={{ fontSize: 12 }}>R$</span>
              <input className="orça-input num" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" style={{ paddingLeft: 28, fontSize: 13 }} />
            </div>
            {txType === "EXPENSE" && effectiveParcelas > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {([["total", "÷tot"], ["per_installment", "×parc"]] as const).map(([m, lbl]) => (
                  <button key={m} onClick={() => setInputMode(m)} style={{ padding: "2px 6px", fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: "pointer", border: `1px solid ${inputMode === m ? "var(--accent)" : "var(--line)"}`, background: inputMode === m ? "var(--accent-soft)" : "var(--surface)", color: inputMode === m ? "var(--accent)" : "var(--ink-3)", whiteSpace: "nowrap" }}>{lbl}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Data + Parcelas */}
        <div style={{ display: "grid", gridTemplateColumns: txType === "EXPENSE" ? "1fr 1.4fr" : "1fr", gap: 10, marginBottom: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Data da compra</label>
            <input className="orça-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ fontSize: 13 }} />
            {hasCutoff && txType === "EXPENSE" && date && (() => {
              const d = months[0]?.date;
              const crossesMonth = d && (d.getMonth() + 1 !== month || d.getFullYear() !== year);
              return crossesMonth ? (
                <div style={{ marginTop: 4, padding: "5px 10px", background: "var(--warn-soft)", border: "1px solid var(--warn)", borderRadius: "var(--r-sm)", fontSize: 11.5, fontWeight: 700, color: "var(--warn)" }}>
                  ⚠ Após o corte — cai na fatura de {months[0]?.label} (vence dia {dueDay})
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginTop: 3 }}>
                  Fatura de {months[0]?.label} · vence dia {dueDay}
                </div>
              );
            })()}
            {!hasCutoff && cutoffDay && txType === "EXPENSE" && (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--warn)", fontWeight: 600 }}>
                Configure o dia de vencimento para ajuste automático da fatura
              </div>
            )}
          </div>
          {txType === "EXPENSE" && (
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontSize: 11 }}>Parcelas</label>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {PARCEL_PRESETS.map(n => (
                  <button key={n} onClick={() => setParcelas(n)} style={{ padding: "5px 8px", borderRadius: "var(--r-sm)", fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${parcelas === n ? "var(--accent)" : "var(--line)"}`, background: parcelas === n ? "var(--accent-soft)" : "var(--surface)", color: parcelas === n ? "var(--accent)" : "var(--ink-2)" }}>
                    {n === 1 ? "À vista" : `${n}x`}
                  </button>
                ))}
                <input className="orça-input num" type="number" min="1" max="120" value={parcelas} onChange={e => setParcelas(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 76, textAlign: "center", fontSize: 12 }} />
              </div>
              {amountVal > 0 && effectiveParcelas > 1 && (
                <div className="row-meta" style={{ marginTop: 4 }}>
                  {inputMode === "total"
                    ? <>{effectiveParcelas}x de <b className="num">{formatBRL(amountVal / effectiveParcelas)}</b></>
                    : <>Total: <b className="num">{formatBRL(amountVal * effectiveParcelas)}</b></>}
                  {" · "}até {months[months.length - 1]?.label}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Categoria */}
        <div className="field" style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>Categoria</label>
          <select className="orça-input" value={selectedCat} onChange={e => setSelectedCat(e.target.value as CategoryKey)} style={{ fontSize: 13, width: "100%" }}>
            {categoriesFor(txType === "INCOME" ? "income" : "expense").map(([k, c]) => (
              <option key={k} value={k}>{c.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: 12 }} onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: "center", fontSize: 12 }} disabled={saving || !description || !amount} onClick={handleSave}>
            {saving ? "Salvando..." : <><OrcaIcon name="check" size={13} />Salvar lançamento</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── BankExtractCsvModal ─────────────────────────────────────────────────────

function isFeeRow(row: ImportRow, fees: CardFee[]): boolean {
  if (!fees.length) return false;
  const d = normalizeStr(row.description);
  return fees.some(f => {
    const fn = normalizeStr(f.name);
    if (fn.length < 3 || d.length < 3) return false;
    return d.includes(fn) || fn.includes(d);
  });
}

function BankExtractCsvModal({ bankName, fees, onImport, onClose }: {
  bankName: string;
  fees: CardFee[];
  onImport: (items: BatchEntryItem[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  function handleTextChange(t: string) {
    setCsvText(t); setError("");
    if (t.trim()) {
      const parsed = parseCsvText(t);
      if (parsed.length === 0 && t.trim().split("\n").length > 1)
        setError("Formato não reconhecido. Verifique se tem colunas de data, descrição e valor.");
      setRows(parsed.map(r => ({ ...r, include: !isFeeRow(r, fees) })));
    } else setRows([]);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    handleTextChange(await file.text());
  }

  function updateRow(id: number, patch: Partial<ImportRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  async function handleImport() {
    const toCreate = rows.filter(r => r.include);
    if (!toCreate.length) return;
    setImporting(true);
    try {
      const items: BatchEntryItem[] = toCreate.map(r => {
        const [year, month] = r.date.split("-").map(Number);
        return { description: r.description, amount: r.amount, type: r.type, month, year, category: r.category };
      });
      const ok = await onImport(items);
      if (ok) onClose();
    } finally { setImporting(false); }
  }

  const included  = rows.filter(r => r.include);
  const feeRows   = rows.filter(r => isFeeRow(r, fees));
  const totalInc  = included.filter(r => r.type === "INCOME").reduce((s, r) => s + r.amount, 0);
  const totalExp  = included.filter(r => r.type === "EXPENSE").reduce((s, r) => s + r.amount, 0);

  function monthLabel(dateStr: string) {
    const [, m, ] = dateStr.split("-").map(Number);
    const y = dateStr.split("-")[0].slice(2);
    return `${String(m).padStart(2, "0")}/${y}`;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", width: "100%", maxWidth: 780, maxHeight: "90vh", overflow: "auto", padding: 24, boxShadow: "var(--shadow-lg)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>Importar extrato — {bankName}</div>
            <div className="row-meta">Cole o CSV do seu extrato bancário. Taxas já cadastradas são excluídas automaticamente.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4 }}>
            <OrcaIcon name="close" size={20} />
          </button>
        </div>

        {/* Input */}
        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Cole o CSV ou faça upload</label>
            <label style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--accent)", display: "flex", alignItems: "center", gap: 5 }}>
              <OrcaIcon name="plus" size={13} />Carregar arquivo
              <input type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: "none" }} />
            </label>
          </div>
          <textarea className="orça-input" style={{ minHeight: rows.length > 0 ? 70 : 120, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
            placeholder={"Data,Descrição,Valor\n2026-06-01,Salário,3500.00\n2026-06-05,Supermercado,-180.50"}
            value={csvText} onChange={e => handleTextChange(e.target.value)} />
          {error && <div style={{ fontSize: 12, color: "var(--neg)", fontWeight: 600, marginTop: 4 }}>{error}</div>}
        </div>

        {/* Fee exclusion notice */}
        {feeRows.length > 0 && (
          <div style={{ margin: "8px 0", padding: "7px 12px", background: "var(--warn-soft, #fef9ec)", borderRadius: "var(--r-sm)", border: "1px solid var(--warn)", display: "flex", alignItems: "center", gap: 8 }}>
            <OrcaIcon name="coins" size={14} style={{ color: "var(--warn)", flex: "0 0 auto" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warn)" }}>
              {feeRows.length} lançamento{feeRows.length !== 1 ? "s" : ""} identificado{feeRows.length !== 1 ? "s" : ""} como taxa já cadastrada e desmarcado{feeRows.length !== 1 ? "s" : ""} automaticamente.
            </span>
          </div>
        )}

        {/* Rows table */}
        {rows.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>{rows.length} lançamentos · {included.length} selecionados</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRows(r => r.map(x => ({ ...x, include: !isFeeRow(x, fees) })))} style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer" }}>Sem taxas</button>
                <button onClick={() => setRows(r => r.map(x => ({ ...x, include: true })))} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>Todos</button>
                <button onClick={() => setRows(r => r.map(x => ({ ...x, include: false })))} style={{ fontSize: 11, fontWeight: 700, color: "var(--neg)", background: "none", border: "none", cursor: "pointer" }}>Nenhum</button>
              </div>
            </div>

            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
              {rows.map((row, i) => {
                const isFee = isFeeRow(row, fees);
                return (
                  <div key={row.id} style={{ display: "grid", gridTemplateColumns: "28px 56px 1fr 108px 80px 72px", gap: 8, alignItems: "center", padding: "6px 12px", borderBottom: i < rows.length - 1 ? "1px solid var(--line-2)" : "none", background: isFee ? "var(--warn-soft, #fef9ec)" : row.include ? "var(--surface)" : "var(--surface-2)", opacity: row.include ? 1 : 0.55 }}>
                    <input type="checkbox" checked={row.include} onChange={e => updateRow(row.id, { include: e.target.checked })} style={{ cursor: "pointer", width: 15, height: 15, accentColor: "var(--accent)" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textAlign: "center" }}>{monthLabel(row.date)}</span>
                    <input className="orça-input" value={row.description} onChange={e => updateRow(row.id, { description: e.target.value })} style={{ fontSize: 12, padding: "4px 8px" }} />
                    <select className="orça-input" value={row.category} onChange={e => updateRow(row.id, { category: e.target.value as CategoryKey })} style={{ fontSize: 11, padding: "4px 6px" }}>
                      {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                    </select>
                    <input className="orça-input num" type="number" step="0.01" value={row.amount} onChange={e => updateRow(row.id, { amount: parseFloat(e.target.value) || 0 })} style={{ fontSize: 12, padding: "4px 8px", textAlign: "right" }} />
                    {isFee
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: "var(--warn)", background: "rgba(201,138,30,.15)", padding: "3px 7px", borderRadius: 4, textAlign: "center" }}>Taxa</span>
                      : <span className={`status ${row.type === "INCOME" ? "paid" : "pending"}`} style={{ fontSize: 10, padding: "3px 7px", justifyContent: "center" }} onClick={() => updateRow(row.id, { type: row.type === "INCOME" ? "EXPENSE" : "INCOME" })} title="Clique para inverter">{row.type === "INCOME" ? "Entrada" : "Saída"}</span>
                    }
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            {included.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                {totalInc > 0 && (
                  <div style={{ flex: 1, padding: "7px 12px", background: "var(--pos-soft, #e6f4ea)", borderRadius: "var(--r-sm)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pos)" }}>Entradas</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 800, color: "var(--pos)" }}>+{formatBRL(totalInc)}</span>
                  </div>
                )}
                {totalExp > 0 && (
                  <div style={{ flex: 1, padding: "7px 12px", background: "var(--neg-soft, #fdecea)", borderRadius: "var(--r-sm)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--neg)" }}>Saídas</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 800, color: "var(--neg)" }}>−{formatBRL(totalExp)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={importing || included.length === 0} onClick={handleImport}>
            {importing ? "Lançando..." : <><OrcaIcon name="check" size={15} />Lançar {included.length} {included.length === 1 ? "item" : "itens"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditBillModal ────────────────────────────────────────────────────────────

function EditBillModal({
  tx, bank, cutoffDay, dueDay, month, year,
  onUpdateSingle, onSaveBatch, onDeleteGroup, onClose,
}: {
  tx: FullBillTx;
  bank: string;
  cutoffDay?: number | null;
  dueDay?: number | null;
  month: number;
  year: number;
  onUpdateSingle: (id: string, desc: string, amount: number, category: string | null, type: "EXPENSE" | "INCOME", bank: string) => Promise<boolean>;
  onSaveBatch: (items: object[]) => Promise<boolean>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onClose: () => void;
}) {
  const isGroup = !!(tx.installments && tx.installments > 1 && tx.groupId);
  const baseDesc = isGroup ? tx.description.replace(/\s+\d+\/\d+$/, "") : tx.description;

  const [txType, setTxType]     = useState<"EXPENSE" | "INCOME">(tx.type);
  const [description, setDesc]  = useState(baseDesc);
  const [amount, setAmount]     = useState(String(tx.amount));
  const [parcelas, setParcelas] = useState(tx.installments ?? 1);
  const [date, setDate]         = useState(tx.date.split("T")[0]);
  const [category, setCategory] = useState<CategoryKey>((tx.category as CategoryKey) ?? "compras");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const hasCutoff = !!(cutoffDay && dueDay);

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!description || isNaN(amt) || amt <= 0) { setError("Preencha descrição e valor."); return; }
    setSaving(true);
    setError("");
    try {
      if (isGroup && tx.groupId) {
        const baseDate = parseLocalDate(date);
        const newGroupId = `grp-${Date.now()}`;
        const records = Array.from({ length: parcelas }, (_, i) => {
          const d = hasCutoff
            ? getBillingDate(baseDate, cutoffDay!, dueDay!, i)
            : new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
          return {
            description: parcelas > 1 ? `${description} ${i + 1}/${parcelas}` : description,
            amount: amt,
            type: txType,
            expenseType: "BANK_BILL",
            category,
            bank,
            date: formatLocalDate(d),
            isPaid: false,
            installments: parcelas > 1 ? parcelas : null,
            installmentIndex: parcelas > 1 ? i + 1 : null,
            groupId: parcelas > 1 ? newGroupId : null,
          };
        });
        await onDeleteGroup(tx.groupId);
        const ok = await onSaveBatch(records);
        if (ok) onClose();
        else setError("Erro ao recriar parcelas — tente novamente.");
      } else {
        const ok = await onUpdateSingle(tx.id, description, amt, category, txType, bank);
        if (ok) onClose();
        else setError("Erro ao salvar — tente novamente.");
      }
    } catch {
      setError("Erro inesperado — tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tipo */}
      <div style={{ display: "flex", gap: 6 }}>
        {([["EXPENSE", "⬇ Débito"], ["INCOME", "⬆ Estorno"]] as const).map(([t, lbl]) => (
          <button key={t} onClick={() => setTxType(t)} style={{
            padding: "6px 14px", fontSize: 13, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer",
            border: `1.5px solid ${txType === t ? (t === "INCOME" ? "var(--pos)" : "var(--accent)") : "var(--line)"}`,
            background: txType === t ? (t === "INCOME" ? "var(--pos-soft)" : "var(--accent-soft)") : "var(--surface)",
            color: txType === t ? (t === "INCOME" ? "var(--pos)" : "var(--accent)") : "var(--ink-3)",
          }}>{lbl}</button>
        ))}
      </div>

      {/* Descrição */}
      <div className="field">
        <label>Descrição</label>
        <input className="orça-input" value={description}
          onChange={e => { setDesc(e.target.value); setError(""); }}
          placeholder="Ex: AliExpress, Posto Shell…" />
      </div>

      {/* Valor + Parcelas */}
      <div className="field-row-2">
        <div className="field">
          <label>Valor {isGroup ? "por parcela" : ""}</label>
          <div className="input-prefix">
            <span className="pf">R$</span>
            <input className="orça-input num" type="number" step="0.01" value={amount}
              onChange={e => { setAmount(e.target.value); setError(""); }}
              placeholder="0,00" style={{ paddingLeft: 34 }} />
          </div>
        </div>
        <div className="field">
          <label>Parcelas</label>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 6, 12].map(n => (
              <button key={n} type="button" onClick={() => setParcelas(n)} style={{
                padding: "6px 10px", borderRadius: "var(--r-sm)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: `1.5px solid ${parcelas === n ? "var(--accent)" : "var(--line)"}`,
                background: parcelas === n ? "var(--accent-soft)" : "var(--surface)",
                color: parcelas === n ? "var(--accent)" : "var(--ink-2)",
              }}>{n}x</button>
            ))}
          </div>
        </div>
      </div>

      {/* Data + Categoria */}
      <div className="field-row-2">
        <div className="field">
          <label>Data{isGroup ? " da 1ª parcela" : ""}</label>
          <input className="orça-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Categoria</label>
          <select className="orça-input" value={category} onChange={e => setCategory(e.target.value as CategoryKey)}>
            {(Object.keys(CATEGORIES) as CategoryKey[]).map(k => (
              <option key={k} value={k}>{CATEGORIES[k].label}</option>
            ))}
          </select>
        </div>
      </div>

      {isGroup && (
        <div style={{ padding: "10px 14px", background: "var(--warn-soft)", borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--warn)", fontWeight: 600, lineHeight: 1.5 }}>
          Este lançamento faz parte de um parcelamento de {tx.installments}x. Salvar vai recriar todas as parcelas com os novos dados.
        </div>
      )}

      {error && <div style={{ fontSize: 13, color: "var(--neg)", fontWeight: 700 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !description || !amount}>
          {saving ? "Salvando…" : <><OrcaIcon name="check" size={14} />Salvar alterações</>}
        </button>
      </div>
    </div>
  );
}

// ─── Bank Card ────────────────────────────────────────────────────────────────

function BankCard({
  name, short, color, textColor,
  bankId,
  balance, prevBalance, fees, billTransactions = [], hasCreditCard = true, investments, entradas, saidas,
  onSaveBalance, onClearBalance, onAddFee, onDeleteFee, onAddEntry, onDeleteEntry, onUpdateEntry,
  onAddBillTxs, onUpdateBillTx, onDeleteBillTx, onDeleteBillTxGroup, onDeleteEntryGroup, onTogglePaid,
  onPayAllBillTxs, onDeleteAllBillTxs,
  onAddEntryBatch, onToggleEntryPaid,
  isCustom, onDeleteBank, onConfigureBank, isClosed = false, onToggleClose,
  month, year, isFuture = false,
  cutoffDay, dueDay,
}: {
  name: string; short: string; color: string; textColor: string;
  bankId: string;
  balance: number | null;
  prevBalance: number | null;
  fees: CardFee[];
  billTransactions?: FullBillTx[];
  hasCreditCard?: boolean;
  investments: CardInvestment[];
  entradas: CardEntry[];
  saidas: CardEntry[];
  onSaveBalance: (v: number) => Promise<boolean>;
  onClearBalance?: () => Promise<void>;
  onAddFee: (name: string, amount: number, day: number) => Promise<boolean>;
  onDeleteFee: (id: string) => Promise<void>;
  onAddEntry: (desc: string, amount: number, type: "INCOME" | "EXPENSE") => Promise<boolean>;
  onDeleteEntry: (id: string) => Promise<void>;
  onUpdateEntry?: (id: string, desc: string, amount: number, category: string | null) => Promise<boolean>;
  onAddEntryBatch?: (items: BatchEntryItem[]) => Promise<boolean>;
  onAddBillTxs?: (items: object[]) => Promise<boolean>;
  onUpdateBillTx?: (id: string, desc: string, amount: number, category: string | null, type: "EXPENSE" | "INCOME", bank: string) => Promise<boolean>;
  onDeleteBillTx?: (id: string) => Promise<void>;
  onDeleteBillTxGroup?: (groupId: string) => Promise<void>;
  onPayAllBillTxs?: () => Promise<void>;
  onDeleteAllBillTxs?: () => Promise<void>;
  onDeleteEntryGroup?: (entry: CardEntry) => Promise<void>;
  onTogglePaid?: (id: string, isPaid: boolean) => Promise<void>;
  onToggleEntryPaid?: (id: string, isPaid: boolean) => Promise<void>;
  isCustom?: boolean;
  onDeleteBank?: () => Promise<void>;
  onConfigureBank?: () => void;
  isClosed?: boolean;
  onToggleClose?: () => void;
  month: number;
  year: number;
  isFuture?: boolean;
  cutoffDay?: number | null;
  dueDay?: number | null;
}) {
  const balanceKey = `${bankId}:${month}:${year}`;
  // localBal: saldo inicial deste mês (manual). Pré-preenche do mês anterior se vazio.
  const [localBal, setLocalBal] = useState<number | null>(balance);
  const [balInput, setBalInput] = useState("");
  // true quando já existe saldo salvo (evita que useEffect/fetchAll preencham o campo)
  const inputClearedRef = useRef(balance !== null);
  const [savingBal, setSavingBal] = useState(false);
  const [balStatus, setBalStatus] = useState<"ok" | "err" | null>(null);
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeName, setFeeName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeDay, setFeeDay] = useState("1");
  const [savingFee, setSavingFee] = useState(false);
  const [feeError, setFeeError] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [pendingBillDelete, setPendingBillDelete] = useState<FullBillTx | null>(null);
  const [editingBillTx, setEditingBillTx] = useState<FullBillTx | null>(null);
  const [showExtract, setShowExtract] = useState(false);
  const [showBalForm, setShowBalForm] = useState(false);
  const [openTarifas, setOpenTarifas] = useState(false);
  const [openFatura, setOpenFatura] = useState(false);
  const [billNotice, setBillNotice] = useState<string | null>(null);

  // Evita vazamento de saldo local ao trocar de mês (mesma key do componente por banco)
  // Reset completo só ao trocar de mês — nunca zera localBal por fetch stale
  useEffect(() => {
    setLocalBal(balance);
    inputClearedRef.current = balance !== null;
    setBalInput("");
    setBalStatus(null);
  }, [balanceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega saldo do DB; só atualiza quando chega valor real (evita lag de read-after-write)
  useEffect(() => {
    if (balance !== null) {
      setLocalBal(balance);
      inputClearedRef.current = true;
    }
  }, [balance]);

  // totais locais — atualizados por callbacks dos EntrySection filhos
  const [localEntTotal, setLocalEntTotal] = useState(entradas.reduce((s, e) => s + Number(e.amount), 0));
  const [localSaiTotal, setLocalSaiTotal] = useState(saidas.reduce((s, e) => s + Number(e.amount), 0));

  const entradasKey = entradas.map(e => e.id).join(",");
  const saidasKey   = saidas.map(e => e.id).join(",");
  useEffect(() => { setLocalEntTotal(entradas.reduce((s, e) => s + Number(e.amount), 0)); }, [entradasKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalSaiTotal(saidas.reduce((s, e) => s + Number(e.amount), 0)); }, [saidasKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const totalFees   = fees.reduce((s, f) => s + Number(f.amount), 0);
  const totalInvest = investments.reduce((s, i) => s + Number(i.value), 0);

  // Saldo real: só faturas já pagas
  const paidBillExp = billTransactions.filter(t => t.type === "EXPENSE" && t.isPaid).reduce((s, t) => s + Number(t.amount), 0);
  const paidBillInc = billTransactions.filter(t => t.type === "INCOME" && t.isPaid).reduce((s, t) => s + Number(t.amount), 0);
  const netBill     = Math.max(0, paidBillExp - paidBillInc);
  const saldoInicial  = localBal ?? (prevBalance ?? 0);
  const saldoConta    = saldoInicial + localEntTotal - localSaiTotal - totalFees - (hasCreditCard ? netBill : 0);

  // Valor total: considera todas as faturas (pagas + pendentes)
  const totalBillExp = billTransactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
  const totalBillInc = billTransactions.filter(t => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
  const totalBillNet = Math.max(0, totalBillExp - totalBillInc);
  const saldoTotal   = saldoInicial + localEntTotal - localSaiTotal - totalFees - (hasCreditCard ? totalBillNet : 0);

  async function handleSaveBal() {
    const val = parseFloat(balInput);
    if (isNaN(val)) return;
    setSavingBal(true);
    setBalStatus(null);
    try {
      const ok = await onSaveBalance(val);
      if (ok) {
        setLocalBal(val);
        setBalInput("");
        inputClearedRef.current = true;
        setBalStatus("ok");
        setTimeout(() => setBalStatus(null), 3000);
      } else {
        setBalStatus("err");
      }
    } finally { setSavingBal(false); }
  }

  async function handleAddFee() {
    const val = parseFloat(feeAmount);
    if (!feeName || isNaN(val) || val <= 0) return;
    setSavingFee(true);
    setFeeError(false);
    try {
      const ok = await onAddFee(feeName, val, parseInt(feeDay) || 1);
      if (ok) {
        setFeeName(""); setFeeAmount(""); setFeeDay("1"); setShowFeeForm(false);
      } else {
        setFeeError(true);
      }
    } finally { setSavingFee(false); }
  }

  if (isClosed) {
    return (
      <div className="card" style={{ overflow: "hidden", opacity: 0.75 }}>
        <div style={{ padding: "12px 18px", background: color, color: textColor, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12 }}>
              {short}
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{name}</div>
              <div style={{ fontSize: 11, opacity: 0.65, fontWeight: 600 }}>Conta fechada</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, opacity: 0.8 }}>
              {formatBRL(saldoConta)}
            </span>
            {onToggleClose && (
              <button onClick={onToggleClose} style={{ background: "rgba(255,255,255,0.18)", border: "none", cursor: "pointer", color: textColor, padding: "5px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700 }}>
                <OrcaIcon name="plus" size={13} />Reabrir
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {editingBillTx && onUpdateBillTx && onAddBillTxs && onDeleteBillTxGroup && (
        <Modal open onClose={() => setEditingBillTx(null)} title="Editar lançamento de fatura" width={520}>
          <EditBillModal
            tx={editingBillTx}
            bank={bankId}
            cutoffDay={cutoffDay}
            dueDay={dueDay}
            month={month}
            year={year}
            onUpdateSingle={onUpdateBillTx}
            onSaveBatch={onAddBillTxs}
            onDeleteGroup={onDeleteBillTxGroup}
            onClose={() => setEditingBillTx(null)}
          />
        </Modal>
      )}

      {showExtract && onAddEntryBatch && (
        <BankExtractCsvModal
          bankName={name}
          fees={fees}
          onImport={onAddEntryBatch}
          onClose={() => setShowExtract(false)}
        />
      )}

      {/* ── Header ── */}
      <div style={{ background: color, color: textColor }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px" }}>
          {/* LEFT: badge + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.25)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: textColor, flexShrink: 0 }}>
              {short}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-.01em" }}>{name}</div>
              <div style={{ fontSize: 11.5, opacity: 0.82 }}>Conta corrente</div>
            </div>
          </div>
          {/* RIGHT: balance + actions */}
          <div style={{ display: "flex", alignItems: "flex-end", flexDirection: "column", gap: 6 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.8, marginBottom: 2 }}>Saldo real</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, letterSpacing: "-.02em" }}>
                {formatBRL(saldoConta)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {onAddEntryBatch && (
                <button onClick={() => setShowExtract(true)} style={{ width: 30, height: 30, background: "rgba(255,255,255,.16)", border: "none", cursor: "pointer", color: textColor, borderRadius: 8, display: "grid", placeItems: "center" }} title="Importar extrato CSV">
                  <OrcaIcon name="upload" size={14} />
                </button>
              )}
              {onConfigureBank && (
                <button onClick={onConfigureBank} style={{ width: 30, height: 30, background: "rgba(255,255,255,.16)", border: "none", cursor: "pointer", color: textColor, borderRadius: 8, display: "grid", placeItems: "center" }} title="Configurar banco">
                  <OrcaIcon name="settings" size={14} />
                </button>
              )}
              {isCustom && onDeleteBank && (
                <button onClick={onDeleteBank} style={{ width: 30, height: 30, background: "rgba(255,255,255,.16)", border: "none", cursor: "pointer", color: textColor, borderRadius: 8, display: "grid", placeItems: "center" }} title="Excluir banco">
                  <OrcaIcon name="trash" size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Stats strip */}
        <div style={{ display: "flex", gap: 7, padding: "0 18px 14px" }}>
          {[
            { label: "Inicial", value: saldoInicial, prefix: "" },
            { label: "Entradas", value: localEntTotal, prefix: "+" },
            { label: "Saídas", value: localSaiTotal, prefix: "−" },
            { label: "Tarifas", value: totalFees, prefix: "−" },
            ...(hasCreditCard ? [{ label: "Fatura", value: netBill, prefix: "−" }] : []),
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, background: "rgba(255,255,255,.14)", borderRadius: 10, padding: "8px 9px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", opacity: 0.82, marginBottom: 2 }}>{stat.label}</div>
              <div className="num" style={{ fontSize: 13, fontWeight: 700 }}>
                {stat.value === 0 ? "—" : stat.prefix + formatBRL(stat.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Saldo inicial (slim row) ── */}
      <div style={{ borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "11px 18px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-3)" }}>Saldo inicial</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{formatBRL(localBal ?? (prevBalance ?? 0))}</span>
            {prevBalance !== null && (
              <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                · fechamento anterior {formatBRL(prevBalance)}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowBalForm(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid var(--line-2)", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "var(--ink-2)", background: "var(--surface)", cursor: "pointer", flexShrink: 0 }}
          >
            <OrcaIcon name="edit" size={13} />Ajustar
          </button>
        </div>
        {/* Collapsible balance form */}
        {showBalForm && (
          <div style={{ padding: "0 18px 14px" }}>
            {prevBalance !== null && localBal === null && entradas.length === 0 && saidas.length === 0 && (
              <button
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "center", fontSize: 12, marginBottom: 10 }}
                disabled={savingBal}
                onClick={async () => {
                  setSavingBal(true);
                  setBalStatus(null);
                  try {
                    const ok = await onSaveBalance(prevBalance);
                    if (ok) {
                      setLocalBal(prevBalance);
                      setBalInput("");
                      inputClearedRef.current = true;
                      setBalStatus("ok");
                      setTimeout(() => setBalStatus(null), 3000);
                    } else {
                      setBalStatus("err");
                    }
                  } finally { setSavingBal(false); }
                }}
              >
                <OrcaIcon name="wallet" size={13} />
                {savingBal ? "Salvando..." : `Usar saldo do mês anterior como inicial (${formatBRL(prevBalance)})`}
              </button>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <div className="input-prefix" style={{ flex: 1 }}>
                <span className="pf">R$</span>
                <input className="orça-input num" type="number" step="0.01" value={balInput} onChange={e => setBalInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveBal()} placeholder="0,00" style={{ fontSize: 15, fontWeight: 700 }} />
              </div>
              <button className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" }} disabled={savingBal || balInput === ""} onClick={handleSaveBal}>
                {savingBal ? "..." : <><OrcaIcon name="check" size={14} />Incluir</>}
              </button>
            </div>
            {balStatus === "err" && (
              <div style={{ marginTop: 7, fontSize: 12, color: "var(--neg)", fontWeight: 700 }}>
                ✕ Erro ao salvar — verifique a conexão
              </div>
            )}
            {balStatus === "ok" && (
              <div style={{ marginTop: 7, fontSize: 12, color: "var(--pos)", fontWeight: 700 }}>
                ✓ Salvo no banco com sucesso
              </div>
            )}
            {localBal !== null && (
              <div style={{ marginTop: 7, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>
                  Registrado: <span className="num" style={{ color: "var(--pos)", fontWeight: 700 }}>{formatBRL(localBal)}</span>
                </span>
                {onClearBalance && (
                  <button
                    onClick={async () => {
                      if (!confirm("Limpar saldo deste mês?")) return;
                      await onClearBalance();
                      setLocalBal(null);
                      setBalInput("");
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: "2px 4px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <OrcaIcon name="trash" size={12} />Limpar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Entradas ── */}
      <EntrySection label="Entradas" type="INCOME" entries={entradas}
        onAdd={(d, a) => onAddEntry(d, a, "INCOME")} onDelete={onDeleteEntry}
        onUpdate={onUpdateEntry}
        onDeleteGroup={onDeleteEntryGroup} onTotalChange={setLocalEntTotal}
        cardMonth={month} cardYear={year} onAddBatch={onAddEntryBatch}
        onTogglePaid={onToggleEntryPaid} />

      {/* ── Saídas ── */}
      <EntrySection label="Saídas" type="EXPENSE" entries={saidas}
        onAdd={(d, a) => onAddEntry(d, a, "EXPENSE")} onDelete={onDeleteEntry}
        onUpdate={onUpdateEntry}
        onDeleteGroup={onDeleteEntryGroup} onTotalChange={setLocalSaiTotal}
        cardMonth={month} cardYear={year} onAddBatch={onAddEntryBatch}
        onTogglePaid={onToggleEntryPaid} />

      {/* ── Tarifas ── */}
      <div style={{ borderBottom: "1px solid var(--line-2)" }}>
        {/* Accordion header */}
        <div role="button" tabIndex={0} onClick={() => setOpenTarifas(o => !o)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && setOpenTarifas(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
          <span style={{ display: "grid", placeItems: "center", color: "var(--ink-3)", transition: "transform .2s", transform: openTarifas ? "rotate(90deg)" : "rotate(0)" }}>
            <OrcaIcon name="chevR" size={16} />
          </span>
          <span style={{ width: 8, height: 8, borderRadius: 3, flexShrink: 0, background: "var(--warn, #C98A1E)" }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-2)" }}>Tarifas bancárias</span>
          {fees.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", background: "var(--surface-2)", borderRadius: 999, padding: "2px 8px" }}>
              {fees.length}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span className="num" style={{ fontWeight: 700, fontSize: 13.5, color: fees.length === 0 ? "var(--ink-3)" : "var(--neg)" }}>
            {fees.length === 0 ? <span style={{ fontWeight: 600, fontSize: 12.5 }}>Nenhuma</span> : "−" + formatBRL(totalFees)}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setShowFeeForm(o => !o); if (!openTarifas) setOpenTarifas(true); }}
            style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line-2)", background: "var(--surface)", display: "grid", placeItems: "center", flexShrink: 0 }}
            title="Adicionar tarifa"
          >
            <OrcaIcon name="plus" size={14} style={{ color: "var(--ink-2)" }} />
          </button>
        </div>

        {/* Accordion body */}
        <div style={{ display: "grid", gridTemplateRows: openTarifas ? "1fr" : "0fr", transition: "grid-template-rows .26s ease" }}>
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div style={{ padding: "0 18px 12px" }}>
              {fees.map(fee => (
                <div key={fee.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{fee.name}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: 6 }}>dia {fee.billingDay}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="num" style={{ color: "var(--neg)", fontWeight: 700 }}>−{formatBRL(Number(fee.amount))}</span>
                    <button onClick={() => onDeleteFee(fee.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 2 }}>
                      <OrcaIcon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {showFeeForm && (
                <div style={{ marginTop: 10, padding: 12, background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 96px 80px", gap: 8, marginBottom: 8 }}>
                    <input className="orça-input" placeholder="Nome da tarifa" value={feeName} onChange={e => setFeeName(e.target.value)} style={{ fontSize: 13 }} />
                    <input className="orça-input num" type="number" step="0.01" placeholder="Valor R$" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} style={{ fontSize: 13 }} />
                    <input className="orça-input num" type="number" min="1" max="31" placeholder="Dia" value={feeDay} onChange={e => setFeeDay(e.target.value)} style={{ fontSize: 13, textAlign: "center" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, marginBottom: feeError ? 4 : 8 }}>Nome · Valor (R$) · Dia de cobrança</div>
                  {feeError && <div style={{ fontSize: 12, color: "var(--neg)", fontWeight: 700, marginBottom: 8 }}>✕ Erro ao salvar tarifa — tente novamente</div>}
                  <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} disabled={savingFee || !feeName || !feeAmount} onClick={handleAddFee}>
                    {savingFee ? "Salvando..." : <><OrcaIcon name="check" size={13} />Salvar tarifa</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fatura Cartão de Crédito ── */}
      {hasCreditCard && (
        <div style={{ borderBottom: "1px solid var(--line-2)" }}>
          {/* Accordion header */}
          <div role="button" tabIndex={0} onClick={() => setOpenFatura(o => !o)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && setOpenFatura(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
            <span style={{ display: "grid", placeItems: "center", color: "var(--ink-3)", transition: "transform .2s", transform: openFatura ? "rotate(90deg)" : "rotate(0)" }}>
              <OrcaIcon name="chevR" size={16} />
            </span>
            <span style={{ width: 8, height: 8, borderRadius: 3, flexShrink: 0, background: color, opacity: 0.8 }} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-2)" }}>Fatura cartão</span>
            {billTransactions.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", background: "var(--surface-2)", borderRadius: 999, padding: "2px 8px" }}>
                {billTransactions.length}
              </span>
            )}
            <span style={{ flex: 1 }} />
            {billTransactions.length > 0 && onPayAllBillTxs && billTransactions.some(t => !t.isPaid) && (
              <button
                onClick={e => { e.stopPropagation(); onPayAllBillTxs(); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11, fontWeight: 700, color: "var(--pos)", border: "1px solid var(--pos)", borderRadius: 6, background: "var(--surface)", cursor: "pointer", flexShrink: 0 }}
              >
                <OrcaIcon name="check" size={11} />Pagar todos
              </button>
            )}
            {billTransactions.length > 0 && onDeleteAllBillTxs && (
              <button
                onClick={e => { e.stopPropagation(); onDeleteAllBillTxs(); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11, fontWeight: 700, color: "var(--neg)", border: "1px solid var(--neg)", borderRadius: 6, background: "var(--surface)", cursor: "pointer", flexShrink: 0 }}
              >
                <OrcaIcon name="trash" size={11} />Excluir todos
              </button>
            )}
            <span className="num" style={{ fontWeight: 700, fontSize: 13.5, color: billTransactions.length === 0 ? "var(--ink-3)" : "var(--neg)" }}>
              {billTransactions.length === 0 ? <span style={{ fontWeight: 600, fontSize: 12.5 }}>Nenhuma</span> : "−" + formatBRL(netBill)}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setShowBillForm(o => !o); if (!openFatura) setOpenFatura(true); }}
              style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line-2)", background: "var(--surface)", display: "grid", placeItems: "center", flexShrink: 0 }}
              title="Adicionar lançamento"
            >
              <OrcaIcon name="plus" size={14} style={{ color: "var(--ink-2)" }} />
            </button>
          </div>

          {/* Accordion body */}
          <div style={{ display: "grid", gridTemplateRows: openFatura ? "1fr" : "0fr", transition: "grid-template-rows .26s ease" }}>
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              {/* Inline form */}
              {showBillForm && onAddBillTxs && (
                <div style={{ padding: "0 16px 8px" }}>
                  <BillForm
                    bank={bankId}
                    cutoffDay={cutoffDay}
                    dueDay={dueDay}
                    month={month}
                    year={year}
                    onSave={async items => {
                      const ok = await onAddBillTxs(items);
                      if (ok) {
                        setShowBillForm(false);
                        const firstDate = items[0] && (items[0] as { date?: string }).date ? parseLocalDate((items[0] as { date: string }).date) : null;
                        if (firstDate) {
                          const txMonth = firstDate.getMonth() + 1;
                          const txYear  = firstDate.getFullYear();
                          if (txMonth !== month || txYear !== year) {
                            const lbl = firstDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                            setBillNotice(`Salvo na fatura de ${lbl} ✓`);
                            setTimeout(() => setBillNotice(null), 6000);
                          }
                        }
                      }
                      return ok;
                    }}
                    onCancel={() => setShowBillForm(false)}
                  />
                </div>
              )}

              {/* Aviso: transação salva em outro mês */}
              {billNotice && (
                <div style={{ margin: "0 16px 8px", padding: "8px 14px", background: "var(--pos-soft)", border: "1px solid var(--pos)", borderRadius: "var(--r-sm)", fontSize: 12.5, fontWeight: 700, color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{billNotice}</span>
                  <button onClick={() => setBillNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pos)", padding: 0 }}>×</button>
                </div>
              )}

              {/* Lista de transações */}
              {billTransactions.length > 0 && (
                <div style={{ padding: "0 18px 4px" }}>
                  {[...billTransactions]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(tx => {
                      const isIncome = tx.type === "INCOME";
                      const cat = CATEGORIES[tx.category as CategoryKey];
                      const dateLabel = tx.date.slice(5, 10).replace("-", "/");
                      const isPending = pendingBillDelete?.id === tx.id;
                      return (
                        <div key={tx.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: isPending ? "none" : "1px solid var(--line-2)", opacity: tx.isPaid ? 0.7 : 1 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", minWidth: 32 }}>{dateLabel}</span>
                            {cat && <span style={{ width: 7, height: 7, borderRadius: "50%", background: cat.color, flex: "0 0 auto" }} />}
                            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</span>
                            {tx.installments && tx.installments > 1 && (
                              <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 700, background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>
                                {tx.installmentIndex}/{tx.installments}
                              </span>
                            )}
                            <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: isIncome ? "var(--pos)" : "var(--neg)", minWidth: 72, textAlign: "right" }}>
                              {isIncome ? "+" : "−"}{formatBRL(Number(tx.amount))}
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {onTogglePaid && (
                                <button onClick={() => onTogglePaid(tx.id, !tx.isPaid)} style={{
                                  padding: "3px 8px", fontSize: 10, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer",
                                  border: `1px solid ${tx.isPaid ? "var(--pos)" : "var(--line)"}`,
                                  background: tx.isPaid ? "var(--pos-soft, #e6f4ea)" : "var(--surface)",
                                  color: tx.isPaid ? "var(--pos)" : "var(--ink-3)",
                                  whiteSpace: "nowrap",
                                }}>
                                  {tx.isPaid ? "✓ Pago" : (isIncome ? "Receber" : "Pagar")}
                                </button>
                              )}
                              {onUpdateBillTx && (
                                <button
                                  onClick={() => { setEditingBillTx(tx); setPendingBillDelete(null); }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 2 }}
                                  title="Editar"
                                >
                                  <OrcaIcon name="edit" size={13} />
                                </button>
                              )}
                              {onDeleteBillTx && (
                                <button onClick={() => setPendingBillDelete(isPending ? null : tx)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: isPending ? "var(--neg)" : "var(--ink-3)", padding: 2 }}>
                                  <OrcaIcon name="trash" size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          {isPending && (
                            <div style={{ paddingBottom: 6, borderBottom: "1px solid var(--line-2)" }}>
                              <DeleteEntryDialog
                                description={tx.description}
                                installments={tx.installments}
                                onDeleteOne={async () => { setPendingBillDelete(null); await onDeleteBillTx!(tx.id); }}
                                onDeleteAll={onDeleteBillTxGroup
                                  ? async () => {
                                      setPendingBillDelete(null);
                                      if (tx.groupId) await onDeleteBillTxGroup!(tx.groupId);
                                      else await onDeleteBillTx!(tx.id);
                                    }
                                  : undefined}
                                onCancel={() => setPendingBillDelete(null)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Investimentos (standard banks only) ── */}
      {investments.length > 0 && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line-2)" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Investimentos</div>
          {investments.map(inv => (
            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
              <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{inv.name}</span>
              <span className="num" style={{ fontWeight: 700, color: "var(--accent)" }}>{formatBRL(Number(inv.value))}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 2px", borderTop: "1px solid var(--line-2)", marginTop: 6, fontSize: 13, fontWeight: 800 }}>
            <span>Total investido</span>
            <span className="num" style={{ color: "var(--accent)" }}>{formatBRL(totalInvest)}</span>
          </div>
        </div>
      )}

      {/* ── Footer: valor total (com todas as faturas) ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", background: "var(--surface-2)", borderTop: "1px solid var(--line)" }}>
        <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink-2)" }}>Valor total</span>
        <span className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, letterSpacing: "-.02em", color: saldoTotal >= 0 ? "var(--ink-2)" : "var(--neg)" }}>
          {formatBRL(saldoTotal)}
        </span>
      </div>

      {/* ── Fechar conta ── */}
      {onToggleClose && (
        <button onClick={onToggleClose} style={{ width: "100%", padding: "8px 0", background: "none", border: "none", borderTop: "1px solid var(--line-2)", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <OrcaIcon name="close" size={12} />Fechar conta
        </button>
      )}
    </div>
  );
}

// ─── Shared: DayPicker ───────────────────────────────────────────────────────

const ACCOUNT_TYPES = ["Conta Corrente", "Conta Poupança", "Conta Digital", "Conta Salário"];
const DAY_PRESETS = [1, 10, 30];

function DayPicker({ label, hint, value, onChange }: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {DAY_PRESETS.map(d => (
          <button key={d} type="button" onClick={() => onChange(String(d))} style={{
            padding: "6px 14px", borderRadius: "var(--r-sm)", fontSize: 13, fontWeight: 700, cursor: "pointer",
            border: `1.5px solid ${value === String(d) ? "var(--accent)" : "var(--line)"}`,
            background: value === String(d) ? "var(--accent-soft)" : "var(--surface)",
            color: value === String(d) ? "var(--accent)" : "var(--ink-2)",
          }}>{d}</button>
        ))}
        <input
          className="orça-input num" type="number" min="1" max="31" value={value}
          onChange={e => onChange(e.target.value)} placeholder="Outro"
          style={{ width: 72, textAlign: "center", fontSize: 13 }}
        />
      </div>
      {value && <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>{hint.replace("{d}", value)}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ─── Configurar Modal ────────────────────────────────────────────────────────

function ConfigurarModal({
  bankName, bankShort, bankColor, initialConfig, isCustom, bankId, bankKey,
  onSave, onClose,
}: {
  bankName: string;
  bankShort?: string;
  bankColor?: string;
  initialConfig: {
    name?: string; short?: string; color?: string;
    agency?: string | null; account?: string | null; accountType?: string | null;
    cutoffDay?: number | null; dueDay?: number | null;
  };
  isCustom: boolean;
  bankId?: string;
  bankKey?: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialConfig.name ?? bankName);
  const [short, setShort] = useState(initialConfig.short ?? bankShort ?? "");
  const [color, setColor] = useState(initialConfig.color ?? bankColor ?? "#6B7280");
  const [agency, setAgency] = useState(initialConfig.agency ?? "");
  const [account, setAccount] = useState(initialConfig.account ?? "");
  const [accountType, setAccountType] = useState(initialConfig.accountType ?? "");
  const [cutoffDay, setCutoffDay] = useState(initialConfig.cutoffDay ? String(initialConfig.cutoffDay) : "");
  const [dueDay, setDueDay] = useState(initialConfig.dueDay ? String(initialConfig.dueDay) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tc = textOnColor(color);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        agency: agency.trim() || null,
        account: account.trim() || null,
        accountType: accountType || null,
        cutoffDay: cutoffDay ? parseInt(cutoffDay) : null,
        dueDay: dueDay ? parseInt(dueDay) : null,
      };

      let res: Response;
      if (isCustom && bankId) {
        res = await fetch(`/api/custom-banks/${bankId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, short, color, ...payload }),
        });
      } else {
        res = await fetch("/api/bank-configs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bank: bankKey, ...payload }),
        });
      }

      if (res.ok) { onSave(); onClose(); }
      else {
        const payload = await res.json().catch(() => null);
        const message = payload && typeof payload.error === "string"
          ? payload.error
          : `Erro ao salvar (HTTP ${res.status})`;
        setError(message);
      }
    } finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Identity — editable only for custom banks */}
      {isCustom ? (
        <div>
          <SectionLabel>Identidade</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 48px", gap: 10, marginBottom: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Nome do banco</label>
              <input className="orça-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Iniciais</label>
              <input className="orça-input" value={short}
                onChange={e => setShort(e.target.value.toUpperCase().slice(0, 3))}
                style={{ textAlign: "center", fontWeight: 800, letterSpacing: ".04em" }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Cor</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                style={{ width: "100%", height: 44, padding: "3px 4px", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", cursor: "pointer", background: "var(--surface)" }} />
            </div>
          </div>
          {name && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: color, borderRadius: "var(--r-md)" }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, color: tc, flex: "0 0 auto" }}>
                {short || "??"}
              </div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: tc }}>{name}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: bankColor ?? "var(--surface-2)", borderRadius: "var(--r-md)" }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, color: tc, flex: "0 0 auto" }}>
            {bankShort}
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: tc }}>{bankName}</span>
        </div>
      )}

      {/* Dados bancários */}
      <div>
        <SectionLabel>Dados bancários</SectionLabel>
        <div className="field-row-3" style={{ gap: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Tipo de conta</label>
            <select className="orça-input" value={accountType} onChange={e => setAccountType(e.target.value)}>
              <option value="">Selecione</option>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Agência</label>
            <input className="orça-input" value={agency} onChange={e => setAgency(e.target.value)} placeholder="0001" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Conta</label>
            <input className="orça-input" value={account} onChange={e => setAccount(e.target.value)} placeholder="12345-6" />
          </div>
        </div>
      </div>

      {/* Cartão de crédito */}
      <div>
        <SectionLabel>Cartão de crédito</SectionLabel>
        <div className="field-row-2" style={{ gap: 16 }}>
          <DayPicker
            label="Dia de corte"
            hint="Compras a partir do dia {d}+1 caem na fatura do mês seguinte"
            value={cutoffDay}
            onChange={setCutoffDay}
          />
          <DayPicker
            label="Dia de vencimento"
            hint="Fatura do cartão vence todo dia {d}"
            value={dueDay}
            onChange={setDueDay}
          />
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: "var(--neg)", fontWeight: 700 }}>✕ {error}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleSave}>
          {saving ? "Salvando..." : <><OrcaIcon name="check" size={15} />Salvar configuração</>}
        </button>
      </div>
    </div>
  );
}

// ─── Add Bank Modal ───────────────────────────────────────────────────────────

function AddBankModal({ month, year, activeBankKeys, onSave, onClose }: {
  month: number; year: number; activeBankKeys: Set<BankKey>;
  onSave: () => Promise<void>; onClose: () => void;
}) {
  const [step, setStep] = useState<"select" | "custom">("select");
  const [activating, setActivating] = useState<BankKey | null>(null);

  const unactivated = BANK_KEYS.filter(k => !activeBankKeys.has(k));

  async function activateStandard(bankKey: BankKey) {
    setActivating(bankKey);
    try {
      await fetch("/api/bank-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank: bankKey }),
      });
      await onSave();
      onClose();
    } finally { setActivating(null); }
  }

  if (step === "custom") {
    return <CustomBankForm month={month} year={year} onSave={onSave} onClose={onClose} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {unactivated.length > 0 ? (
        <>
          <div>
            <SectionLabel>Bancos padrão disponíveis</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {unactivated.map(k => {
                const b = BANKS[k];
                return (
                  <button key={k} disabled={!!activating} onClick={() => activateStandard(k)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: "var(--r-md)", border: "1.5px solid var(--line)", background: activating === k ? "var(--surface-2)" : "var(--surface)", cursor: "pointer", textAlign: "left", opacity: activating && activating !== k ? 0.6 : 1 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: b.color, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11, color: b.on, flex: "0 0 auto" }}>
                      {activating === k ? "…" : b.short}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{b.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--ink-3)" }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>ou</span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "8px 0" }}>
          Todos os bancos padrão já foram adicionados.
        </div>
      )}
      <button className="btn btn-ghost" style={{ justifyContent: "center" }} onClick={() => setStep("custom")}>
        <OrcaIcon name="plus" size={14} />Criar banco personalizado
      </button>
    </div>
  );
}

// ─── Custom Bank Form (formerly CreateBankModal) ──────────────────────────────

function CustomBankForm({ month, year, onSave, onClose }: { month: number; year: number; onSave: () => Promise<void>; onClose: () => void; }) {
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [agency, setAgency] = useState("");
  const [account, setAccount] = useState("");
  const [accountType, setAccountType] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [balance, setBalance] = useState("");
  const [fees, setFees] = useState<Array<{ name: string; amount: string; day: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(v: string) {
    setName(v);
    const initials = v.replace(/[^a-zA-Záéíóúàèìòùâêîôûãõç]/gi, "").slice(0, 2).toUpperCase();
    if (initials) setShort(initials);
  }

  async function handleSave() {
    if (!name || !short) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/custom-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, short, color,
          agency: agency.trim() || null,
          account: account.trim() || null,
          accountType: accountType || null,
          cutoffDay: cutoffDay ? parseInt(cutoffDay) : null,
          dueDay: dueDay ? parseInt(dueDay) : null,
          initialBalance: balance ? parseFloat(balance) : null,
          month, year,
          fees: fees.filter(f => f.name && f.amount).map(f => ({
            name: f.name, amount: parseFloat(f.amount), billingDay: parseInt(f.day) || 1,
          })),
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload && typeof payload.error === "string"
          ? payload.error
          : `Erro ao criar banco (HTTP ${res.status})`;
        setError(message);
        return;
      }

      await onSave();
      onClose();
    } finally { setSaving(false); }
  }

  const tc = textOnColor(color);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Identidade */}
      <div>
        <SectionLabel>Identidade</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 48px", gap: 10, marginBottom: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Nome do banco</label>
            <input className="orça-input" value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Bradesco, Santander..." />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Iniciais</label>
            <input className="orça-input" value={short}
              onChange={e => setShort(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="BR" style={{ textAlign: "center", fontWeight: 800, letterSpacing: ".04em" }} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Cor</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ width: "100%", height: 44, padding: "3px 4px", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", cursor: "pointer", background: "var(--surface)" }} />
          </div>
        </div>
        {name && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: color, borderRadius: "var(--r-md)" }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, color: tc, flex: "0 0 auto" }}>
              {short || "??"}
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: tc }}>{name}</span>
          </div>
        )}
      </div>

      {/* Dados bancários */}
      <div>
        <SectionLabel>Dados bancários</SectionLabel>
        <div className="field-row-3" style={{ gap: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Tipo de conta</label>
            <select className="orça-input" value={accountType} onChange={e => setAccountType(e.target.value)}>
              <option value="">Selecione</option>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Agência</label>
            <input className="orça-input" value={agency} onChange={e => setAgency(e.target.value)} placeholder="0001" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Conta</label>
            <input className="orça-input" value={account} onChange={e => setAccount(e.target.value)} placeholder="12345-6" />
          </div>
        </div>
      </div>

      {/* Cartão de crédito */}
      <div>
        <SectionLabel>Cartão de crédito</SectionLabel>
        <div className="field-row-2" style={{ gap: 16 }}>
          <DayPicker
            label="Dia de corte"
            hint="Compras a partir do dia {d}+1 caem na fatura do mês seguinte"
            value={cutoffDay}
            onChange={setCutoffDay}
          />
          <DayPicker
            label="Dia de vencimento"
            hint="Fatura do cartão vence todo dia {d}"
            value={dueDay}
            onChange={setDueDay}
          />
        </div>
      </div>

      {/* Saldo inicial */}
      <div>
        <SectionLabel>Saldo inicial</SectionLabel>
        <div className="input-prefix">
          <span className="pf">R$</span>
          <input className="orça-input num" type="number" step="0.01" value={balance}
            onChange={e => setBalance(e.target.value)} placeholder="0,00" />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 6, fontWeight: 600 }}>
          Saldo da conta no início do mês atual (opcional)
        </div>
      </div>

      {/* Tarifas */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionLabel>Tarifas bancárias</SectionLabel>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
            onClick={() => setFees(f => [...f, { name: "", amount: "", day: "1" }])}>
            <OrcaIcon name="plus" size={12} />Adicionar
          </button>
        </div>
        {fees.length === 0
          ? <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Nenhuma tarifa. Pode adicionar depois.</div>
          : fees.map((fee, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 96px 76px 28px", gap: 8, marginBottom: 7 }}>
              <input className="orça-input" placeholder="Nome" value={fee.name}
                onChange={e => setFees(f => f.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                style={{ fontSize: 13 }} />
              <input className="orça-input num" type="number" placeholder="Valor" value={fee.amount}
                onChange={e => setFees(f => f.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                style={{ fontSize: 13 }} />
              <input className="orça-input num" type="number" min="1" max="31" placeholder="Dia" value={fee.day}
                onChange={e => setFees(f => f.map((x, j) => j === i ? { ...x, day: e.target.value } : x))}
                style={{ fontSize: 13, textAlign: "center" }} />
              <button onClick={() => setFees(f => f.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", display: "grid", placeItems: "center" }}>
                <OrcaIcon name="trash" size={14} />
              </button>
            </div>
          ))
        }
      </div>

      {error && <div style={{ fontSize: 12, color: "var(--neg)", fontWeight: 700 }}>✕ {error}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving || !name || !short} onClick={handleSave}>
          {saving ? "Salvando..." : <><OrcaIcon name="check" size={15} />Criar banco</>}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BancosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const fetchGenRef = useRef(0);
  const [showCreate, setShowCreate] = useState(false);
  const [closedBanks, setClosedBanks] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("orça-closed-banks") ?? "[]")); }
    catch { return new Set(); }
  });

  function toggleBankClosed(id: string) {
    setClosedBanks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("orça-closed-banks", JSON.stringify([...next])); } catch {}
      return next;
    });
  }
  const [configuringBank, setConfiguringBank] = useState<{
    bankName: string; bankShort?: string; bankColor?: string;
    isCustom: boolean; bankId?: string; bankKey?: string;
    config: {
      name?: string; short?: string; color?: string;
      agency?: string | null; account?: string | null; accountType?: string | null;
      cutoffDay?: number | null; dueDay?: number | null;
    };
  } | null>(null);
  const [bankConfigs, setBankConfigs] = useState<BankConfig[]>([]);

  // Standard banks
  const [balances, setBalances]         = useState<BankBalance[]>([]);
  const [fees, setFees]                 = useState<BankFee[]>([]);
  const [billTransactions, setBillTxs]       = useState<FullBillTx[]>([]);
  const [investments, setInvestments]        = useState<Investment[]>([]);
  const [orphanAssign, setOrphanAssign]      = useState<Record<string, string>>({});
  const [globalOrphans, setGlobalOrphans]    = useState<FullBillTx[]>([]);

  // Custom banks
  const [customBanks, setCustomBanks]   = useState<CustomBank[]>([]);
  const [customBalances, setCustomBals] = useState<CustomBankBalance[]>([]);
  const [customFees, setCustomFees]     = useState<CustomBankFee[]>([]);

  // All manual entries (standard + custom)
  const [entries, setEntries] = useState<BankEntry[]>([]);

  // Saldo de fechamento do mês anterior (calculado server-side)
  const [prevClosing, setPrevClosing] = useState<Record<string, number | null>>({});
  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    summary: string;
    failures: string[];
    tone: "warn" | "error";
  } | null>(null);

  const fetchAll = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    const safe = async (p: Promise<Response>) => {
      try { const r = await p; return r.ok ? r.json().catch(() => null) : null; }
      catch { return null; }
    };

    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;

    const [bals, fs, bills, invs, ents, cbs, cbBals, cbFs, closing, cfgs] = await Promise.all([
      safe(fetch(`/api/bank-balances?month=${month}&year=${year}`)),
      safe(fetch("/api/bank-fees")),
      safe(fetch(`/api/transactions?month=${month}&year=${year}&expenseType=BANK_BILL`)),
      safe(fetch("/api/investments")),
      safe(fetch(`/api/bank-entries?month=${month}&year=${year}`)),
      safe(fetch("/api/custom-banks")),
      safe(fetch(`/api/custom-bank-balances?month=${month}&year=${year}`)),
      safe(fetch("/api/custom-bank-fees")),
      safe(fetch(`/api/bank-closing-balance?month=${prevM}&year=${prevY}`)),
      safe(fetch("/api/bank-configs")),
    ]);

    // Descarta resultado se uma navegação mais recente já iniciou novo fetch
    if (gen !== fetchGenRef.current) return;

    if (bals)    setBalances(bals);
    if (fs)      setFees(fs);
    if (bills)   setBillTxs(bills);
    if (invs)    setInvestments(invs);
    if (ents)    setEntries(ents);
    if (cbs)     setCustomBanks(cbs);
    if (cbBals)  setCustomBals(cbBals);
    if (cbFs)    setCustomFees(cbFs);
    if (closing) {
      setPrevClosing(closing);
    } else {
      // Evita manter carry-forward stale quando a API de fechamento falha
      setPrevClosing({});
    }
    if (cfgs)    setBankConfigs(cfgs);

    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  const fetchGlobalOrphans = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions?expenseType=BANK_BILL&bank=none");
      if (res.ok) setGlobalOrphans(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchGlobalOrphans(); }, [fetchGlobalOrphans]);

  type BatchApiResponse = {
    mode: "batch";
    total: number;
    successCount: number;
    failedCount: number;
    failures: Array<{ index: number; error: string }>;
  };

  function normalizeBatchFailures(payload: BatchApiResponse): string[] {
    return payload.failures.map(f => `Item ${f.index + 1}: ${f.error}`);
  }

  function showFeedback(title: string, summary: string, failures: string[] = [], tone: "warn" | "error" = "warn") {
    setFeedbackModal({ title, summary, failures, tone });
  }

  function showBatchSummary(actionLabel: string, total: number, failures: string[]) {
    const successCount = total - failures.length;
    if (failures.length === 0) return;

    if (successCount > 0) {
      showFeedback(
        actionLabel,
        `${successCount}/${total} salvo(s). ${failures.length} falha(s) no processamento.`,
        failures,
        "warn",
      );
      return;
    }

    showFeedback(
      actionLabel,
      `Nenhum item foi salvo. ${failures.length} falha(s) retornadas pelo servidor.`,
      failures,
      "error",
    );
  }

  // ── Standard bank handlers ──
  async function saveBalance(bank: BankKey, value: number): Promise<boolean> {
    const res = await fetchWithTimeoutAndRetry("/api/bank-balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank, month, year, balance: value }),
    }, { retries: 2, timeoutMs: 7000 });
    if (res.ok) {
      const saved = await res.json();
      const num = Number(saved.balance);
      setBalances(prev => {
        const rest = prev.filter(b => !(b.bank === bank && b.month === month && b.year === year));
        return [...rest, { ...saved, balance: num }];
      });
      fetchAll();
      return true;
    }
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    showFeedback("Erro ao salvar saldo", String(err.error ?? `HTTP ${res.status}`), [], "error");
    return false;
  }

  async function clearBalance(bank: BankKey) {
    const bal = balances.find(b => b.bank === bank && b.month === month && b.year === year);
    if (!bal) return;
    await fetch(`/api/bank-balances/${bal.id}`, { method: "DELETE" });
    setBalances(prev => prev.filter(b => b.id !== bal.id));
    fetchAll();
  }

  async function addFee(bank: BankKey, name: string, amount: number, day: number): Promise<boolean> {
    const res = await fetch("/api/bank-fees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bank, name, amount, billingDay: day }) });
    if (res.ok) { await fetchAll(); return true; }
    return false;
  }

  async function deleteFee(id: string) {
    if (!confirm("Remover esta tarifa?")) return;
    await fetch(`/api/bank-fees/${id}`, { method: "DELETE" });
    await fetchAll();
  }

  async function addEntry(bank: BankKey, desc: string, amount: number, type: "INCOME" | "EXPENSE"): Promise<boolean> {
    const res = await fetch("/api/bank-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bank, month, year, description: desc, amount, type }) });
    if (res.ok) { await fetchAll(); return true; }
    return false;
  }

  async function addEntryBatch(bank: BankKey, items: BatchEntryItem[]): Promise<boolean> {
    const payloadItems = items.map(item => ({
      bank,
      month: item.month,
      year: item.year,
      description: item.description,
      amount: item.amount,
      type: item.type,
      groupId: item.groupId ?? null,
      installments: item.installments ?? null,
      category: item.category ?? null,
    }));

    const res = await fetchWithTimeoutAndRetry("/api/bank-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payloadItems }),
    }, { retries: 2, timeoutMs: 12000 });

    const payload = await res.json().catch(() => null) as BatchApiResponse | null;

    if (!res.ok && res.status !== 207) {
      showFeedback(
        "Erro no lote de lançamentos (banco)",
        String(payload?.failures?.[0]?.error ?? payload?.mode ?? `HTTP ${res.status}`),
        payload?.failures?.map(f => `Item ${f.index + 1}: ${f.error}`) ?? [],
        "error",
      );
      return false;
    }

    if (payload?.mode === "batch") {
      if (payload.successCount > 0) await fetchAll();
      showBatchSummary("Lote de lançamentos (banco)", payload.total, normalizeBatchFailures(payload));
      return payload.successCount > 0;
    }

    await fetchAll();
    return true;
  }

  async function deleteEntryGroup(entry: CardEntry) {
    let res: Response;
    if (entry.groupId) {
      res = await fetch(`/api/bank-entries?groupId=${encodeURIComponent(entry.groupId)}`, { method: "DELETE" });
    } else if (entry.installments && entry.installments > 1) {
      const base = entry.description.replace(/\s+\d+\/\d+$/, "");
      const full = entries.find(e => e.id === entry.id);
      const params = new URLSearchParams({ descriptionBase: base });
      if (full?.bank) params.set("bank", full.bank);
      if (full?.customBankId) params.set("customBankId", full.customBankId);
      res = await fetch(`/api/bank-entries?${params}`, { method: "DELETE" });
    } else {
      res = await fetch(`/api/bank-entries/${entry.id}`, { method: "DELETE" });
    }
    if (!res.ok) {
      showFeedback("Erro ao excluir lançamentos", "Não foi possível excluir os lançamentos selecionados.", [], "error");
    }
    await fetchAll();
  }

  async function deleteBillTxGroup(groupId: string) {
    await fetch(`/api/transactions?groupId=${encodeURIComponent(groupId)}`, { method: "DELETE" });
    await fetchAll();
  }

  // [Bug 1 fix] confirm removido daqui — movido para EntrySection.handleDelete
  async function deleteEntry(id: string) {
    await fetch(`/api/bank-entries/${id}`, { method: "DELETE" });
    await fetchAll();
  }

  async function updateEntry(id: string, desc: string, amount: number, category: string | null): Promise<boolean> {
    const res = await fetch(`/api/bank-entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc, amount, category }),
    });
    if (res.ok) { await fetchAll(); return true; }
    return false;
  }

  async function updateBillTx(id: string, desc: string, amount: number, category: string | null, type: "EXPENSE" | "INCOME", bank: string): Promise<boolean> {
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc, amount, category, type, bank }),
    });
    if (res.ok) { await fetchAll(); return true; }
    return false;
  }

  async function assignOrphanedTx(id: string) {
    const bank = orphanAssign[id];
    if (!bank) return;
    await fetch(`/api/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank }),
    });
    setOrphanAssign(prev => { const n = { ...prev }; delete n[id]; return n; });
    await Promise.all([fetchAll(), fetchGlobalOrphans()]);
  }

  async function deleteOrphanedTx(id: string) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    await Promise.all([fetchAll(), fetchGlobalOrphans()]);
  }

  // ── Custom bank handlers ──
  async function saveCustomBalance(customBankId: string, value: number): Promise<boolean> {
    const res = await fetchWithTimeoutAndRetry("/api/custom-bank-balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customBankId, month, year, balance: value }),
    }, { retries: 2, timeoutMs: 7000 });
    if (res.ok) {
      const saved = await res.json();
      const num = Number(saved.balance);
      setCustomBals(prev => {
        const rest = prev.filter(b => !(b.customBankId === customBankId && b.month === month && b.year === year));
        return [...rest, { ...saved, balance: num }];
      });
      await fetchAll();
      return true;
    }
    return false;
  }

  async function clearCustomBalance(customBankId: string) {
    const bal = customBalances.find(b => b.customBankId === customBankId && b.month === month && b.year === year);
    if (!bal) return;
    await fetch(`/api/custom-bank-balances/${bal.id}`, { method: "DELETE" });
    setCustomBals(prev => prev.filter(b => b.id !== bal.id));
    fetchAll();
  }

  async function addCustomFee(customBankId: string, name: string, amount: number, day: number): Promise<boolean> {
    const res = await fetch("/api/custom-bank-fees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customBankId, name, amount, billingDay: day }) });
    if (res.ok) { await fetchAll(); return true; }
    return false;
  }

  async function deleteCustomFee(id: string) {
    if (!confirm("Remover esta tarifa?")) return;
    const res = await fetch(`/api/custom-bank-fees/${id}`, { method: "DELETE" });
    if (!res.ok) showFeedback("Erro ao remover tarifa", "Não foi possível remover a tarifa agora.", [], "error");
    await fetchAll();
  }

  async function addCustomEntry(customBankId: string, desc: string, amount: number, type: "INCOME" | "EXPENSE"): Promise<boolean> {
    const res = await fetch("/api/bank-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customBankId, month, year, description: desc, amount, type }) });
    if (res.ok) { await fetchAll(); return true; }
    return false;
  }

  async function addCustomEntryBatch(customBankId: string, items: BatchEntryItem[]): Promise<boolean> {
    const payloadItems = items.map(item => ({
      customBankId,
      month: item.month,
      year: item.year,
      description: item.description,
      amount: item.amount,
      type: item.type,
      groupId: item.groupId ?? null,
      installments: item.installments ?? null,
      category: item.category ?? null,
    }));

    const res = await fetchWithTimeoutAndRetry("/api/bank-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payloadItems }),
    }, { retries: 2, timeoutMs: 12000 });

    const payload = await res.json().catch(() => null) as BatchApiResponse | null;

    if (!res.ok && res.status !== 207) {
      showFeedback(
        "Erro no lote de lançamentos (banco customizado)",
        String(payload?.failures?.[0]?.error ?? payload?.mode ?? `HTTP ${res.status}`),
        payload?.failures?.map(f => `Item ${f.index + 1}: ${f.error}`) ?? [],
        "error",
      );
      return false;
    }

    if (payload?.mode === "batch") {
      if (payload.successCount > 0) await fetchAll();
      showBatchSummary("Lote de lançamentos (banco customizado)", payload.total, normalizeBatchFailures(payload));
      return payload.successCount > 0;
    }

    await fetchAll();
    return true;
  }

  async function deleteCustomBank(id: string, bankName: string) {
    if (!confirm(`Excluir banco "${bankName}"? Todos os dados serão removidos.`)) return;
    const res = await fetch(`/api/custom-banks/${id}`, { method: "DELETE" });
    if (!res.ok) showFeedback("Erro ao excluir banco", "Não foi possível excluir o banco agora.", [], "error");
    await fetchAll();
  }

  // ── Bill transaction handlers ──
  async function addBillTxs(items: object[]): Promise<boolean> {
    const res = await fetchWithTimeoutAndRetry("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }, { retries: 2, timeoutMs: 12000 });

    const payload = await res.json().catch(() => null) as BatchApiResponse | null;

    if (!res.ok && res.status !== 207) {
      showFeedback(
        "Erro no lote de fatura",
        String(payload?.failures?.[0]?.error ?? payload?.mode ?? `HTTP ${res.status}`),
        payload?.failures?.map(f => `Item ${f.index + 1}: ${f.error}`) ?? [],
        "error",
      );
      return false;
    }

    if (payload?.mode === "batch") {
      if (payload.successCount > 0) await fetchAll();
      showBatchSummary("Lote de fatura", payload.total, normalizeBatchFailures(payload));
      return payload.successCount > 0;
    }

    await fetchAll();
    return true;
  }

  async function deleteBillTx(id: string) {
    setBillTxs(prev => prev.filter(t => t.id !== id)); // otimista
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) await fetchAll(); // reverte se falhar
  }

  async function togglePaid(id: string, isPaid: boolean) {
    setBillTxs(prev => prev.map(t => t.id === id ? { ...t, isPaid } : t)); // otimista
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPaid }),
    });
    if (!res.ok) await fetchAll(); // reverte se falhar
  }

  async function toggleEntryPaid(id: string, isPaid: boolean) {
    const res = await fetch(`/api/bank-entries/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPaid }),
    });
    if (!res.ok) await fetchAll();
  }

  async function payAllBillTxs(bank: BankKey) {
    setBillTxs(prev => prev.map(t => t.bank === bank ? { ...t, isPaid: true } : t));
    await fetch(
      `/api/transactions?bank=${bank}&month=${month}&year=${year}&expenseType=BANK_BILL`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPaid: true }) },
    );
    await fetchAll();
  }

  async function deleteAllBillTxs(bank: BankKey) {
    if (!confirm("Excluir todos os lançamentos desta fatura?")) return;
    setBillTxs(prev => prev.filter(t => t.bank !== bank));
    const res = await fetch(
      `/api/transactions?bank=${bank}&month=${month}&year=${year}&expenseType=BANK_BILL`,
      { method: "DELETE" },
    );
    if (!res.ok) showFeedback("Erro ao excluir fatura", "Não foi possível excluir os lançamentos. Tente novamente.", [], "error");
    await fetchAll();
  }

  // ── Saldo de fechamento do mês anterior (via API centralizada) ──
  function getPrevSaldo(bankKey: BankKey): number | null {
    const v = prevClosing[bankKey];
    return v !== undefined ? v : null;
  }

  function getPrevCustomSaldo(cb: CustomBank): number | null {
    const v = prevClosing[cb.id];
    return v !== undefined ? v : null;
  }

  function calcSaldoAtual(
    bal: { balance: number } | undefined,
    prevBal: { balance: number } | undefined,
    bankFees: { amount: number }[],
    billTotal: number,
    ins: { amount: number }[],
    outs: { amount: number }[],
  ) {
    const ini = bal ? Number(bal.balance) : prevBal ? Number(prevBal.balance) : 0;
    return ini
      + ins.reduce((s, e) => s + Number(e.amount), 0)
      - outs.reduce((s, e) => s + Number(e.amount), 0)
      - bankFees.reduce((s, f) => s + Number(f.amount), 0)
      - billTotal;
  }

  // Bancos padrão ativos: ou têm config explícita ou já têm dados (retrocompatibilidade)
  const activeBankKeys = useMemo(() => {
    const active = new Set(bankConfigs.map(c => c.bank as BankKey));
    BANK_KEYS.forEach(k => {
      if (
        balances.some(b => b.bank === k) ||
        fees.some(f => f.bank === k) ||
        entries.some(e => e.bank === k) ||
        billTransactions.some(t => t.bank === k) ||
        investments.some(i => i.institution === k)
      ) active.add(k);
    });
    return active;
  }, [bankConfigs, balances, fees, entries, billTransactions, investments]);

  const totalBalance = [
    ...BANK_KEYS.filter(k => activeBankKeys.has(k)).map(k => {
      const bal   = balances.find(b => b.bank === k);
      const prevS = getPrevSaldo(k);
      const pBal  = prevS !== null ? { balance: prevS } : undefined;
      const bfees = fees.filter(f => f.bank === k);
      const paidTxs = billTransactions.filter(t => t.bank === k && t.isPaid);
      const bill  = Math.max(0, paidTxs.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0) - paidTxs.filter(t => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0));
      const ins   = entries.filter(e => e.bank === k && e.type === "INCOME");
      const outs  = entries.filter(e => e.bank === k && e.type === "EXPENSE");
      return calcSaldoAtual(bal, pBal, bfees, bill, ins, outs);
    }),
    ...customBanks.map(cb => {
      const bal    = customBalances.find(b => b.customBankId === cb.id);
      const prevS  = getPrevCustomSaldo(cb);
      const pBal   = prevS !== null ? { balance: prevS } : undefined;
      const cbfees = customFees.filter(f => f.customBankId === cb.id);
      const ins    = entries.filter(e => e.customBankId === cb.id && e.type === "INCOME");
      const outs   = entries.filter(e => e.customBankId === cb.id && e.type === "EXPENSE");
      return calcSaldoAtual(bal, pBal, cbfees, 0, ins, outs);
    }),
  ].reduce((s, v) => s + v, 0);

  const hasAnyBalance = balances.length + customBalances.length > 0
    || Object.values(prevClosing).some(v => v !== null);
  const totalFees      = [...fees, ...customFees].reduce((s, f) => s + Number(f.amount), 0);
  const totalBills     = billTransactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
  const paidBills      = billTransactions.filter(t => t.type === "EXPENSE" && t.isPaid).reduce((s, t) => s + Number(t.amount), 0);
  const pendingBills   = totalBills - paidBills;

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
  // keep local orphans for immediate display; global covers all months
  const orphanedBillTxs = globalOrphans;
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Adicionar banco" width={580}>
        <AddBankModal month={month} year={year} activeBankKeys={activeBankKeys} onSave={fetchAll} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!configuringBank} onClose={() => setConfiguringBank(null)} title={`Configurar ${configuringBank?.bankName ?? ""}`} width={520}>
        {configuringBank && (
          <ConfigurarModal
            bankName={configuringBank.bankName}
            bankShort={configuringBank.bankShort}
            bankColor={configuringBank.bankColor}
            initialConfig={configuringBank.config}
            isCustom={configuringBank.isCustom}
            bankId={configuringBank.bankId}
            bankKey={configuringBank.bankKey}
            onSave={fetchAll}
            onClose={() => setConfiguringBank(null)}
          />
        )}
      </Modal>

      <Modal open={!!feedbackModal} onClose={() => setFeedbackModal(null)} title={feedbackModal?.title ?? "Resultado"} width={560}>
        {feedbackModal && (
          <BatchFeedbackContent
            summary={feedbackModal.summary}
            failures={feedbackModal.failures}
            tone={feedbackModal.tone}
            onClose={() => setFeedbackModal(null)}
          />
        )}
      </Modal>

      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Carteiras · Bancos</div>
          <div className="page-title">Bancos</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <OrcaIcon name="plus" size={16} />Adicionar banco
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div className="r-kpi-3" style={{ marginBottom: 24 }}>

          {/* Total em carteira */}
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} />Total em carteira</div>
            <div className="kpi-val num sm" style={{ color: hasAnyBalance ? (totalBalance >= 0 ? "var(--pos)" : "var(--neg)") : undefined }}>
              {hasAnyBalance ? formatBRL(totalBalance) : "—"}
            </div>
            <div className="kpi-delta muted" style={{ marginTop: 4 }}>
              {balances.length + customBalances.length} saldo{(balances.length + customBalances.length) !== 1 ? "s" : ""} configurado{(balances.length + customBalances.length) !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Total tarifas */}
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="coins" size={14} />Total tarifas/mês</div>
            <div className="kpi-val num sm" style={{ color: totalFees > 0 ? "var(--neg)" : undefined }}>
              {totalFees > 0 ? formatBRL(totalFees) : "—"}
            </div>
            <div className="kpi-delta" style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: totalFees > 0 ? "var(--neg)" : "var(--ink-3)", fontWeight: 600 }}>
                {totalFees > 0 ? `aplicado mensalmente` : "nenhuma tarifa"}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>
                {fees.length + customFees.length} tarifa{(fees.length + customFees.length) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Faturas cartão */}
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} />Faturas cartão</div>
            <div className="kpi-val num sm" style={{ color: totalBills > 0 ? "var(--neg)" : undefined }}>
              {totalBills > 0 ? formatBRL(totalBills) : "—"}
            </div>
            <div className="kpi-delta" style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
              {totalBills > 0 ? (
                <>
                  {paidBills > 0 && (
                    <span style={{ fontSize: 11, color: "var(--pos)", fontWeight: 600 }}>
                      pago {formatBRL(paidBills)}
                    </span>
                  )}
                  {pendingBills > 0 && (
                    <span style={{ fontSize: 11, color: "var(--warn)", fontWeight: 600 }}>
                      pendente {formatBRL(pendingBills)}
                    </span>
                  )}
                </>
              ) : (
                <span className="muted" style={{ fontSize: 11 }}>nenhuma fatura</span>
              )}
            </div>
          </div>

        </div>

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 80 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : activeBankKeys.size === 0 && customBanks.length === 0 ? (
          <div style={{ display: "grid", placeItems: "center", padding: "64px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--ink)", marginBottom: 8 }}>Nenhum banco adicionado</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-3)", marginBottom: 20, maxWidth: 320 }}>Adicione seus bancos para acompanhar saldos, lançamentos e faturas.</div>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <OrcaIcon name="plus" size={15} />Adicionar banco
            </button>
          </div>
        ) : (
          <>
          {orphanedBillTxs.length > 0 && (
            <div style={{ marginBottom: 20, padding: "14px 18px", background: "var(--warn-soft)", border: "1.5px solid var(--warn)", borderRadius: "var(--r-md)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, color: "var(--warn)" }}>
                <OrcaIcon name="flame" size={15} />
                {orphanedBillTxs.length} lançamento{orphanedBillTxs.length > 1 ? "s" : ""} de fatura sem banco encontrado{orphanedBillTxs.length > 1 ? "s" : ""} — selecione o banco correto para recuperar
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orphanedBillTxs.map(tx => (
                  <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--surface)", borderRadius: "var(--r-sm)", padding: "8px 12px" }}>
                    <span style={{ flex: "1 1 180px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{tx.description}</span>
                    <span className="num" style={{ fontSize: 13, color: "var(--neg)", fontWeight: 700, minWidth: 80, textAlign: "right" }}>{formatBRL(tx.amount)}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                      {parseLocalDate(tx.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <select
                      className="orça-input"
                      value={orphanAssign[tx.id] ?? ""}
                      onChange={e => setOrphanAssign(prev => ({ ...prev, [tx.id]: e.target.value }))}
                      style={{ fontSize: 12, padding: "4px 8px", minWidth: 130 }}
                    >
                      <option value="">Selecionar banco…</option>
                      {BANK_KEYS.map(k => <option key={k} value={k}>{BANKS[k].name}</option>)}
                      {customBanks.map(cb => <option key={cb.id} value={cb.id}>{cb.name}</option>)}
                    </select>
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: "5px 12px" }} disabled={!orphanAssign[tx.id]} onClick={() => assignOrphanedTx(tx.id)}>
                      Recuperar
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px", color: "var(--neg)" }} onClick={() => deleteOrphanedTx(tx.id)}>
                      <OrcaIcon name="trash" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="r-grid-2col">
            {[
              ...BANK_KEYS.filter(k => activeBankKeys.has(k)).map(k => ({ kind: "standard" as const, id: k })),
              ...customBanks.map(cb => ({ kind: "custom" as const, id: cb.id })),
            ]
              .sort((a, b) => (closedBanks.has(a.id) ? 1 : 0) - (closedBanks.has(b.id) ? 1 : 0))
              .map(item => {
                if (item.kind === "standard") {
                  const bankKey = item.id as BankKey;
                  const bank = BANKS[bankKey];
                  const bal = balances.find(b => b.bank === bankKey && b.month === month && b.year === year);
                  const bankFees = fees.filter(f => f.bank === bankKey);
                  const bankInvest = investments.filter(i => i.institution === bankKey).map(i => ({ id: i.id, name: i.name, value: Number(i.value) }));
                  const bankEntradas = entries.filter(e => e.bank === bankKey && e.type === "INCOME").map(e => ({ id: e.id, description: e.description, amount: Number(e.amount), type: "INCOME" as const, isPaid: e.isPaid, groupId: e.groupId, installments: e.installments, category: e.category }));
                  const bankSaidas   = entries.filter(e => e.bank === bankKey && e.type === "EXPENSE").map(e => ({ id: e.id, description: e.description, amount: Number(e.amount), type: "EXPENSE" as const, isPaid: e.isPaid, groupId: e.groupId, installments: e.installments, category: e.category }));
                  const cfg = bankConfigs.find(c => c.bank === bankKey);
                  const bankBillTxs = billTransactions.filter(t => t.bank === bankKey);
                  return (
                    <BankCard
                      key={`${bankKey}-${month}-${year}`}
                      name={bank.name} short={bank.short} color={bank.color} textColor={bank.on}
                      bankId={bankKey}
                      balance={bal ? Number(bal.balance) : null}
                      prevBalance={getPrevSaldo(bankKey)}
                      fees={bankFees}
                      billTransactions={bankBillTxs}
                      hasCreditCard={true}
                      investments={bankInvest}
                      entradas={bankEntradas}
                      saidas={bankSaidas}
                      onSaveBalance={v => saveBalance(bankKey, v)}
                      onClearBalance={() => clearBalance(bankKey)}
                      onAddFee={(n, a, d) => addFee(bankKey, n, a, d)}
                      onDeleteFee={deleteFee}
                      onAddEntry={(desc, amt, type) => addEntry(bankKey, desc, amt, type)}
                      onDeleteEntry={deleteEntry}
                      onUpdateEntry={updateEntry}
                      onAddEntryBatch={items => addEntryBatch(bankKey, items)}
                      onAddBillTxs={addBillTxs}
                      onUpdateBillTx={updateBillTx}
                      onDeleteBillTx={deleteBillTx}
                      onDeleteBillTxGroup={deleteBillTxGroup}
                      onDeleteEntryGroup={deleteEntryGroup}
                      onTogglePaid={togglePaid}
                      onToggleEntryPaid={toggleEntryPaid}
                      onPayAllBillTxs={() => payAllBillTxs(bankKey)}
                      onDeleteAllBillTxs={() => deleteAllBillTxs(bankKey)}
                      month={month} year={year}
                      cutoffDay={cfg?.cutoffDay}
                      dueDay={cfg?.dueDay}
                      onConfigureBank={() => setConfiguringBank({
                        bankName: bank.name, bankShort: bank.short, bankColor: bank.color,
                        isCustom: false, bankKey,
                        config: { agency: cfg?.agency, account: cfg?.account, accountType: cfg?.accountType, cutoffDay: cfg?.cutoffDay, dueDay: cfg?.dueDay },
                      })}
                      isClosed={closedBanks.has(bankKey)}
                      onToggleClose={() => toggleBankClosed(bankKey)}
                      isFuture={isFutureMonth}
                    />
                  );
                } else {
                  const cb = customBanks.find(b => b.id === item.id)!;
                  const bal = customBalances.find(b => b.customBankId === cb.id && b.month === month && b.year === year);
                  const cbFees = customFees.filter(f => f.customBankId === cb.id);
                  const cbEntradas = entries.filter(e => e.customBankId === cb.id && e.type === "INCOME").map(e => ({ id: e.id, description: e.description, amount: Number(e.amount), type: "INCOME" as const, isPaid: e.isPaid, groupId: e.groupId, installments: e.installments, category: e.category }));
                  const cbSaidas   = entries.filter(e => e.customBankId === cb.id && e.type === "EXPENSE").map(e => ({ id: e.id, description: e.description, amount: Number(e.amount), type: "EXPENSE" as const, isPaid: e.isPaid, groupId: e.groupId, installments: e.installments, category: e.category }));
                  return (
                    <BankCard
                      key={`${cb.id}-${month}-${year}`}
                      name={cb.name} short={cb.short} color={cb.color} textColor={textOnColor(cb.color)}
                      bankId={cb.id}
                      balance={bal ? Number(bal.balance) : null}
                      prevBalance={getPrevCustomSaldo(cb)}
                      fees={cbFees}
                      billTransactions={[]}
                      hasCreditCard={false}
                      investments={[]}
                      entradas={cbEntradas}
                      saidas={cbSaidas}
                      onSaveBalance={v => saveCustomBalance(cb.id, v)}
                      onClearBalance={() => clearCustomBalance(cb.id)}
                      onAddFee={(n, a, d) => addCustomFee(cb.id, n, a, d)}
                      onDeleteFee={deleteCustomFee}
                      onAddEntry={(desc, amt, type) => addCustomEntry(cb.id, desc, amt, type)}
                      onDeleteEntry={deleteEntry}
                      onUpdateEntry={updateEntry}
                      onAddEntryBatch={items => addCustomEntryBatch(cb.id, items)}
                      onDeleteEntryGroup={deleteEntryGroup}
                      onToggleEntryPaid={toggleEntryPaid}
                      month={month} year={year}
                      onConfigureBank={() => setConfiguringBank({
                        bankName: cb.name, bankShort: cb.short, bankColor: cb.color,
                        isCustom: true, bankId: cb.id,
                        config: { name: cb.name, short: cb.short, color: cb.color, agency: cb.agency, account: cb.account, accountType: cb.accountType, cutoffDay: cb.cutoffDay, dueDay: cb.dueDay },
                      })}
                      isClosed={closedBanks.has(cb.id)}
                      onToggleClose={() => toggleBankClosed(cb.id)}
                      isCustom
                      isFuture={isFutureMonth}
                      onDeleteBank={() => deleteCustomBank(cb.id, cb.name)}
                    />
                  );
                }
              })
            }
          </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
