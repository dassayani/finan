import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    investment: {
      findMany:   vi.fn(),
      findFirst:  vi.fn(),
      create:     vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    investmentSnapshot: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth",    () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",   () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { PUT, DELETE } from "@/app/api/investments/[id]/route";
import { POST } from "@/app/api/investments/route";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/investments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
});

describe("investments — auth", () => {
  it("POST returns 401 unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await POST(jsonReq({ name: "X", type: "cdb", value: 100 }));
    expect(res.status).toBe(401);
  });
  it("PUT returns 401 unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await PUT(jsonReq({ value: 1 }), ctx("inv-1"));
    expect(res.status).toBe(401);
  });
});

describe("investments PUT — mass-assignment hardening", () => {
  it("rejects unknown/forbidden fields implicitly (only whitelisted persisted)", async () => {
    prismaMock.investment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.investment.findFirst.mockResolvedValue({ id: "inv-1" });
    await PUT(jsonReq({ value: 200, userId: "attacker", id: "other" }), ctx("inv-1"));
    const data = prismaMock.investment.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("userId");
    expect(data).not.toHaveProperty("id");
    expect(data.value).toBe(200);
  });

  it("rejects invalid institution", async () => {
    const res = await PUT(jsonReq({ institution: "banco-pirata" }), ctx("inv-1"));
    expect(res.status).toBe(400);
  });

  it("rejects non-positive value", async () => {
    const res = await PUT(jsonReq({ value: -5 }), ctx("inv-1"));
    expect(res.status).toBe(400);
  });

  it("scopes update by userId and returns 404 when not owned", async () => {
    prismaMock.investment.updateMany.mockResolvedValue({ count: 0 });
    const res = await PUT(jsonReq({ value: 10 }), ctx("inv-someone-else"));
    expect(res.status).toBe(404);
    expect(prismaMock.investment.updateMany.mock.calls[0][0].where).toEqual({ id: "inv-someone-else", userId: "user-1" });
  });

  it("records a value-change snapshot when the value changes", async () => {
    prismaMock.investment.findFirst.mockResolvedValue({ value: "1000" });
    prismaMock.investment.updateMany.mockResolvedValue({ count: 1 });
    await PUT(jsonReq({ value: 1200 }), ctx("inv-1"));
    expect(prismaMock.investmentSnapshot.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.investmentSnapshot.create.mock.calls[0][0].data).toMatchObject({ investmentId: "inv-1", userId: "user-1", value: 1200 });
  });

  it("does NOT snapshot when the value is unchanged", async () => {
    prismaMock.investment.findFirst.mockResolvedValue({ value: "1000" });
    prismaMock.investment.updateMany.mockResolvedValue({ count: 1 });
    await PUT(jsonReq({ value: 1000, name: "novo nome" }), ctx("inv-1"));
    expect(prismaMock.investmentSnapshot.create).not.toHaveBeenCalled();
  });
});

describe("investments DELETE", () => {
  it("returns 404 when nothing was deleted (not owned)", async () => {
    prismaMock.investment.deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(jsonReq({}), ctx("inv-x"));
    expect(res.status).toBe(404);
  });
  it("returns 204 on success and scopes by userId", async () => {
    prismaMock.investment.deleteMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(jsonReq({}), ctx("inv-1"));
    expect(res.status).toBe(204);
    expect(prismaMock.investment.deleteMany.mock.calls[0][0].where).toEqual({ id: "inv-1", userId: "user-1" });
  });
});

describe("investments POST — validation", () => {
  it("rejects invalid institution", async () => {
    const res = await POST(jsonReq({ name: "X", type: "cdb", value: 100, institution: "xpto" }));
    expect(res.status).toBe(400);
  });
  it("creates with valid payload", async () => {
    prismaMock.investment.create.mockResolvedValue({ id: "inv-1" });
    const res = await POST(jsonReq({ name: "Tesouro", type: "tesouro", value: 1000, institution: "nubank" }));
    expect(res.status).toBe(201);
    expect(prismaMock.investment.create.mock.calls[0][0].data.userId).toBe("user-1");
  });

  it("defaults costBasis to value and creates an initial snapshot", async () => {
    prismaMock.investment.create.mockResolvedValue({ id: "inv-1" });
    await POST(jsonReq({ name: "Tesouro", type: "Renda Fixa", value: 1000 }));
    const data = prismaMock.investment.create.mock.calls[0][0].data;
    expect(data.costBasis).toBe(1000);
    expect(data.snapshots.create).toMatchObject({ userId: "user-1", value: 1000 });
  });

  it("keeps an explicit costBasis distinct from value", async () => {
    prismaMock.investment.create.mockResolvedValue({ id: "inv-1" });
    await POST(jsonReq({ name: "FII", type: "FII", value: 1200, costBasis: 1000 }));
    expect(prismaMock.investment.create.mock.calls[0][0].data.costBasis).toBe(1000);
  });

  it("records a CREATE audit entry", async () => {
    prismaMock.investment.create.mockResolvedValue({ id: "inv-1" });
    await POST(jsonReq({ name: "Tesouro", type: "tesouro", value: 1000 }));
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "CREATE", entity: "investment", userId: "user-1" });
  });

  it("records a DELETE audit entry with the before-state", async () => {
    prismaMock.investment.findFirst.mockResolvedValue({ name: "X", type: "cdb", value: "500", institution: "itau" });
    prismaMock.investment.deleteMany.mockResolvedValue({ count: 1 });
    await DELETE(jsonReq({}), ctx("inv-1"));
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ action: "DELETE", entity: "investment", entityId: "inv-1" });
    expect(data.before.value).toBe(500);
  });
});
