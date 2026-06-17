export const BANKS = {
  caixa:  { name: 'Caixa',          short: 'CX', color: '#0B57A4', soft: '#E4EDF6', on: '#FFFFFF' },
  bb:     { name: 'Banco do Brasil', short: 'BB', color: '#F7D117', soft: '#FCF4D2', on: '#2A2503' },
  itau:   { name: 'Itaú',           short: 'IT', color: '#EC7000', soft: '#FCEBDB', on: '#FFFFFF' },
  nubank: { name: 'Nubank',         short: 'NU', color: '#820AD1', soft: '#F0E2FA', on: '#FFFFFF' },
  picpay: { name: 'PicPay',         short: 'PP', color: '#1FB85F', soft: '#E1F5E9', on: '#FFFFFF' },
  inter:  { name: 'Inter',          short: 'IN', color: '#FF9A4D', soft: '#FDEEE0', on: '#4A2A06' },
  mp:     { name: 'Mercado Pago',   short: 'MP', color: '#4AB9F0', soft: '#E4F3FC', on: '#08374F' },
} as const;

export type BankKey = keyof typeof BANKS;

export const CATEGORIES = {
  // Despesas
  casa:        { label: 'Casa/Moradia',             color: '#3B82C4', applicableTo: 'expense' as const },
  alim:        { label: 'Alimentação',              color: '#E08A2B', applicableTo: 'expense' as const },
  imprev:      { label: 'Imprevistos',              color: '#C0556A', applicableTo: 'expense' as const },
  transp:      { label: 'Transporte',               color: '#4C7C9B', applicableTo: 'expense' as const },
  saude:       { label: 'Saúde',                   color: '#2FA37A', applicableTo: 'expense' as const },
  pet:         { label: 'Pet',                     color: '#A86BC9', applicableTo: 'expense' as const },
  assin:       { label: 'Assinaturas',             color: '#5B49C9', applicableTo: 'expense' as const },
  lazer:       { label: 'Lazer/Bem-estar',         color: '#D96BA0', applicableTo: 'expense' as const },
  compras:     { label: 'Compras pessoais',        color: '#C98A1E', applicableTo: 'expense' as const },
  trab:        { label: 'Trabalho/Estudo',         color: '#6B7280', applicableTo: 'expense' as const },
  viagem:      { label: 'Viagens',                 color: '#2BA0B5', applicableTo: 'expense' as const },
  reserva:     { label: 'Reserva/Investim.',       color: '#15543D', applicableTo: 'expense' as const },
  tarifas:     { label: 'Tarifas/Impostos',        color: '#8A6D3B', applicableTo: 'expense' as const },
  reemb:       { label: 'Reembolso',               color: '#0E9F6E', applicableTo: 'both'    as const },
  // Receitas
  salario:     { label: 'Salário / Renda fixa',    color: '#0E9F6E', applicableTo: 'income'  as const },
  freelance:   { label: 'Freelance / Consultoria', color: '#2BA0B5', applicableTo: 'income'  as const },
  aluguel_rec: { label: 'Aluguel recebido',        color: '#5B49C9', applicableTo: 'income'  as const },
  dividendos:  { label: 'Dividendos / Rendimentos',color: '#15543D', applicableTo: 'income'  as const },
  presente:    { label: 'Presente / Doação',       color: '#D96BA0', applicableTo: 'income'  as const },
  outros_rec:  { label: 'Outros recebimentos',     color: '#6B7280', applicableTo: 'income'  as const },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export function categoriesFor(type: 'income' | 'expense') {
  return (Object.entries(CATEGORIES) as [CategoryKey, (typeof CATEGORIES)[CategoryKey]][])
    .filter(([, c]) => c.applicableTo === type || c.applicableTo === 'both');
}

// Classes de investimento — fonte única de verdade (rótulo + cor). A UI e
// qualquer agregação devem usar isto em vez de listas locais. O schema guarda
// `type` como String livre; manter aqui evita divergência entre tela e dados.
export const INVESTMENT_TYPES = {
  'Renda Fixa': { color: '#15543D' },
  'FII':        { color: '#EC7000' },
  'Ações':      { color: '#820AD1' },
  'Cripto':     { color: '#F7931A' },
  'Outro':      { color: '#6b7280' },
} as const;

export type InvestmentType = keyof typeof INVESTMENT_TYPES;

/** Cor de uma classe de investimento, com fallback para tipos legados. */
export function investmentTypeColor(type: string): string {
  return (INVESTMENT_TYPES as Record<string, { color: string }>)[type]?.color ?? '#6b7280';
}

export function formatBRL(value: number, { sign = false } = {}): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const s = value < 0 ? '−' : sign ? '+' : '';
  return `${s}R$ ${abs}`;
}

export function getMonthName(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
