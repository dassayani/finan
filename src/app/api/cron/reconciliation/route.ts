import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcile, type ReconTransaction, type ReconBankEntry } from "@/lib/finance/reconcile";
import { recordAudit } from "@/lib/audit";

/**
 * Job de reconciliação automática (Nível 5). Varre TODOS os usuários, compara os
 * dois ledgers e registra um AuditLog `RECONCILE_ALERT` para cada usuário com
 * divergências — para alertar ANTES do usuário perceber.
 *
 * Protegido por CRON_SECRET (não usa sessão — é chamado por um agendador).
 * Vercel Cron envia `Authorization: Bearer ${CRON_SECRET}` automaticamente quando
 * a env CRON_SECRET está definida. Sem o segredo correto → 401.
 *
 * Agendamento em vercel.json. NÃO altera dados — só lê e registra alertas.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const users = await prisma.user.findMany({ select: { id: true } });

  let usersWithDivergence = 0;
  let totalDivergences = 0;
  const report: Array<{ userId: string; divergenceCount: number }> = [];

  for (const { id: userId } of users) {
    const [txs, entries] = await Promise.all([
      prisma.transaction.findMany({ where: { userId }, select: { id: true, amount: true, isPaid: true, groupId: true, date: true } }),
      prisma.bankEntry.findMany({ where: { userId }, select: { id: true, amount: true, isPaid: true, groupId: true, month: true, year: true } }),
    ]);

    const transactions: ReconTransaction[] = txs.map(t => ({ ...t, amount: Number(t.amount) }));
    const bankEntries: ReconBankEntry[] = entries.map(e => ({ ...e, amount: Number(e.amount) }));

    const divergences = reconcile(transactions, bankEntries);
    if (divergences.length > 0) {
      usersWithDivergence++;
      totalDivergences += divergences.length;
      report.push({ userId, divergenceCount: divergences.length });
      await recordAudit({
        userId, action: "RECONCILE_ALERT", entity: "reconciliation",
        after: { divergenceCount: divergences.length, divergences },
      });
    }
  }

  return NextResponse.json({
    ok: totalDivergences === 0,
    usersChecked: users.length,
    usersWithDivergence,
    totalDivergences,
    report,
  });
}
