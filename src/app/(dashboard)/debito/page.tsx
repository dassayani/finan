"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { BankBadge } from "@/components/ui/bank-badge";
import { Modal } from "@/components/ui/modal";
import { BANKS, CATEGORIES, formatBRL } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";

type ExpenseMode = "BANK_BILL" | "FIXED" | "VARIABLE";

const PARCEL_PRESETS = [1, 2, 3, 6, 10, 12];
const BANK_IDS = Object.keys(BANKS) as BankKey[];

interface BankFee {
  id: string;
  bank: string;
  name: string;
  amount: number;
  billingDay: number;
}

// ─── Bank Fee Config Modal ────────────────────────────────────────────────────

function BankFeeModal({ onClose }: { onClose: () => void }) {
  const [fees, setFees] = useState<BankFee[]>([]);
  const [selectedBank, setSelectedBank] = useState<BankKey>("bb");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [saving, setSaving] = useState(false);

  const fetchFees = useCallback(async () => {
    const res = await fetch("/api/bank-fees");
    if (res.ok) setFees(await res.json());
  }, []);

  useEffect(() => { fetchFees(); }, [fetchFees]);

  async function addFee() {
    if (!name || !amount) return;
    setSaving(true);
    await fetch("/api/bank-fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank: selectedBank, name, amount: parseFloat(amount), billingDay: parseInt(day) }),
    });
    setName(""); setAmount(""); setDay("1");
    await fetchFees();
    setSaving(false);
  }

  async function removeFee(id: string) {
    await fetch(`/api/bank-fees/${id}`, { method: "DELETE" });
    fetchFees();
  }

  const byBank = BANK_IDS.filter(id => fees.some(f => f.bank === id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        Taxas configuradas aqui aparecem automaticamente no total de cada banco na Visão do Mês.
      </p>

      {/* Existing fees by bank */}
      {byBank.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {byBank.map(bankId => (
            <div key={bankId}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <BankBadge id={bankId} size={22} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>{BANKS[bankId].name}</span>
              </div>
              {fees.filter(f => f.bank === bankId).map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: "var(--surface-2)", borderRadius: "var(--r-sm)", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{f.name} <span className="row-meta">(dia {f.billingDay})</span></span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="num" style={{ fontWeight: 700, fontSize: 13, color: "var(--neg)" }}>{formatBRL(Number(f.amount))}</span>
                    <button onClick={() => removeFee(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neg)", padding: 2 }}>
                      <OrcaIcon name="dots" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add new fee */}
      <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Adicionar nova taxa</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {BANK_IDS.map(id => (
            <span key={id} className={`opt${selectedBank === id ? " sel" : ""}`} onClick={() => setSelectedBank(id)} style={{ cursor: "pointer", padding: "5px 8px", fontSize: 12 }}>
              <BankBadge id={id} size={16} />{BANKS[id].name}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 60px", gap: 8, marginBottom: 10 }}>
          <input className="orça-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Manutenção de conta" style={{ fontSize: 13 }} />
          <input className="orça-input num" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="R$ 0,00" style={{ fontSize: 13 }} />
          <input className="orça-input num" type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} placeholder="Dia" style={{ fontSize: 13 }} title="Dia do mês que a taxa é cobrada" />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={saving || !name || !amount} onClick={addFee}>
          <OrcaIcon name="plus" size={14} />Adicionar taxa
        </button>
      </div>

      <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onClose}>Fechar</button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DebitoPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ExpenseMode>("BANK_BILL");
  const [selectedBank, setSelectedBank] = useState<BankKey>("bb");
  const [selectedCat, setSelectedCat] = useState<CategoryKey>("compras");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [parcelas, setParcelas] = useState(1);
  const [manualParcelas, setManualParcelas] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [repeatPreset, setRepeatPreset] = useState<"year" | "custom">("year");
  const [showBankFees, setShowBankFees] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveParcelas = useManual ? (parseInt(manualParcelas) || 1) : parcelas;
  const total = parseFloat(amount) || 0;
  const each = effectiveParcelas > 0 ? total / effectiveParcelas : total;

  const baseDate = new Date(date);
  const months = Array.from({ length: effectiveParcelas }, (_, i) => {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
    return { label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), date: d };
  });

  const endOfYear = `${new Date().getFullYear()}-12-31`;
  const repeatEnd = repeat ? (repeatPreset === "year" ? endOfYear : repeatUntil) : null;

  async function handleSave() {
    if (!description || !amount) return;
    setSaving(true);
    try {
      const groupId = `grp-${Date.now()}`;

      if (mode === "BANK_BILL") {
        // Create one transaction per installment
        const records = months.map((m, i) => ({
          description: effectiveParcelas > 1 ? `${description} ${i + 1}/${effectiveParcelas}` : description,
          amount: each,
          type: "EXPENSE",
          expenseType: "BANK_BILL",
          category: selectedCat,
          bank: selectedBank,
          date: m.date.toISOString().split("T")[0],
          notes: notes || null,
          isPaid: i === 0 ? isPaid : false,
          installments: effectiveParcelas > 1 ? effectiveParcelas : null,
          installmentIndex: effectiveParcelas > 1 ? i + 1 : null,
          groupId: effectiveParcelas > 1 ? groupId : null,
        }));

        await Promise.all(records.map(r =>
          fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) })
        ));
      } else {
        // Fixed or Variable — optionally repeat monthly
        const startDate = new Date(date);
        const endDate = repeatEnd ? new Date(repeatEnd) : null;

        const dates: Date[] = [startDate];
        if (repeat && endDate) {
          let d = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
          while (d <= endDate) {
            dates.push(new Date(d));
            d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
          }
        }

        await Promise.all(dates.map((d, i) =>
          fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description,
              amount: total,
              type: "EXPENSE",
              expenseType: mode,
              category: selectedCat,
              bank: selectedBank || null,
              date: d.toISOString().split("T")[0],
              notes: notes || null,
              isPaid: i === 0 ? isPaid : false,
              groupId: dates.length > 1 ? groupId : null,
            }),
          })
        ));
      }

      router.push("/mes");
    } finally {
      setSaving(false);
    }
  }

  const modeConfig = {
    BANK_BILL: { label: "Fatura / Cartão", icon: "card", desc: "Gastos no cartão de crédito, agrupados por banco" },
    FIXED:     { label: "Gasto Fixo",      icon: "repeat", desc: "Boleto ou PIX fixo todo mês (condomínio, internet...)" },
    VARIABLE:  { label: "Gasto Variável",  icon: "flame",  desc: "Gasto avulso ou que pode repetir mensalmente" },
  } as const;

  return (
    <>
      <Modal open={showBankFees} onClose={() => setShowBankFees(false)} title="Configurar taxas dos bancos" width={520}>
        <BankFeeModal onClose={() => setShowBankFees(false)} />
      </Modal>

      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Lançamentos · Débito</div>
          <div className="page-title">Lançar Débito</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-ghost" onClick={() => setShowBankFees(true)}>
            <OrcaIcon name="settings" size={15} />Taxas dos bancos
          </button>
          <button className="btn btn-ghost" onClick={() => router.back()}>Cancelar</button>
          <button className="btn btn-primary" disabled={saving || !description || !amount} onClick={handleSave}>
            <OrcaIcon name="check" size={16} />{saving ? "Salvando..." : "Salvar lançamento"}
          </button>
        </div>
      </div>

      <div className="content" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>
        {/* FORM */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Mode selector */}
          <div className="card card-pad" style={{ paddingBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Tipo de lançamento</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {(["BANK_BILL", "FIXED", "VARIABLE"] as ExpenseMode[]).map(m => {
                const cfg = modeConfig[m];
                const active = mode === m;
                return (
                  <div key={m} onClick={() => setMode(m)} style={{
                    padding: "12px 14px", borderRadius: "var(--r-md)", cursor: "pointer",
                    border: `2px solid ${active ? "var(--accent)" : "var(--line)"}`,
                    background: active ? "var(--accent-soft)" : "var(--surface)",
                    transition: "all .15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <OrcaIcon name={cfg.icon} size={16} style={{ color: active ? "var(--accent)" : "var(--ink-3)" }} />
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: active ? "var(--accent)" : "var(--ink)" }}>{cfg.label}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: active ? "var(--accent)" : "var(--ink-3)", lineHeight: 1.4 }}>{cfg.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bank selector (BANK_BILL only) */}
          {mode === "BANK_BILL" && (
            <div className="card card-pad">
              <div className="section-label" style={{ marginBottom: 10 }}>Banco do cartão</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {BANK_IDS.map(id => {
                  const active = selectedBank === id;
                  return (
                    <button key={id} onClick={() => setSelectedBank(id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                      borderRadius: "var(--r-sm)", border: `2px solid ${active ? BANKS[id].color : "var(--line)"}`,
                      background: active ? BANKS[id].soft : "var(--surface)", cursor: "pointer",
                      fontWeight: 700, fontSize: 13, color: active ? BANKS[id].color : "var(--ink-2)",
                      transition: "all .15s",
                    }}>
                      <BankBadge id={id} size={24} />
                      {BANKS[id].name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description + Amount */}
          <div className="card card-pad">
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14, marginBottom: 14 }}>
              <div className="field">
                <label>Descrição</label>
                <input className="orça-input" value={description} onChange={e => setDescription(e.target.value)} placeholder={mode === "BANK_BILL" ? "Ex: Supermercado, Amazon..." : "Ex: Condomínio, Internet..."} />
              </div>
              <div className="field">
                <label>Valor{mode === "BANK_BILL" && effectiveParcelas > 1 ? " total" : ""}</label>
                <div className="input-prefix">
                  <span className="pf">R$</span>
                  <input className="orça-input num" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ paddingLeft: 34 }} placeholder="0,00" />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Data {mode === "BANK_BILL" ? "da compra" : "de vencimento"}</label>
                <input className="orça-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Categoria</label>
                <select className="orça-input" value={selectedCat} onChange={e => setSelectedCat(e.target.value as CategoryKey)}>
                  {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
                    <option key={k} value={k}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Parcelamento (BANK_BILL) */}
          {mode === "BANK_BILL" && (
            <div className="card card-pad">
              <div className="section-label" style={{ marginBottom: 10 }}>Parcelamento</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {PARCEL_PRESETS.map(n => (
                  <button key={n} onClick={() => { setParcelas(n); setUseManual(false); }} style={{
                    padding: "8px 14px", borderRadius: "var(--r-sm)", border: `2px solid ${!useManual && parcelas === n ? "var(--accent)" : "var(--line)"}`,
                    background: !useManual && parcelas === n ? "var(--accent-soft)" : "var(--surface)",
                    color: !useManual && parcelas === n ? "var(--accent)" : "var(--ink-2)",
                    fontWeight: 700, fontSize: 13.5, cursor: "pointer",
                  }}>{n === 1 ? "À vista" : `${n}x`}</button>
                ))}
                {/* Manual input */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    className="orça-input num"
                    type="number" min="2" max="120"
                    value={manualParcelas}
                    onChange={e => { setManualParcelas(e.target.value); setUseManual(true); }}
                    onFocus={() => setUseManual(true)}
                    placeholder="__x"
                    style={{
                      width: 64, textAlign: "center", fontSize: 13.5, fontWeight: 700,
                      border: `2px solid ${useManual ? "var(--accent)" : "var(--line)"}`,
                      background: useManual ? "var(--accent-soft)" : "var(--surface)",
                      color: useManual ? "var(--accent)" : "var(--ink-2)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>manual</span>
                </div>
              </div>
              {total > 0 && effectiveParcelas > 1 && (
                <div className="row-meta" style={{ marginTop: 10 }}>
                  {effectiveParcelas}x de <b className="num" style={{ color: "var(--ink)" }}>{formatBRL(each)}</b>
                  {" · "}1ª em {months[0]?.label}, última em {months[months.length - 1]?.label}
                </div>
              )}
            </div>
          )}

          {/* Repetir mensalmente (FIXED / VARIABLE) */}
          {(mode === "FIXED" || mode === "VARIABLE") && (
            <div className="card card-pad">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: repeat ? 14 : 0 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>Repetir mensalmente</div>
                  <div className="row-meta">Lança automaticamente nos próximos meses</div>
                </div>
                <span className={`switch${repeat ? " on" : ""}`} onClick={() => setRepeat(v => !v)} style={{ cursor: "pointer" }} />
              </div>

              {repeat && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="seg" style={{ width: "100%" }}>
                    <button style={{ flex: 1 }} className={repeatPreset === "year" ? "on" : ""} onClick={() => setRepeatPreset("year")}>
                      Até fim do ano ({new Date().getFullYear()})
                    </button>
                    <button style={{ flex: 1 }} className={repeatPreset === "custom" ? "on" : ""} onClick={() => setRepeatPreset("custom")}>
                      Outra data
                    </button>
                  </div>
                  {repeatPreset === "custom" && (
                    <div className="field">
                      <label>Repetir até</label>
                      <input className="orça-input" type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} />
                    </div>
                  )}
                  {repeatEnd && date && (
                    <div className="row-meta">
                      Serão criados {Math.max(1, Math.round((new Date(repeatEnd).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 30))) + 1} lançamentos
                    </div>
                  )}
                </div>
              )}

              {/* Optional bank for fixed/variable */}
              <div style={{ marginTop: 16, borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>Banco de débito (opcional)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => setSelectedBank("" as BankKey)} style={{ padding: "6px 12px", borderRadius: "var(--r-sm)", border: `2px solid ${!selectedBank ? "var(--accent)" : "var(--line)"}`, background: !selectedBank ? "var(--accent-soft)" : "var(--surface)", color: !selectedBank ? "var(--accent)" : "var(--ink-2)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Nenhum
                  </button>
                  {BANK_IDS.map(id => (
                    <button key={id} onClick={() => setSelectedBank(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--r-sm)", border: `2px solid ${selectedBank === id ? BANKS[id].color : "var(--line)"}`, background: selectedBank === id ? BANKS[id].soft : "var(--surface)", cursor: "pointer", fontWeight: 700, fontSize: 12, color: selectedBank === id ? BANKS[id].color : "var(--ink-2)" }}>
                      <BankBadge id={id} size={18} />{BANKS[id].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Paid toggle + Notes */}
          <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {mode === "BANK_BILL" && effectiveParcelas > 1 ? "Já paguei a 1ª parcela?" : "Já paguei?"}
                </div>
                <div className="row-meta">Marca como pago e entra no fluxo de caixa</div>
              </div>
              <span className={`switch${isPaid ? " on" : ""}`} onClick={() => setIsPaid(v => !v)} style={{ cursor: "pointer" }} />
            </div>

            {/* Notes toggle */}
            <div>
              <button onClick={() => setShowNotes(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
                <OrcaIcon name="edit" size={13} />
                {showNotes ? "Ocultar observação" : "Adicionar observação"}
              </button>
              {showNotes && (
                <textarea
                  className="orça-input"
                  style={{ marginTop: 8, resize: "vertical", minHeight: 72, fontFamily: "var(--font-body)", fontSize: 13 }}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Detalhes, contexto ou lembretes sobre este lançamento..."
                />
              )}
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 80 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            {mode === "BANK_BILL" ? (
              <div style={{ padding: "14px 18px", background: BANKS[selectedBank].soft, borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "center", gap: 10 }}>
                <BankBadge id={selectedBank} size={28} />
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>Lançamento automático</div>
                  <div className="row-meta">{BANKS[selectedBank].name}</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 18px", background: mode === "FIXED" ? "var(--accent-soft)" : "#EFEDFB", borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "center", gap: 10 }}>
                <OrcaIcon name={mode === "FIXED" ? "repeat" : "flame"} size={20} style={{ color: mode === "FIXED" ? "var(--accent)" : "#5B49C9" }} />
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{mode === "FIXED" ? "Gasto Fixo" : "Gasto Variável"}</div>
                  <div className="row-meta">{repeat ? "Mensal" : "Único"}</div>
                </div>
              </div>
            )}

            <div style={{ padding: "14px 18px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {selectedCat && <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORIES[selectedCat]?.color }} />}
                <span style={{ fontWeight: 700, fontSize: 14 }}>{description || "Descrição"}</span>
              </div>
              {selectedCat && <div className="row-meta" style={{ marginBottom: 8 }}>{CATEGORIES[selectedCat]?.label}</div>}
              <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--neg)" }}>
                {total > 0 ? formatBRL(-total) : "R$ —"}
              </div>
              {mode === "BANK_BILL" && effectiveParcelas > 1 && (
                <div className="row-meta">distribuído em {effectiveParcelas} meses</div>
              )}
              {(mode === "FIXED" || mode === "VARIABLE") && repeat && repeatEnd && (
                <div className="row-meta">repete mensalmente até {new Date(repeatEnd).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
              )}
            </div>

            {/* Installments preview */}
            {mode === "BANK_BILL" && effectiveParcelas > 1 && months.length > 0 && (
              <>
                <div className="divider" />
                <div style={{ padding: "6px 0", maxHeight: 300, overflowY: "auto" }}>
                  {months.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, background: i === 0 ? "var(--accent)" : "var(--surface-3)", color: i === 0 ? "#fff" : "var(--ink-3)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, flex: "0 0 auto" }}>{i + 1}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                          <div className="row-meta">Parcela {i + 1}/{effectiveParcelas}</div>
                        </div>
                      </div>
                      <span className="amt neg num">{formatBRL(-each)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Note preview */}
          {notes && (
            <div className="card card-pad" style={{ background: "var(--warn-soft)", border: "none" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <OrcaIcon name="edit" size={14} style={{ color: "var(--warn)", flex: "0 0 auto", marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--warn)", fontWeight: 600, lineHeight: 1.5 }}>{notes}</p>
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="card card-pad" style={{ background: "var(--accent-soft)", border: "none" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <OrcaIcon name={modeConfig[mode].icon} size={15} style={{ color: "var(--accent)", flex: "0 0 auto", marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 12, color: "var(--accent)", fontWeight: 600, lineHeight: 1.5 }}>
                {mode === "BANK_BILL"
                  ? "Cada parcela entra no mês correspondente. Marque como paga quando quitar — o saldo se ajusta na hora."
                  : mode === "FIXED"
                  ? "Gastos fixos são pagos via boleto/PIX no início do mês. Ative 'Repetir' para criar automaticamente nos próximos meses."
                  : "Gastos variáveis são avulsos, feitos com o saldo disponível. Ative 'Repetir' se for recorrente."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
