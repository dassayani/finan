import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock, getServerSessionMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      bankBalance: { upsert: vi.fn(), findMany: vi.fn() },
      bankEntry: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
      customBank: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
      transaction: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
      bankFee: { update: vi.fn(), delete: vi.fn() },
      bankConfig: { upsert: vi.fn(), findMany: vi.fn() },
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

import { POST as postBankBalances } from "@/app/api/bank-balances/route";
import { POST as postBankEntries, DELETE as deleteBankEntries } from "@/app/api/bank-entries/route";
import { PATCH as patchCustomBank } from "@/app/api/custom-banks/[id]/route";
import { POST as postTransactions } from "@/app/api/transactions/route";
import { PUT as putBankFee } from "@/app/api/bank-fees/[id]/route";
import { PUT as putBankConfig } from "@/app/api/bank-configs/route";

function makeJsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Bank endpoints integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("validates bank key in bank balances endpoint", async () => {
    const req = makeJsonRequest("http://localhost/api/bank-balances", {
      bank: "banco-invalido",
      month: 6,
      year: 2026,
      balance: 1200,
    });

    const res = await postBankBalances(req as never);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Banco inválido");
    expect(prismaMock.bankBalance.upsert).not.toHaveBeenCalled();
  });

  it("enforces ownership when creating custom bank entries", async () => {
    prismaMock.customBank.findUnique.mockResolvedValue({ userId: "other-user" });

    const req = makeJsonRequest("http://localhost/api/bank-entries", {
      customBankId: "custom-1",
      month: 6,
      year: 2026,
      description: "Ajuste manual",
      amount: 100,
      type: "INCOME",
    });

    const res = await postBankEntries(req as never);

    expect(res.status).toBe(403);
    expect(prismaMock.bankEntry.create).not.toHaveBeenCalled();
  });

  it("updates only provided fields in custom bank PATCH", async () => {
    prismaMock.customBank.update.mockResolvedValue({ id: "custom-1", name: "Banco Novo" });

    const req = makeJsonRequest("http://localhost/api/custom-banks/custom-1", {
      name: "Banco Novo",
    }, "PATCH");

    const res = await patchCustomBank(req as never, {
      params: Promise.resolve({ id: "custom-1" }),
    });

    expect(res.status).toBe(200);
    expect(prismaMock.customBank.update).toHaveBeenCalledWith({
      where: { id: "custom-1", userId: "user-1" },
      data: { name: "Banco Novo" },
    });
  });

  it("returns 207 with detailed failures in bank entry batch endpoint", async () => {
    prismaMock.bankEntry.create.mockResolvedValue({ id: "entry-1" });

    const req = makeJsonRequest("http://localhost/api/bank-entries", {
      items: [
        {
          bank: "nubank",
          month: 6,
          year: 2026,
          description: "Entrada válida",
          amount: 200,
          type: "INCOME",
        },
        {
          bank: "invalido",
          month: 6,
          year: 2026,
          description: "Entrada inválida",
          amount: 90,
          type: "EXPENSE",
        },
      ],
    });

    const res = await postBankEntries(req as never);
    const payload = await res.json();

    expect(res.status).toBe(207);
    expect(payload.mode).toBe("batch");
    expect(payload.total).toBe(2);
    expect(payload.successCount).toBe(1);
    expect(payload.failedCount).toBe(1);
    expect(payload.failures[0].index).toBe(1);
    expect(payload.failures[0].error).toContain("Banco inválido");
  });

  it("returns 207 with detailed failures in transactions batch endpoint", async () => {
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-1" });

    const req = makeJsonRequest("http://localhost/api/transactions", {
      items: [
        {
          description: "Compra válida",
          amount: 120,
          type: "EXPENSE",
          expenseType: "BANK_BILL",
          bank: "nubank",
          category: "compras",
          date: "2026-06-05",
        },
        {
          amount: 120,
          type: "EXPENSE",
          expenseType: "BANK_BILL",
          bank: "nubank",
          category: "compras",
          date: "2026-06-05",
        },
      ],
    });

    const res = await postTransactions(req as never);
    const payload = await res.json();

    expect(res.status).toBe(207);
    expect(payload.mode).toBe("batch");
    expect(payload.successCount).toBe(1);
    expect(payload.failedCount).toBe(1);
    expect(payload.failures[0].index).toBe(1);
    expect(payload.failures[0].error).toContain("expected string");
  });

  it("returns 201 for fully successful bank entry batch", async () => {
    prismaMock.bankEntry.create.mockResolvedValue({ id: "entry-ok" });

    const req = makeJsonRequest("http://localhost/api/bank-entries", {
      items: [
        {
          bank: "nubank",
          month: 6,
          year: 2026,
          description: "Entrada 1",
          amount: 100,
          type: "INCOME",
        },
        {
          bank: "itau",
          month: 6,
          year: 2026,
          description: "Saída 1",
          amount: 50,
          type: "EXPENSE",
        },
      ],
    });

    const res = await postBankEntries(req as never);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.successCount).toBe(2);
    expect(payload.failedCount).toBe(0);
    expect(payload.failures).toHaveLength(0);
  });

  it("returns 207 for fully failed bank entry batch", async () => {
    const req = makeJsonRequest("http://localhost/api/bank-entries", {
      items: [
        {
          bank: "invalido-1",
          month: 6,
          year: 2026,
          description: "Falha 1",
          amount: 100,
          type: "INCOME",
        },
        {
          bank: "invalido-2",
          month: 6,
          year: 2026,
          description: "Falha 2",
          amount: 40,
          type: "EXPENSE",
        },
      ],
    });

    const res = await postBankEntries(req as never);
    const payload = await res.json();

    expect(res.status).toBe(207);
    expect(payload.successCount).toBe(0);
    expect(payload.failedCount).toBe(2);
    expect(payload.failures[0].error).toContain("Banco inválido");
    expect(payload.failures[1].error).toContain("Banco inválido");
  });

  it("validates payload for bank fee PUT endpoint", async () => {
    const req = makeJsonRequest("http://localhost/api/bank-fees/fee-1", {
      amount: -10,
    }, "PUT");

    const res = await putBankFee(req as never, {
      params: Promise.resolve({ id: "fee-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Too small");
    expect(prismaMock.bankFee.update).not.toHaveBeenCalled();
  });

  it("keeps user scope in bank fee PUT update", async () => {
    prismaMock.bankFee.update.mockResolvedValue({ id: "fee-1", name: "Tarifa" });

    const req = makeJsonRequest("http://localhost/api/bank-fees/fee-1", {
      name: "Tarifa atualizada",
      active: true,
    }, "PUT");

    const res = await putBankFee(req as never, {
      params: Promise.resolve({ id: "fee-1" }),
    });

    expect(res.status).toBe(200);
    expect(prismaMock.bankFee.update).toHaveBeenCalledWith({
      where: { id: "fee-1", userId: "user-1" },
      data: { name: "Tarifa atualizada", active: true },
    });
  });

  it("deletes bank entries by groupId scoped to user", async () => {
    prismaMock.bankEntry.deleteMany.mockResolvedValue({ count: 5 });

    const req = new Request("http://localhost/api/bank-entries?groupId=grp-123", { method: "DELETE" });
    const res = await deleteBankEntries(req as never);

    expect(res.status).toBe(204);
    expect(prismaMock.bankEntry.deleteMany).toHaveBeenCalledWith({
      where: { groupId: "grp-123", userId: "user-1" },
    });
  });

  it("deletes bank entries by descriptionBase using OR clause scoped to bank", async () => {
    prismaMock.bankEntry.deleteMany.mockResolvedValue({ count: 3 });

    const req = new Request(
      "http://localhost/api/bank-entries?descriptionBase=Aluguel&bank=nubank",
      { method: "DELETE" },
    );
    const res = await deleteBankEntries(req as never);

    expect(res.status).toBe(204);
    expect(prismaMock.bankEntry.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [
          { description: { startsWith: "Aluguel " } },
          { description: "Aluguel" },
        ],
        bank: "nubank",
      },
    });
  });

  it("deletes bank entries by descriptionBase without bank filter when no bank given", async () => {
    prismaMock.bankEntry.deleteMany.mockResolvedValue({ count: 2 });

    const req = new Request(
      "http://localhost/api/bank-entries?descriptionBase=Salario",
      { method: "DELETE" },
    );
    const res = await deleteBankEntries(req as never);

    expect(res.status).toBe(204);
    expect(prismaMock.bankEntry.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [
          { description: { startsWith: "Salario " } },
          { description: "Salario" },
        ],
      },
    });
  });

  it("returns 400 when DELETE bank-entries has neither groupId nor descriptionBase", async () => {
    const req = new Request("http://localhost/api/bank-entries", { method: "DELETE" });
    const res = await deleteBankEntries(req as never);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("obrigatório");
    expect(prismaMock.bankEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("validates bank key in bank config PUT endpoint", async () => {
    const req = makeJsonRequest("http://localhost/api/bank-configs", {
      bank: "desconhecido",
      dueDay: 10,
    }, "PUT");

    const res = await putBankConfig(req as never);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Banco inválido");
    expect(prismaMock.bankConfig.upsert).not.toHaveBeenCalled();
  });

  it("writes config scoped to authenticated user", async () => {
    prismaMock.bankConfig.upsert.mockResolvedValue({ id: "cfg-1", bank: "nubank" });

    const req = makeJsonRequest("http://localhost/api/bank-configs", {
      bank: "nubank",
      dueDay: 10,
      cutoffDay: 3,
      accountType: "Conta Digital",
    }, "PUT");

    const res = await putBankConfig(req as never);

    expect(res.status).toBe(200);
    expect(prismaMock.bankConfig.upsert).toHaveBeenCalledWith({
      where: { userId_bank: { userId: "user-1", bank: "nubank" } },
      create: {
        userId: "user-1",
        bank: "nubank",
        agency: null,
        account: null,
        accountType: "Conta Digital",
        cutoffDay: 3,
        dueDay: 10,
      },
      update: {
        agency: null,
        account: null,
        accountType: "Conta Digital",
        cutoffDay: 3,
        dueDay: 10,
      },
    });
  });
});
