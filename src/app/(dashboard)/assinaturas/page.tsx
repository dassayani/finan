"use client";

import { useCallback, useEffect, useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { PayToggle } from "@/components/ui/pay-toggle";
import { Modal } from "@/components/ui/modal";
import { formatBRL } from "@/lib/constants";

interface Member { id: string; name: string; share: number; isOwner: boolean; paidAt: string | null; }
interface Sub { id: string; name: string; brand: string; icon: string; total: number; account: string; members: Member[]; }

function personInitials(n: string) { return n.length <= 4 ? n.toUpperCase() : n.slice(0, 2).toUpperCase(); }

function SubCard({ s, onEdit, onDelete, onToggleMember }: { s: Sub; onEdit: () => void; onDelete: () => void; onToggleMember: (memberId: string, paid: boolean) => void; }) {
  const me = s.members.find(p => p.isOwner);
  const others = s.members.filter(p => !p.isOwner);
  const aReceber = others.reduce((a, p) => a + Number(p.share), 0);
  const recebido = others.reduce((a, p) => a + (p.paidAt ? Number(p.share) : 0), 0);
  const pagaram = others.filter(p => p.paidAt).length;
  const pct = aReceber > 0 ? Math.round((recebido / aReceber) * 100) : 0;

  return (
    <div className="card" style={{ overflow: "hidden", breakInside: "avoid", marginBottom: 16 }}>
      <div style={{ padding: "16px 18px", background: s.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center" }}>
            <OrcaIcon name={s.icon || "repeat"} size={21} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>{s.name}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, opacity: .85 }}>{s.account} · {s.members.length} pessoas</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{formatBRL(Number(s.total))}</div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: .85 }}>por mês</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onEdit} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", width: 30, height: 30, display: "grid", placeItems: "center" }}>
              <OrcaIcon name="edit" size={14} />
            </button>
            <button onClick={onDelete} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", width: 30, height: 30, display: "grid", placeItems: "center" }}>
              <OrcaIcon name="dots" size={14} />
            </button>
          </div>
        </div>
      </div>

      {me && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>Sua parte</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PayToggle paid={!!me.paidAt} onToggle={() => onToggleMember(me.id, !me.paidAt)} />
            <span className="num" style={{ fontWeight: 800, fontSize: 14 }}>{formatBRL(Number(me.share))}</span>
          </div>
        </div>
      )}

      <div style={{ padding: "4px 0" }}>
        {others.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: p.paidAt ? "var(--pos-soft)" : "var(--surface-3)", color: p.paidAt ? "var(--pos)" : "var(--ink-3)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>
                {personInitials(p.name)}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="num" style={{ fontWeight: 700, fontSize: 13, color: "var(--ink-2)" }}>{formatBRL(Number(p.share))}</span>
              <PayToggle paid={!!p.paidAt} onToggle={() => onToggleMember(p.id, !p.paidAt)} label={{ paid: "Recebido", pending: "Cobrar" }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "11px 18px", borderTop: "1px solid var(--line-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span className="row-meta">{pagaram} de {others.length} já pagaram</span>
        </div>
        <div className="bar" style={{ marginBottom: 6 }}><span style={{ width: `${pct}%`, background: s.brand }} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
          <span className="num" style={{ color: "var(--pos)" }}>{formatBRL(recebido)} recebido</span>
          <span className="num muted">de {formatBRL(aReceber)} a receber</span>
        </div>
      </div>
    </div>
  );
}

function SubForm({ initial, onSave, onCancel, loading }: { initial?: Partial<Sub>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; loading: boolean; }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "#6366f1");
  const [icon, setIcon] = useState(initial?.icon ?? "repeat");
  const [total, setTotal] = useState(initial?.total ? String(initial.total) : "");
  const [account, setAccount] = useState(initial?.account ?? "");
  const [members, setMembers] = useState<{ name: string; share: string; isOwner: boolean }[]>(
    initial?.members?.map(m => ({ name: m.name, share: String(m.share), isOwner: m.isOwner })) ?? [{ name: "Você", share: "", isOwner: true }]
  );

  const addMember = () => setMembers(m => [...m, { name: "", share: "", isOwner: false }]);
  const removeMember = (i: number) => setMembers(m => m.filter((_, j) => j !== i));
  const setMember = (i: number, k: string, v: string | boolean) => setMembers(m => m.map((mem, j) => j === i ? { ...mem, [k]: v } : mem));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Nome da assinatura</label><input className="orça-input" value={name} onChange={e => setName(e.target.value)} placeholder="Netflix" /></div>
        <div className="field"><label>Valor total / mês (R$)</label><input className="orça-input num" type="number" step="0.01" value={total} onChange={e => setTotal(e.target.value)} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 12 }}>
        <div className="field"><label>Plano / Conta</label><input className="orça-input" value={account} onChange={e => setAccount(e.target.value)} placeholder="Família" /></div>
        <div className="field"><label>Ícone</label>
          <div className="seg">
            {["repeat", "music", "tv", "play"].map(ic => <button key={ic} className={icon === ic ? "on" : ""} onClick={() => setIcon(ic)}><OrcaIcon name={ic} size={14} /></button>)}
          </div>
        </div>
        <div className="field"><label>Cor</label><input type="color" value={brand} onChange={e => setBrand(e.target.value)} style={{ width: "100%", height: 44, borderRadius: "var(--r-sm)", border: "1px solid var(--line)", cursor: "pointer" }} /></div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>Divisão entre pessoas</label>
          <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={addMember}><OrcaIcon name="plus" size={13} />Adicionar</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="orça-input" style={{ flex: 1 }} value={m.name} onChange={e => setMember(i, "name", e.target.value)} placeholder="Nome" />
              <input className="orça-input num" style={{ width: 100 }} type="number" step="0.01" value={m.share} onChange={e => setMember(i, "share", e.target.value)} placeholder="Parte R$" />
              {i > 0 && <button onClick={() => removeMember(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 4 }}><OrcaIcon name="dots" size={16} /></button>}
              {i === 0 && <span style={{ width: 24, fontSize: 10, color: "var(--ink-3)", fontWeight: 700 }}>Eu</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !name || !total} onClick={() => onSave({ name, brand, icon, total: parseFloat(total), account, members: members.map(m => ({ name: m.name, share: parseFloat(m.share) || 0, isOwner: m.isOwner })) })}>
          {loading ? "Salvando..." : <><OrcaIcon name="check" size={15} />Salvar</>}
        </button>
      </div>
    </div>
  );
}

export default function AssinaturasPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSub, setEditSub] = useState<Sub | null>(null);
  const [showNew, setShowNew] = useState(false);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/subscriptions");
    setSubs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  async function handleSave(data: Record<string, unknown>) {
    setSaving(true);
    try {
      if (editSub) {
        await fetch(`/api/subscriptions/${editSub.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      } else {
        await fetch("/api/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      }
      setEditSub(null); setShowNew(false); fetchSubs();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir assinatura "${name}"?`)) return;
    await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    fetchSubs();
  }

  async function handleToggleMember(subId: string, memberId: string, paid: boolean) {
    await fetch(`/api/subscriptions/${subId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, paid }) });
    fetchSubs();
  }

  const totalMensal = subs.reduce((a, s) => a + Number(s.total), 0);
  const suaParte = subs.reduce((a, s) => a + Number(s.members.find(m => m.isOwner)?.share ?? 0), 0);
  const others = subs.flatMap(s => s.members.filter(m => !m.isOwner));
  const aReceber = others.reduce((a, p) => a + Number(p.share), 0);
  const recebido = others.reduce((a, p) => a + (p.paidAt ? Number(p.share) : 0), 0);

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <>
      <Modal open={!!editSub} onClose={() => setEditSub(null)} title="Editar assinatura" width={560}>
        {editSub && <SubForm initial={editSub} onSave={handleSave} onCancel={() => setEditSub(null)} loading={saving} />}
      </Modal>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nova assinatura" width={560}>
        <SubForm onSave={handleSave} onCancel={() => setShowNew(false)} loading={saving} />
      </Modal>

      <div className="topbar">
        <div className="topbar-l"><div className="crumb">Carteiras</div><div className="page-title">Assinaturas</div></div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><OrcaIcon name="plus" size={16} />Nova assinatura</button>
        </div>
      </div>

      <div className="content">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="repeat" size={14} />Custo total / mês</div><div className="kpi-val sm num">{formatBRL(totalMensal)}</div><div className="kpi-delta muted">{subs.length} assinaturas</div></div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="wallet" size={14} style={{ color: "var(--neg)" }} />Sua parte</div><div className="kpi-val sm num" style={{ color: "var(--neg)" }}>{formatBRL(suaParte)}</div><div className="kpi-delta muted">o que sai do seu bolso</div></div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="users" size={14} style={{ color: "var(--warn)" }} />A receber</div><div className="kpi-val sm num" style={{ color: "var(--warn)" }}>{formatBRL(aReceber - recebido)}</div><div className="kpi-delta muted">de {others.length} pessoas</div></div>
          <div className="card kpi"><div className="kpi-label"><OrcaIcon name="arrowDown" size={14} style={{ color: "var(--pos)" }} />Já recebido</div><div className="kpi-val sm num" style={{ color: "var(--pos)" }}>{formatBRL(recebido)}</div><div className="kpi-delta" style={{ color: "var(--pos)" }}>de {formatBRL(aReceber)} dividido</div></div>
        </div>

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 80 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : subs.length === 0 ? (
          <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)", padding: 60 }}>
            <OrcaIcon name="repeat" size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontWeight: 600, margin: 0 }}>Nenhuma assinatura cadastrada</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowNew(true)}><OrcaIcon name="plus" size={15} />Adicionar primeira assinatura</button>
          </div>
        ) : (
          <div style={{ columnCount: 2, columnGap: 16 }}>
            {subs.map(s => (
              <SubCard key={s.id} s={s}
                onEdit={() => setEditSub(s)}
                onDelete={() => handleDelete(s.id, s.name)}
                onToggleMember={(memberId, paid) => handleToggleMember(s.id, memberId, paid)}
              />
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
