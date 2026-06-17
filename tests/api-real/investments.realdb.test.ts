import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runRealDb = process.env.RUN_REAL_DB_TESTS === "1";
if (process.env.TEST_DIRECT_URL) {
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL;
}

const describeRealDb = runRealDb ? describe : describe.skip;

const { getServerSessionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/investments/route";
import { PUT, DELETE } from "@/app/api/investments/[id]/route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/investments", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  });
}
function putReq(body: unknown) {
  return new NextRequest("http://localhost/api/investments/x", {
    method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describeRealDb("Investments real-db integration", () => {
  let userId = "";
  let otherUserId = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const user = await prisma.user.create({ data: { email: `inv-${stamp}@example.com`, name: "Inv Tests" } });
    const other = await prisma.user.create({ data: { email: `inv-other-${stamp}@example.com`, name: "Other" } });
    userId = user.id;
    otherUserId = other.id;
    getServerSessionMock.mockResolvedValue({ user: { id: userId } });
  });

  afterEach(async () => {
    if (userId)      { await prisma.user.delete({ where: { id: userId } }).catch(() => {});      userId = ""; }
    if (otherUserId) { await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {}); otherUserId = ""; }
  });

  // ── Positivo ────────────────────────────────────────────────────────────────

  it("POST creates an investment, defaults costBasis to value and an initial snapshot", async () => {
    const res = await POST(postReq({ name: "Tesouro Selic", type: "Renda Fixa", value: 1000, institution: "nubank" }));
    expect(res.status).toBe(201);
    const body = await res.json();

    // Decimal NUNCA pode vazar: os campos devem ser number puro
    expect(typeof body.value).toBe("number");
    expect(typeof body.costBasis).toBe("number");
    expect(body.value).toBe(1000);
    expect(body.costBasis).toBe(1000);

    const snaps = await prisma.investmentSnapshot.count({ where: { investmentId: body.id } });
    expect(snaps).toBe(1);
  });

  it("GET returns serialized numbers and the snapshot list (the query that broke before)", async () => {
    await POST(postReq({ name: "FII XPLG", type: "FII", value: 1200, costBasis: 1000, returnRate: 0.08 }));

    const res = await GET();
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);

    const inv = list[0];
    expect(typeof inv.value).toBe("number");
    expect(typeof inv.returnRate).toBe("number");
    expect(inv.costBasis).toBe(1000);
    expect(Array.isArray(inv.snapshots)).toBe(true);
    expect(inv.snapshots).toHaveLength(1);
    expect(typeof inv.snapshots[0].value).toBe("number");
    // ganho real derivável: 1200 - 1000 = 200
    expect(inv.value - inv.costBasis).toBe(200);
  });

  it("PUT with a new value appends a snapshot and updates the value", async () => {
    const created = await (await POST(postReq({ name: "Ação", type: "Ações", value: 500 }))).json();

    const res = await PUT(putReq({ value: 650 }), ctx(created.id));
    expect(res.status).toBe(200);

    const snaps = await prisma.investmentSnapshot.findMany({ where: { investmentId: created.id }, orderBy: { date: "asc" } });
    expect(snaps).toHaveLength(2);
    expect(Number(snaps[1].value)).toBe(650);

    const fresh = await prisma.investment.findUnique({ where: { id: created.id } });
    expect(Number(fresh!.value)).toBe(650);
  });

  it("DELETE removes the investment and cascades its snapshots", async () => {
    const created = await (await POST(postReq({ name: "Cripto", type: "Cripto", value: 300 }))).json();
    expect(await prisma.investmentSnapshot.count({ where: { investmentId: created.id } })).toBe(1);

    const res = await DELETE(putReq({}), ctx(created.id));
    expect(res.status).toBe(204);

    expect(await prisma.investment.count({ where: { id: created.id } })).toBe(0);
    expect(await prisma.investmentSnapshot.count({ where: { investmentId: created.id } })).toBe(0);
  });

  // ── Negativo ────────────────────────────────────────────────────────────────

  it("GET returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST rejects an invalid institution (400) and persists nothing", async () => {
    const res = await POST(postReq({ name: "X", type: "Outro", value: 10, institution: "banco-pirata" }));
    expect(res.status).toBe(400);
    expect(await prisma.investment.count({ where: { userId } })).toBe(0);
  });

  it("PUT with an unchanged value does NOT append a snapshot", async () => {
    const created = await (await POST(postReq({ name: "CDB", type: "Renda Fixa", value: 800 }))).json();
    const res = await PUT(putReq({ value: 800, name: "CDB renomeado" }), ctx(created.id));
    expect(res.status).toBe(200);
    expect(await prisma.investmentSnapshot.count({ where: { investmentId: created.id } })).toBe(1);
  });

  it("PUT on another user's investment returns 404 and does not touch it", async () => {
    const foreign = await prisma.investment.create({
      data: { userId: otherUserId, name: "Alheio", type: "Outro", value: 999, costBasis: 999 },
    });
    const res = await PUT(putReq({ value: 1 }), ctx(foreign.id));
    expect(res.status).toBe(404);

    const fresh = await prisma.investment.findUnique({ where: { id: foreign.id } });
    expect(Number(fresh!.value)).toBe(999);
  });
});
