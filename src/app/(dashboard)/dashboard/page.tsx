"use client";

import { OrcaIcon } from "@/components/ui/orca-icon";
import { CATEGORIES, formatBRL } from "@/lib/constants";
import type { CategoryKey } from "@/lib/constants";

const YEAR_DATA = [
  { m: 'Jan', base: 2650.53, rec: 2254.08 }, { m: 'Fev', base: 5440.55, rec: 4427.69 },
  { m: 'Mar', base: 5440.55, rec: 4549.22 }, { m: 'Abr', base: 5440.55, rec: 4549.22 },
  { m: 'Mai', base: 5712.58, rec: 5868.13 }, { m: 'Jun', base: 4760.88, rec: 3962.91 },
  { m: 'Jul', base: 5712.58, rec: 7528.42 }, { m: 'Ago', base: 5712.58, rec: 4672.13 },
  { m: 'Set', base: 5712.58, rec: 7417.40 }, { m: 'Out', base: 5712.58, rec: 4672.13 },
  { m: 'Nov', base: 5712.58, rec: 4672.13 }, { m: 'Dez', base: 5712.58, rec: 6572.13 },
];

const GASTO_MEDIO = 5180;
const CUR_IDX = 5; // Junho

const CAT_DATA: { cat: CategoryKey; v: number }[] = [
  { cat: 'viagem', v: 2879.95 },
  { cat: 'compras', v: 371.47 },
  { cat: 'casa', v: 732.90 },
  { cat: 'assin', v: 114.39 },
  { cat: 'transp', v: 158.50 },
  { cat: 'alim', v: 257.70 },
];

const PATRIMONIO = 34840.50;

export default function DashboardPage() {
  const totalRec = YEAR_DATA.reduce((s, m) => s + m.rec, 0);
  const totalGasto = GASTO_MEDIO * 12;
  const economia = totalRec - totalGasto;
  const maxRec = Math.max(...YEAR_DATA.map(m => m.rec));
  const catTotal = CAT_DATA.reduce((s, c) => s + c.v, 0);

  return (
    <>
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Visão geral</div>
          <div className="page-title">Dashboard 2026</div>
        </div>
        <div className="topbar-r">
          <div className="seg">
            <button className="on">2026</button>
            <button>2025</button>
          </div>
          <button className="btn-icon">
            <OrcaIcon name="filter" size={18} />
          </button>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowDown" size={14} style={{ color: 'var(--pos)' }} />Recebido no ano</div>
            <div className="kpi-val sm num" style={{ color: 'var(--pos)' }}>{formatBRL(totalRec)}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="arrowUp" size={14} style={{ color: 'var(--neg)' }} />Gasto no ano</div>
            <div className="kpi-val sm num" style={{ color: 'var(--neg)' }}>{formatBRL(totalGasto)}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="wallet" size={14} style={{ color: 'var(--accent)' }} />Guardado</div>
            <div className="kpi-val sm num" style={{ color: 'var(--accent)' }}>{formatBRL(economia, { sign: true })}</div>
            <div className="kpi-delta" style={{ color: 'var(--pos)' }}>{Math.round((economia / totalRec) * 100)}% da renda</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label"><OrcaIcon name="trend" size={14} />Patrimônio investido</div>
            <div className="kpi-val sm num">{formatBRL(PATRIMONIO)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* Bar chart */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="card-title">Recebimentos por mês</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5, fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--pos)' }} />Líquido recebido
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--surface-3)' }} />Salário base
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 220 }}>
              {YEAR_DATA.map((m, i) => (
                <div key={m.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                  <span className="num" style={{ fontSize: 9.5, fontWeight: 700, color: i === CUR_IDX ? 'var(--pos)' : 'var(--ink-3)' }}>
                    {(m.rec / 1000).toFixed(1)}k
                  </span>
                  <div style={{ position: 'relative', width: '70%', height: `${(m.rec / maxRec) * 170}px`, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${(m.base / maxRec) * 170}px`, background: 'var(--surface-3)', borderRadius: '5px 5px 0 0' }} />
                    <div style={{ position: 'relative', width: '100%', height: '100%', background: i === CUR_IDX ? 'var(--pos)' : 'var(--accent)', borderRadius: '5px 5px 0 0', opacity: i === CUR_IDX ? 1 : 0.82 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: i === CUR_IDX ? 'var(--ink)' : 'var(--ink-3)' }}>{m.m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 4 }}>Gastos por categoria</div>
            <div className="row-meta" style={{ marginBottom: 16 }}>Junho 2026 · {formatBRL(catTotal)}</div>
            {CAT_DATA.map(({ cat, v }) => {
              const c = CATEGORIES[cat];
              const maxV = CAT_DATA[0].v;
              return (
                <div key={cat} style={{ marginBottom: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                      {c.label}
                    </span>
                    <span className="num">{formatBRL(v)}</span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${(v / maxV) * 100}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly saldo strip */}
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Saldo mês a mês</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 8 }}>
            {YEAR_DATA.map((m, i) => {
              const saldo = m.rec - GASTO_MEDIO;
              const pos = saldo >= 0;
              return (
                <div key={m.m} style={{ textAlign: 'center', padding: '12px 4px', borderRadius: 10,
                  background: i === CUR_IDX ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: `1px solid ${i === CUR_IDX ? 'var(--accent)' : 'var(--line-2)'}` }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' }}>{m.m}</div>
                  <div className="num" style={{ fontSize: 11.5, fontWeight: 800, marginTop: 4, color: pos ? 'var(--pos)' : 'var(--neg)' }}>
                    {pos ? '+' : '−'}{(Math.abs(saldo) / 1000).toFixed(1)}k
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
