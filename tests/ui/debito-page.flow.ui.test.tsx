/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DebitoPage from "@/app/(dashboard)/debito/page";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const FIXED_TX = {
  id: "t1", description: "Aluguel", amount: 2000,
  type: "EXPENSE" as const, expenseType: "FIXED" as const,
  category: "casa", bank: null, date: "2026-06-01",
  isPaid: true, notes: null, installments: null, installmentIndex: null, groupId: null,
};

const VARIABLE_TX = {
  id: "t2", description: "Academia", amount: 100,
  type: "EXPENSE" as const, expenseType: "VARIABLE" as const,
  category: "saude", bank: null, date: "2026-06-05",
  isPaid: false, notes: null, installments: null, installmentIndex: null, groupId: null,
};

const GROUP_TX = {
  ...VARIABLE_TX, id: "t3", description: "Parcelamento",
  groupId: "grp-123", installments: 6, installmentIndex: 2,
};

// Despesa mensal recorrente (repetir até data X): tem groupId mas NÃO tem
// installments. Era o caso que não oferecia "Excluir todos os meses".
const RECUR_TX = {
  ...FIXED_TX, id: "t4", description: "Internet",
  groupId: "grp-999", installments: null, installmentIndex: null,
};

function makeFetch(transactions: unknown[] = []) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (method !== "GET") return okJson({ id: "ok" });
    if (url.includes("/api/transactions")) return okJson(transactions);
    if (url.includes("/api/custom-banks")) return okJson([]);
    return okJson([]);
  });
}

// OrcaIcon "trash" SVG path — used to locate the delete button reliably
const TRASH_PATH = "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6";

function findTrashButton(): HTMLButtonElement {
  const btn = Array.from(document.querySelectorAll("button")).find(b =>
    b.querySelector(`path[d="${TRASH_PATH}"]`)
  ) as HTMLButtonElement | undefined;
  if (!btn) throw new Error("Trash button not found in DOM");
  return btn;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", makeFetch());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DebitoPage", () => {

  // ── Estado vazio ─────────────────────────────────────────────────────────────

  it("shows empty state when there are no transactions", async () => {
    render(<DebitoPage />);
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma despesa/i)).toBeInTheDocument();
    });
  });

  it("renders all four KPI cards", async () => {
    render(<DebitoPage />);
    await waitFor(() => {
      expect(screen.getByText("Gastos Fixos")).toBeInTheDocument();
      expect(screen.getByText("Gastos Variáveis")).toBeInTheDocument();
      expect(screen.getByText("Já pago")).toBeInTheDocument();
      expect(screen.getByText("Pendente")).toBeInTheDocument();
    });
  });

  // ── Lista com dados ───────────────────────────────────────────────────────────

  it("renders transaction rows when data exists", async () => {
    vi.stubGlobal("fetch", makeFetch([FIXED_TX, VARIABLE_TX]));
    render(<DebitoPage />);
    await waitFor(() => {
      expect(screen.getByText("Aluguel")).toBeInTheDocument();
      expect(screen.getByText("Academia")).toBeInTheDocument();
    });
  });

  it("shows BRL-formatted amount for transactions", async () => {
    vi.stubGlobal("fetch", makeFetch([FIXED_TX]));
    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Aluguel"));
    expect(screen.getAllByText(/2\.000,00/).length).toBeGreaterThan(0);
  });

  it("shows 'Pago' badge on paid transaction", async () => {
    vi.stubGlobal("fetch", makeFetch([FIXED_TX]));
    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Aluguel"));
    expect(screen.getByText("Pago")).toBeInTheDocument();
  });

  it("shows 'Pagar' badge on unpaid transaction", async () => {
    vi.stubGlobal("fetch", makeFetch([VARIABLE_TX]));
    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Academia"));
    expect(screen.getByText("Pagar")).toBeInTheDocument();
  });

  // ── Modal "Lançar despesa" ─────────────────────────────────────────────────────

  it("opens ExpenseForm modal when 'Lançar despesa' is clicked", async () => {
    render(<DebitoPage />);
    await waitFor(() => screen.getByText(/Nenhuma despesa/i));

    fireEvent.click(screen.getByRole("button", { name: /Lançar despesa/i }));

    await waitFor(() => {
      expect(screen.getByText("Novo lançamento")).toBeInTheDocument();
      expect(screen.getByText("Gasto Fixo")).toBeInTheDocument();
      expect(screen.getByText("Gasto Variável")).toBeInTheDocument();
    });
  });

  it("closes modal when Cancelar is clicked", async () => {
    render(<DebitoPage />);
    await waitFor(() => screen.getByText(/Nenhuma despesa/i));

    fireEvent.click(screen.getByRole("button", { name: /Lançar despesa/i }));
    await waitFor(() => screen.getByText("Novo lançamento"));

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByText("Novo lançamento")).not.toBeInTheDocument();
    });
  });

  it("switches to Gasto Variável when clicked", async () => {
    render(<DebitoPage />);
    await waitFor(() => screen.getByText(/Nenhuma despesa/i));
    fireEvent.click(screen.getByRole("button", { name: /Lançar despesa/i }));
    await waitFor(() => screen.getByText("Novo lançamento"));

    fireEvent.click(screen.getByText("Gasto Variável"));

    await waitFor(() => {
      expect(screen.getByText(/Gasto avulso ou eventual/i)).toBeInTheDocument();
    });
  });

  it("ExpenseForm category field is a <select>", async () => {
    render(<DebitoPage />);
    await waitFor(() => screen.getByText(/Nenhuma despesa/i));
    fireEvent.click(screen.getByRole("button", { name: /Lançar despesa/i }));
    await waitFor(() => screen.getByText("Novo lançamento"));

    const selects = Array.from(document.querySelectorAll("select"));
    const catSelect = selects.find(s =>
      s.querySelector('option[value="casa"]') || s.querySelector('option[value="alim"]')
    );
    expect(catSelect).toBeTruthy();
    expect(catSelect!.tagName).toBe("SELECT");
  });

  // ── Filtros ────────────────────────────────────────────────────────────────────

  it("filter 'Pendentes' shows only unpaid rows", async () => {
    vi.stubGlobal("fetch", makeFetch([FIXED_TX, VARIABLE_TX]));
    render(<DebitoPage />);
    await waitFor(() => {
      expect(screen.getByText("Aluguel")).toBeInTheDocument();
      expect(screen.getByText("Academia")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Pendentes" }));

    await waitFor(() => {
      const rowNames = Array.from(document.querySelectorAll(".row-name")).map(el => el.textContent);
      expect(rowNames).toContain("Academia");    // unpaid — should be visible
      expect(rowNames).not.toContain("Aluguel"); // paid — should be hidden
    });
  });

  it("filter 'Pagos' shows only paid rows", async () => {
    vi.stubGlobal("fetch", makeFetch([FIXED_TX, VARIABLE_TX]));
    render(<DebitoPage />);
    await waitFor(() => {
      expect(screen.getByText("Aluguel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Pagos" }));

    await waitFor(() => {
      const rowNames = Array.from(document.querySelectorAll(".row-name")).map(el => el.textContent);
      expect(rowNames).toContain("Aluguel");     // paid — should be visible
      expect(rowNames).not.toContain("Academia");// unpaid — should be hidden
    });
  });

  // ── Toggle pago ────────────────────────────────────────────────────────────────

  it("calls PATCH /api/transactions/:id when toggling paid", async () => {
    const fetchMock = makeFetch([VARIABLE_TX]);
    vi.stubGlobal("fetch", fetchMock);

    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Academia"));

    fireEvent.click(screen.getByText("Pagar"));

    await waitFor(() => {
      const patched = fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === "string" ? input : input.toString();
        return (init as RequestInit)?.method === "PATCH" && url.includes("/api/transactions/t2");
      });
      expect(patched).toBe(true);
    });
  });

  // ── Salvar novo lançamento ─────────────────────────────────────────────────────

  it("calls POST /api/transactions when saving a new expense", async () => {
    const fetchMock = makeFetch([]);
    vi.stubGlobal("fetch", fetchMock);

    render(<DebitoPage />);
    await waitFor(() => screen.getByText(/Nenhuma despesa/i));

    fireEvent.click(screen.getByRole("button", { name: /Lançar despesa/i }));
    await waitFor(() => screen.getByText("Novo lançamento"));

    fireEvent.change(screen.getByPlaceholderText(/Condomínio|Spotify/i), {
      target: { value: "Luz" },
    });
    const numInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numInput, { target: { value: "150" } });

    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/i }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === "string" ? input : input.toString();
        return (init as RequestInit)?.method === "POST" && url.includes("/api/transactions");
      });
      expect(posted).toBe(true);
    });
  });

  // ── Modal de exclusão ──────────────────────────────────────────────────────────

  it("shows single 'Excluir' for non-recurring expense", async () => {
    vi.stubGlobal("fetch", makeFetch([VARIABLE_TX]));
    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Academia"));

    fireEvent.click(findTrashButton());

    await waitFor(() => {
      // Modal title confirms the modal opened
      expect(screen.getByText("Excluir lançamento")).toBeInTheDocument();
      // Description appears inside <b> — check for the bold element
      expect(screen.getByText(/"Academia"/)).toBeInTheDocument();
      // No group-delete options for non-recurring
      expect(screen.queryByRole("button", { name: /Só este mês/i })).not.toBeInTheDocument();
    });
  });

  it("shows 'Só este mês' and 'Excluir todos' for recurring expense", async () => {
    vi.stubGlobal("fetch", makeFetch([GROUP_TX]));
    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Parcelamento"));

    fireEvent.click(findTrashButton());

    await waitFor(() => {
      // Modal title confirms the modal opened
      expect(screen.getByText("Excluir lançamento")).toBeInTheDocument();
      // Description appears inside <b>
      expect(screen.getByText(/"Parcelamento"/)).toBeInTheDocument();
      // Group-delete options for recurring
      expect(screen.getByRole("button", { name: /Só este mês/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Excluir todos/i })).toBeInTheDocument();
    });
  });

  it("calls DELETE with groupId when 'Excluir todos' is clicked", async () => {
    const fetchMock = makeFetch([GROUP_TX]);
    vi.stubGlobal("fetch", fetchMock);

    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Parcelamento"));

    fireEvent.click(findTrashButton());
    await waitFor(() => screen.getByRole("button", { name: /Excluir todos/i }));

    fireEvent.click(screen.getByRole("button", { name: /Excluir todos/i }));

    await waitFor(() => {
      const groupDelete = fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === "string" ? input : input.toString();
        return (init as RequestInit)?.method === "DELETE" && url.includes("groupId=grp-123");
      });
      expect(groupDelete).toBe(true);
    });
  });

  it("calls DELETE by id when 'Só este mês' is clicked", async () => {
    const fetchMock = makeFetch([GROUP_TX]);
    vi.stubGlobal("fetch", fetchMock);

    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Parcelamento"));

    fireEvent.click(findTrashButton());
    await waitFor(() => screen.getByRole("button", { name: /Só este mês/i }));

    fireEvent.click(screen.getByRole("button", { name: /Só este mês/i }));

    await waitFor(() => {
      const singleDelete = fetchMock.mock.calls.some(([input, init]) => {
        const url = typeof input === "string" ? input : input.toString();
        return (init as RequestInit)?.method === "DELETE" && url.includes("/api/transactions/t3");
      });
      expect(singleDelete).toBe(true);
    });
  });

  // ── Recorrência mensal SEM installments (o caso reportado) ────────────────────

  it("offers 'Excluir todos os meses' for a monthly recurring expense (no installments)", async () => {
    vi.stubGlobal("fetch", makeFetch([RECUR_TX]));
    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Internet"));

    fireEvent.click(findTrashButton());

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Só este mês/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Excluir todos os meses/i })).toBeInTheDocument();
    });
  });

  it("'Só este mês' deletes only that month's bank-entry (groupId + month + year), not the whole group", async () => {
    const fetchMock = makeFetch([RECUR_TX]); // date 2026-06-01
    vi.stubGlobal("fetch", fetchMock);

    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Internet"));

    fireEvent.click(findTrashButton());
    await waitFor(() => screen.getByRole("button", { name: /Só este mês/i }));
    fireEvent.click(screen.getByRole("button", { name: /Só este mês/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls
        .filter(([, init]) => (init as RequestInit)?.method === "DELETE")
        .map(([input]) => (typeof input === "string" ? input : input.toString()));
      // transação única por id
      expect(calls.some(u => u.includes("/api/transactions/t4"))).toBe(true);
      // bank-entry só daquele mês: groupId + month + year (NÃO o grupo inteiro)
      const be = calls.find(u => u.includes("/api/bank-entries") && u.includes("groupId=grp-999"));
      expect(be).toBeTruthy();
      expect(be).toContain("month=6");
      expect(be).toContain("year=2026");
    });
  });

  it("deletes transactions AND mirror bank-entries by groupId for a recurring expense", async () => {
    const fetchMock = makeFetch([RECUR_TX]);
    vi.stubGlobal("fetch", fetchMock);

    render(<DebitoPage />);
    await waitFor(() => screen.getByText("Internet"));

    fireEvent.click(findTrashButton());
    await waitFor(() => screen.getByRole("button", { name: /Excluir todos os meses/i }));
    fireEvent.click(screen.getByRole("button", { name: /Excluir todos os meses/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([input, init]) =>
        (init as RequestInit)?.method === "DELETE" &&
        (typeof input === "string" ? input : input.toString()).includes("groupId=grp-999")
      );
      const urls = calls.map(([input]) => (typeof input === "string" ? input : input.toString()));
      // limpa os dois ledgers
      expect(urls.some(u => u.includes("/api/transactions"))).toBe(true);
      expect(urls.some(u => u.includes("/api/bank-entries"))).toBe(true);
    });
  });
});
