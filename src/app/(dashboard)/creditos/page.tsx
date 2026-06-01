"use client";

import { useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { BankBadge } from "@/components/ui/bank-badge";
import { CATEGORIES, formatBRL } from "@/lib/constants";
import type { CategoryKey } from "@/lib/constants";

const SAL = {
  base: 4760.88,
  proventos: [
    { n: 'Salário base', v: 4760.88 },
    { n: 'Extra / PLR', v: 0 },
    { n: 'Horas extras', v: 0 },
  ],
  descontos: [
    { n: 'INSS', v: 501.05 },
    { n: 'IRRF', v: 134.96 },
    { n: 'Desc. Unimed', v: 161.96 },
  ],
};

const OUTROS = [
  { name: 'Outros (Tati)', v: 60.00, src: 'Reembolso', cat: 'reemb' as CategoryKey },
  { name: 'Outros (YouTube F)', v: 53.90, src: 'Assinatura compart.', cat: 'reemb' as CategoryKey },
  { name: 'Pai/Mãe — Ushuaia 1/6', v: 509.97, src: 'Parcela 1 de 6', cat: 'viagem' as CategoryKey },
  { name: 'Ingrid — Ushuaia', v: 2403.99, src: 'Reembolso viagem', cat: 'viagem' as CategoryKey },
  { name: 'Pai — Nutag', v: 96.94, src: 'Reembolso', cat: 'reemb' as CategoryKey },
];

const SALDOS = [
  { bank: 'caixa' as const, v: 64.00 },
  { bank: 'itau' as const, v: 0.90 },
  { bank: 'bb' as const, v: 14.52 },
  { bank: 'nubank' as const, v: 150.00 },
];

export default function CreditosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const provTotal = SAL.proventos.reduce((a, p) => a + p.v, 0);
  const descTotal = SAL.descontos.reduce((a, p) => a + p.v, 0);
  const liquido = provTotal - descTotal;
  const outrosTotal = OUTROS.reduce((a, p) => a + p.v, 0);
  const total = liquido + outrosTotal;

  const monthLabel = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Lançamentos · Créditos</div>
          <div className="page-title">Créditos</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary">
            <OrcaIcon name="plus" size={16} />Lançar crédito
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
          <div className="card kpi">
            <div className="kpi-label">
              <OrcaIcon name="arrowDown" size={14} style={{ color: 'var(--pos)' }} />
              Total de entradas
            </div>
            <div className="kpi-val num" style={{ color: 'var(--pos)' }}>{formatBRL(total)}</div>
            <div className="kpi-delta" style={{ color: 'var(--pos)' }}>
              <OrcaIcon name="trend" size={13} />em {OUTROS.length + 1} lançamentos
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">
              <OrcaIcon name="wallet" size={14} />Salário líquido
            </div>
            <div className="kpi-val num">{formatBRL(liquido)}</div>
            <div className="kpi-delta muted">CLT · cai dia 05</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">
              <OrcaIcon name="coins" size={14} />Outros recebimentos
            </div>
            <div className="kpi-val num">{formatBRL(outrosTotal)}</div>
            <div className="kpi-delta muted">{OUTROS.length} fontes</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 16, alignItems: 'start' }}>
          {/* Holerite */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <span className="dot" style={{ background: 'var(--pos)' }} />
                Salário CLT · {monthCap}
              </div>
              <span className="chip">Recorrente</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              <div className="section-label" style={{ padding: '12px 20px 4px' }}>Proventos</div>
              {SAL.proventos.map((p, i) => (
                <div className="row" key={i} style={{ borderBottom: 'none', padding: '7px 20px' }}>
                  <span className="row-name">{p.n}</span>
                  <span className="amt pos num">{p.v ? formatBRL(p.v, { sign: true }) : '—'}</span>
                </div>
              ))}
              <div className="section-label" style={{ padding: '14px 20px 4px' }}>Descontos</div>
              {SAL.descontos.map((p, i) => (
                <div className="row" key={i} style={{ borderBottom: 'none', padding: '7px 20px' }}>
                  <span className="row-name">{p.n}</span>
                  <span className="amt neg num">{formatBRL(-p.v)}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ background: 'var(--pos-soft)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
              <span style={{ fontWeight: 800 }}>Líquido recebido</span>
              <span className="amt pos num" style={{ fontSize: 17 }}>{formatBRL(liquido)}</span>
            </div>
          </div>

          {/* Outros + Saldos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  <span className="dot" style={{ background: 'var(--accent)' }} />
                  Outros recebimentos
                </div>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
                  <OrcaIcon name="plus" size={14} />Adicionar
                </button>
              </div>
              {OUTROS.map((c, i) => (
                <div className="row" key={i}>
                  <div className="row-l">
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: CATEGORIES[c.cat].color, flex: '0 0 auto' }} />
                    <div>
                      <div className="row-name">{c.name}</div>
                      <div className="row-meta">{c.src}</div>
                    </div>
                  </div>
                  <span className="amt pos num">{formatBRL(c.v, { sign: true })}</span>
                </div>
              ))}
            </div>

            <div className="card card-pad">
              <div className="section-label" style={{ marginBottom: 12 }}>Saldos iniciais por banco</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SALDOS.filter(s => s.v > 0).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
                    <BankBadge id={s.bank} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        {s.bank.charAt(0).toUpperCase() + s.bank.slice(1)}
                      </div>
                      <div className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--pos)' }}>{formatBRL(s.v)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
