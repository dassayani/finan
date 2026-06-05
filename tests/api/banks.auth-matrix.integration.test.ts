import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSessionMock, prismaMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  prismaMock: {
    customBank: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    customBankFee: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    customBankBalance: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GET as getBankBalances, POST as postBankBalances } from "@/app/api/bank-balances/route";
import { DELETE as deleteBankBalanceById } from "@/app/api/bank-balances/[id]/route";
import { GET as getBankEntries, POST as postBankEntries, DELETE as deleteBankEntries } from "@/app/api/bank-entries/route";
import { DELETE as deleteBankEntryById } from "@/app/api/bank-entries/[id]/route";
import { GET as getBankFees, POST as postBankFees } from "@/app/api/bank-fees/route";
import { PUT as putBankFeeById, DELETE as deleteBankFeeById } from "@/app/api/bank-fees/[id]/route";
import { GET as getBankConfigs, PUT as putBankConfigs } from "@/app/api/bank-configs/route";
import { GET as getCustomBanks, POST as postCustomBanks } from "@/app/api/custom-banks/route";
import { PATCH as patchCustomBankById, DELETE as deleteCustomBankById } from "@/app/api/custom-banks/[id]/route";
import { GET as getCustomBankFees, POST as postCustomBankFees } from "@/app/api/custom-bank-fees/route";
import { DELETE as deleteCustomBankFeeById } from "@/app/api/custom-bank-fees/[id]/route";
import { GET as getCustomBankBalances, POST as postCustomBankBalances } from "@/app/api/custom-bank-balances/route";
import { DELETE as deleteCustomBankBalanceById } from "@/app/api/custom-bank-balances/[id]/route";
import { GET as getBankClosingBalance } from "@/app/api/bank-closing-balance/route";

function jsonRequest(url: string, body: unknown, method: string) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Banks auth matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for all bank endpoints when session is missing", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const calls: Array<Promise<Response>> = [
      getBankBalances(new Request("http://localhost/api/bank-balances") as never),
      postBankBalances(jsonRequest("http://localhost/api/bank-balances", { bank: "nubank", month: 6, year: 2026, balance: 10 }, "POST") as never),
      deleteBankBalanceById(new Request("http://localhost/api/bank-balances/1", { method: "DELETE" }) as never, { params: Promise.resolve({ id: "1" }) }),

      getBankEntries(new Request("http://localhost/api/bank-entries") as never),
      postBankEntries(jsonRequest("http://localhost/api/bank-entries", { bank: "nubank", month: 6, year: 2026, description: "x", amount: 10, type: "INCOME" }, "POST") as never),
      deleteBankEntries(new Request("http://localhost/api/bank-entries?groupId=grp", { method: "DELETE" }) as never),
      deleteBankEntryById(new Request("http://localhost/api/bank-entries/1", { method: "DELETE" }) as never, { params: Promise.resolve({ id: "1" }) }),

      getBankFees(),
      postBankFees(jsonRequest("http://localhost/api/bank-fees", { bank: "nubank", name: "f", amount: 1 }, "POST") as never),
      putBankFeeById(jsonRequest("http://localhost/api/bank-fees/1", { active: true }, "PUT") as never, { params: Promise.resolve({ id: "1" }) }),
      deleteBankFeeById(new Request("http://localhost/api/bank-fees/1", { method: "DELETE" }) as never, { params: Promise.resolve({ id: "1" }) }),

      getBankConfigs(),
      putBankConfigs(jsonRequest("http://localhost/api/bank-configs", { bank: "nubank" }, "PUT") as never),

      getCustomBanks(),
      postCustomBanks(jsonRequest("http://localhost/api/custom-banks", { name: "Meu", short: "ME", color: "#000000" }, "POST") as never),
      patchCustomBankById(jsonRequest("http://localhost/api/custom-banks/1", { name: "x" }, "PATCH") as never, { params: Promise.resolve({ id: "1" }) }),
      deleteCustomBankById(new Request("http://localhost/api/custom-banks/1", { method: "DELETE" }) as never, { params: Promise.resolve({ id: "1" }) }),

      getCustomBankFees(new Request("http://localhost/api/custom-bank-fees") as never),
      postCustomBankFees(jsonRequest("http://localhost/api/custom-bank-fees", { customBankId: "c1", name: "f", amount: 1 }, "POST") as never),
      deleteCustomBankFeeById(new Request("http://localhost/api/custom-bank-fees/1", { method: "DELETE" }) as never, { params: Promise.resolve({ id: "1" }) }),

      getCustomBankBalances(new Request("http://localhost/api/custom-bank-balances") as never),
      postCustomBankBalances(jsonRequest("http://localhost/api/custom-bank-balances", { customBankId: "c1", month: 6, year: 2026, balance: 10 }, "POST") as never),
      deleteCustomBankBalanceById(new Request("http://localhost/api/custom-bank-balances/1", { method: "DELETE" }) as never, { params: Promise.resolve({ id: "1" }) }),

      getBankClosingBalance(new Request("http://localhost/api/bank-closing-balance?month=6&year=2026") as never),
    ];

    const responses = await Promise.all(calls);
    responses.forEach(res => expect(res.status).toBe(401));
  });

  it("returns 403 when custom bank ownership does not match", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    prismaMock.customBank.findUnique.mockResolvedValue({ userId: "other-user" });
    const postFeeRes = await postCustomBankFees(
      jsonRequest("http://localhost/api/custom-bank-fees", { customBankId: "c1", name: "Tarifa", amount: 1 }, "POST") as never,
    );
    expect(postFeeRes.status).toBe(403);

    const postBalanceRes = await postCustomBankBalances(
      jsonRequest("http://localhost/api/custom-bank-balances", { customBankId: "c1", month: 6, year: 2026, balance: 10 }, "POST") as never,
    );
    expect(postBalanceRes.status).toBe(403);

    prismaMock.customBankFee.findUnique.mockResolvedValue({ customBank: { userId: "other-user" } });
    const delFeeRes = await deleteCustomBankFeeById(
      new Request("http://localhost/api/custom-bank-fees/1", { method: "DELETE" }) as never,
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(delFeeRes.status).toBe(403);

    prismaMock.customBankBalance.findUnique.mockResolvedValue({ customBank: { userId: "other-user" } });
    const delBalanceRes = await deleteCustomBankBalanceById(
      new Request("http://localhost/api/custom-bank-balances/1", { method: "DELETE" }) as never,
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(delBalanceRes.status).toBe(403);
  });
});
