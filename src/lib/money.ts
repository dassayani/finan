/**
 * Helpers monetários. O sistema persiste valores em Decimal(12,2); aqui
 * trabalhamos em centavos (inteiros) para evitar erro de ponto flutuante na
 * divisão de parcelas.
 */

/** Arredonda para 2 casas (centavos) de forma estável. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Divide um total em `n` parcelas somando EXATAMENTE o total.
 * O resto de centavos é distribuído nas primeiras parcelas — assim
 * `splitInstallments(100, 3) → [33.34, 33.33, 33.33]` (soma 100,00),
 * em vez de 3×33,33 = 99,99.
 */
export function splitInstallments(total: number, n: number): number[] {
  const count = Math.max(1, Math.floor(n));
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count; // 0..count-1 centavos sobrando
  return Array.from({ length: count }, (_, i) => {
    const cents = base + (i < remainder ? 1 : 0);
    return cents / 100;
  });
}
