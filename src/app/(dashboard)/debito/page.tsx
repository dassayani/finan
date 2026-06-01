"use client";

import { useState } from "react";
import { OrcaIcon } from "@/components/ui/orca-icon";
import { BankBadge } from "@/components/ui/bank-badge";
import { BANKS, CATEGORIES, formatBRL } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";

const PARCEL_OPTS = ['1x', '2x', '3x', '6x', '10x', '12x'];

export default function DebitoPage() {
  const [expenseType, setExpenseType] = useState<'fixo' | 'variavel'>('variavel');
  const [payType, setPayType] = useState<'avista' | 'parcelado'>('parcelado');
  const [parcelas, setParcelas] = useState(6);
  const [selectedCat, setSelectedCat] = useState<CategoryKey>('viagem');
  const [selectedBank, setSelectedBank] = useState<BankKey>('bb');
  const [isPaid, setIsPaid] = useState(false);
  const [amount, setAmount] = useState('2455.60');
  const [description, setDescription] = useState('Passagens Ushuaia — Ingrid');

  const total = parseFloat(amount) || 0;
  const each = payType === 'parcelado' ? total / parcelas : total;

  const now = new Date();
  const startMonth = now.getMonth();
  const startYear = now.getFullYear();
  const months = Array.from({ length: parcelas }, (_, i) => {
    const d = new Date(startYear, startMonth + i, 1);
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  });

  return (
    <>
      <div className="topbar">
        <div className="topbar-l">
          <div className="crumb">Lançamentos · Débito</div>
          <div className="page-title">Lançar Débito</div>
        </div>
        <div className="topbar-r">
          <button className="btn btn-ghost">Cancelar</button>
          <button className="btn btn-primary">
            <OrcaIcon name="check" size={16} />Salvar lançamento
          </button>
        </div>
      </div>

      <div className="content" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* FORM */}
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
            <div className="field">
              <label>Descrição</label>
              <input className="orça-input" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="field">
              <label>Valor total</label>
              <div className="input-prefix">
                <span className="pf">R$</span>
                <input className="orça-input num" value={amount} onChange={e => setAmount(e.target.value)} style={{ paddingLeft: 34 }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label>Data da compra</label>
              <div style={{ position: 'relative' }}>
                <input className="orça-input num" defaultValue={new Date().toLocaleDateString('pt-BR')} />
                <OrcaIcon name="calendar" size={16} style={{ position: 'absolute', right: 13, top: 13, color: 'var(--ink-3)' }} />
              </div>
            </div>
            <div className="field">
              <label>Tipo de gasto</label>
              <div className="seg" style={{ width: '100%' }}>
                <button
                  style={{ flex: 1 }}
                  className={expenseType === 'fixo' ? 'on' : ''}
                  onClick={() => setExpenseType('fixo')}
                >
                  <OrcaIcon name="repeat" size={14} /> Fixo
                </button>
                <button
                  style={{ flex: 1 }}
                  className={expenseType === 'variavel' ? 'on' : ''}
                  onClick={() => setExpenseType('variavel')}
                >
                  <OrcaIcon name="flame" size={14} /> Variável
                </button>
              </div>
            </div>
          </div>

          {/* Parcelamento */}
          <div className="field">
            <label>Parcelamento</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="seg">
                <button className={payType === 'avista' ? 'on' : ''} onClick={() => setPayType('avista')}>À vista</button>
                <button className={payType === 'parcelado' ? 'on' : ''} onClick={() => setPayType('parcelado')}>Parcelado</button>
              </div>
              {payType === 'parcelado' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PARCEL_OPTS.map(p => {
                    const n = parseInt(p);
                    return (
                      <span
                        key={p}
                        className={`opt${n === parcelas ? ' sel' : ''}`}
                        onClick={() => setParcelas(n)}
                        style={{ cursor: 'pointer' }}
                      >
                        {p}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            {payType === 'parcelado' && (
              <div className="row-meta" style={{ marginTop: 4 }}>
                {parcelas} parcelas de{' '}
                <b className="num" style={{ color: 'var(--ink)' }}>{formatBRL(each)}</b>{' '}
                · 1ª em {months[0]}, última em {months[months.length - 1]}
              </div>
            )}
          </div>

          {/* Categoria */}
          <div className="field">
            <label>Categoria de gasto</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([k, c]) => (
                <span
                  key={k}
                  className={`opt${k === selectedCat ? ' sel' : ''}`}
                  onClick={() => setSelectedCat(k)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="cd" style={{ background: c.color }} />{c.label}
                </span>
              ))}
            </div>
          </div>

          {/* Banco */}
          <div className="field">
            <label>Banco / forma de pagamento</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(BANKS) as BankKey[]).map(id => (
                <span
                  key={id}
                  className={`opt${id === selectedBank ? ' sel' : ''}`}
                  onClick={() => setSelectedBank(id)}
                  style={{ cursor: 'pointer', paddingLeft: 8 }}
                >
                  <BankBadge id={id} size={22} />{BANKS[id].name}
                </span>
              ))}
            </div>
          </div>

          {/* Já paguei? */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Já paguei a 1ª parcela?</div>
              <div className="row-meta">Marca como pago e entra no fluxo de caixa</div>
            </div>
            <span
              className={`switch${isPaid ? ' on' : ''}`}
              onClick={() => setIsPaid(v => !v)}
              style={{ cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* PREVIEW */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-head" style={{ background: BANKS[selectedBank].soft }}>
              <div className="card-title">
                <BankBadge id={selectedBank} size={26} />
                Lançamento automático
              </div>
            </div>
            <div className="card-pad" style={{ paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORIES[selectedCat].color }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{description || 'Descrição'}</span>
              </div>
              <div className="row-meta" style={{ marginBottom: 4 }}>{CATEGORIES[selectedCat].label} · {BANKS[selectedBank].name}</div>
              <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>{formatBRL(total)}</div>
              <div className="row-meta">distribuído em {payType === 'parcelado' ? `${parcelas} meses` : '1 mês'}</div>
            </div>
            <div className="divider" />
            <div style={{ padding: '6px 0' }}>
              {months.map((m, i) => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: i === 0 ? 'var(--accent)' : 'var(--surface-3)',
                      color: i === 0 ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{m}</div>
                      <div className="row-meta">Parcela {i + 1}/{parcelas}</div>
                    </div>
                  </div>
                  <span className="amt neg num">{formatBRL(-each)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad" style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--accent-soft)', border: 'none' }}>
            <OrcaIcon name="repeat" size={18} style={{ color: 'var(--accent)', flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, lineHeight: 1.45 }}>
              Cada parcela entra sozinha no mês correspondente. Você só marca como <b>paga</b> quando quitar — e o saldo do mês se ajusta na hora.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
