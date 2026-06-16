/**
 * Reconciliação financeira (Níveis 5 + 9 do framework de maturidade).
 *
 * Este app mantém DOIS ledgers paralelos (ver lib/bank-entry-sync.ts):
 *  - `Transaction`  → fonte da verdade do orçamento (dashboard, categorias)
 *  - `BankEntry`    → fonte da verdade do saldo por banco
 *
 * Alguns BankEntries são *espelhos* de uma Transaction. Enquanto não houver SSOT
 * único, a forma profissional de garantir que "os dois lugares mostram o mesmo
 * número" é RECONCILIAR: para cada espelho, verificar que a Transaction existe e
 * que valor + estado de pagamento batem. Divergência = sinal de corrupção a
 * alertar ANTES do usuário perceber.
 *
 * Funções puras (sem Prisma) → fáceis de testar e reusar no servidor.
 */

export interface ReconTransaction {
  id: string;
  amount: number;
  isPaid: boolean;
  groupId: string | null;
  date: string | Date;
}

export interface ReconBankEntry {
  id: string;
  amount: number;
  isPaid: boolean;
  groupId: string | null;
  month: number;
  year: number;
}

export type DivergenceType = "ORPHAN_MIRROR" | "AMOUNT_MISMATCH" | "PAID_DESYNC";

export interface Divergence {
  type: DivergenceType;
  bankEntryId: string;
  groupId: string;
  detail: string;
}

function monthYearOf(date: string | Date): { month: number; year: number } {
  const d = typeof date === "string" ? new Date(date) : date;
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

/**
 * Resolve a Transaction que um BankEntry espelho deveria refletir.
 * Retorna a transaction encontrada, ou null se nenhuma corresponde (órfão).
 */
function resolveMirrorTransaction(
  entry: ReconBankEntry,
  byId: Map<string, ReconTransaction>,
  byGroupId: Map<string, ReconTransaction[]>,
): ReconTransaction | null {
  const gid = entry.groupId;
  if (!gid) return null;

  // credit-entry-{txId}
  if (gid.startsWith("credit-entry-")) {
    return byId.get(gid.slice("credit-entry-".length)) ?? null;
  }
  // salary-entry-{uid}-{m}-{y} → transaction groupId salary-{uid} no mesmo mês/ano
  if (gid.startsWith("salary-entry-")) {
    const parts = gid.split("-");
    const uid = parts.slice(2, parts.length - 2).join("-");
    const candidates = byGroupId.get(`salary-${uid}`) ?? [];
    return candidates.find(t => {
      const my = monthYearOf(t.date);
      return my.month === entry.month && my.year === entry.year;
    }) ?? null;
  }
  // bonus-entry-{type}-{y}-{pm}-{uid} → transaction groupId bonus-{type}-{y}-{pm}-{uid}
  if (gid.startsWith("bonus-entry-")) {
    const txGroup = gid.replace("bonus-entry-", "bonus-");
    return (byGroupId.get(txGroup) ?? [])[0] ?? null;
  }
  // loan-entry-{loanId}-{m}-{y} → transaction groupId loan-tx-{loanId}-{m}-{y}
  if (gid.startsWith("loan-entry-")) {
    const txGroup = gid.replace("loan-entry-", "loan-tx-");
    return (byGroupId.get(txGroup) ?? [])[0] ?? null;
  }
  // sub-entry-* espelha SubscriptionPayment, não Transaction → fora do escopo aqui
  return null;
}

const RECONCILABLE_PREFIXES = ["credit-entry-", "salary-entry-", "bonus-entry-", "loan-entry-"];
function isReconcilable(groupId: string | null): boolean {
  return !!groupId && RECONCILABLE_PREFIXES.some(p => groupId.startsWith(p));
}

const CENT = 0.005; // tolerância de meio centavo para comparação de Decimal→number

/**
 * Compara os dois ledgers e retorna todas as divergências encontradas.
 * Lista vazia = tudo reconciliado.
 */
export function reconcile(
  transactions: ReconTransaction[],
  bankEntries: ReconBankEntry[],
): Divergence[] {
  const byId = new Map(transactions.map(t => [t.id, t]));
  const byGroupId = new Map<string, ReconTransaction[]>();
  for (const t of transactions) {
    if (!t.groupId) continue;
    const arr = byGroupId.get(t.groupId) ?? [];
    arr.push(t);
    byGroupId.set(t.groupId, arr);
  }

  const divergences: Divergence[] = [];

  for (const entry of bankEntries) {
    if (!isReconcilable(entry.groupId)) continue;
    const gid = entry.groupId as string;
    const tx = resolveMirrorTransaction(entry, byId, byGroupId);

    if (!tx) {
      divergences.push({
        type: "ORPHAN_MIRROR",
        bankEntryId: entry.id,
        groupId: gid,
        detail: `Lançamento bancário espelho sem Transaction correspondente`,
      });
      continue;
    }

    if (Math.abs(Number(tx.amount) - Number(entry.amount)) > CENT) {
      divergences.push({
        type: "AMOUNT_MISMATCH",
        bankEntryId: entry.id,
        groupId: gid,
        detail: `Valor diverge: banco=${entry.amount} vs transação=${tx.amount}`,
      });
    }

    if (tx.isPaid !== entry.isPaid) {
      divergences.push({
        type: "PAID_DESYNC",
        bankEntryId: entry.id,
        groupId: gid,
        detail: `Estado de pagamento diverge: banco=${entry.isPaid} vs transação=${tx.isPaid}`,
      });
    }
  }

  return divergences;
}
