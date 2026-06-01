"use client";

import { useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { MonthPill } from "@/components/ui/month-pill";
import { PayToggle } from "@/components/ui/pay-toggle";
import { formatBRL } from "@/lib/constants";

interface SubPerson {
  n: string;
  share: number;
  paid: boolean;
  me?: boolean;
}

interface Sub {
  name: string;
  brand: string;
  icon: string;
  total: number;
  account: string;
  people: SubPerson[];
}

const SUBS_DATA: Sub[] = [
  { name: 'Spotify', brand: '#1DB954', icon: 'music', total: 34.90, account: 'Conta Família',
    people: [
      { n: 'Você', share: 6.82, paid: true, me: true },
      { n: 'Mano', share: 6.82, paid: true },
      { n: 'Yonara', share: 6.82, paid: false },
      { n: 'Ingrid', share: 6.50, paid: true },
      { n: 'Ketlyn', share: 5.80, paid: false },
    ]},
  { name: 'Netflix', brand: '#E50914', icon: 'tv', total: 44.90, account: 'Premium 4K',
    people: [
      { n: 'Você', share: 30.90, paid: true, me: true },
      { n: 'Tati', share: 14.00, paid: false },
    ]},
  { name: 'Disney+', brand: '#1A53D6', icon: 'play', total: 28.99, account: 'Padrão',
    people: [
      { n: 'Você', share: 14.49, paid: true, me: true },
      { n: 'Ketlyn', share: 4.20, paid: true },
      { n: 'Tati', share: 9.30, paid: false },
      { n: 'Letícia', share: 4.20, paid: false },
    ]},
  { name: 'YouTube Premium', brand: '#FF0000', icon: 'play', total: 53.90, account: 'Família',
    people: [
      { n: 'Você', share: 8.90, paid: true, me: true },
      { n: 'Letícia', share: 9.00, paid: true },
      { n: 'Shay', share: 9.00, paid: true },
      { n: 'Sara', share: 9.00, paid: false },
      { n: 'Millena', share: 9.00, paid: false },
      { n: 'Nia', share: 9.00, paid: false },
    ]},
];

function personInitials(n: string) {
  return n === 'Você' ? 'EU' : n.slice(0, 2).toUpperCase();
}

function SubCard({ s }: { s: Sub }) {
  const me = s.people.find(p => p.me)!;
  const others = s.people.filter(p => !p.me);
  const aReceber = others.reduce((a, p) => a + p.share, 0);
  const recebido = others.reduce((a, p) => a + (p.paid ? p.share : 0), 0);
  const pagaram = others.filter(p => p.paid).length;
  const pct = aReceber ? Math.round((recebido / aReceber) * 100) : 0;

  return (
    <div className="card" style={{ overflow: 'hidden', breakInside: 'avoid', marginBottom: 16 }}>
      <div style={{ padding: '16px 18px', background: s.brand, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>
            <OrcaIcon name={s.icon} size={21} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{s.name}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, opacity: .85 }}>{s.account} · {s.people.length} pessoas</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="num" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{formatBRL(s.total)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: .85 }}>por mês</div>
        </div>
      </div>

      {/* Sua parte */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line-2)' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Sua parte</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PayToggle paid={me.paid} />
          <span className="num" style={{ fontWeight: 800, fontSize: 14 }}>{formatBRL(me.share)}</span>
        </div>
      </div>

      {/* Pessoas */}
      <div style={{ padding: '4px 0' }}>
        {others.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%',
                background: p.paid ? 'var(--pos-soft)' : 'var(--surface-3)',
                color: p.paid ? 'var(--pos)' : 'var(--ink-3)',
                display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
                {personInitials(p.n)}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.n}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="num" style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-2)' }}>{formatBRL(p.share)}</span>
              <PayToggle
                paid={p.paid}
                label={{ paid: 'Recebido', pending: 'Cobrar' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '11px 18px', borderTop: '1px solid var(--line-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="row-meta">{pagaram} de {others.length} já pagaram</span>
          <button className="pay-toggle" style={{ borderStyle: 'dashed' }}>
            <OrcaIcon name="edit" size={13} />Editar divisão
          </button>
        </div>
        <div className="bar" style={{ marginBottom: 6 }}>
          <span style={{ width: `${pct}%`, background: s.brand }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
          <span className="num" style={{ color: 'var(--pos)' }}>{formatBRL(recebido)} recebido</span>
          <span className="num muted">de {formatBRL(aReceber)} a receber</span>
        </div>
      </div>
    </div>
  );
}

export default function AssinaturasPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const totalMensal = SUBS_DATA.reduce((a, s) => a + s.total, 0);
  const suaParte = SUBS_DATA.reduce((a, s) => a + (s.people.find(p => p.me)?.share ?? 0), 0);
  const others = SUBS_DATA.flatMap(s => s.people.filter(p => !p.me));
  const aReceber = others.reduce((a, p) => a + p.share, 0);
  const recebido = others.reduce((a, p) => a + (p.paid ? p.share : 0), 0);

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
          <div className="crumb">Carteiras</div>
          <div className="page-title">Assinaturas</div>
        </div>
        <div className="topbar-r">
          <MonthPill label={monthCap} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-primary">
            <OrcaIcon name="plus" size={16} />Nova assinatura
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="repeat" size={14} />Custo total / mês</div>
            <div className="kpi-val sm num">{formatBRL(totalMensal)}</div>
            <div className="kpi-delta muted">{SUBS_DATA.length} assinaturas</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} style={{ color: 'var(--neg)' }} />Sua parte</div>
            <div className="kpi-val sm num" style={{ color: 'var(--neg)' }}>{formatBRL(suaParte)}</div>
            <div className="kpi-delta muted">o que sai do seu bolso</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="users" size={14} style={{ color: 'var(--warn)' }} />A receber</div>
            <div className="kpi-val sm num" style={{ color: 'var(--warn)' }}>{formatBRL(aReceber - recebido)}</div>
            <div className="kpi-delta muted">de {others.length} pessoas</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowDown" size={14} style={{ color: 'var(--pos)' }} />Já recebido</div>
            <div className="kpi-val sm num" style={{ color: 'var(--pos)' }}>{formatBRL(recebido)}</div>
            <div className="kpi-delta" style={{ color: 'var(--pos)' }}>de {formatBRL(aReceber)} dividido</div>
          </div>
        </div>

        <div style={{ columnCount: 2, columnGap: 16 }}>
          {SUBS_DATA.map((s, i) => <SubCard key={i} s={s} />)}
        </div>
      </div>
    </>
  );
}
