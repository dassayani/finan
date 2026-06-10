"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoryKey } from "@/lib/constants";
import type { YearMonthData } from "@/types/dashboard";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface AnnualMonth { month: number; income: number; expense: number; }

interface State {
  yearData: YearMonthData[];
  investments: { value: number }[];
  salaryNet: number;
  loading: boolean;
}

const EMPTY: State = {
  yearData: [],
  investments: [],
  salaryNet: 0,
  loading: true,
};

export function useDashboardAnual(
  year: number,
  excludedCats: CategoryKey[],
  enabled: boolean,
): State {
  const [state, setState] = useState<State>(EMPTY);

  const exclParam = excludedCats.length > 0 ? `&excl=${excludedCats.join(",")}` : "";

  const doFetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear  = now.getFullYear();

    try {
      const [dashRes, invRes, salRes] = await Promise.all([
        fetch(`/api/dashboard?year=${year}&mode=annual${exclParam}`),
        fetch("/api/investments"),
        fetch("/api/salary?month=0&year=0"),
      ]);

      const investments = invRes.ok ? await invRes.json() : [];

      let salaryNet = 0;
      if (salRes.ok) {
        const sd = await salRes.json();
        salaryNet = Number(sd.template?.netAmount ?? 0);
      }

      let yearData: YearMonthData[] = MONTH_NAMES.map(m => ({
        m, income: salaryNet, expense: 0, projected: true,
      }));

      if (dashRes.ok) {
        const { months } = await dashRes.json() as { months: AnnualMonth[] };
        yearData = MONTH_NAMES.map((m, i) => {
          const mn = i + 1;
          if (year === curYear && mn > curMonth) {
            return { m, income: salaryNet, expense: 0, projected: true };
          }
          const d = months.find(x => x.month === mn);
          return { m, income: d?.income ?? 0, expense: d?.expense ?? 0, projected: false };
        });
      }

      setState({ yearData, investments, salaryNet, loading: false });
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }, [year, exclParam]);

  useEffect(() => {
    if (!enabled) return;
    doFetch();
  }, [enabled, doFetch]);

  return state;
}
