import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    subscription: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    transaction:  { deleteMany: vi.fn(), findMany: vi.fn() },
    auditLog:     { create: vi.fn() },
  },
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth",    () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",   () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/subscriptions/route";
import { DELETE } from "@/app/api/subscriptions/[id]/route";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/subscriptions", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  prismaMock.transaction.findMany.mockResolvedValue([]);
});

describe("subscriptions audit", () => {
  it("records CREATE on POST (sem banco → sem geração de fatura)", async () => {
    prismaMock.subscription.create.mockResolvedValue({
      id: "sub-1", name: "Netflix", total: 55, bank: null, customBankId: null, members: [],
    });
    const res = await POST(jsonReq({
      name: "Netflix", total: 55,
      members: [{ name: "Eu", share: 55, isOwner: true }],
    }));
    expect(res.status).toBe(201);
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "CREATE", entity: "subscription", entityId: "sub-1", userId: "user-1" });
  });

  it("records DELETE with before-state", async () => {
    prismaMock.subscription.findFirst.mockResolvedValue({ name: "Netflix", total: "55", bank: "nubank", customBankId: null });
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.subscription.delete.mockResolvedValue({ id: "sub-1" });
    const res = await DELETE(jsonReq({}), ctx("sub-1"));
    expect(res.status).toBe(204);
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ action: "DELETE", entity: "subscription", entityId: "sub-1" });
    expect(data.before.total).toBe(55);
  });
});
