"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { Modal } from "@/components/ui/modal";
import { BANKS, formatBRL } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankBalance { id: string; bank: BankKey; month: number; year: number; balance: number; }
interface BankFee     { id: string; bank: BankKey; name: string; amount: number; billingDay: number; }
interface BillTx      { id: string; bank: string | null; amount: number; }
interface Investment  { id: string; name: string; institution: string | null; value: number; }
interface BankEntry   { id: string; bank: string | null; customBankId: string | null; description: string; amount: number; type: "INCOME" | "EXPENSE"; }

interface CustomBank  { id: string; name: string; short: string; color: string; }
interface CustomBankBalance { id: string; customBankId: string; month: number; year: number; balance: number; }
interface CustomBankFee     { id: string; customBankId: string; name: string; amount: number; billingDay: number; }

interface CardFee        { id: string; name: string; amount: number; billingDay: number; }
interface CardEntry      { id: string; description: string; amount: number; type: "INCOME" | "EXPENSE"; }
interface CardInvestment { id: string; name: string; value: number; }

const BANK_KEYS = Object.keys(BANKS) as BankKey[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textOnColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? "#1B1B16" : "#FFFFFF";
}

// ─── Entry section (Entradas / Saídas) ───────────────────────────────────────

function EntrySection({
  label, type, entries, onAdd, onDelete, onTotalChange,
}: {
  label: string;
  type: "INCOME" | "EXPENSE";
  entries: CardEntry[];
  onAdd: (desc: string, amount: number) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  onTotalChange?: (total: number) => void;
}) {
  const [local, setLocal] = useState<CardEntry[]>(entries);
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState(false);

  const entriesKey = entries.map(e => e.id).join(",");
  useEffect(() => { setLocal(entries); }, [entriesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = local.reduce((s, e) => s + Number(e.amount), 0);
  const isPos = type === "INCOME";

  useEffect(() => { onTotalChange?.(total); }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    const val = parseFloat(amt);
    if (!desc || isNaN(val) || val <= 0) return;
    setSaving(true);
    setAddError(false);
    const tempId = `__tmp_${Date.now()}`;
    const savedDesc = desc;
    // [Bug 2 fix] otimismo: adiciona localmente; reverte se API falhar
    setLocal(prev => [...prev, { id: tempId, description: savedDesc, amount: val, type }]);
    setDesc(""); setAmt(""); setOpen(false);
    try {
      const ok = await onAdd(savedDesc, val);
      if (!ok) {
        setLocal(prev => prev.filter(e => e.id !== tempId));
        setAddError(true);
        setOpen(true);
        setDesc(savedDesc);
        setAmt(String(val));
      }
    } finally { setSaving(false); }
  }

  // [Bug 1 fix] confirm ANTES do delete otimista — evita item sumir ao cancelar
  async function handleDelete(id: string) {
    if (!confirm("Remover este lançamento?")) return;
    setLocal(prev => prev.filter(e => e.id !== id));
    await onDelete(id);
  }

  return (
    <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: local.length > 0 || open ? 8 : 0 }}>
        <span className="section-label" style={{ color: isPos ? "var(--pos)" : "var(--neg)" }}>{label}</span>
        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setOpen(o => !o)}>
          <OrcaIcon name="plus" size={12} />{open ? "Cancelar" : "Adicionar"}
        </button>
      </div>

      {local.length === 0 && !open && (
        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Nenhum lançamento</div>
      )}

      {local.map(e => (
        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: "var(--ink-2)", opacity: e.id.startsWith("__tmp") ? 0.5 : 1 }}>{e.description}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="num" style={{ fontWeight: 700, color: isPos ? "var(--pos)" : "var(--neg)" }}>
              {isPos ? "+" : "−"}{formatBRL(Number(e.amount))}
            </span>
            {!e.id.startsWith("__tmp") && (
              <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 2 }}>
                <OrcaIcon name="trash" size={13} />
              </button>
            )}
          </div>
        </div>
      ))}

      {local.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 2px", borderTop: "1px solid var(--line-2)", marginTop: 6, fontSize: 13, fontWeight: 800 }}>
          <span>Total {label.toLowerCase()}</span>
          <span className="num" style={{ color: isPos ? "var(--pos)" : "var(--neg)" }}>
            {isPos ? "+" : "−"}{formatBRL(total)}
          </span>
        </div>
      )}

      {open && (
        <div style={{ marginTop: 10, padding: 12, background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
          {addError && (
            <div style={{ fontSize: 12, color: "var(--neg)", fontWeight: 700, marginBottom: 8 }}>
              ✕ Erro ao salvar — tente novamente
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8, marginBottom: 8 }}>
            <input className="orça-input" placeholder="Descrição (PIX, TED...)" value={desc} onChange={e => { setDesc(e.target.value); setAddError(false); }} style={{ fontSize: 13 }} />
            <input className="orça-input num" type="number" step="0.01" placeholder="Valor" value={amt} onChange={e => { setAmt(e.target.value); setAddError(false); }} style={{ fontSize: 13 }} />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} disabled={saving || !desc || !amt} onClick={handleAdd}>
            {saving ? "Salvando..." : <><OrcaIcon name="check" size={13} />Salvar {label.toLowerCase()}</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Bank Card ────────────────────────────────────────────────────────────────

function BankCard({
  name, short, color, textColor,
  balance, prevBalance, fees, billTotal, showCreditCard = true, investments, entradas, saidas,
  onSaveBalance, onClearBalance, onAddFee, onDeleteFee, onAddEntry, onDeleteEntry,
  isCustom, onDeleteBank, isFuture = false,
}: {
  name: string; short: string; color: string; textColor: string;
  balance: number | null;
  prevBalance: number | null;
  fees: CardFee[];
  billTotal: number;
  showCreditCard?: boolean;
  investments: CardInvestment[];
  entradas: CardEntry[];
  saidas: CardEntry[];
  onSaveBalance: (v: number) => Promise<boolean>;
  onClearBalance?: () => Promise<void>;
  onAddFee: (name: string, amount: number, day: number) => Promise<boolean>;
  onDeleteFee: (id: string) => Promise<void>;
  onAddEntry: (desc: string, amount: number, type: "INCOME" | "EXPENSE") => Promise<boolean>;
  onDeleteEntry: (id: string) => Promise<void>;
  isCustom?: boolean;
  onDeleteBank?: () => Promise<void>;
  isFuture?: boolean;
}) {
  // localBal: saldo inicial deste mês (manual). Pré-preenche do mês anterior se vazio.
  const [localBal, setLocalBal] = useState<number | null>(balance);
  const [balInput, setBalInput] = useState(
    // pré-preenche apenas se não é mês futuro e não tem saldo salvo ainda
    !isFuture && balance === null && prevBalance !== null ? String(prevBalance) : ""
  );
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

  // Sincroniza do DB quando chega valor real; respeita se o usuário limpou o campo
  useEffect(() => {
    if (balance !== null) {
      setLocalBal(balance);
      if (!inputClearedRef.current) setBalInput(String(balance));
    } else if (!isFuture && prevBalance !== null && localBal === null && !inputClearedRef.current) {
      setBalInput(String(prevBalance));
    }
  }, [balance, prevBalance]); // eslint-disable-line react-hooks/exhaustive-deps

  // totais locais — atualizados por callbacks dos EntrySection filhos
  const [localEntTotal, setLocalEntTotal] = useState(entradas.reduce((s, e) => s + Number(e.amount), 0));
  const [localSaiTotal, setLocalSaiTotal] = useState(saidas.reduce((s, e) => s + Number(e.amount), 0));

  const entradasKey = entradas.map(e => e.id).join(",");
  const saidasKey   = saidas.map(e => e.id).join(",");
  useEffect(() => { setLocalEntTotal(entradas.reduce((s, e) => s + Number(e.amount), 0)); }, [entradasKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalSaiTotal(saidas.reduce((s, e) => s + Number(e.amount), 0)); }, [saidasKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const totalFees   = fees.reduce((s, f) => s + Number(f.amount), 0);
  const totalInvest = investments.reduce((s, i) => s + Number(i.value), 0);

  const effectiveBill = showCreditCard ? billTotal : 0;
  // Meses futuros sem saldo salvo partem de 0 — não projetam usando prevBalance
  const saldoInicial  = localBal ?? (isFuture ? 0 : (prevBalance ?? 0));
  const saldoConta    = saldoInicial + localEntTotal - localSaiTotal - totalFees - effectiveBill;

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

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* ── Header ── */}
      <div style={{ padding: "14px 20px", background: color, color: textColor, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13 }}>
            {short}
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>{name}</div>
            <div style={{ fontSize: 11.5, opacity: 0.75, fontWeight: 600 }}>Saldo atual</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, letterSpacing: "-.02em" }}>
              {formatBRL(saldoConta)}
            </div>
            {totalInvest > 0 && (
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>+{formatBRL(totalInvest)} invest.</div>
            )}
          </div>
          {isCustom && onDeleteBank && (
            <button onClick={onDeleteBank} style={{ background: "rgba(0,0,0,0.2)", border: "none", cursor: "pointer", color: textColor, width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center" }} title="Excluir banco">
              <OrcaIcon name="trash" size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Saldo anterior (mês passado) — só exibe quando não há botão de carregamento ── */}
      {prevBalance !== null && !(isFuture && localBal === null) && (
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--line-2)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>Saldo anterior (mês passado)</span>
          <span className="num" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>{formatBRL(prevBalance)}</span>
        </div>
      )}

      {/* ── Saldo inicial ── */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line-2)" }}>
        <div className="section-label" style={{ marginBottom: 9 }}>Saldo inicial do mês</div>

        {isFuture && prevBalance !== null && localBal === null && (
          <button
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center", fontSize: 13, marginBottom: 10, color: "var(--accent)", borderColor: "var(--accent)" }}
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
            <OrcaIcon name="wallet" size={14} />
            {savingBal ? "Salvando..." : `Carregar saldo do mês anterior (${formatBRL(prevBalance)})`}
          </button>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <div className="input-prefix" style={{ flex: 1 }}>
            <span className="pf">R$</span>
            <input className="orça-input num" type="number" step="0.01" value={balInput} onChange={e => setBalInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveBal()} placeholder="0,00" style={{ fontSize: 15, fontWeight: 700 }} />
          </div>
          <button className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" }} disabled={savingBal || balInput === ""} onClick={handleSaveBal}>
            {savingBal ? "..." : <><OrcaIcon name="check" size={14} />Salvar</>}
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

      {/* ── Entradas ── */}
      <EntrySection label="Entradas" type="INCOME" entries={entradas} onAdd={(d, a) => onAddEntry(d, a, "INCOME")} onDelete={onDeleteEntry} onTotalChange={setLocalEntTotal} />

      {/* ── Saídas ── */}
      <EntrySection label="Saídas" type="EXPENSE" entries={saidas} onAdd={(d, a) => onAddEntry(d, a, "EXPENSE")} onDelete={onDeleteEntry} onTotalChange={setLocalSaiTotal} />

      {/* ── Tarifas ── */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: fees.length > 0 || showFeeForm ? 9 : 0 }}>
          <span className="section-label">Tarifas bancárias</span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setShowFeeForm(o => !o)}>
            <OrcaIcon name="plus" size={12} />{showFeeForm ? "Cancelar" : "Adicionar"}
          </button>
        </div>

        {fees.length === 0 && !showFeeForm && <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Nenhuma tarifa configurada</div>}

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

        {fees.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 2px", borderTop: "1px solid var(--line-2)", marginTop: 6, fontSize: 13, fontWeight: 800 }}>
            <span>Total tarifas</span>
            <span className="num" style={{ color: "var(--neg)" }}>−{formatBRL(totalFees)}</span>
          </div>
        )}

        {showFeeForm && (
          <div style={{ marginTop: 10, padding: 12, background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 54px", gap: 8, marginBottom: 8 }}>
              <input className="orça-input" placeholder="Nome da tarifa" value={feeName} onChange={e => setFeeName(e.target.value)} style={{ fontSize: 13 }} />
              <input className="orça-input num" type="number" step="0.01" placeholder="Valor" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} style={{ fontSize: 13 }} />
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

      {/* ── Cartão de crédito (standard banks only) ── */}
      {showCreditCard && (
        <div style={{ padding: "11px 20px", borderBottom: "1px solid var(--line-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="section-label" style={{ marginBottom: 2 }}>Cartão de crédito</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{billTotal > 0 ? "Fatura lançada em Débitos" : "Sem fatura lançada neste mês"}</div>
          </div>
          <span className="num" style={{ fontWeight: 700, fontSize: 15, color: billTotal > 0 ? "var(--neg)" : "var(--ink-3)" }}>
            {billTotal > 0 ? `−${formatBRL(billTotal)}` : "—"}
          </span>
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

      {/* ── Footer: saldo da conta ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 20px", background: saldoConta >= 0 ? "var(--pos-soft)" : "var(--neg-soft)" }}>
        <span style={{ fontWeight: 800, fontSize: 13 }}>Saldo atual</span>
        <span className="num" style={{ fontWeight: 800, fontSize: 18, color: saldoConta >= 0 ? "var(--pos)" : "var(--neg)" }}>
          {formatBRL(saldoConta)}
        </span>
      </div>
    </div>
  );
}

// ─── Create Bank Modal ────────────────────────────────────────────────────────

function CreateBankModal({ month, year, onSave, onClose }: { month: number; year: number; onSave: () => void; onClose: () => void; }) {
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [balance, setBalance] = useState("");
  const [fees, setFees] = useState<Array<{ name: string; amount: string; day: string }>>([]);
  const [saving, setSaving] = useState(false);

  function handleNameChange(v: string) {
    setName(v);
    const initials = v.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    if (initials) setShort(initials);
  }

  async function handleSave() {
    if (!name || !short) return;
    setSaving(true);
    try {
      await fetch("/api/custom-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, short, color,
          initialBalance: balance ? parseFloat(balance) : null,
          month, year,
          fees: fees.filter(f => f.name && f.amount).map(f => ({ name: f.name, amount: parseFloat(f.amount), billingDay: parseInt(f.day) || 1 })),
        }),
      });
      onSave(); onClose();
    } finally { setSaving(false); }
  }

  const tc = textOnColor(color);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 52px", gap: 12 }}>
        <div className="field">
          <label>Nome do banco</label>
          <input className="orça-input" value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Bradesco, Santander..." />
        </div>
        <div className="field">
          <label>Iniciais</label>
          <input className="orça-input" value={short} onChange={e => setShort(e.target.value.toUpperCase().slice(0, 3))} placeholder="BR" style={{ textAlign: "center", fontWeight: 800, letterSpacing: ".04em" }} />
        </div>
        <div className="field">
          <label>Cor</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: "100%", height: 44, padding: "3px 4px", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", cursor: "pointer", background: "var(--surface)" }} />
        </div>
      </div>

      {name && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: color, borderRadius: "var(--r-md)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: tc }}>
            {short || "??"}
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: tc }}>{name}</span>
        </div>
      )}

      <div className="field">
        <label>Saldo inicial neste mês (opcional)</label>
        <div className="input-prefix">
          <span className="pf">R$</span>
          <input className="orça-input num" type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0,00" />
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>Tarifas bancárias (opcional)</span>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setFees(f => [...f, { name: "", amount: "", day: "1" }])}>
            <OrcaIcon name="plus" size={12} />Adicionar
          </button>
        </div>
        {fees.map((fee, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 54px 28px", gap: 8, marginBottom: 7 }}>
            <input className="orça-input" placeholder="Nome" value={fee.name} onChange={e => setFees(f => f.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ fontSize: 13 }} />
            <input className="orça-input num" type="number" placeholder="Valor" value={fee.amount} onChange={e => setFees(f => f.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} style={{ fontSize: 13 }} />
            <input className="orça-input num" type="number" min="1" max="31" placeholder="Dia" value={fee.day} onChange={e => setFees(f => f.map((x, j) => j === i ? { ...x, day: e.target.value } : x))} style={{ fontSize: 13, textAlign: "center" }} />
            <button onClick={() => setFees(f => f.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", display: "grid", placeItems: "center" }}>
              <OrcaIcon name="trash" size={14} />
            </button>
          </div>
        ))}
        {fees.length === 0 && <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Nenhuma tarifa. Pode adicionar depois.</div>}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
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
  const [showCreate, setShowCreate] = useState(false);

  // Standard banks
  const [balances, setBalances]       = useState<BankBalance[]>([]);
  const [prevBalances, setPrevBals]   = useState<BankBalance[]>([]);
  const [fees, setFees]               = useState<BankFee[]>([]);
  const [billTxs, setBillTxs]         = useState<BillTx[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  // Custom banks
  const [customBanks, setCustomBanks]         = useState<CustomBank[]>([]);
  const [customBalances, setCustomBals]       = useState<CustomBankBalance[]>([]);
  const [prevCustomBalances, setPrevCustBals] = useState<CustomBankBalance[]>([]);
  const [customFees, setCustomFees]           = useState<CustomBankFee[]>([]);

  // All manual entries (standard + custom)
  const [entries, setEntries] = useState<BankEntry[]>([]);

  // Previous month data for real closing balance
  const [prevEntries, setPrevEntries]   = useState<BankEntry[]>([]);
  const [prevBillTxs, setPrevBillTxs]   = useState<BillTx[]>([]);

  const fetchAll = useCallback(async () => {
    const safe = async (p: Promise<Response>) => {
      try { const r = await p; return r.ok ? r.json().catch(() => null) : null; }
      catch { return null; }
    };

    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;

    const [bals, prevBals, fs, bills, invs, ents, cbs, cbBals, prevCbBals, cbFs, prevEnts, prevBills] = await Promise.all([
      safe(fetch(`/api/bank-balances?month=${month}&year=${year}`)),
      safe(fetch(`/api/bank-balances?month=${prevM}&year=${prevY}`)),
      safe(fetch("/api/bank-fees")),
      safe(fetch(`/api/transactions?month=${month}&year=${year}&expenseType=BANK_BILL`)),
      safe(fetch("/api/investments")),
      safe(fetch(`/api/bank-entries?month=${month}&year=${year}`)),
      safe(fetch("/api/custom-banks")),
      safe(fetch(`/api/custom-bank-balances?month=${month}&year=${year}`)),
      safe(fetch(`/api/custom-bank-balances?month=${prevM}&year=${prevY}`)),
      safe(fetch("/api/custom-bank-fees")),
      safe(fetch(`/api/bank-entries?month=${prevM}&year=${prevY}`)),
      safe(fetch(`/api/transactions?month=${prevM}&year=${prevY}&expenseType=BANK_BILL`)),
    ]);

    if (bals)       setBalances(bals);
    if (prevBals)   setPrevBals(prevBals);
    if (fs)         setFees(fs);
    if (bills)      setBillTxs(bills);
    if (invs)       setInvestments(invs);
    if (ents)       setEntries(ents);
    if (cbs)        setCustomBanks(cbs);
    if (cbBals)     setCustomBals(cbBals);
    if (prevCbBals) setPrevCustBals(prevCbBals);
    if (cbFs)       setCustomFees(cbFs);
    if (prevEnts)   setPrevEntries(prevEnts);
    if (prevBills)  setPrevBillTxs(prevBills);

    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  // ── Standard bank handlers ──
  async function saveBalance(bank: BankKey, value: number): Promise<boolean> {
    const res = await fetch("/api/bank-balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank, month, year, balance: value }),
    });
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
    alert(`Erro ao salvar saldo: ${err.error}`);
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

  // [Bug 1 fix] confirm removido daqui — movido para EntrySection.handleDelete
  async function deleteEntry(id: string) {
    await fetch(`/api/bank-entries/${id}`, { method: "DELETE" });
    await fetchAll();
  }

  // ── Custom bank handlers ──
  async function saveCustomBalance(customBankId: string, value: number): Promise<boolean> {
    const res = await fetch("/api/custom-bank-balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customBankId, month, year, balance: value }),
    });
    if (res.ok) {
      const saved = await res.json();
      const num = Number(saved.balance);
      setCustomBals(prev => {
        const rest = prev.filter(b => !(b.customBankId === customBankId && b.month === month && b.year === year));
        return [...rest, { ...saved, balance: num }];
      });
      fetchAll();
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
    await fetch(`/api/custom-bank-fees/${id}`, { method: "DELETE" });
    await fetchAll();
  }

  async function addCustomEntry(customBankId: string, desc: string, amount: number, type: "INCOME" | "EXPENSE"): Promise<boolean> {
    const res = await fetch("/api/bank-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customBankId, month, year, description: desc, amount, type }) });
    if (res.ok) { await fetchAll(); return true; }
    return false;
  }

  async function deleteCustomBank(id: string, bankName: string) {
    if (!confirm(`Excluir banco "${bankName}"? Todos os dados serão removidos.`)) return;
    await fetch(`/api/custom-banks/${id}`, { method: "DELETE" });
    await fetchAll();
  }

  // ── Saldo real de encerramento do mês anterior ──
  function getPrevSaldo(bankKey: BankKey): number | null {
    const prevBal = prevBalances.find(b => b.bank === bankKey);
    if (!prevBal) return null;
    const bfees = fees.filter(f => f.bank === bankKey);
    const bill  = prevBillTxs.filter(t => t.bank === bankKey).reduce((s, t) => s + Number(t.amount), 0);
    const ins   = prevEntries.filter(e => e.bank === bankKey && e.type === "INCOME");
    const outs  = prevEntries.filter(e => e.bank === bankKey && e.type === "EXPENSE");
    return calcSaldoAtual(prevBal, undefined, bfees, bill, ins, outs);
  }

  function getPrevCustomSaldo(cb: CustomBank): number | null {
    const prevBal = prevCustomBalances.find(b => b.customBankId === cb.id);
    if (!prevBal) return null;
    const cbfees = customFees.filter(f => f.customBankId === cb.id);
    const ins    = prevEntries.filter(e => e.customBankId === cb.id && e.type === "INCOME");
    const outs   = prevEntries.filter(e => e.customBankId === cb.id && e.type === "EXPENSE");
    return calcSaldoAtual(prevBal, undefined, cbfees, 0, ins, outs);
  }

  // ── KPI calculations ──
  // [Bug 3 fix] saldo real = saldo_inicial + entradas − saídas − tarifas − cartão
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

  const totalBalance = [
    ...BANK_KEYS.map(k => {
      const bal    = balances.find(b => b.bank === k);
      const prevS  = getPrevSaldo(k);
      const pBal   = prevS !== null ? { balance: prevS } : undefined;
      const bfees  = fees.filter(f => f.bank === k);
      const bill   = billTxs.filter(t => t.bank === k).reduce((s, t) => s + Number(t.amount), 0);
      const ins    = entries.filter(e => e.bank === k && e.type === "INCOME");
      const outs   = entries.filter(e => e.bank === k && e.type === "EXPENSE");
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
    || prevBalances.length + prevCustomBalances.length > 0;
  const totalFees   = [...fees, ...customFees].reduce((s, f) => s + Number(f.amount), 0);
  const totalBills  = billTxs.reduce((s, t) => s + Number(t.amount), 0);
  const totalInvest = investments.reduce((s, i) => s + Number(i.value), 0);

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Criar novo banco" width={520}>
        <CreateBankModal month={month} year={year} onSave={fetchAll} onClose={() => setShowCreate(false)} />
      </Modal>

      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Carteiras · Bancos</div>
          <div className="page-title">Bancos</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <OrcaIcon name="plus" size={16} />Criar banco
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} />Total em carteira</div>
            <div className="kpi-val num sm" style={{ color: hasAnyBalance ? (totalBalance >= 0 ? "var(--pos)" : "var(--neg)") : undefined }}>{hasAnyBalance ? formatBRL(totalBalance) : "—"}</div>
            <div className="kpi-delta muted">{balances.length + customBalances.length} saldo{(balances.length + customBalances.length) !== 1 ? "s" : ""} configurado{(balances.length + customBalances.length) !== 1 ? "s" : ""}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="coins" size={14} />Total tarifas/mês</div>
            <div className="kpi-val num sm" style={{ color: totalFees > 0 ? "var(--neg)" : undefined }}>{totalFees > 0 ? formatBRL(totalFees) : "—"}</div>
            <div className="kpi-delta muted">{fees.length + customFees.length} tarifa{(fees.length + customFees.length) !== 1 ? "s" : ""}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} />Faturas cartão</div>
            <div className="kpi-val num sm" style={{ color: totalBills > 0 ? "var(--neg)" : undefined }}>{totalBills > 0 ? formatBRL(totalBills) : "—"}</div>
            <div className="kpi-delta muted">{billTxs.length} lançamento{billTxs.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="trend" size={14} />Total investimentos</div>
            <div className="kpi-val num sm" style={{ color: totalInvest > 0 ? "var(--accent)" : undefined }}>{totalInvest > 0 ? formatBRL(totalInvest) : "—"}</div>
            <div className="kpi-delta muted">{investments.length} ativo{investments.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 80 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            {/* Standard banks */}
            {BANK_KEYS.map(bankKey => {
              const bank = BANKS[bankKey];
              const bal     = balances.find(b => b.bank === bankKey);
              const prevBal = prevBalances.find(b => b.bank === bankKey);
              const bankFees  = fees.filter(f => f.bank === bankKey);
              const billTotal = billTxs.filter(t => t.bank === bankKey).reduce((s, t) => s + Number(t.amount), 0);
              const bankInvest = investments.filter(i => i.institution === bankKey).map(i => ({ id: i.id, name: i.name, value: Number(i.value) }));
              const bankEntradas = entries.filter(e => e.bank === bankKey && e.type === "INCOME").map(e => ({ id: e.id, description: e.description, amount: Number(e.amount), type: "INCOME" as const }));
              const bankSaidas   = entries.filter(e => e.bank === bankKey && e.type === "EXPENSE").map(e => ({ id: e.id, description: e.description, amount: Number(e.amount), type: "EXPENSE" as const }));

              return (
                <BankCard
                  key={bankKey}
                  name={bank.name} short={bank.short} color={bank.color} textColor={bank.on}
                  balance={bal ? Number(bal.balance) : null}
                  prevBalance={getPrevSaldo(bankKey)}
                  fees={bankFees}
                  billTotal={billTotal}
                  investments={bankInvest}
                  entradas={bankEntradas}
                  saidas={bankSaidas}
                  onSaveBalance={v => saveBalance(bankKey, v)}
                  onClearBalance={() => clearBalance(bankKey)}
                  onAddFee={(n, a, d) => addFee(bankKey, n, a, d)}
                  onDeleteFee={deleteFee}
                  onAddEntry={(desc, amt, type) => addEntry(bankKey, desc, amt, type)}
                  onDeleteEntry={deleteEntry}
                  isFuture={isFutureMonth}
                />
              );
            })}

            {/* Custom banks */}
            {customBanks.map(cb => {
              const bal     = customBalances.find(b => b.customBankId === cb.id);
              const prevBal = prevCustomBalances.find(b => b.customBankId === cb.id);
              const cbFees = customFees.filter(f => f.customBankId === cb.id);
              const cbEntradas = entries.filter(e => e.customBankId === cb.id && e.type === "INCOME").map(e => ({ id: e.id, description: e.description, amount: Number(e.amount), type: "INCOME" as const }));
              const cbSaidas   = entries.filter(e => e.customBankId === cb.id && e.type === "EXPENSE").map(e => ({ id: e.id, description: e.description, amount: Number(e.amount), type: "EXPENSE" as const }));

              return (
                <BankCard
                  key={cb.id}
                  name={cb.name} short={cb.short} color={cb.color} textColor={textOnColor(cb.color)}
                  balance={bal ? Number(bal.balance) : null}
                  prevBalance={getPrevCustomSaldo(cb)}
                  fees={cbFees}
                  billTotal={0}
                  showCreditCard={false}
                  investments={[]}
                  entradas={cbEntradas}
                  saidas={cbSaidas}
                  onSaveBalance={v => saveCustomBalance(cb.id, v)}
                  onClearBalance={() => clearCustomBalance(cb.id)}
                  onAddFee={(n, a, d) => addCustomFee(cb.id, n, a, d)}
                  onDeleteFee={deleteCustomFee}
                  onAddEntry={(desc, amt, type) => addCustomEntry(cb.id, desc, amt, type)}
                  onDeleteEntry={deleteEntry}
                  isCustom
                  isFuture={isFutureMonth}
                  onDeleteBank={() => deleteCustomBank(cb.id, cb.name)}
                />
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
