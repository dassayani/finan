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
  casa:    { label: 'Casa/Moradia',       color: '#3B82C4' },
  alim:    { label: 'Alimentação',        color: '#E08A2B' },
  imprev:  { label: 'Imprevistos',        color: '#C0556A' },
  transp:  { label: 'Transporte',         color: '#4C7C9B' },
  saude:   { label: 'Saúde',             color: '#2FA37A' },
  pet:     { label: 'Pet',               color: '#A86BC9' },
  assin:   { label: 'Assinaturas',       color: '#5B49C9' },
  lazer:   { label: 'Lazer/Bem-estar',   color: '#D96BA0' },
  compras: { label: 'Compras pessoais',  color: '#C98A1E' },
  trab:    { label: 'Trabalho/Estudo',   color: '#6B7280' },
  viagem:  { label: 'Viagens',           color: '#2BA0B5' },
  reserva: { label: 'Reserva/Investim.', color: '#15543D' },
  tarifas: { label: 'Tarifas/Impostos',  color: '#8A6D3B' },
  reemb:   { label: 'Reembolso',         color: '#0E9F6E' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export function formatBRL(value: number, { sign = false } = {}): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const s = value < 0 ? '−' : sign ? '+' : '';
  return `${s}R$ ${abs}`;
}

export function getMonthName(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
