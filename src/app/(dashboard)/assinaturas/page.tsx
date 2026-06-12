"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { Modal } from "@/components/ui/modal";
import { formatBRL, BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

const BANK_IDS = Object.keys(BANKS) as BankKey[];

const ICONS = ["repeat","music","tv","play","headphones","star","globe","book","cloud","phone","game","wifi"] as const;

interface CustomBank { id: string; name: string; }

function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Period = "mensal" | "anual";

interface Payment { month: number; year: number; paidAt: string; }
interface Member { id: string; name: string; share: number; isOwner: boolean; paidAt: string | null; paidCount: number; payments?: Payment[]; }
interface Sub { id: string; name: string; brand: string; icon: string; total: number; account: string; period: Period; startDate: string | null; endDate: string | null; bank: string | null; customBankId: string | null; members: Member[]; }

function monthsElapsed(startDate: string | null): number {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
  const now = new Date();
  // Count only months that have fully passed (exclude current month)
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
}

function personInitials(n: string) { return n.length <= 4 ? n.toUpperCase() : n.slice(0, 2).toUpperCase(); }

// ─── Status button ────────────────────────────────────────────────────────────
function StatusBtn({ paid, onToggle, paidLabel, pendingLabel }: { paid: boolean; onToggle: () => void; paidLabel: string; pendingLabel: string; }) {
  return (
    <button
      onClick={onToggle}
      className={`status ${paid ? "paid" : "pending"}`}
      style={{ fontSize: 10.5, padding: "3px 9px", border: "none", cursor: "pointer" }}
    >
      <span className="sd" />{paid ? paidLabel : pendingLabel}
    </button>
  );
}

// ─── SubCard ──────────────────────────────────────────────────────────────────
function SubCard({ s, onEdit, onDelete, onToggleMember, onMemberHistory, onPayAll, onEncerrar }: {
  s: Sub;
  onEdit: () => void;
  onDelete: () => void;
  onToggleMember: (memberId: string, paid: boolean) => void;
  onMemberHistory: (member: Member) => void;
  onPayAll: () => void;
  onEncerrar: () => void;
}) {
  const me = s.members.find(p => p.isOwner);
  const others = s.members.filter(p => !p.isOwner);
  const aReceber = others.reduce((a, p) => a + Number(p.share), 0);
  const recebido = others.reduce((a, p) => a + (p.paidAt ? Number(p.share) : 0), 0);
  const pagaram = others.filter(p => p.paidAt).length;
  const pct = aReceber > 0 ? Math.round((recebido / aReceber) * 100) : 0;
  const anyUnpaid = s.members.some(m => !m.paidAt);

  return (
    <div className="card" style={{ overflow: "hidden", breakInside: "avoid", marginBottom: 16 }}>
      <div style={{ padding: "16px 18px", background: s.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center" }}>
            <OrcaIcon name={s.icon || "repeat"} size={21} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>{s.name}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, opacity: .85 }}>
              {s.account} · {s.members.length} pessoas · <span style={{ textTransform: "capitalize" }}>{s.period}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{formatBRL(Number(s.total))}</div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: .85 }}>
              {s.endDate
                ? <span style={{ background: "rgba(0,0,0,.25)", borderRadius: 5, padding: "1px 6px" }}>Encerrada</span>
                : s.period === "anual" ? "por ano" : "por mês"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onEdit} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", width: 30, height: 30, display: "grid", placeItems: "center" }}>
              <OrcaIcon name="edit" size={14} />
            </button>
            {!s.endDate && (
              <button onClick={onEncerrar} title="Encerrar assinatura" style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", width: 30, height: 30, display: "grid", placeItems: "center" }}>
                <OrcaIcon name="close" size={14} />
              </button>
            )}
            <button onClick={onDelete} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", width: 30, height: 30, display: "grid", placeItems: "center" }}>
              <OrcaIcon name="trash" size={14} />
            </button>
          </div>
        </div>
      </div>

      {me && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => onMemberHistory(me)}
              title="Ver histórico"
              style={{ width: 30, height: 30, borderRadius: "50%", background: me.paidAt ? "var(--pos-soft)" : "var(--surface-3)", color: me.paidAt ? "var(--pos)" : "var(--ink-3)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, border: "none", cursor: "pointer" }}
            >
              {personInitials(me.name)}
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>Minha parte</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StatusBtn paid={!!me.paidAt} onToggle={() => onToggleMember(me.id, !me.paidAt)} paidLabel="Pago" pendingLabel="Pagar" />
            <span className="num" style={{ fontWeight: 800, fontSize: 14 }}>{formatBRL(Number(me.share))}</span>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div style={{ padding: "4px 0" }}>
          {others.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <button
                  onClick={() => onMemberHistory(p)}
                  title="Ver histórico"
                  style={{ width: 30, height: 30, borderRadius: "50%", background: p.paidAt ? "var(--pos-soft)" : "var(--surface-3)", color: p.paidAt ? "var(--pos)" : "var(--ink-3)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, border: "none", cursor: "pointer" }}
                >
                  {personInitials(p.name)}
                </button>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="num" style={{ fontWeight: 700, fontSize: 13, color: "var(--ink-2)" }}>{formatBRL(Number(p.share))}</span>
                <StatusBtn paid={!!p.paidAt} onToggle={() => onToggleMember(p.id, !p.paidAt)} paidLabel="Recebido" pendingLabel="Cobrar" />
              </div>
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div style={{ padding: "11px 18px", borderTop: "1px solid var(--line-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="row-meta">{pagaram} de {others.length} já pagaram</span>
          </div>
          <div className="bar" style={{ marginBottom: 6 }}><span style={{ width: `${pct}%`, background: s.brand }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
            <span className="num" style={{ color: "var(--pos)" }}>{formatBRL(recebido)} recebido</span>
            <span className="num muted">de {formatBRL(aReceber)} a cobrar</span>
          </div>
        </div>
      )}

      {anyUnpaid && (
        <div style={{ padding: "8px 18px", borderTop: "1px solid var(--line-2)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onPayAll} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px", color: "var(--pos)", gap: 5 }}>
            <OrcaIcon name="check" size={13} />Pagar todos
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SubForm ──────────────────────────────────────────────────────────────────
function SubForm({ initial, onSave, onCancel, loading, customBanks = [] }: { initial?: Partial<Sub>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; loading: boolean; customBanks?: CustomBank[]; }) {
  const [name,      setName]      = useState(initial?.name      ?? "");
  const [brand,     setBrand]     = useState(initial?.brand     ?? "#6366f1");
  const [icon,      setIcon]      = useState(initial?.icon      ?? "repeat");
  const [total,     setTotal]     = useState(initial?.total     ? String(initial.total) : "");
  const [account,   setAccount]   = useState(initial?.account   ?? "");
  const [period,    setPeriod]    = useState<Period>(initial?.period ?? "mensal");
  const [startDate, setStartDate] = useState(
    initial?.startDate ? formatLocalDate(parseLocalDate(initial.startDate.split("T")[0])) : ""
  );
  const initBankValue = initial?.customBankId ? `cst:${initial.customBankId}` : initial?.bank ? `std:${initial.bank}` : "";
  const [bankValue, setBankValue] = useState(initBankValue);

  // Owner (me) — separate from other members so the checkbox can toggle it independently
  const initialOwner = initial?.members?.find(m => m.isOwner);
  const [includeMe, setIncludeMe] = useState(!!initialOwner || !initial);
  const [myName,    setMyName]    = useState(initialOwner?.name  ?? "Você");
  const [myShare,   setMyShare]   = useState(initialOwner?.share != null ? String(initialOwner.share) : "");
  const [myId]                    = useState<string | undefined>(initialOwner?.id);

  // Non-owner members
  const [others, setOthers] = useState<{ id?: string; name: string; share: string }[]>(
    initial?.members?.filter(m => !m.isOwner).map(m => ({ id: m.id, name: m.name, share: String(m.share) }))
    ?? []
  );

  const addOther    = () => setOthers(o => [...o, { name: "", share: "" }]);
  const removeOther = (i: number) => setOthers(o => o.filter((_, j) => j !== i));
  const setOther    = (i: number, k: string, v: string) => setOthers(o => o.map((m, j) => j === i ? { ...m, [k]: v } : m));

  function splitEqually() {
    const t = parseFloat(total) || 0;
    const count = (includeMe ? 1 : 0) + others.length;
    if (!t || count === 0) return;
    const each = Math.round((t / count) * 100) / 100;
    const diff = Math.round((t - each * count) * 100) / 100;
    const shares = Array(count).fill(each).map((v: number, i: number) =>
      i === count - 1 ? Math.round((v + diff) * 100) / 100 : v
    );
    let idx = 0;
    if (includeMe) setMyShare(String(shares[idx++]));
    setOthers(o => o.map((m, i) => ({ ...m, share: String(shares[idx + i]) })));
  }

  function buildMembers() {
    return [
      ...(includeMe ? [{ ...(myId ? { id: myId } : {}), name: myName, share: parseFloat(myShare) || 0, isOwner: true }] : []),
      ...others.map(m => ({ ...(m.id ? { id: m.id } : {}), name: m.name, share: parseFloat(m.share) || 0, isOwner: false })),
    ];
  }

  const ownerShare = includeMe ? (parseFloat(myShare) || 0) : 0;
  const othersSum  = others.reduce((a, m) => a + (parseFloat(m.share) || 0), 0);
  const sharesSum  = ownerShare + othersSum;
  const totalVal   = parseFloat(total) || 0;
  const sharesDiff = Math.round((totalVal - sharesSum) * 100) / 100;
  const sharesOk   = totalVal === 0 || Math.abs(sharesDiff) <= 0.01;
  const hasMembers = includeMe || others.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field-row-2">
        <div className="field"><label>Nome da assinatura</label><input className="orça-input" value={name} onChange={e => setName(e.target.value)} placeholder="Netflix" /></div>
        <div className="field"><label>Valor total (R$)</label><input className="orça-input num" type="number" step="0.01" value={total} onChange={e => setTotal(e.target.value)} /></div>
      </div>
      <div className="field-row-3">
        <div className="field"><label>Plano / Conta</label><input className="orça-input" value={account} onChange={e => setAccount(e.target.value)} placeholder="Família" /></div>
        <div className="field">
          <label>Período</label>
          <div className="seg">
            <button className={period === "mensal" ? "on" : ""} onClick={() => setPeriod("mensal")}>Mensal</button>
            <button className={period === "anual"  ? "on" : ""} onClick={() => setPeriod("anual") }>Anual</button>
          </div>
        </div>
        <div className="field">
          <label>Data de início <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(opcional)</span></label>
          <input className="orça-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: 12, alignItems: "end" }}>
        <div className="field">
          <label>Ícone</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: "var(--surface-3)", borderRadius: "var(--r-sm)", padding: 4 }}>
            {[...ICONS].map(ic => (
              <button key={ic} type="button" onClick={() => setIcon(ic)}
                style={{ width: 34, height: 34, borderRadius: 7, border: icon === ic ? "2px solid var(--accent)" : "none", background: icon === ic ? "var(--surface)" : "none", cursor: "pointer", color: icon === ic ? "var(--accent)" : "var(--ink-2)", display: "grid", placeItems: "center", boxShadow: icon === ic ? "var(--shadow-sm)" : "none" }}>
                <OrcaIcon name={ic} size={15} />
              </button>
            ))}
          </div>
        </div>
        <div className="field"><label>Cor</label><input type="color" value={brand} onChange={e => setBrand(e.target.value)} style={{ width: "100%", height: 44, borderRadius: "var(--r-sm)", border: "1px solid var(--line)", cursor: "pointer" }} /></div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>Divisão entre pessoas</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={splitEqually} disabled={!totalVal || !hasMembers}>
              <OrcaIcon name="repeat" size={12} />Dividir igual
            </button>
            <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={addOther}>
              <OrcaIcon name="plus" size={13} />Adicionar
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Linha Eu — sempre visível, com checkbox para incluir/excluir */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {includeMe ? (
              <>
                <input className="orça-input" style={{ flex: 1 }} value={myName} onChange={e => setMyName(e.target.value)} placeholder="Seu nome" />
                <input className="orça-input num" style={{ width: 100 }} type="number" step="0.01" value={myShare} onChange={e => setMyShare(e.target.value)} placeholder="R$" />
              </>
            ) : (
              <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>Sem participação sua nesta assinatura</span>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", userSelect: "none", flexShrink: 0 }}>
              <input type="checkbox" checked={includeMe} onChange={e => setIncludeMe(e.target.checked)} style={{ cursor: "pointer", width: 14, height: 14, accentColor: "var(--accent)" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: includeMe ? "var(--ink)" : "var(--ink-3)" }}>Eu</span>
            </label>
          </div>

          {/* Demais membros */}
          {others.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="orça-input" style={{ flex: 1 }} value={m.name} onChange={e => setOther(i, "name", e.target.value)} placeholder="Nome" />
              <input className="orça-input num" style={{ width: 100 }} type="number" step="0.01" value={m.share} onChange={e => setOther(i, "share", e.target.value)} placeholder="R$" />
              <button onClick={() => removeOther(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4 }}><OrcaIcon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
        {totalVal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "8px 12px", borderRadius: "var(--r-sm)", background: sharesOk ? "var(--pos-soft, #e6f4ea)" : "var(--warn-soft)" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: sharesOk ? "var(--pos, #1a7c3a)" : "var(--warn)" }}>
              {sharesOk ? "✓ Divisão completa" : sharesDiff > 0 ? `Faltam ${formatBRL(sharesDiff)} para fechar` : `Excede em ${formatBRL(Math.abs(sharesDiff))}`}
            </span>
            <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: sharesOk ? "var(--pos, #1a7c3a)" : "var(--warn)" }}>
              {formatBRL(sharesSum)} / {formatBRL(totalVal)}
            </span>
          </div>
        )}
      </div>

      <div className="field" style={{ marginBottom: 4 }}>
        <label>Banco de pagamento <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(opcional)</span></label>
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

      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !name || !total || !sharesOk || !hasMembers}
          onClick={() => {
            const bank = bankValue.startsWith("std:") ? bankValue.slice(4) : null;
            const customBankId = bankValue.startsWith("cst:") ? bankValue.slice(4) : null;
            onSave({ name, brand, icon, total: parseFloat(total), account, period, startDate: startDate || null, bank, customBankId, members: buildMembers() });
          }}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />Salvar</>}
        </button>
      </div>
    </div>
  );
}

// ─── Section of subs ──────────────────────────────────────────────────────────
function SubSection({ title, subs, onEdit, onDelete, onToggleMember, onMemberHistory, onPayAll, onEncerrar }: {
  title: string; subs: Sub[];
  onEdit: (s: Sub) => void; onDelete: (id: string, name: string) => void;
  onToggleMember: (subId: string, memberId: string, paid: boolean) => void;
  onMemberHistory: (subName: string, member: Member) => void;
  onPayAll: (subId: string, members: Member[]) => void;
  onEncerrar: (id: string, name: string) => void;
}) {
  if (subs.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-label" style={{ marginBottom: 12 }}>{title}</div>
      <div style={{ columnCount: 2, columnGap: 16 }}>
        {subs.map(s => (
          <SubCard key={s.id} s={s}
            onEdit={() => onEdit(s)}
            onDelete={() => onDelete(s.id, s.name)}
            onToggleMember={(memberId, paid) => onToggleMember(s.id, memberId, paid)}
            onMemberHistory={member => onMemberHistory(s.name, member)}
            onPayAll={() => onPayAll(s.id, s.members)}
            onEncerrar={() => onEncerrar(s.id, s.name)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AssinaturasPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [subs,  setSubs]  = useState<Sub[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [editSub,       setEditSub]       = useState<Sub | null>(null);
  const [showNew,       setShowNew]       = useState(false);
  const [deleteTarget,   setDeleteTarget]   = useState<{ id: string; name: string } | null>(null);
  const [encerrarTarget, setEncerrarTarget] = useState<{ id: string; name: string } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ subName: string; member: Member } | null>(null);
  const [payingDebt,    setPayingDebt]    = useState<string | null>(null);
  const [customBanks,   setCustomBanks]   = useState<CustomBank[]>([]);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions?month=${month}&year=${year}`);
      if (res.ok) setSubs(await res.json());
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);
  useEffect(() => {
    fetch("/api/custom-banks").then(r => r.ok ? r.json() : []).then(d => setCustomBanks(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = editSub
        ? await fetch(`/api/subscriptions/${editSub.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        : await fetch("/api/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        alert(`Erro ao salvar: ${err.error ?? res.statusText}`);
        return;
      }
      setEditSub(null); setShowNew(false); fetchSubs();
    } finally { setSaving(false); }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await fetch(`/api/subscriptions/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchSubs();
  }

  async function handleEncerrarConfirm() {
    if (!encerrarTarget) return;
    await fetch(`/api/subscriptions/${encerrarTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "encerrar" }),
    });
    setEncerrarTarget(null);
    fetchSubs();
  }

  async function handleToggleMember(subId: string, memberId: string, paid: boolean) {
    setSubs(prev => prev.map(s => s.id !== subId ? s : {
      ...s,
      members: s.members.map(m => m.id !== memberId ? m : { ...m, paidAt: paid ? new Date().toISOString() : null }),
    }));
    await fetch(`/api/subscriptions/${subId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, paid, month, year }),
    });
    fetchSubs();
  }

  async function handlePayAll(subId: string, members: Member[]) {
    const unpaid = members.filter(m => !m.paidAt);
    if (unpaid.length === 0) return;
    const now = new Date().toISOString();
    const unpaidIds = new Set(unpaid.map(m => m.id));
    setSubs(prev => prev.map(s => s.id !== subId ? s : {
      ...s,
      members: s.members.map(m => unpaidIds.has(m.id) ? { ...m, paidAt: now } : m),
    }));
    await Promise.all(
      unpaid.map(m =>
        fetch(`/api/subscriptions/${subId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: m.id, paid: true, month, year }),
        })
      )
    );
    fetchSubs();
  }

  async function handlePayDebt(subId: string, memberId: string, period: Period, startDate: string | null, payments: Payment[], elapsed: number) {
    const key = `${subId}-${memberId}`;
    setPayingDebt(key);
    try {
      const paidSet = new Set(payments.map(p => `${p.year}-${p.month}`));
      const missing: { month: number; year: number }[] = [];

      if (period === "mensal") {
        const start = startDate ? parseLocalDate(startDate.split("T")[0]) : new Date(new Date().getFullYear(), 0, 1);
        const now = new Date();
        let yr = start.getFullYear();
        let mo = start.getMonth() + 1;
        while (yr < now.getFullYear() || (yr === now.getFullYear() && mo < now.getMonth() + 1)) {
          if (!paidSet.has(`${yr}-${mo}`)) missing.push({ month: mo, year: yr });
          mo++; if (mo > 12) { mo = 1; yr++; }
        }
      } else {
        // Annual: pay anniversary month (same month as start) for each elapsed year
        const start = startDate ? parseLocalDate(startDate.split("T")[0]) : new Date(new Date().getFullYear(), 0, 1);
        const startYear = start.getFullYear();
        const startMonth = start.getMonth() + 1;
        for (let i = 1; i <= elapsed; i++) {
          const yr = startYear + i;
          if (!paidSet.has(`${yr}-${startMonth}`)) missing.push({ month: startMonth, year: yr });
        }
      }

      if (missing.length > 0) {
        await Promise.all(
          missing.map(({ month: mo, year: yr }) =>
            fetch(`/api/subscriptions/${subId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memberId, paid: true, month: mo, year: yr }),
            })
          )
        );
      }
      fetchSubs();
    } finally {
      setPayingDebt(null);
    }
  }

  const mensais = subs.filter(s => s.period !== "anual");
  const anuais  = subs.filter(s => s.period === "anual");

  // KPIs
  const totalMensalBruto = mensais.reduce((a, s) => a + Number(s.total), 0);
  const totalAnualBruto  = anuais.reduce((a, s) => a + Number(s.total), 0);
  const suaParteMensal   = mensais.reduce((a, s) => a + Number(s.members.find(m => m.isOwner)?.share ?? 0), 0);
  const suaParteAnual    = anuais.reduce((a, s)  => a + Number(s.members.find(m => m.isOwner)?.share ?? 0), 0);
  const allOthers        = subs.flatMap(s => s.members.filter(m => !m.isOwner));
  const aReceber         = allOthers.reduce((a, p) => a + Number(p.share), 0);
  const recebido         = allOthers.reduce((a, p) => a + (p.paidAt ? Number(p.share) : 0), 0);

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap   = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const sortedHistory = [...(historyTarget?.member.payments ?? [])].sort((a, b) => b.year - a.year || b.month - a.month);

  return (
    <>
      <Modal open={!!editSub} onClose={() => setEditSub(null)} title="Editar assinatura" width={580}>
        {editSub && <SubForm initial={editSub} onSave={handleSave} onCancel={() => setEditSub(null)} loading={saving} customBanks={customBanks} />}
      </Modal>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nova assinatura" width={580}>
        <SubForm onSave={handleSave} onCancel={() => setShowNew(false)} loading={saving} customBanks={customBanks} />
      </Modal>

      {/* Confirmação de encerramento */}
      <Modal open={!!encerrarTarget} onClose={() => setEncerrarTarget(null)} title="Encerrar assinatura" width={420}>
        <p style={{ margin: "0 0 20px", color: "var(--ink-2)", lineHeight: 1.6 }}>
          Deseja encerrar <strong>{encerrarTarget?.name}</strong>?<br />
          A assinatura continuará aparecendo na fatura deste mês e será removida dos meses seguintes.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEncerrarTarget(null)}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, background: "var(--warn)" }} onClick={handleEncerrarConfirm}>
            <OrcaIcon name="close" size={15} />Encerrar
          </button>
        </div>
      </Modal>

      {/* #6 — confirmação de exclusão */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir assinatura" width={420}>
        <p style={{ margin: "0 0 20px", color: "var(--ink-2)", lineHeight: 1.6 }}>
          Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?<br />
          Todo o histórico de pagamentos será perdido permanentemente.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, background: "var(--neg)" }} onClick={handleDeleteConfirm}>
            <OrcaIcon name="trash" size={15} />Excluir
          </button>
        </div>
      </Modal>

      {/* #7 — histórico de pagamentos por membro */}
      <Modal open={!!historyTarget} onClose={() => setHistoryTarget(null)} title={`Histórico — ${historyTarget?.member.name}`} width={400}>
        {historyTarget && (
          <div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14, fontWeight: 600 }}>
              {historyTarget.subName} · {historyTarget.member.paidCount} pagamento{historyTarget.member.paidCount !== 1 ? "s" : ""}
            </div>
            {sortedHistory.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "32px 0", fontWeight: 600 }}>
                Nenhum pagamento registrado
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sortedHistory.map((p, i) => {
                  const label = new Date(p.year, p.month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                  const cap   = label.charAt(0).toUpperCase() + label.slice(1);
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", background: "var(--surface-2)", borderRadius: "var(--r-sm)" }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{cap}</span>
                      <span className="status paid" style={{ fontSize: 10.5, padding: "2px 8px" }}><span className="sd" />Pago</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Lançamentos</div>
          <div className="page-title">Assinaturas</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600, marginTop: 2 }}>Gerenciamento de assinaturas compartilhadas</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><OrcaIcon name="plus" size={16} />Nova assinatura</button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div className="r-kpi-5">
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="repeat" size={13} />Mensais</div>
            <div className="kpi-val sm num">{formatBRL(totalMensalBruto)}</div>
            <div className="kpi-delta muted">{mensais.length} assinaturas</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="calendar" size={13} />Anuais</div>
            <div className="kpi-val sm num">{formatBRL(totalAnualBruto)}</div>
            <div className="kpi-delta muted">{anuais.length} assinaturas · {formatBRL(totalAnualBruto / 12)}/mês</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={13} style={{ color: "var(--neg)" }} />Minha parte</div>
            <div className="kpi-val sm num" style={{ color: "var(--neg)" }}>{formatBRL(suaParteMensal + suaParteAnual / 12)}<span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>/mês</span></div>
            <div className="kpi-delta muted">mensais + anuais ÷ 12</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="users" size={13} style={{ color: "var(--warn)" }} />A receber</div>
            <div className="kpi-val sm num" style={{ color: "var(--warn)" }}>{formatBRL(aReceber - recebido)}</div>
            <div className="kpi-delta muted">de {allOthers.length} pessoas</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowDown" size={13} style={{ color: "var(--pos)" }} />Já recebido</div>
            <div className="kpi-val sm num" style={{ color: "var(--pos)" }}>{formatBRL(recebido)}</div>
            <div className="kpi-delta" style={{ color: "var(--pos)" }}>de {formatBRL(aReceber)} dividido</div>
          </div>
        </div>

        {/* Mini dashboard — cada assinatura */}
        {subs.length > 0 && (
          <div className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px 8px", borderBottom: "1px solid var(--line-2)" }}>
              <div className="section-label">Resumo de pagamentos — {monthCap}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 0 }}>
              {subs.map((s, idx) => {
                const totalPaid    = s.members.reduce((a, m) => a + (m.paidAt  ? Number(m.share) : 0), 0);
                const totalPending = s.members.reduce((a, m) => a + (!m.paidAt ? Number(m.share) : 0), 0);
                const totalValue   = Number(s.total);
                const pct          = totalValue > 0 ? Math.min(100, Math.round((totalPaid / totalValue) * 100)) : 100;
                const allPaid      = totalPending < 0.01;
                return (
                  <div key={s.id} style={{ padding: "12px 16px", borderRight: (idx + 1) % 4 !== 0 ? "1px solid var(--line-2)" : "none", borderBottom: "1px solid var(--line-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: s.brand, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                        <OrcaIcon name={s.icon || "repeat"} size={14} style={{ color: "#fff" }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        <div className="row-meta" style={{ fontSize: 10.5 }}>{s.period === "anual" ? "anual" : "mensal"} · <span className="num">{formatBRL(totalValue)}</span></div>
                      </div>
                      {allPaid && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--pos)", background: "var(--pos-soft)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>OK</span>}
                    </div>
                    <div className="bar" style={{ marginBottom: 6 }}>
                      <span style={{ width: `${pct}%`, background: allPaid ? "var(--pos)" : s.brand }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700 }}>
                      <span className="num" style={{ color: "var(--pos)" }}>{formatBRL(totalPaid)} pagos</span>
                      {!allPaid && <span className="num" style={{ color: "var(--neg)" }}>{formatBRL(totalPending)} pendente</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 80 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : subs.length === 0 ? (
          <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 60 }}>
            <OrcaIcon name="repeat" size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontWeight: 600, margin: 0 }}>Nenhuma assinatura cadastrada</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowNew(true)}><OrcaIcon name="plus" size={15} />Adicionar primeira</button>
          </div>
        ) : (
          <>
            <SubSection title="Mensais" subs={mensais} onEdit={setEditSub} onDelete={(id, name) => setDeleteTarget({ id, name })} onToggleMember={handleToggleMember} onMemberHistory={(subName, member) => setHistoryTarget({ subName, member })} onPayAll={handlePayAll} onEncerrar={(id, name) => setEncerrarTarget({ id, name })} />
            <SubSection title="Anuais"  subs={anuais}  onEdit={setEditSub} onDelete={(id, name) => setDeleteTarget({ id, name })} onToggleMember={handleToggleMember} onMemberHistory={(subName, member) => setHistoryTarget({ subName, member })} onPayAll={handlePayAll} onEncerrar={(id, name) => setEncerrarTarget({ id, name })} />

            {/* Bloco de adimplência */}
            {(() => {
              const rows: { subId: string; memberId: string; startDate: string | null; period: Period; payments: Payment[]; subName: string; brand: string; icon: string; memberName: string; share: number; paidCount: number; monthsElapsed: number; }[] = [];
              for (const s of subs) {
                const meses = monthsElapsed(s.startDate);
                // Annual: 1 period due only after at least 12 months have passed; skip if started this month
                const elapsed = s.period === "anual" ? (meses >= 12 ? Math.floor(meses / 12) : 0) : meses;
                if (elapsed === 0) continue;
                for (const m of s.members.filter(m => !m.isOwner)) {
                  const owed = elapsed * Number(m.share);
                  const paid = Number(m.paidCount) * Number(m.share);
                  if (owed > paid + 0.01) {
                    rows.push({ subId: s.id, memberId: m.id, startDate: s.startDate, period: s.period, payments: m.payments ?? [], subName: s.name, brand: s.brand, icon: s.icon, memberName: m.name, share: Number(m.share), paidCount: m.paidCount, monthsElapsed: elapsed });
                  }
                }
              }
              if (rows.length === 0) return (
                <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--pos-soft, #e6f4ea)", border: "none", marginTop: 8 }}>
                  <span style={{ fontSize: 20 }}>✓</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--pos, #1a7c3a)" }}>Todos em dia!</div>
                    <div className="row-meta">Nenhum membro com pagamento pendente acumulado.</div>
                  </div>
                </div>
              );
              return (
                <div className="card" style={{ overflow: "hidden", marginTop: 8 }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-2)", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="section-label">Adimplência acumulada</div>
                      <div className="row-meta">{rows.length} membro{rows.length > 1 ? "s" : ""} com pagamento pendente desde o início da assinatura</div>
                    </div>
                    <span className="num" style={{ fontWeight: 800, fontSize: 15, color: "var(--neg)" }}>
                      {formatBRL(rows.reduce((a, r) => a + (r.monthsElapsed - r.paidCount) * r.share, 0))}
                    </span>
                  </div>
                  {rows.map((r, i) => {
                    const totalOwed = r.monthsElapsed * r.share;
                    const totalPaid = r.paidCount * r.share;
                    const debt = totalOwed - totalPaid;
                    const pct = Math.round((totalPaid / totalOwed) * 100);
                    return (
                      <div key={i} style={{ padding: "12px 18px", borderBottom: i < rows.length - 1 ? "1px solid var(--line-2)" : "none", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: r.brand, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                            <OrcaIcon name={r.icon || "repeat"} size={16} style={{ color: "#fff" }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.memberName}</div>
                            <div className="row-meta">{r.subName} · {r.paidCount}/{r.monthsElapsed} meses pagos</div>
                          </div>
                        </div>
                        <div style={{ padding: "0 8px" }}>
                          <div className="bar" style={{ marginBottom: 4 }}>
                            <span style={{ width: `${pct}%`, background: pct >= 80 ? "var(--pos)" : pct >= 50 ? "var(--warn)" : "var(--neg)" }} />
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>
                            {formatBRL(totalPaid)} pago de {formatBRL(totalOwed)} ({pct}%)
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="num" style={{ fontSize: 14, fontWeight: 800, color: "var(--neg)" }}>{formatBRL(debt)}</div>
                          <div className="row-meta">em aberto</div>
                          <button
                            className="btn btn-ghost"
                            style={{ marginTop: 6, fontSize: 11.5, padding: "4px 10px", color: "var(--pos)", gap: 4 }}
                            disabled={payingDebt === `${r.subId}-${r.memberId}`}
                            onClick={() => handlePayDebt(r.subId, r.memberId, r.period, r.startDate, r.payments, r.monthsElapsed)}
                          >
                            <OrcaIcon name="check" size={12} />
                            {payingDebt === `${r.subId}-${r.memberId}` ? "Pagando..." : "Pagar tudo"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
