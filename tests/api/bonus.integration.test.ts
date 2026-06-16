import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    salary:      { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    transaction: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    bankEntry:   { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    customBank:  { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth",    () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",   () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST, GET, DELETE } from "@/app/api/bonus/route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/bonus", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  });
}
const getReq = (qs: string) => new NextRequest(`http://localhost/api/bonus?${qs}`);
const delReq = (qs: string) => new NextRequest(`http://localhost/api/bonus?${qs}`, { method: "DELETE" });

const feriasBody = {
  type: "ferias", year: 2026, payDate: "2026-07-01",
  baseAmount: 5000, netAmount: 4200, notes: null,
  bank: "nubank", customBankId: null,
  items: [
    { name: "Férias", amount: 3750, type: "PROVENTO" },
    { name: "1/3 Constitucional", amount: 1250, type: "PROVENTO" },
    { name: "INSS", amount: 550, type: "DESCONTO" },
    { name: "IRRF", amount: 250, type: "DESCONTO" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock));
  prismaMock.salary.upsert.mockResolvedValue({ id: "sal-1", items: [] });
  prismaMock.transaction.findFirst.mockResolvedValue(null);
  prismaMock.transaction.create.mockResolvedValue({ id: "tx-1" });
  prismaMock.bankEntry.findFirst.mockResolvedValue(null);
  prismaMock.bankEntry.create.mockResolvedValue({ id: "be-1" });
  prismaMock.bankEntry.deleteMany.mockResolvedValue({ count: 0 });
});

describe("POST /api/bonus — Férias", () => {
  it("401 unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await POST(postReq(feriasBody));
    expect(res.status).toBe(401);
  });

  it("encodes month as FERIAS_BASE(1200) + payMonth and creates INCOME transaction", async () => {
    const res = await POST(postReq(feriasBody));
    expect(res.status).toBe(201);

    // Salary upsert keyed by encoded month 1207 (1200 + July)
    const upsertArg = prismaMock.salary.upsert.mock.calls[0][0];
    expect(upsertArg.where.userId_month_year.month).toBe(1207);
    expect(upsertArg.where.userId_month_year.year).toBe(2026);

    // INCOME transaction with bonus-ferias groupId and "trab" category
    const txArg = prismaMock.transaction.create.mock.calls[0][0].data;
    expect(txArg.type).toBe("INCOME");
    expect(txArg.description).toBe("Férias");
    expect(txArg.category).toBe("trab");
    expect(txArg.amount).toBe(4200);
    expect(txArg.groupId).toBe("bonus-ferias-2026-7-user-1");
  });

  it("creates a mirror BankEntry with bonus-entry- groupId on the pay month", async () => {
    await POST(postReq(feriasBody));
    const beArg = prismaMock.bankEntry.create.mock.calls[0][0].data;
    expect(beArg.groupId).toBe("bonus-entry-ferias-2026-7-user-1");
    expect(beArg.bank).toBe("nubank");
    expect(beArg.month).toBe(7);
    expect(beArg.year).toBe(2026);
    expect(beArg.type).toBe("INCOME");
  });

  it("does not create a BankEntry when no bank is given", async () => {
    await POST(postReq({ ...feriasBody, bank: null, customBankId: null }));
    expect(prismaMock.transaction.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bankEntry.create).not.toHaveBeenCalled();
  });

  it("403 when the custom bank belongs to another user", async () => {
    prismaMock.customBank.findUnique.mockResolvedValue({ userId: "someone-else" });
    const res = await POST(postReq({ ...feriasBody, bank: null, customBankId: "cb-other" }));
    expect(res.status).toBe(403);
    expect(prismaMock.salary.upsert).not.toHaveBeenCalled();
  });

  it("skips transaction creation when netAmount is zero", async () => {
    await POST(postReq({ ...feriasBody, netAmount: 0 }));
    expect(prismaMock.salary.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it("updates the existing INCOME transaction instead of duplicating", async () => {
    prismaMock.transaction.findFirst.mockResolvedValue({ id: "tx-existing" });
    await POST(postReq(feriasBody));
    expect(prismaMock.transaction.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/bonus — disjoint encoding ranges", () => {
  it("returns plr, decimo and ferias filtered by pay month", async () => {
    prismaMock.salary.findMany
      .mockResolvedValueOnce([{ id: "plr", month: 1406, payDay: 6, items: [] }])     // PLR June
      .mockResolvedValueOnce([{ id: "dec", month: 1312, payDay: 12, items: [] }])    // Décimo December
      .mockResolvedValueOnce([{ id: "fer", month: 1207, payDay: 7, items: [] }]);    // Férias July

    const res = await GET(getReq("year=2026&month=7"));
    const body = await res.json();
    // Only férias matches month 7
    expect(body.ferias?.id).toBe("fer");
    expect(body.plr).toBeNull();
    expect(body.decimo).toBeNull();
  });
});

describe("DELETE /api/bonus — Férias", () => {
  beforeEach(() => {
    prismaMock.salary.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("removes salary, transaction and mirror entry for the encoded month", async () => {
    const res = await DELETE(delReq("type=ferias&year=2026&payMonth=7"));
    expect(res.status).toBe(204);
    expect(prismaMock.salary.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", month: 1207, year: 2026 },
    });
    expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", groupId: "bonus-ferias-2026-7-user-1" },
    });
    expect(prismaMock.bankEntry.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", groupId: "bonus-entry-ferias-2026-7-user-1" },
    });
  });

  it("400 when required params are missing", async () => {
    const res = await DELETE(delReq("type=ferias&year=2026"));
    expect(res.status).toBe(400);
  });
});
