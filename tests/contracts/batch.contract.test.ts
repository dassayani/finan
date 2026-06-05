import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { prismaMock, getServerSessionMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      bankEntry: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
      customBank: { findUnique: vi.fn() },
      transaction: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
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

import { POST as postBankEntries } from "@/app/api/bank-entries/route";
import { POST as postTransactions } from "@/app/api/transactions/route";

const batchContractSchema = z.object({
  mode: z.literal("batch"),
  total: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  created: z.array(z.object({ index: z.number().int().nonnegative(), id: z.string() })),
  failures: z.array(z.object({ index: z.number().int().nonnegative(), error: z.string().min(1) })),
});

function makeRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Batch response contract", () => {
  it("matches bank entries batch contract", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.bankEntry.create.mockResolvedValueOnce({ id: "entry-1" });

    const req = makeRequest("http://localhost/api/bank-entries", {
      items: [
        { bank: "nubank", month: 6, year: 2026, description: "ok", amount: 10, type: "INCOME" },
        { bank: "invalid", month: 6, year: 2026, description: "bad", amount: 10, type: "EXPENSE" },
      ],
    });

    const res = await postBankEntries(req as never);
    const payload = await res.json();

    expect([201, 207]).toContain(res.status);
    const parsed = batchContractSchema.parse(payload);
    expect(parsed.total).toBe(2);
    expect(parsed.successCount + parsed.failedCount).toBe(parsed.total);
  });

  it("matches transactions batch contract", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.transaction.create.mockResolvedValueOnce({ id: "tx-1" });

    const req = makeRequest("http://localhost/api/transactions", {
      items: [
        { description: "ok", amount: 20, type: "EXPENSE", date: "2026-06-01" },
        { amount: 20, type: "EXPENSE", date: "2026-06-01" },
      ],
    });

    const res = await postTransactions(req as never);
    const payload = await res.json();

    expect([201, 207]).toContain(res.status);
    const parsed = batchContractSchema.parse(payload);
    expect(parsed.total).toBe(2);
    expect(parsed.successCount + parsed.failedCount).toBe(parsed.total);
  });

  it("keeps valid contract under concurrent bank-entry batch requests", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    let counter = 0;
    prismaMock.bankEntry.create.mockImplementation(async () => {
      counter += 1;
      await new Promise(resolve => setTimeout(resolve, 5));
      return { id: `entry-${counter}` };
    });

    const payload = {
      items: [
        { bank: "nubank", month: 6, year: 2026, description: "ok1", amount: 10, type: "INCOME" },
        { bank: "itau", month: 6, year: 2026, description: "ok2", amount: 12, type: "EXPENSE" },
      ],
    };

    const [resA, resB] = await Promise.all([
      postBankEntries(makeRequest("http://localhost/api/bank-entries", payload) as never),
      postBankEntries(makeRequest("http://localhost/api/bank-entries", payload) as never),
    ]);

    const parsedA = batchContractSchema.parse(await resA.json());
    const parsedB = batchContractSchema.parse(await resB.json());

    expect([201, 207]).toContain(resA.status);
    expect([201, 207]).toContain(resB.status);
    expect(parsedA.total).toBe(2);
    expect(parsedB.total).toBe(2);
    expect(parsedA.successCount + parsedA.failedCount).toBe(2);
    expect(parsedB.successCount + parsedB.failedCount).toBe(2);
  });

  it("documents non-idempotent behavior for duplicate items in one batch", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    let counter = 0;
    prismaMock.bankEntry.create.mockImplementation(async () => {
      counter += 1;
      return { id: `dup-${counter}` };
    });

    const req = makeRequest("http://localhost/api/bank-entries", {
      items: [
        { bank: "nubank", month: 6, year: 2026, description: "dup", amount: 10, type: "INCOME" },
        { bank: "nubank", month: 6, year: 2026, description: "dup", amount: 10, type: "INCOME" },
      ],
    });

    const res = await postBankEntries(req as never);
    const parsed = batchContractSchema.parse(await res.json());

    expect(parsed.total).toBe(2);
    expect(parsed.successCount).toBe(2);
    expect(parsed.created).toHaveLength(2);
  });
});
