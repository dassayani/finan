import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getServerSessionMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      bankBalance: { findMany: vi.fn() },
      bankEntry: { findMany: vi.fn() },
      bankFee: { findMany: vi.fn() },
      customBank: { findMany: vi.fn() },
      transaction: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
      auditLog: { create: vi.fn() },
    },
    getServerSessionMock: vi.fn(),
  };
});

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GET as getBankClosingBalance } from "@/app/api/bank-closing-balance/route";
import { POST as postTransactions } from "@/app/api/transactions/route";
import { PUT as putTransactionById } from "@/app/api/transactions/[id]/route";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Additional banking and transaction scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns non-null closing balance when month has only active fees", async () => {
    prismaMock.bankBalance.findMany.mockResolvedValue([]);
    prismaMock.bankEntry.findMany.mockResolvedValue([]);
    prismaMock.bankFee.findMany.mockResolvedValue([
      { id: "fee-1", bank: "nubank", amount: 25, active: true },
    ]);
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.customBank.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/bank-closing-balance?month=6&year=2026");
    const res = await getBankClosingBalance(req as never);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.nubank).toBe(-25);
  });

  it("rejects transaction POST with invalid bank/category before persistence", async () => {
    const req = jsonRequest("http://localhost/api/transactions", {
      description: "Compra inválida",
      amount: 123,
      type: "EXPENSE",
      expenseType: "BANK_BILL",
      category: "categoria-invalida",
      bank: "banco-invalido",
      date: "2026-06-05",
    });

    const res = await postTransactions(req as never);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toMatch(/inválid/i);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it("rejects transaction PUT with invalid bank/category before update", async () => {
    const req = jsonRequest("http://localhost/api/transactions/tx-1", {
      bank: "banco-invalido",
      category: "categoria-invalida",
    }, "PUT");

    const res = await putTransactionById(req as never, {
      params: Promise.resolve({ id: "tx-1" }),
    });

    expect(res.status).toBe(400);
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it("respects explicit isPaid for income transaction", async () => {
    prismaMock.transaction.create.mockResolvedValue({
      id: "tx-1",
      isPaid: true,
    });

    const req = jsonRequest("http://localhost/api/transactions", {
      description: "Recebimento",
      amount: 500,
      type: "INCOME",
      category: "reemb",
      date: "2026-06-05",
      isPaid: true,
    });

    const res = await postTransactions(req as never);

    expect(res.status).toBe(201);
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "INCOME",
          isPaid: true,
        }),
      }),
    );
  });
});
