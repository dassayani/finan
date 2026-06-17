/**
 * Série temporal do patrimônio investido.
 *
 * Cada ativo tem uma lista de snapshots (data + valor). Para desenhar a curva de
 * evolução do patrimônio total, somamos, em cada mês, o último valor conhecido de
 * cada ativo até o fim daquele mês (forward-fill). Ativos sem snapshot ainda não
 * contam (valor 0) — entram na curva no mês do seu primeiro aporte.
 *
 * Função pura (sem Prisma, sem React) → testável e reutilizável.
 */

export interface PortfolioSnapshotInput {
  date: string | Date;
  value: number;
}

export interface PortfolioAssetInput {
  snapshots: PortfolioSnapshotInput[];
}

export interface PortfolioPoint {
  /** Chave ordenável "YYYY-MM". */
  key: string;
  /** Rótulo curto para o eixo, ex.: "jun/26". */
  label: string;
  value: number;
}

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function ym(date: Date): { y: number; m: number } {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() };
}

/** Timestamp do último instante do mês (UTC) — usado como corte do bucket. */
function endOfMonth(y: number, m: number): number {
  return Date.UTC(y, m + 1, 0, 23, 59, 59, 999);
}

/**
 * Constrói a série mensal do patrimônio total.
 * @param maxMonths limita aos N meses mais recentes (default 24).
 */
export function buildPortfolioSeries(
  assets: PortfolioAssetInput[],
  now: Date = new Date(),
  maxMonths = 24,
): PortfolioPoint[] {
  // Normaliza snapshots: ordena por data asc e descarta vazios.
  const series = assets
    .map(a => [...a.snapshots]
      .map(s => ({ t: new Date(s.date).getTime(), value: Number(s.value) }))
      .filter(s => !Number.isNaN(s.t))
      .sort((x, z) => x.t - z.t))
    .filter(s => s.length > 0);

  if (series.length === 0) return [];

  const firstT = Math.min(...series.map(s => s[0].t));
  const start = ym(new Date(firstT));
  const end = ym(now);

  const points: PortfolioPoint[] = [];
  let y = start.y;
  let m = start.m;
  while (y < end.y || (y === end.y && m <= end.m)) {
    const cutoff = endOfMonth(y, m);
    let total = 0;
    for (const snaps of series) {
      // último snapshot com data <= fim do mês
      let last: number | null = null;
      for (const s of snaps) {
        if (s.t <= cutoff) last = s.value;
        else break;
      }
      if (last !== null) total += last;
    }
    points.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MONTH_ABBR[m]}/${String(y).slice(-2)}`,
      value: Math.round(total * 100) / 100,
    });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }

  return points.slice(-maxMonths);
}
