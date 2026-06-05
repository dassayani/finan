import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runRealDb = process.env.RUN_REAL_DB_TESTS === "1";
if (process.env.TEST_DIRECT_URL) {
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL;
}

const describeRealDb = runRealDb ? describe : describe.skip;

const { getServerSessionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { prisma } from "@/lib/prisma";
import { GET as getBankClosingBalance } from "@/app/api/bank-closing-balance/route";

describeRealDb("Bank closing balance real-db integration", () => {
  let userId = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const user = await prisma.user.create({
      data: {
        email: `bank-tests-${stamp}@example.com`,
        name: "Bank Tests",
      },
    });

    userId = user.id;
    getServerSessionMock.mockResolvedValue({ user: { id: userId } });
  });

  afterEach(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
      userId = "";
    }
  });

  it("counts only active fees once in monthly closing", async () => {
    const month = 6;
    const year = 2026;

    await prisma.bankBalance.create({
      data: {
        userId,
        bank: "nubank",
        month,
        year,
        balance: 1000,
      },
    });

    await prisma.bankEntry.createMany({
      data: [
        {
          userId,
          bank: "nubank",
          month,
          year,
          description: "Entrada",
          amount: 100,
          type: "INCOME",
        },
        {
          userId,
          bank: "nubank",
          month,
          year,
          description: "Saída",
          amount: 40,
          type: "EXPENSE",
        },
      ],
    });

    await prisma.bankFee.createMany({
      data: [
        { userId, bank: "nubank", name: "Tarifa ativa", amount: 10, active: true, billingDay: 30 },
        { userId, bank: "nubank", name: "Tarifa inativa", amount: 999, active: false, billingDay: 30 },
      ],
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId,
          description: "Pagamento fatura",
          amount: 20,
          type: "EXPENSE",
          expenseType: "BANK_BILL",
          bank: "nubank",
          date: new Date(Date.UTC(year, month - 1, 10)),
          isPaid: true,
        },
        {
          userId,
          description: "Estorno pago",
          amount: 5,
          type: "INCOME",
          expenseType: "BANK_BILL",
          bank: "nubank",
          date: new Date(Date.UTC(year, month - 1, 11)),
          isPaid: true,
        },
      ],
    });

    const req = new Request(`http://localhost/api/bank-closing-balance?month=${month}&year=${year}`);
    const res = await getBankClosingBalance(req as never);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.nubank).toBe(1035);
  });

  it("returns null for a month without activity between active months and preserves continuity when next month has activity", async () => {
    const monthA = 5;
    const monthB = 6;
    const monthC = 7;
    const year = 2026;

    await prisma.bankBalance.create({
      data: { userId, bank: "nubank", month: monthA, year, balance: 1000 },
    });

    await prisma.bankEntry.create({
      data: {
        userId,
        bank: "nubank",
        month: monthA,
        year,
        description: "Saida maio",
        amount: 100,
        type: "EXPENSE",
      },
    });

    // Junho sem qualquer atividade deve resultar em null (frontend decide carry-forward)
    const reqB = new Request(`http://localhost/api/bank-closing-balance?month=${monthB}&year=${year}`);
    const resB = await getBankClosingBalance(reqB as never);
    const payloadB = await resB.json();
    expect(resB.status).toBe(200);
    expect(payloadB.nubank).toBeNull();

    // Julho com atividade volta a calcular normalmente a partir do balance do próprio mês
    await prisma.bankBalance.create({
      data: { userId, bank: "nubank", month: monthC, year, balance: 900 },
    });
    await prisma.bankEntry.create({
      data: {
        userId,
        bank: "nubank",
        month: monthC,
        year,
        description: "Entrada julho",
        amount: 50,
        type: "INCOME",
      },
    });

    const reqC = new Request(`http://localhost/api/bank-closing-balance?month=${monthC}&year=${year}`);
    const resC = await getBankClosingBalance(reqC as never);
    const payloadC = await resC.json();
    expect(resC.status).toBe(200);
    expect(payloadC.nubank).toBe(950);
  });

  it("treats active monthly fees as activity for closing", async () => {
    const month = 8;
    const year = 2026;

    await prisma.bankFee.create({
      data: {
        userId,
        bank: "itau",
        name: "Manutencao",
        amount: 25,
        active: true,
        billingDay: 10,
      },
    });

    const req = new Request(`http://localhost/api/bank-closing-balance?month=${month}&year=${year}`);
    const res = await getBankClosingBalance(req as never);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.itau).toBe(-25);
  });
});
