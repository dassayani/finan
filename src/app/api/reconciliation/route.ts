import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconcile, type ReconTransaction, type ReconBankEntry } from "@/lib/finance/reconcile";

/**
 * Reconciliação financeira (read-only). Compara o ledger de Transaction com os
 * BankEntries espelho e retorna divergências (órfãos, valor, estado de pagamento).
 *
 * Uso: monitoramento/alerta. NÃO altera dados. Pode ser chamado por um job ou
 * exibido num painel admin. `?month=&year=` opcional para escopar o período.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const uid = session.user.id;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txWhere: Record<string, any> = { userId: uid };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beWhere: Record<string, any> = { userId: uid };
  if (month && year) {
    const y = Number(year), m = Number(month);
    txWhere.date = { gte: new Date(Date.UTC(y, m - 1, 1)), lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)) };
    beWhere.month = m;
    beWhere.year = y;
  }

  const [txs, entries] = await Promise.all([
    prisma.transaction.findMany({ where: txWhere, select: { id: true, amount: true, isPaid: true, groupId: true, date: true } }),
    prisma.bankEntry.findMany({ where: beWhere, select: { id: true, amount: true, isPaid: true, groupId: true, month: true, year: true } }),
  ]);

  const transactions: ReconTransaction[] = txs.map(t => ({ ...t, amount: Number(t.amount) }));
  const bankEntries: ReconBankEntry[] = entries.map(e => ({ ...e, amount: Number(e.amount) }));

  const divergences = reconcile(transactions, bankEntries);

  return NextResponse.json({
    ok: divergences.length === 0,
    checked: { transactions: transactions.length, bankEntries: bankEntries.length },
    divergenceCount: divergences.length,
    divergences,
  });
}
