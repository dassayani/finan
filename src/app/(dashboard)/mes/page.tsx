"use client";

import { useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { BankBadge } from "@/components/ui/bank-badge";
import { PayToggle } from "@/components/ui/pay-toggle";
import { BANKS, CATEGORIES, formatBRL } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";

// ---- Sample data matching the design ----
const DATA = {
  credits: 7086.71,
  fixos: [
    { name: 'Condomínio', v: 320.00, cat: 'casa' as CategoryKey, paid: true },
    { name: 'Internet', v: 127.00, cat: 'casa' as CategoryKey, paid: true },
    { name: 'Inglês', v: 290.00, cat: 'trab' as CategoryKey, paid: true },
    { name: 'PetLove', v: 49.00, cat: 'pet' as CategoryKey, paid: false },
    { name: 'TV ITG — Gabriel 2/5', v: 100.00, cat: 'lazer' as CategoryKey, paid: false },
    { name: 'Parcela 2 IR 30/06', v: 57.19, cat: 'tarifas' as CategoryKey, paid: false },
  ],
  variaveis: [
    { name: 'Mercado — Pão de Açúcar', v: 184.30, cat: 'alim' as CategoryKey, paid: true },
    { name: 'Uber', v: 38.50, cat: 'transp' as CategoryKey, paid: true },
    { name: 'Farmácia', v: 62.90, cat: 'saude' as CategoryKey, paid: false },
    { name: 'iFood', v: 73.40, cat: 'alim' as CategoryKey, paid: false },
    { name: 'Cinema', v: 54.00, cat: 'lazer' as CategoryKey, paid: false },
  ],
  banks: {
    caixa: { taxa: 3.00, items: [
      { name: 'Parcela Minha Casa', v: 351.00, cat: 'casa' as CategoryKey, paid: true },
      { name: 'Claro Celular', v: 60.90, cat: 'casa' as CategoryKey, paid: false },
    ]},
    itau: { taxa: 0, items: [
      { name: 'Dimevet 3/8', v: 218.75, cat: 'pet' as CategoryKey, paid: false },
    ]},
    bb: { taxa: 0, items: [
      { name: 'Anuidade', v: 18.00, cat: 'tarifas' as CategoryKey, paid: true },
      { name: 'CPU nova 11/18', v: 180.50, cat: 'compras' as CategoryKey, paid: true },
      { name: 'Compra Amazon mixer 6/6', v: 35.15, cat: 'compras' as CategoryKey, paid: true },
      { name: 'Airbnb Buenos Aires 1/6', v: 87.23, cat: 'viagem' as CategoryKey, paid: false },
      { name: 'Airbnb Ushuaia 1/6', v: 337.21, cat: 'viagem' as CategoryKey, paid: false },
      { name: 'Shopee 2/2', v: 59.91, cat: 'compras' as CategoryKey, paid: false },
      { name: 'Passagens Ingrid', v: 2455.60, cat: 'viagem' as CategoryKey, paid: false },
      { name: 'Amazon Prime', v: 107.57, cat: 'assin' as CategoryKey, paid: false },
    ]},
    nubank: { taxa: 0, items: [
      { name: 'Spotify Família', v: 6.82, cat: 'assin' as CategoryKey, paid: false },
      { name: 'AliExpress 2/3', v: 43.90, cat: 'compras' as CategoryKey, paid: true },
      { name: 'Posto Shell', v: 120.00, cat: 'transp' as CategoryKey, paid: true },
      { name: 'Renner 3/4', v: 89.90, cat: 'compras' as CategoryKey, paid: false },
    ]},
  } as Record<string, { taxa: number; items: { name: string; v: number; cat: CategoryKey; paid: boolean }[] }>,
};

const BANK_IDS: BankKey[] = ['caixa', 'itau', 'bb', 'nubank'];

function sum(items: { v: number }[]) { return items.reduce((a, b) => a + b.v, 0); }
function sumPaid(items: { v: number; paid: boolean }[]) { return items.filter(i => i.paid).reduce((a, b) => a + b.v, 0); }
function bankTotal(id: string) { return sum(DATA.banks[id].items) + DATA.banks[id].taxa; }
function bankPaid(id: string) { return sumPaid(DATA.banks[id].items); }

interface DenseRowProps {
  it: { name: string; v: number; cat: CategoryKey; paid: boolean };
  last: boolean;
}

function DenseRow({ it, last }: DenseRowProps) {
  const cat = CATEGORIES[it.cat];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 12,
      padding: '8px 16px', borderBottom: last ? 'none' : '1px solid var(--line-2)', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color, flex: '0 0 auto' }} />
        <span className="row-name" style={{ fontWeight: 600 }}>{it.name}</span>
        <span className="row-meta" style={{ flex: '0 0 auto' }}>{cat.label}</span>
      </div>
      <span className={`status ${it.paid ? 'paid' : 'pending'}`} style={{ fontSize: 10.5, padding: '3px 8px' }}>
        <span className="sd" />{it.paid ? 'Pago' : 'Pend.'}
      </span>
      <span className="amt neg num" style={{ minWidth: 86, textAlign: 'right', fontSize: 13 }}>{formatBRL(-it.v)}</span>
    </div>
  );
}

interface DenseSectionProps {
  title: string;
  badge: React.ReactNode;
  color: string;
  items: { name: string; v: number; cat: CategoryKey; paid: boolean }[];
  total: number;
  paidVal: number;
  taxa?: number;
}

function DenseSection({ title, badge, color, items, total, paidVal, taxa }: DenseSectionProps) {
  const pct = Math.round((paidVal / total) * 100) || 0;
  return (
    <div className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px',
        borderLeft: `3px solid ${color}`, background: 'var(--surface-2)', borderBottom: '1px solid var(--line-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {badge}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{title}</span>
          <span className="row-meta">{items.length} lançamentos</span>
        </div>
        <span className="amt neg num" style={{ fontSize: 14 }}>{formatBRL(-total)}</span>
      </div>
      {items.map((it, i) => (
        <DenseRow key={i} it={it} last={!taxa && i === items.length - 1} />
      ))}
      {taxa ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 16px', fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>
          <span>Taxa do banco</span><span className="num">{formatBRL(-taxa)}</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', borderTop: '1px solid var(--line-2)' }}>
        <span className="row-meta num">{formatBRL(paidVal)} de {formatBRL(total)} pago</span>
        <div className="bar" style={{ width: 120 }}>
          <span style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

export default function MesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fixosTotal = sum(DATA.fixos);
  const varsTotal = sum(DATA.variaveis);
  const debits = fixosTotal + varsTotal + BANK_IDS.reduce((a, id) => a + bankTotal(id), 0);
  const paid = sumPaid(DATA.fixos) + sumPaid(DATA.variaveis) + BANK_IDS.reduce((a, id) => a + bankPaid(id), 0);
  const pending = debits - paid;
  const saldo = DATA.credits - debits;
  const pct = Math.round((paid / debits) * 100) || 0;

  const buckets = [
    { label: 'Gastos Fixos', v: fixosTotal, c: 'var(--accent)' },
    { label: 'Variáveis', v: varsTotal, c: '#5B49C9' },
    ...BANK_IDS.map(id => ({ label: BANKS[id].name, v: bankTotal(id), c: BANKS[id].color })),
  ].sort((a, b) => b.v - a.v);
  const maxB = Math.max(...buckets.map(b => b.v));

  const monthLabel = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Visão do Mês</div>
          <div className="page-title">{monthCap}</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-ghost">
            <OrcaIcon name="filter" size={16} />Filtrar
          </button>
          <button className="btn btn-primary">
            <OrcaIcon name="plus" size={16} />Lançar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="content" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>
        {/* LEFT RAIL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Saldo */}
          <div className="card" style={{ padding: 22, background: 'var(--accent)', color: '#fff', border: 'none' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .8 }}>Saldo do mês</div>
            <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, letterSpacing: '-.03em', margin: '4px 0 14px' }}>
              {formatBRL(saldo, { sign: true })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>Entradas</div>
                <div className="num" style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{formatBRL(DATA.credits)}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>Saídas</div>
                <div className="num" style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{formatBRL(debits)}</div>
              </div>
            </div>
          </div>

          {/* Pago no mês */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span className="section-label" style={{ color: 'var(--ink-2)' }}>Pago no mês</span>
              <span className="num" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>{pct}%</span>
            </div>
            <div className="bar" style={{ height: 10, marginBottom: 10 }}>
              <span style={{ width: `${pct}%`, background: 'var(--pos)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
              <span className="num" style={{ color: 'var(--pos)' }}>{formatBRL(paid)}</span>
              <span className="num" style={{ color: 'var(--warn)' }}>{formatBRL(pending)} a pagar</span>
            </div>
          </div>

          {/* Para onde foi */}
          <div className="card card-pad">
            <div className="section-label" style={{ color: 'var(--ink-2)', marginBottom: 14 }}>Para onde foi</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {buckets.map((b, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: 'var(--ink-2)' }}>{b.label}</span>
                    <span className="num">{formatBRL(b.v)}</span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${(b.v / maxB) * 100}%`, background: b.c }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — ledger */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-label">Razão do mês · por bloco</div>
            <div className="seg">
              <button className="on">Tudo</button>
              <button>Pendentes</button>
              <button>Pagos</button>
            </div>
          </div>

          <DenseSection
            title="Gastos Fixos"
            color="var(--accent)"
            items={DATA.fixos}
            total={fixosTotal}
            paidVal={sumPaid(DATA.fixos)}
            badge={<span style={{ color: 'var(--accent)' }}><OrcaIcon name="repeat" size={16} /></span>}
          />

          <DenseSection
            title="Gastos Variáveis"
            color="#5B49C9"
            items={DATA.variaveis}
            total={varsTotal}
            paidVal={sumPaid(DATA.variaveis)}
            badge={<span style={{ color: '#5B49C9' }}><OrcaIcon name="flame" size={16} /></span>}
          />

          <div className="section-label" style={{ margin: '18px 0 10px' }}>Faturas por banco</div>
          <div style={{ columnCount: 2, columnGap: 14 }}>
            {BANK_IDS.map(id => (
              <div key={id} style={{ breakInside: 'avoid' }}>
                <DenseSection
                  title={BANKS[id].name}
                  color={BANKS[id].color}
                  items={DATA.banks[id].items}
                  total={bankTotal(id)}
                  paidVal={bankPaid(id)}
                  taxa={DATA.banks[id].taxa || undefined}
                  badge={<BankBadge id={id} size={24} />}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
