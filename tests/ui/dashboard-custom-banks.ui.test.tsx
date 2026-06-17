/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(dashboard)/dashboard/page";

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const SWILE = { id: "cb1", name: "Swile", short: "SW", color: "#6B7280" };
const swileEntry = {
  id: "e1", bank: null, customBankId: "cb1", description: "Vale refeição",
  amount: 500, type: "INCOME", category: null, groupId: null, isPaid: true,
};

/**
 * Roteia os ~11 endpoints do dashboard mensal. `entries` controla os
 * lançamentos de banco; o resto é vazio para isolar a visão por banco.
 */
function makeFetch(opts: { entries?: unknown[]; customBanks?: unknown[] } = {}) {
  const { entries = [], customBanks = [] } = opts;
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (init?.method === "POST") return okJson({});                       // subscriptions/backfill
    if (url.includes("/api/dashboard"))             return okJson({ expenseTypeData: { fixed: 0, variable: 0, bankBill: 0 } });
    if (url.includes("/api/bank-entries"))          return okJson(entries);
    if (url.includes("/api/custom-bank-balances"))  return okJson([]);
    if (url.includes("/api/custom-bank-fees"))      return okJson([]);
    if (url.includes("/api/custom-banks"))          return okJson(customBanks);
    if (url.includes("/api/bank-closing-balance"))  return okJson({});
    if (url.includes("/api/bank-balances"))         return okJson([]);
    if (url.includes("/api/bank-fees"))             return okJson([]);
    if (url.includes("/api/salary"))                return okJson({});
    return okJson([]); // transactions, credits
  });
}

afterEach(cleanup);
beforeEach(() => { vi.restoreAllMocks(); });

describe("Dashboard — bancos customizados", () => {
  // ── Positivo: banco custom com lançamento aparece no dashboard ────────────────
  it("renders a custom bank card when it has entries in the month", async () => {
    vi.stubGlobal("fetch", makeFetch({ entries: [swileEntry], customBanks: [SWILE] }));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Swile")).toBeInTheDocument();
    });
    // a seção de bancos deve existir
    expect(screen.getByText("Bancos")).toBeInTheDocument();
  });

  // ── Negativo: banco custom existe mas sem lançamento no mês → não aparece ──────
  it("does NOT render a custom bank with no activity in the month", async () => {
    vi.stubGlobal("fetch", makeFetch({ entries: [], customBanks: [SWILE] }));

    render(<DashboardPage />);

    // espera o dashboard sair do loading (estado vazio aparece)
    await waitFor(() => {
      expect(screen.getByText(/Nenhum lançamento em/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Swile")).not.toBeInTheDocument();
  });
});
