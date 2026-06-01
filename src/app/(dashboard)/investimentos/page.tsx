"use client";

import { OrcaIcon } from "@/components/ui/orca-icon";
import { BankBadge } from "@/components/ui/bank-badge";
import { BANKS, formatBRL } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

const INVEST = [
  { name: 'Tesouro Selic 2029', type: 'Renda Fixa', inst: 'caixa' as BankKey, v: 12480.00, ret: 0.108, aporte: 500 },
  { name: 'CDB Liquidez Diária', type: 'Renda Fixa', inst: 'nubank' as BankKey, v: 6320.50, ret: 0.102, aporte: 300 },
  { name: 'Fundo Imobiliário HGLG11', type: 'FII', inst: 'itau' as BankKey, v: 4150.00, ret: 0.089, aporte: 0 },
  { name: 'ETF IVVB11', type: 'Ações', inst: 'itau' as BankKey, v: 3890.00, ret: 0.214, aporte: 200 },
  { name: 'Reserva de Emergência', type: 'Renda Fixa', inst: 'mp' as BankKey, v: 8000.00, ret: 0.098, aporte: 400 },
];

const TYPE_COLORS: Record<string, string> = {
  'Renda Fixa': '#15543D',
  'FII': '#EC7000',
  'Ações': '#820AD1',
};

export default function InvestimentosPage() {
  const total = INVEST.reduce((s, i) => s + i.v, 0);
  const aporte = INVEST.reduce((s, i) => s + i.aporte, 0);
  const wReturn = INVEST.reduce((s, i) => s + i.ret * i.v, 0) / total;
  const rendimento = (total * wReturn) / 12;

  const byType: Record<string, number> = {};
  INVEST.forEach(i => { byType[i.type] = (byType[i.type] || 0) + i.v; });
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  let acc = 0;
  const stops = types.map(([k, v]) => {
    const start = (acc / total) * 360;
    acc += v;
    const end = (acc / total) * 360;
    return `${TYPE_COLORS[k]} ${start}deg ${end}deg`;
  }).join(', ');

  const totalK = total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <>
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Carteiras</div>
          <div className="page-title">Investimentos</div>
        </div>
        <div className="topbar-r">
          <div className="seg">
            <button>Mês</button>
            <button className="on">Ano</button>
            <button>Tudo</button>
          </div>
          <button className="btn btn-primary">
            <OrcaIcon name="plus" size={16} />Novo aporte
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
          <div className="card kpi">
            <div className="kpi-label" style={{ color: 'var(--ink-3)' }}>
              <OrcaIcon name="wallet" size={14} style={{ color: 'var(--accent)' }} />Patrimônio
            </div>
            <div className="kpi-val num">{formatBRL(total)}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">
              <OrcaIcon name="trend" size={14} style={{ color: 'var(--pos)' }} />Rend. no mês
            </div>
            <div className="kpi-val sm num" style={{ color: 'var(--pos)' }}>{formatBRL(rendimento, { sign: true })}</div>
            <div className="kpi-delta" style={{ color: 'var(--pos)' }}>{(wReturn * 100).toFixed(1)}% a.a. médio</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">
              <OrcaIcon name="repeat" size={14} />Aporte mensal
            </div>
            <div className="kpi-val sm num">{formatBRL(aporte)}</div>
            <div className="kpi-delta muted">automático</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">
              <OrcaIcon name="coins" size={14} />Ativos
            </div>
            <div className="kpi-val sm num">{INVEST.length}</div>
            <div className="kpi-delta muted">{types.length} classes</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Donut allocation */}
          <div className="card card-pad">
            <div className="section-label" style={{ marginBottom: 16 }}>Alocação por classe</div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 20px' }}>
              <div style={{ width: 168, height: 168, borderRadius: '50%', background: `conic-gradient(${stops})`, display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 108, height: 108, borderRadius: '50%', background: 'var(--surface)', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                  <div>
                    <div className="row-meta">Total</div>
                    <div className="num" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>R$ {totalK}</div>
                  </div>
                </div>
              </div>
            </div>
            {types.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: TYPE_COLORS[k] }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{k}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="num" style={{ fontWeight: 700, fontSize: 13 }}>{formatBRL(v)}</span>
                  <span className="row-meta num" style={{ marginLeft: 8 }}>{Math.round((v / total) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Asset list */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Carteira</div>
              <span className="chip">{INVEST.length} ativos</span>
            </div>
            {INVEST.map((it, i) => (
              <div className="row" key={i} style={{ padding: '13px 20px' }}>
                <div className="row-l">
                  <BankBadge id={it.inst} size={36} />
                  <div>
                    <div className="row-name">{it.name}</div>
                    <div className="row-meta">
                      {it.type} · {BANKS[it.inst].name}
                      {it.aporte > 0 ? ` · aporte ${formatBRL(it.aporte)}/mês` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span className="chip" style={{ background: 'var(--pos-soft)', color: 'var(--pos)' }}>
                    <OrcaIcon name="trend" size={12} />
                    {(it.ret * 100).toFixed(1)}%
                  </span>
                  <span className="amt num" style={{ minWidth: 100, textAlign: 'right', fontSize: 15 }}>{formatBRL(it.v)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
