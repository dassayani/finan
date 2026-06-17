import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runRealDb = process.env.RUN_REAL_DB_TESTS === "1";
if (process.env.TEST_DIRECT_URL) {
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL;
}

const describeRealDb = runRealDb ? describe : describe.skip;

const { getServerSessionMock } = vi.hoisted(() => ({ getServerSessionMock: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { prisma } from "@/lib/prisma";
import { DELETE } from "@/app/api/bank-entries/route";

const delReq = (qs: string) =>
  new NextRequest(`http://localhost/api/bank-entries?${qs}`, { method: "DELETE" });

describeRealDb("bank-entries DELETE by groupId (+ optional month/year) real-db", () => {
  let userId = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const user = await prisma.user.create({ data: { email: `be-del-${stamp}@example.com`, name: "BE Del" } });
    userId = user.id;
    getServerSessionMock.mockResolvedValue({ user: { id: userId } });

    // Recorrência: 3 meses, mesmo groupId
    await prisma.bankEntry.createMany({
      data: [
        { userId, bank: "nubank", month: 6, year: 2026, description: "Internet", amount: 100, type: "EXPENSE", groupId: "grp-x" },
        { userId, bank: "nubank", month: 7, year: 2026, description: "Internet", amount: 100, type: "EXPENSE", groupId: "grp-x" },
        { userId, bank: "nubank", month: 8, year: 2026, description: "Internet", amount: 100, type: "EXPENSE", groupId: "grp-x" },
      ],
    });
  });

  afterEach(async () => {
    if (userId) { await prisma.user.delete({ where: { id: userId } }).catch(() => {}); userId = ""; }
  });

  it("deletes ONLY the given month when month+year are provided", async () => {
    const res = await DELETE(delReq("groupId=grp-x&month=7&year=2026"));
    expect(res.status).toBe(204);

    const left = await prisma.bankEntry.findMany({ where: { userId, groupId: "grp-x" }, orderBy: { month: "asc" } });
    expect(left.map(e => e.month)).toEqual([6, 8]);
  });

  it("deletes the WHOLE group when only groupId is provided", async () => {
    const res = await DELETE(delReq("groupId=grp-x"));
    expect(res.status).toBe(204);

    const left = await prisma.bankEntry.count({ where: { userId, groupId: "grp-x" } });
    expect(left).toBe(0);
  });

  it("does not touch another user's entries with the same groupId", async () => {
    const other = await prisma.user.create({ data: { email: `be-other-${Date.now()}@example.com`, name: "Other" } });
    await prisma.bankEntry.create({
      data: { userId: other.id, bank: "itau", month: 7, year: 2026, description: "Internet", amount: 100, type: "EXPENSE", groupId: "grp-x" },
    });

    await DELETE(delReq("groupId=grp-x")); // session = userId, not other
    const otherLeft = await prisma.bankEntry.count({ where: { userId: other.id, groupId: "grp-x" } });
    expect(otherLeft).toBe(1);

    await prisma.user.delete({ where: { id: other.id } }).catch(() => {});
  });
});
