/**
 * Bank-entry ↔ Transaction mirror convention.
 *
 * The app keeps two parallel ledgers:
 *  - `Transaction`  → orçamento (categorias, dashboard, fluxo)
 *  - `BankEntry`    → conciliação de saldo por banco/mês
 *
 * Some BankEntries are *mirrors* of a Transaction (salário, bônus, crédito com
 * banco, empréstimo, assinatura). Esses são identificados pelo prefixo do
 * `groupId`. Qualquer agregação que some BankEntry **e** Transaction (ex.: o
 * dashboard) precisa EXCLUIR os espelhos, senão o valor é contado duas vezes.
 *
 * BankEntries "manuais" (criados direto na tela de Bancos) têm `groupId = null`
 * ou um prefixo que NÃO está nesta lista — esses devem entrar no dashboard.
 */
export const MIRROR_GROUP_PREFIXES = [
  "salary-entry-",
  "bonus-entry-",
  "credit-entry-",
  "loan-entry-",
  "sub-entry-",
] as const;

/** True se o groupId pertence a um BankEntry que espelha uma Transaction. */
export function isMirrorGroupId(groupId: string | null | undefined): boolean {
  if (!groupId) return false;
  return MIRROR_GROUP_PREFIXES.some(p => groupId.startsWith(p));
}

/** True se o groupId identifica os dois lados de uma transferência entre bancos. */
export function isTransferGroupId(groupId: string | null | undefined): boolean {
  return !!groupId && groupId.startsWith("transfer-");
}

/**
 * Filtro Prisma (where) que mantém apenas BankEntries manuais — ou seja,
 * exclui todos os espelhos de Transaction. Usar em qualquer query que some
 * BankEntry junto com Transaction.
 */
export function manualBankEntryWhere() {
  return {
    OR: [
      { groupId: null },
      { NOT: MIRROR_GROUP_PREFIXES.map(p => ({ groupId: { startsWith: p } })) },
    ],
  };
}
