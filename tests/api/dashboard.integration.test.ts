import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    transaction: {
      findMany:  vi.fn(),
      groupBy:   vi.fn(),
    },
    bankEntry: {
      findMany: vi.fn(),
    },
  },
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth",   () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",  () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET } from "@/app/api/dashboard/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(params: Record<string, string>) {
  const url = new URL("http://localhost/api/dashboard");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function okSession() {
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
}

function makeTx(overrides: object = {}) {
  return { type: "EXPENSE", amount: "100", expenseType: "FIXED", category: "casa", ...overrides };
}

function makeBe(overrides: object = {}) {
  return { type: "EXPENSE", amount: "50", category: "casa", ...overrides };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("GET /api/dashboard — auth", () => {
  it("returns 401 when not authenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(req({ month: "6", year: "2026" }));
    expect(res.status).toBe(401);
  });
});

// ── Monthly mode ──────────────────────────────────────────────────────────────

describe("GET /api/dashboard — monthly", () => {
  beforeEach(() => {
    okSession();
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.groupBy.mockResolvedValue([]);
    prismaMock.bankEntry.findMany.mockResolvedValue([]);
  });

  it("returns zero stats when no data", async () => {
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.stats).toEqual({ totalIncome: 0, totalExpense: 0, balance: 0, transactionCount: 0 });
    expect(body.categoryData).toEqual([]);
    expect(body.expenseTypeData).toEqual({ fixed: 0, variable: 0, bankBill: 0 });
  });

  it("sums Transaction expenses in totalExpense", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: "EXPENSE", amount: "200" }),
      makeTx({ type: "EXPENSE", amount: "300" }),
    ]);
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    expect(body.stats.totalExpense).toBe(500);
  });

  it("includes manual BankEntry expenses in totalExpense", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: "EXPENSE", amount: "100" }),
    ]);
    prismaMock.bankEntry.findMany.mockResolvedValue([
      makeBe({ type: "EXPENSE", amount: "80" }),
    ]);
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    expect(body.stats.totalExpense).toBe(180);
  });

  it("includes manual BankEntry income in totalIncome", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: "INCOME", amount: "3000", expenseType: null }),
    ]);
    prismaMock.bankEntry.findMany.mockResolvedValue([
      makeBe({ type: "INCOME", amount: "500", category: "freelance" }),
    ]);
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    expect(body.stats.totalIncome).toBe(3500);
  });

  it("merges BankEntry category with Transaction category in categoryData", async () => {
    prismaMock.transaction.groupBy.mockResolvedValue([
      { category: "casa", _sum: { amount: "200" } },
    ]);
    prismaMock.bankEntry.findMany.mockResolvedValue([
      makeBe({ type: "EXPENSE", amount: "100", category: "casa" }),
    ]);
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    const casa = body.categoryData.find((c: { key: string }) => c.key === "casa");
    expect(casa?.value).toBe(300);
  });

  it("adds new category from BankEntry not present in Transaction groupBy", async () => {
    prismaMock.transaction.groupBy.mockResolvedValue([
      { category: "casa", _sum: { amount: "200" } },
    ]);
    prismaMock.bankEntry.findMany.mockResolvedValue([
      makeBe({ type: "EXPENSE", amount: "150", category: "saude" }),
    ]);
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    const keys = body.categoryData.map((c: { key: string }) => c.key);
    expect(keys).toContain("saude");
    const saude = body.categoryData.find((c: { key: string }) => c.key === "saude");
    expect(saude?.value).toBe(150);
  });

  // NOTE: exclusion of category=reserva and mirror groupIds (salary-entry-*, etc.)
  // happens in the Prisma `where` clause, which the mock does not evaluate. That
  // logic is covered by tests/lib/bank-entry-sync.test.ts. Here we only assert the
  // aggregation behaviour over whatever the query returns.

  it("queries BankEntry excluding reserva and mirror groupIds", async () => {
    await GET(req({ month: "6", year: "2026" }));
    const call = prismaMock.bankEntry.findMany.mock.calls.at(-1)?.[0];
    expect(call.where.category).toEqual({ not: "reserva" });
    // manualBankEntryWhere(): OR[0] keeps null, OR[1].NOT excludes mirror prefixes
    expect(call.where.OR[0]).toEqual({ groupId: null });
    expect(Array.isArray(call.where.OR[1].NOT)).toBe(true);
    expect(call.where.OR[1].NOT.length).toBeGreaterThanOrEqual(5);
  });

  it("expenseTypeData comes only from Transaction groupBy (no BankEntry)", async () => {
    prismaMock.transaction.groupBy
      .mockResolvedValueOnce([{ category: "casa", _sum: { amount: "100" } }]) // categoryGroups
      .mockResolvedValueOnce([{ expenseType: "BANK_BILL", _sum: { amount: "1500" } }]); // expTypeGroups
    prismaMock.bankEntry.findMany.mockResolvedValue([
      makeBe({ type: "EXPENSE", amount: "200", category: "alim" }),
    ]);
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    // expenseTypeData vem só do groupBy de Transaction — o BankEntry manual (200)
    // não entra aqui...
    expect(body.expenseTypeData.bankBill).toBe(1500);
    // ...mas entra em totalExpense (stats.findMany mock = [], então só o BE de 200).
    expect(body.stats.totalExpense).toBe(200);
  });

  it("balance = totalIncome - totalExpense", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: "INCOME",  amount: "5000", expenseType: null }),
      makeTx({ type: "EXPENSE", amount: "2000" }),
    ]);
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    expect(body.stats.balance).toBe(3000);
  });

  it("categoryData is sorted descending by value", async () => {
    prismaMock.transaction.groupBy.mockResolvedValue([
      { category: "casa",  _sum: { amount: "100" } },
      { category: "alim",  _sum: { amount: "500" } },
      { category: "saude", _sum: { amount: "300" } },
    ]);
    const res  = await GET(req({ month: "6", year: "2026" }));
    const body = await res.json();
    const values = body.categoryData.map((c: { value: number }) => c.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });
});

// ── Annual mode ───────────────────────────────────────────────────────────────

describe("GET /api/dashboard — annual mode", () => {
  beforeEach(() => {
    okSession();
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.bankEntry.findMany.mockResolvedValue([]);
  });

  it("returns 12 months of data", async () => {
    const res  = await GET(req({ year: "2026", mode: "annual" }));
    const body = await res.json();
    expect(body.months).toHaveLength(12);
    expect(body.months[0]).toMatchObject({ month: 1, income: 0, expense: 0 });
  });

  it("includes BankEntry in annual monthly totals", async () => {
    // Transaction in June
    prismaMock.transaction.findMany.mockResolvedValue([
      { type: "INCOME", amount: "3000", date: new Date("2026-06-05") },
    ]);
    // BankEntry in June
    prismaMock.bankEntry.findMany.mockResolvedValue([
      { type: "EXPENSE", amount: "200", month: 6 },
    ]);
    const res  = await GET(req({ year: "2026", mode: "annual" }));
    const body = await res.json();
    const june = body.months.find((m: { month: number }) => m.month === 6);
    expect(june.income).toBe(3000);
    expect(june.expense).toBe(200);
  });
});
