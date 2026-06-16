import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user:        { findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
    bankEntry:   { findMany: vi.fn() },
    auditLog:    { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET } from "@/app/api/cron/reconciliation/route";

function cronReq(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret) headers.authorization = `Bearer ${secret}`;
  return new NextRequest("http://localhost/api/cron/reconciliation", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cr3t";
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.transaction.findMany.mockResolvedValue([]);
  prismaMock.bankEntry.findMany.mockResolvedValue([]);
});

describe("GET /api/cron/reconciliation — auth", () => {
  it("401 without the secret", async () => {
    expect((await GET(cronReq())).status).toBe(401);
  });
  it("401 with wrong secret", async () => {
    expect((await GET(cronReq("nope"))).status).toBe(401);
  });
  it("401 when CRON_SECRET is unset (fail closed)", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(cronReq("anything"))).status).toBe(401);
  });
});

describe("GET /api/cron/reconciliation — run", () => {
  it("reports ok when there are no divergences", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1" }]);
    const res = await GET(cronReq("s3cr3t"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.usersChecked).toBe(1);
    expect(body.totalDivergences).toBe(0);
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("records RECONCILE_ALERT for a user with an orphan mirror", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1" }]);
    prismaMock.transaction.findMany.mockResolvedValue([]); // sem transação
    prismaMock.bankEntry.findMany.mockResolvedValue([
      { id: "be-1", amount: "100", isPaid: false, groupId: "credit-entry-ghost", month: 6, year: 2026 },
    ]);
    const res = await GET(cronReq("s3cr3t"));
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.usersWithDivergence).toBe(1);
    expect(body.totalDivergences).toBe(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe("RECONCILE_ALERT");
    expect(data.userId).toBe("u1");
  });
});
