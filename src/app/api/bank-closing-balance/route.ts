import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

const BANK_KEYS = Object.keys(BANKS) as BankKey[];

/**
 * Returns the closing balance for each bank at the end of the requested month.
 *
 * Formula per bank:
 *   closing = initial_balance + entradas - saídas - fees - paid_bill_expenses + paid_bill_estornos
 *
 * "initial_balance" is the value stored in bank_balances for that month.
 * If nothing is stored, initial_balance = 0 (the caller handles carry-forward by
 * querying the previous month's closing and using it as next month's opening).
 *
 * Returns null for a bank when it has no recorded activity for the month.
 * Response shape: { [bankKeyOrCustomBankId]: number | null }
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month"));
  const year  = Number(searchParams.get("year"));
  if (!month || !year) {
    return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const uid   = session.user.id;

  const [balances, entries, fees, billTxs, customBanks] = await Promise.all([
    prisma.bankBalance.findMany({ where: { userId: uid, month, year } }),

    prisma.bankEntry.findMany({ where: { userId: uid, month, year } }),

    prisma.bankFee.findMany({ where: { userId: uid, active: true } }),

    prisma.transaction.findMany({
      where: {
        userId: uid,
        expenseType: "BANK_BILL",
        date: { gte: start, lte: end },
        isPaid: true,
      },
      select: { bank: true, amount: true, type: true },
    }),

    prisma.customBank.findMany({
      where: { userId: uid },
      include: {
        balances: { where: { month, year } },
        fees: { where: { active: true } },
        entries: { where: { month, year } },
      },
    }),
  ]);

  const result: Record<string, number | null> = {};

  // ── Standard banks ──────────────────────────────────────────────────────────
  for (const bankKey of BANK_KEYS) {
    const bal       = balances.find(b => b.bank === bankKey);
    const bankEnts  = entries.filter(e => e.bank === bankKey);
    const bankFees  = fees.filter(f => f.bank === bankKey);
    const bankBills = billTxs.filter(t => t.bank === bankKey);

    const hasActivity = bal || bankEnts.length > 0 || bankBills.length > 0 || bankFees.length > 0;
    if (!hasActivity) { result[bankKey] = null; continue; }

    const initial   = bal ? Number(bal.balance) : 0;
    const entradas  = bankEnts.filter(e => e.type === "INCOME").reduce((s, e) => s + Number(e.amount), 0);
    const saidas    = bankEnts.filter(e => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);
    const totalFees = bankFees.reduce((s, f) => s + Number(f.amount), 0);
    const paidBill  = bankBills.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
    const paidEst   = bankBills.filter(t => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);

    result[bankKey] = initial + entradas - saidas - totalFees - paidBill + paidEst;
  }

  // ── Custom banks ─────────────────────────────────────────────────────────────
  for (const cb of customBanks) {
    const bal      = cb.balances[0];
    const bankEnts = cb.entries;
    const bankFees = cb.fees;

    const hasActivity = bal || bankEnts.length > 0 || bankFees.length > 0;
    if (!hasActivity) { result[cb.id] = null; continue; }

    const initial   = bal ? Number(bal.balance) : 0;
    const entradas  = bankEnts.filter(e => e.type === "INCOME").reduce((s, e) => s + Number(e.amount), 0);
    const saidas    = bankEnts.filter(e => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);
    const totalFees = bankFees.reduce((s, f) => s + Number(f.amount), 0);

    result[cb.id] = initial + entradas - saidas - totalFees;
  }

  return NextResponse.json(result);
}
