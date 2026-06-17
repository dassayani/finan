/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvestimentosPage from "@/app/(dashboard)/investimentos/page";

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const SAMPLE = [{
  id: "inv-1", name: "Tesouro Selic", type: "Renda Fixa", institution: "nubank",
  value: 1200, costBasis: 1000, returnRate: 0.1, monthlyAdd: 100, snapshots: [],
}];

afterEach(cleanup);
beforeEach(() => { vi.restoreAllMocks(); });

describe("InvestimentosPage UI flow", () => {
  // ── Positivo ────────────────────────────────────────────────────────────────
  it("renders portfolio, asset and real gain when the API returns data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson(SAMPLE)));

    render(<InvestimentosPage />);

    await waitFor(() => {
      expect(screen.getByText("Tesouro Selic")).toBeInTheDocument();
    });

    // Patrimônio = soma dos valores
    expect(screen.getByText("Patrimônio")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 1.200,00").length).toBeGreaterThan(0);
    // Ganho real = 1200 − 1000 = +200 aparece em algum lugar (KPI/linha)
    expect(screen.getAllByText(/\+R\$ 200,00/).length).toBeGreaterThan(0);
    // Não deve mostrar estado vazio
    expect(screen.queryByText(/Nenhum investimento cadastrado/i)).not.toBeInTheDocument();
  });

  // ── Negativo: o cenário exato do bug (resposta de erro) ───────────────────────
  it("does not crash and shows empty state when the API returns a 500", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));

    render(<InvestimentosPage />);

    await waitFor(() => {
      expect(screen.getByText(/Nenhum investimento cadastrado/i)).toBeInTheDocument();
    });
  });

  // ── Negativo: corpo vazio com status 200 (json() estouraria) ──────────────────
  it("survives an empty 200 body without throwing (the json parse that broke before)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200, headers: { "Content-Type": "application/json" } })));

    render(<InvestimentosPage />);

    await waitFor(() => {
      expect(screen.getByText(/Nenhum investimento cadastrado/i)).toBeInTheDocument();
    });
  });

  // ── Negativo: payload inesperado (não-array) vira lista vazia ─────────────────
  it("coerces a non-array payload to an empty list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ unexpected: "object" })));

    render(<InvestimentosPage />);

    await waitFor(() => {
      expect(screen.getByText(/Nenhum investimento cadastrado/i)).toBeInTheDocument();
    });
  });
});
