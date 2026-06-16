"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoryKey } from "@/lib/constants";
import type {
  MonthDashData,
  DashTransaction,
  DashBankFee,
  DashBankBalance,
  DashBankEntry,
} from "@/types/dashboard";

interface SalaryEffective {
  netAmount: number;
  contractEnded: boolean;
}

interface State {
  monthDash: MonthDashData | null;
  transactions: DashTransaction[];
  incomes: DashTransaction[];
  bankFees: DashBankFee[];
  bankBalances: DashBankBalance[];
  bankEntriesList: DashBankEntry[];
  prevBankClosing: Record<string, number | null>;
  salaryEffective: SalaryEffective | null;
  loading: boolean;
}

const EMPTY: State = {
  monthDash: null,
  transactions: [],
  incomes: [],
  bankFees: [],
  bankBalances: [],
  bankEntriesList: [],
  prevBankClosing: {},
  salaryEffective: null,
  loading: true,
};

export function useDashboardMensal(
  month: number,
  year: number,
  excludedCats: CategoryKey[],
  enabled: boolean,
): State {
  const [state, setState] = useState<State>(EMPTY);

  const exclParam = excludedCats.length > 0 ? `&excl=${excludedCats.join(",")}` : "";
  const prevM = month === 1 ? 12 : month - 1;
  const prevY = month === 1 ? year - 1 : year;

  const doFetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      // Ensure subscription bill transactions exist for all active months before querying
      await fetch("/api/subscriptions/backfill", { method: "POST" }).catch(() => {});

      const [dashRes, txRes, incRes, feesRes, balRes, entRes, closingRes, salRes] = await Promise.all([
        fetch(`/api/dashboard?year=${year}&month=${month}${exclParam}`),
        fetch(`/api/transactions?month=${month}&year=${year}&type=EXPENSE`),
        fetch(`/api/credits?month=${month}&year=${year}`),
        fetch("/api/bank-fees"),
        fetch(`/api/bank-balances?month=${month}&year=${year}`),
        fetch(`/api/bank-entries?month=${month}&year=${year}`),
        fetch(`/api/bank-closing-balance?month=${prevM}&year=${prevY}`),
        fetch(`/api/salary?month=${month}&year=${year}`),
      ]);

      let salaryEffective: SalaryEffective | null = null;
      if (salRes.ok) {
        const sd = await salRes.json();
        if (sd.effective) {
          salaryEffective = { netAmount: Number(sd.effective.netAmount), contractEnded: false };
        } else if (sd.contractEnded) {
          salaryEffective = { netAmount: 0, contractEnded: true };
        }
      }

      setState({
        monthDash:       dashRes.ok    ? await dashRes.json()    : null,
        transactions:    txRes.ok      ? await txRes.json()      : [],
        incomes:         incRes.ok     ? await incRes.json()     : [],
        bankFees:        feesRes.ok    ? await feesRes.json()    : [],
        bankBalances:    balRes.ok     ? await balRes.json()     : [],
        bankEntriesList: entRes.ok     ? await entRes.json()     : [],
        prevBankClosing: closingRes.ok ? await closingRes.json() : {},
        salaryEffective,
        loading: false,
      });
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }, [month, year, exclParam, prevM, prevY]);

  useEffect(() => {
    if (!enabled) return;
    doFetch();
  }, [enabled, doFetch]);

  return state;
}
