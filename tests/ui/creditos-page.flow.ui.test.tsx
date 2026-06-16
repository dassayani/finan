/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreditosPage from "@/app/(dashboard)/creditos/page";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_CREDIT = {
  id: "c1",
  description: "Freelance",
  amount: 1500,
  category: "reemb",
  bank: null,
  date: "2026-06-01",
  notes: null,
  groupId: null,
};

function makeFetch(credits: unknown[] = []) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (method !== "GET") return okJson({ id: "ok" });
    if (url.includes("/api/salary"))  return okJson(null);
    if (url.includes("/api/credits")) return okJson(credits);
    if (url.includes("/api/bonus"))   return okJson({ plr: null, decimo: null });
    return okJson(null);
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", makeFetch());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CreditosPage", () => {

  // ── Estado vazio ─────────────────────────────────────────────────────────────

  it("shows empty state when there are no credits", async () => {
    render(<CreditosPage />);
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma receita registrada/i)).toBeInTheDocument();
    });
  });

  it("renders both KPI cards", async () => {
    render(<CreditosPage />);
    await waitFor(() => {
      expect(screen.getByText("Total de entradas")).toBeInTheDocument();
      expect(screen.getByText("Outros recebimentos")).toBeInTheDocument();
    });
  });

  // ── Lista com dados ───────────────────────────────────────────────────────────

  it("renders credit rows when credits exist", async () => {
    vi.stubGlobal("fetch", makeFetch([SAMPLE_CREDIT]));
    render(<CreditosPage />);
    await waitFor(() => {
      expect(screen.getByText("Freelance")).toBeInTheDocument();
    });
  });

  it("shows BRL-formatted amount in the credit row", async () => {
    vi.stubGlobal("fetch", makeFetch([SAMPLE_CREDIT]));
    render(<CreditosPage />);
    await waitFor(() => screen.getByText("Freelance"));
    // Amount appears in multiple places (KPI + row) — at least one occurrence
    expect(screen.getAllByText(/1\.500,00/).length).toBeGreaterThan(0);
  });

  it("shows edit and delete action buttons per credit row", async () => {
    vi.stubGlobal("fetch", makeFetch([SAMPLE_CREDIT]));
    render(<CreditosPage />);
    await waitFor(() => screen.getByText("Freelance"));

    // Edit button has ink-3 color, delete button has neg color
    const editBtn = document.querySelector('button[style*="ink-3"]');
    const deleteBtn = document.querySelector('button[style*="var(--neg)"]');
    expect(editBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();
  });

  // ── Dropdown "Incluir Nova Receita" ────────────────────────────────────────────

  it("opens dropdown menu when the button is clicked", async () => {
    render(<CreditosPage />);
    await waitFor(() => screen.getByText(/Nenhuma receita/i));

    fireEvent.click(screen.getByRole("button", { name: /Incluir Nova Receita/i }));

    await waitFor(() => {
      expect(screen.getByText("Holerite")).toBeInTheDocument();
      expect(screen.getByText("Outras Receitas")).toBeInTheDocument();
    });
  });

  it("closes dropdown when clicking outside (backdrop)", async () => {
    render(<CreditosPage />);
    await waitFor(() => screen.getByText(/Nenhuma receita/i));

    fireEvent.click(screen.getByRole("button", { name: /Incluir Nova Receita/i }));
    await waitFor(() => screen.getByText("Holerite"));

    // Click the invisible backdrop (first div with position:fixed that appears)
    const backdrop = document.querySelector('div[style*="position: fixed"][style*="inset: 0"]');
    if (backdrop) fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByText("Holerite")).not.toBeInTheDocument();
    });
  });

  // ── Modal CreditForm ──────────────────────────────────────────────────────────

  it("opens CreditForm modal on 'Outras Receitas'", async () => {
    render(<CreditosPage />);
    await waitFor(() => screen.getByText(/Nenhuma receita/i));

    fireEvent.click(screen.getByRole("button", { name: /Incluir Nova Receita/i }));
    fireEvent.click(screen.getByText("Outras Receitas"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Reembolso|aluguel|bônus/i)).toBeInTheDocument();
    });
  });

  it("category field is a <select> element, not pills/buttons", async () => {
    render(<CreditosPage />);
    await waitFor(() => screen.getByText(/Nenhuma receita/i));

    fireEvent.click(screen.getByRole("button", { name: /Incluir Nova Receita/i }));
    fireEvent.click(screen.getByText("Outras Receitas"));
    await waitFor(() => screen.getByPlaceholderText(/Reembolso|aluguel|bônus/i));

    const selects = Array.from(document.querySelectorAll("select"));
    const catSelect = selects.find(s =>
      s.querySelector('option[value="reemb"]') || s.querySelector('option[value="casa"]')
    );
    expect(catSelect).toBeTruthy();
    expect(catSelect!.tagName).toBe("SELECT");
  });

  it("closes modal when Cancelar is clicked", async () => {
    render(<CreditosPage />);
    await waitFor(() => screen.getByText(/Nenhuma receita/i));

    fireEvent.click(screen.getByRole("button", { name: /Incluir Nova Receita/i }));
    fireEvent.click(screen.getByText("Outras Receitas"));
    await waitFor(() => screen.getByPlaceholderText(/Reembolso|aluguel|bônus/i));

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Reembolso|aluguel|bônus/i)).not.toBeInTheDocument();
    });
  });

  // ── Salvar crédito ────────────────────────────────────────────────────────────

  it("calls POST /api/credits (atomic dual-write) when saving a credit", async () => {
    const fetchMock = makeFetch([]);
    vi.stubGlobal("fetch", fetchMock);

    render(<CreditosPage />);
    await waitFor(() => screen.getByText(/Nenhuma receita/i));

    fireEvent.click(screen.getByRole("button", { name: /Incluir Nova Receita/i }));
    fireEvent.click(screen.getByText("Outras Receitas"));
    await waitFor(() => screen.getByPlaceholderText(/Reembolso|aluguel|bônus/i));

    fireEvent.change(screen.getByPlaceholderText(/Reembolso|aluguel|bônus/i), {
      target: { value: "Bônus anual" },
    });
    const numInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numInput, { target: { value: "5000" } });

    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/i }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === "string" ? input : input.toString();
        return (init as RequestInit)?.method === "POST"
          && url.includes("/api/credits")
          && !url.includes("/api/credits/"); // não confundir com PUT/DELETE em /[id]
      });
      expect(posted).toBe(true);
    });
  });

  // ── Excluir crédito ───────────────────────────────────────────────────────────

  it("calls DELETE /api/credits/c1 when deletion is confirmed", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const fetchMock = makeFetch([SAMPLE_CREDIT]);
    vi.stubGlobal("fetch", fetchMock);

    render(<CreditosPage />);
    await waitFor(() => screen.getByText("Freelance"));

    const deleteBtn = document.querySelector('button[style*="var(--neg)"]') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      const deleted = fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === "string" ? input : input.toString();
        return (init as RequestInit)?.method === "DELETE" && url.includes("/api/credits/c1");
      });
      expect(deleted).toBe(true);
    });
  });

  it("does NOT call DELETE when deletion is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const fetchMock = makeFetch([SAMPLE_CREDIT]);
    vi.stubGlobal("fetch", fetchMock);

    render(<CreditosPage />);
    await waitFor(() => screen.getByText("Freelance"));

    const deleteBtn = document.querySelector('button[style*="var(--neg)"]') as HTMLButtonElement;
    fireEvent.click(deleteBtn);

    // No DELETE should have been called
    const deleted = fetchMock.mock.calls.some(([input, init]) => {
      const url = typeof input === "string" ? input : input.toString();
      return (init as RequestInit)?.method === "DELETE" && url.includes("/api/credits");
    });
    expect(deleted).toBe(false);
  });
});
