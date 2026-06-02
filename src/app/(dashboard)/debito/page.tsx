"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { BankBadge } from "@/components/ui/bank-badge";
import { BANKS, CATEGORIES, formatBRL } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";

type ExpenseMode = "BANK_BILL" | "FIXED" | "VARIABLE";

// Parse "YYYY-MM-DD" as local date (not UTC) to avoid timezone day-shift
function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Format Date as "YYYY-MM-DD" in local time
function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PARCEL_PRESETS = [1, 2, 3, 6, 10, 12];
const BANK_IDS = Object.keys(BANKS) as BankKey[];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DebitoPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ExpenseMode>("BANK_BILL");
  const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [selectedBank, setSelectedBank] = useState<BankKey>("nubank");
  const [selectedCat, setSelectedCat] = useState<CategoryKey>("compras");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [parcelas, setParcelas] = useState(1);
  const [isPaid, setIsPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [repeatPreset, setRepeatPreset] = useState<"year" | "custom">("year");
  const [saving, setSaving] = useState(false);
  const [inputMode, setInputMode] = useState<"total" | "per_installment">("total");
  const [amountOverrides, setAmountOverrides] = useState<Record<number, number>>({});

  const effectiveParcelas = Math.max(1, parcelas);
  const amountVal = parseFloat(amount) || 0;

  // Clear individual overrides whenever the base inputs change
  useEffect(() => {
    setAmountOverrides({});
  }, [amount, inputMode, effectiveParcelas]);

  const baseEach = effectiveParcelas > 0
    ? (inputMode === "total" ? amountVal / effectiveParcelas : amountVal)
    : amountVal;

  const installmentAmounts = Array.from({ length: effectiveParcelas }, (_, i) =>
    amountOverrides[i] !== undefined ? amountOverrides[i] : baseEach
  );

  const installmentTotal = installmentAmounts.reduce((s, v) => s + v, 0);
  const total = mode === "BANK_BILL" ? installmentTotal : amountVal;

  const baseDate = parseLocalDate(date);
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
        const isCredit = txType === "INCOME";
        const records = months.map((m, i) => ({
          description: effectiveParcelas > 1 ? `${description} ${i + 1}/${effectiveParcelas}` : description,
          amount: installmentAmounts[i] ?? 0,
          type: txType,
          expenseType: isCredit ? null : "BANK_BILL",
          category: selectedCat,
          bank: selectedBank,
          date: formatLocalDate(m.date),
          notes: notes || null,
          isPaid: isCredit ? false : (i === 0 ? isPaid : false),
          installments: effectiveParcelas > 1 ? effectiveParcelas : null,
          installmentIndex: effectiveParcelas > 1 ? i + 1 : null,
          groupId: effectiveParcelas > 1 ? groupId : null,
        }));

        await Promise.all(records.map(r =>
          fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) })
        ));
      } else {
        // Fixed or Variable — optionally repeat monthly
        const startDate = parseLocalDate(date);
        const endDate = repeatEnd ? parseLocalDate(repeatEnd) : null;

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
              date: formatLocalDate(d),
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

      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Lançamentos · Débito</div>
          <div className="page-title">Lançar Débito</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-ghost" onClick={() => {
            setMode("BANK_BILL");
            setTxType("EXPENSE");
            setSelectedBank("nubank");
            setSelectedCat("compras");
            setDescription("");
            setAmount("");
            setDate(formatLocalDate(new Date()));
            setParcelas(1);
            setIsPaid(false);
            setNotes("");
            setRepeat(false);
            setRepeatUntil("");
            setRepeatPreset("year");
            setInputMode("total");
            setAmountOverrides({});
          }}>Limpar Dados</button>
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
                  <div key={m} onClick={() => { setMode(m); if (m !== "BANK_BILL") setTxType("EXPENSE"); }} style={{
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="section-label">Banco do cartão</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {([["EXPENSE", "⬇ Débito"], ["INCOME", "⬆ Crédito / Estorno"]] as const).map(([t, lbl]) => (
                    <button key={t} onClick={() => setTxType(t)} style={{
                      padding: "5px 12px", fontSize: 12, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer",
                      border: `1.5px solid ${txType === t ? (t === "INCOME" ? "var(--pos, #1a7c3a)" : "var(--accent)") : "var(--line)"}`,
                      background: txType === t ? (t === "INCOME" ? "var(--pos-soft, #e6f4ea)" : "var(--accent-soft)") : "var(--surface)",
                      color: txType === t ? (t === "INCOME" ? "var(--pos, #1a7c3a)" : "var(--accent)") : "var(--ink-3)",
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>
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

          {/* Description + Amount + Parcelas */}
          <div className="card card-pad">
            {/* Row 1: Descrição | Valor | Toggle modo */}
            <div style={{ display: "grid", gridTemplateColumns: mode === "BANK_BILL" ? "1.6fr 1fr auto" : "1.6fr 1fr", gap: 14, marginBottom: 14, alignItems: "end" }}>
              <div className="field">
                <label>Descrição</label>
                <input className="orça-input" value={description} onChange={e => setDescription(e.target.value)} placeholder={mode === "BANK_BILL" ? "Ex: Supermercado, Amazon..." : "Ex: Condomínio, Internet..."} />
              </div>
              <div className="field">
                <label>
                  {mode === "BANK_BILL"
                    ? (inputMode === "per_installment" ? "Valor por parcela" : effectiveParcelas > 1 ? "Valor total" : "Valor")
                    : "Valor"}
                </label>
                <div className="input-prefix">
                  <span className="pf">R$</span>
                  <input className="orça-input num" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ paddingLeft: 34 }} placeholder="0,00" />
                </div>
              </div>
              {mode === "BANK_BILL" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 2 }}>
                  {([["total", "÷ total"], ["per_installment", "× parcela"]] as const).map(([m, lbl]) => (
                    <button key={m} onClick={() => setInputMode(m)} style={{
                      padding: "5px 10px", fontSize: 11.5, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer",
                      border: `1.5px solid ${inputMode === m ? "var(--accent)" : "var(--line)"}`,
                      background: inputMode === m ? "var(--accent-soft)" : "var(--surface)",
                      color: inputMode === m ? "var(--accent)" : "var(--ink-3)",
                      whiteSpace: "nowrap",
                    }}>{lbl}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 2: Data | Parcelas (BANK_BILL) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div className="field">
                <label>Data {mode === "BANK_BILL" ? "da compra" : "de vencimento"}</label>
                <input className="orça-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              {mode === "BANK_BILL" ? (
                <div className="field">
                  <label>Parcelas</label>
                  <input
                    className="orça-input num"
                    type="number" min="1" max="120"
                    value={parcelas}
                    onChange={e => setParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ fontWeight: 700, marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {PARCEL_PRESETS.map(n => (
                      <button key={n} onClick={() => setParcelas(n)} style={{
                        padding: "4px 10px", borderRadius: "var(--r-sm)", fontSize: 12,
                        border: `1.5px solid ${parcelas === n ? "var(--accent)" : "var(--line)"}`,
                        background: parcelas === n ? "var(--accent-soft)" : "var(--surface)",
                        color: parcelas === n ? "var(--accent)" : "var(--ink-2)",
                        fontWeight: 700, cursor: "pointer",
                      }}>{n === 1 ? "À vista" : `${n}x`}</button>
                    ))}
                  </div>
                  {amountVal > 0 && effectiveParcelas > 1 && (
                    <div className="row-meta" style={{ marginTop: 8 }}>
                      {inputMode === "total"
                        ? <>{effectiveParcelas}x de <b className="num" style={{ color: "var(--ink)" }}>{formatBRL(amountVal / effectiveParcelas)}</b></>
                        : <>Total: <b className="num" style={{ color: "var(--ink)" }}>{formatBRL(amountVal * effectiveParcelas)}</b></>
                      }
                      {" · "}última em {months[months.length - 1]?.label}
                    </div>
                  )}
                </div>
              ) : (
                <div className="field">
                  <label>Categoria</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
                      <span key={k} className={`opt${selectedCat === k ? " sel" : ""}`} onClick={() => setSelectedCat(k as CategoryKey)} style={{ cursor: "pointer", fontSize: 12, padding: "5px 10px" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />{c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Categoria (BANK_BILL only — outros modos já mostram acima) */}
            {mode === "BANK_BILL" && (
              <div className="field">
                <label>Categoria</label>
                <select className="orça-input" value={selectedCat} onChange={e => setSelectedCat(e.target.value as CategoryKey)}>
                  {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
                    <option key={k} value={k}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

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

            {/* Notes — always visible in the form */}
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <OrcaIcon name="edit" size={13} style={{ color: "var(--ink-3)" }} />
                Observação <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(opcional)</span>
              </label>
              <textarea
                className="orça-input"
                style={{ resize: "vertical", minHeight: 72, fontFamily: "var(--font-body)", fontSize: 13 }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Detalhes, contexto ou lembretes — aparece na Visão do Mês ao clicar no ícone de nota"
              />
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 80 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            {mode === "BANK_BILL" ? (
              <div style={{ padding: "14px 18px", background: txType === "INCOME" ? "var(--pos-soft, #e6f4ea)" : BANKS[selectedBank].soft, borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "center", gap: 10 }}>
                <BankBadge id={selectedBank} size={28} />
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: txType === "INCOME" ? "var(--pos, #1a7c3a)" : "inherit" }}>
                    {txType === "INCOME" ? "Crédito / Estorno" : "Dados do Lançamento"}
                  </div>
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
              <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: txType === "INCOME" ? "var(--pos, #1a7c3a)" : "var(--neg)" }}>
                {total > 0 ? (txType === "INCOME" ? formatBRL(total) : formatBRL(-total)) : "R$ —"}
              </div>
              {mode === "BANK_BILL" && effectiveParcelas > 1 && (
                <div className="row-meta">distribuído em {effectiveParcelas} parcelas</div>
              )}
              {(mode === "FIXED" || mode === "VARIABLE") && repeat && repeatEnd && (
                <div className="row-meta">repete mensalmente até {new Date(repeatEnd).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
              )}
            </div>

            {/* Installments preview — editable */}
            {mode === "BANK_BILL" && effectiveParcelas > 1 && months.length > 0 && (
              <>
                <div className="divider" />
                <div style={{ padding: "4px 18px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="section-label">Parcelas</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>edite os valores individuais</span>
                </div>
                <div style={{ padding: "0 0 6px", maxHeight: 320, overflowY: "auto" }}>
                  {months.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, background: i === 0 ? "var(--accent)" : "var(--surface-3)", color: i === 0 ? "#fff" : "var(--ink-3)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, flex: "0 0 auto" }}>{i + 1}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                          <div className="row-meta">Parcela {i + 1}/{effectiveParcelas}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>R$</span>
                        <input
                          className="orça-input num"
                          type="number"
                          step="0.01"
                          value={installmentAmounts[i] !== undefined ? String(Math.round((installmentAmounts[i] ?? 0) * 100) / 100) : ""}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setAmountOverrides(prev => ({ ...prev, [i]: val }));
                          }}
                          style={{ width: 82, textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--neg)", padding: "4px 8px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)" }}
                        />
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "8px 18px 4px", borderTop: "1px solid var(--line-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="row-meta">Total</span>
                    <span className="num" style={{ fontSize: 14, fontWeight: 700, color: "var(--neg)" }}>{formatBRL(-installmentTotal)}</span>
                  </div>
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
