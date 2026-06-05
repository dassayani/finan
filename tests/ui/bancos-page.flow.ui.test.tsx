/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BancosPage from "@/app/(dashboard)/bancos/page";

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BancosPage UI flow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows feedback modal when save balance API fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (!init?.method || init.method === "GET") {
        if (url.includes("/api/bank-closing-balance")) return okJson({});
        return okJson([]);
      }

      if (init?.method === "POST" && url.includes("/api/bank-balances")) {
        return new Response(JSON.stringify({ error: "Falha simulada" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return okJson({});
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<BancosPage />);

    await waitFor(() => {
      expect(screen.getByText("Bancos")).toBeInTheDocument();
    });

    const amountInputs = screen.getAllByPlaceholderText("0,00");
    amountInputs.forEach(input => {
      fireEvent.change(input, { target: { value: "123" } });
    });

    const includeButtons = screen.getAllByRole("button", { name: /Incluir/i });
    includeButtons.forEach(button => {
      if (!button.hasAttribute("disabled")) {
        fireEvent.click(button);
      }
    });

    await waitFor(() => {
      const hasBalancePost = fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === "string" ? input : input.toString();
        const maybeInit = init as RequestInit | undefined;
        return maybeInit?.method === "POST" && url.includes("/api/bank-balances");
      });
      expect(hasBalancePost).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText(/Erro ao salvar saldo/i)).toBeInTheDocument();
      expect(screen.getByText(/Falha simulada/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const balancePostCalls = fetchMock.mock.calls.filter(([input, init]) => {
        const url = typeof input === "string" ? input : input.toString();
        const maybeInit = init as RequestInit | undefined;
        return maybeInit?.method === "POST" && url.includes("/api/bank-balances");
      });

      // saveBalance uses retry policy (initial call + retries)
      expect(balancePostCalls.length).toBeGreaterThanOrEqual(3);
    });
  });
});
