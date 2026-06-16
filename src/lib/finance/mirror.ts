/**
 * Financial Engine — espelhamento Transaction → BankEntry (Nível 6).
 *
 * Regra de negócio única para criar/derivar o BankEntry espelho de uma receita
 * de crédito. Centralizar aqui evita que o formato do groupId e a derivação de
 * mês/ano se espalhem por rotas e componentes (regra financeira NUNCA no
 * frontend). Usado por /api/credits.
 */
import type { BankKey, CategoryKey } from "@/lib/constants";

export const creditMirrorGroupId = (transactionId: string) => `credit-entry-${transactionId}`;

/** Deriva {month, year} de YYYY-MM-DD sem day-shift de fuso. */
export function monthYearFromDateStr(dateStr: string): { month: number; year: number } {
  const [y, m] = dateStr.split("-").map(Number);
  return { month: m, year: y };
}

export interface CreditMirrorInput {
  userId: string;
  transactionId: string;
  bank: BankKey | null;
  customBankId: string | null;
  dateStr: string;
  description: string;
  amount: number;
  category: CategoryKey | null;
  isPaid: boolean;
}

/** Monta o `data` do BankEntry espelho de uma receita. */
export function buildCreditMirrorData(input: CreditMirrorInput) {
  const { month, year } = monthYearFromDateStr(input.dateStr);
  return {
    userId: input.userId,
    bank: input.bank,
    customBankId: input.customBankId,
    month,
    year,
    description: input.description,
    amount: input.amount,
    type: "INCOME" as const,
    category: input.category,
    groupId: creditMirrorGroupId(input.transactionId),
    isPaid: input.isPaid,
  };
}
