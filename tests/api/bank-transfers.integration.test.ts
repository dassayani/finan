import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    bankEntry:  { create: vi.fn(), deleteMany: vi.fn() },
    customBank: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth",    () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",   () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST, DELETE } from "@/app/api/bank-transfers/route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/bank-transfers", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  });
}
function deleteReq(groupId?: string) {
  const url = groupId
    ? `http://localhost/api/bank-transfers?groupId=${encodeURIComponent(groupId)}`
    : "http://localhost/api/bank-transfers";
  return new NextRequest(url, { method: "DELETE" });
}

const validBody = {
  sourceBank: "nubank", sourceCustomBankId: null, sourceName: "Nubank",
  destBank: "itau", destCustomBankId: null, destName: "Itaú",
  amount: 500, description: "PIX", month: 6, year: 2026,
};

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock));
  prismaMock.bankEntry.create.mockResolvedValue({ id: "be-x" });
  prismaMock.bankEntry.deleteMany.mockResolvedValue({ count: 2 });
  prismaMock.customBank.findMany.mockResolvedValue([]);
});

describe("POST /api/bank-transfers — dual-entry transfer", () => {
  it("401 unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
  });

  it("creates EXPENSE at source + INCOME at destination atomically", async () => {
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.bankEntry.create).toHaveBeenCalledTimes(2);

    const first  = prismaMock.bankEntry.create.mock.calls[0][0].data;
    const second = prismaMock.bankEntry.create.mock.calls[1][0].data;

    // Saída na origem
    expect(first.bank).toBe("nubank");
    expect(first.type).toBe("EXPENSE");
    expect(first.description).toBe("PIX → Itaú");
    // Entrada no destino
    expect(second.bank).toBe("itau");
    expect(second.type).toBe("INCOME");
    expect(second.description).toBe("PIX ← Nubank");
  });

  it("both sides share the same transfer- groupId and are marked paid", async () => {
    await POST(postReq(validBody));
    const first  = prismaMock.bankEntry.create.mock.calls[0][0].data;
    const second = prismaMock.bankEntry.create.mock.calls[1][0].data;

    expect(first.groupId).toBe(second.groupId);
    expect(first.groupId).toMatch(/^transfer-/);
    expect(first.isPaid).toBe(true);
    expect(second.isPaid).toBe(true);
    expect(first.category).toBeNull();
    expect(second.category).toBeNull();
  });

  it("defaults the label to 'Transferência' when no description given", async () => {
    await POST(postReq({ ...validBody, description: undefined }));
    const first = prismaMock.bankEntry.create.mock.calls[0][0].data;
    expect(first.description).toBe("Transferência → Itaú");
  });

  it("propagates month/year to both entries", async () => {
    await POST(postReq({ ...validBody, month: 3, year: 2027 }));
    for (const call of prismaMock.bankEntry.create.mock.calls) {
      expect(call[0].data.month).toBe(3);
      expect(call[0].data.year).toBe(2027);
    }
  });

  it("rejects an invalid standard bank", async () => {
    const res = await POST(postReq({ ...validBody, sourceBank: "pirata" }));
    expect(res.status).toBe(400);
    expect(prismaMock.bankEntry.create).not.toHaveBeenCalled();
  });

  it("rejects same source and destination", async () => {
    const res = await POST(postReq({ ...validBody, destBank: "nubank", destName: "Nubank" }));
    expect(res.status).toBe(400);
    expect(prismaMock.bankEntry.create).not.toHaveBeenCalled();
  });

  it("rejects a side with both bank and customBankId", async () => {
    const res = await POST(postReq({ ...validBody, sourceCustomBankId: "cb1" }));
    expect(res.status).toBe(400);
  });

  it("rejects a side with neither bank nor customBankId", async () => {
    const res = await POST(postReq({ ...validBody, sourceBank: null }));
    expect(res.status).toBe(400);
  });

  it("rejects non-positive amount", async () => {
    const res = await POST(postReq({ ...validBody, amount: 0 }));
    expect(res.status).toBe(400);
  });

  it("403 when a custom bank belongs to another user", async () => {
    // Only one of the two custom ids comes back as owned
    prismaMock.customBank.findMany.mockResolvedValue([{ id: "cb-mine" }]);
    const res = await POST(postReq({
      ...validBody,
      sourceBank: null, sourceCustomBankId: "cb-mine", sourceName: "Minha",
      destBank: null, destCustomBankId: "cb-other", destName: "Alheia",
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.bankEntry.create).not.toHaveBeenCalled();
  });

  it("allows a transfer between two owned custom banks", async () => {
    prismaMock.customBank.findMany.mockResolvedValue([{ id: "cb-a" }, { id: "cb-b" }]);
    const res = await POST(postReq({
      ...validBody,
      sourceBank: null, sourceCustomBankId: "cb-a", sourceName: "A",
      destBank: null, destCustomBankId: "cb-b", destName: "B",
    }));
    expect(res.status).toBe(201);
    const first = prismaMock.bankEntry.create.mock.calls[0][0].data;
    expect(first.customBankId).toBe("cb-a");
    expect(first.bank).toBeNull();
  });
});

describe("DELETE /api/bank-transfers — removes both sides", () => {
  it("401 unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await DELETE(deleteReq("transfer-123-abcdef"));
    expect(res.status).toBe(401);
  });

  it("400 when groupId is missing", async () => {
    const res = await DELETE(deleteReq());
    expect(res.status).toBe(400);
    expect(prismaMock.bankEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("400 when groupId is not a transfer id", async () => {
    const res = await DELETE(deleteReq("credit-entry-xyz"));
    expect(res.status).toBe(400);
    expect(prismaMock.bankEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes both entries scoped to the user and groupId", async () => {
    const res = await DELETE(deleteReq("transfer-123-abcdef"));
    expect(res.status).toBe(204);
    expect(prismaMock.bankEntry.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", groupId: "transfer-123-abcdef" },
    });
  });
});
