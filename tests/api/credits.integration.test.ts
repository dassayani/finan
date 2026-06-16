import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    transaction: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    bankEntry:   { create: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn() },
    customBank:  { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth",    () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",   () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/credits/route";
import { PUT, DELETE } from "@/app/api/credits/[id]/route";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/credits", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  // Run the $transaction callback against the same mock client
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock));
  prismaMock.transaction.create.mockResolvedValue({ id: "tx-1" });
  prismaMock.bankEntry.create.mockResolvedValue({ id: "be-1" });
});

describe("POST /api/credits — atomic dual-write", () => {
  it("401 unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await POST(jsonReq({ description: "x", amount: 1, date: "2026-06-01" }));
    expect(res.status).toBe(401);
  });

  it("creates only the Transaction when no bank is given", async () => {
    const res = await POST(jsonReq({ description: "Freela", amount: 1500, category: "freelance", date: "2026-06-01" }));
    expect(res.status).toBe(201);
    expect(prismaMock.transaction.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bankEntry.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalled(); // wrapped atomically
  });

  it("creates Transaction + mirror BankEntry when a bank is given", async () => {
    const res = await POST(jsonReq({ description: "Aluguel", amount: 1000, category: "aluguel_rec", date: "2026-06-10", bank: "nubank" }));
    expect(res.status).toBe(201);
    expect(prismaMock.transaction.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bankEntry.create).toHaveBeenCalledTimes(1);
    const beData = prismaMock.bankEntry.create.mock.calls[0][0].data;
    expect(beData.groupId).toBe("credit-entry-tx-1");
    expect(beData.month).toBe(6);
    expect(beData.year).toBe(2026);
    expect(beData.userId).toBe("user-1");
  });

  it("rejects invalid bank", async () => {
    const res = await POST(jsonReq({ description: "x", amount: 1, date: "2026-06-01", bank: "pirata" }));
    expect(res.status).toBe(400);
  });

  it("rejects bank + customBankId together", async () => {
    const res = await POST(jsonReq({ description: "x", amount: 1, date: "2026-06-01", bank: "nubank", customBankId: "cb1" }));
    expect(res.status).toBe(400);
  });

  it("403 when customBank belongs to another user", async () => {
    prismaMock.customBank.findUnique.mockResolvedValue({ userId: "someone-else" });
    const res = await POST(jsonReq({ description: "x", amount: 1, date: "2026-06-01", customBankId: "cb1" }));
    expect(res.status).toBe(403);
  });

  it("recurring creates one Transaction per month (first paid, rest unpaid)", async () => {
    let n = 0;
    prismaMock.transaction.create.mockImplementation(async () => ({ id: `tx-${n++}` }));
    const res = await POST(jsonReq({
      description: "Mensal", amount: 100, category: "outros_rec",
      date: "2026-01-01", recurring: { until: "2026-03-01" },
    }));
    expect(res.status).toBe(201);
    expect(prismaMock.transaction.create).toHaveBeenCalledTimes(3); // jan, fev, mar
    const isPaidFlags = prismaMock.transaction.create.mock.calls.map(c => c[0].data.isPaid);
    expect(isPaidFlags).toEqual([true, false, false]);
  });
});

describe("PUT /api/credits/[id] — atomic update + mirror replace", () => {
  it("404 when transaction not owned", async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 0 });
    const res = await PUT(jsonReq({ description: "x", amount: 1, date: "2026-06-01" }), ctx("tx-x"));
    expect(res.status).toBe(404);
  });

  it("replaces mirror entry: deletes old, recreates when bank present", async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bankEntry.findFirst.mockResolvedValue({ isPaid: true });
    const res = await PUT(jsonReq({ description: "x", amount: 50, date: "2026-06-01", bank: "itau" }), ctx("tx-1"));
    expect(res.status).toBe(200);
    expect(prismaMock.bankEntry.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", groupId: "credit-entry-tx-1" } });
    expect(prismaMock.bankEntry.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bankEntry.create.mock.calls[0][0].data.isPaid).toBe(true); // preserved
  });

  it("removes mirror entry when bank cleared", async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bankEntry.findFirst.mockResolvedValue(null);
    const res = await PUT(jsonReq({ description: "x", amount: 50, date: "2026-06-01" }), ctx("tx-1"));
    expect(res.status).toBe(200);
    expect(prismaMock.bankEntry.deleteMany).toHaveBeenCalled();
    expect(prismaMock.bankEntry.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/credits/[id]", () => {
  it("deletes transaction and mirror atomically, scoped by userId", async () => {
    const res = await DELETE(jsonReq({}), ctx("tx-1"));
    expect(res.status).toBe(204);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith({ where: { id: "tx-1", userId: "user-1" } });
    expect(prismaMock.bankEntry.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", groupId: "credit-entry-tx-1" } });
  });
});
