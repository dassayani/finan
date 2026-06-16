import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Teste de FLUXO financeiro ponta a ponta (Nível 8).
 * Cobre o ciclo de uma receita com banco: criar → pagar → estornar → excluir,
 * verificando que os dois ledgers (Transaction + BankEntry espelho) permanecem
 * consistentes em cada etapa. Usa um "banco" em memória sobre os mocks do Prisma
 * para que as operações realmente reflitam umas nas outras.
 */

const { prismaMock, getServerSessionMock } = vi.hoisted(() => {
  // Tabelas em memória
  const txs: any[] = [];
  const bes: any[] = [];
  let seq = 0;

  const transaction = {
    create: vi.fn(async ({ data }: any) => { const row = { id: `tx-${++seq}`, ...data }; txs.push(row); return row; }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const t of txs) if (matches(t, where)) { Object.assign(t, data); count++; }
      return { count };
    }),
    deleteMany: vi.fn(async ({ where }: any) => {
      let count = 0;
      for (let i = txs.length - 1; i >= 0; i--) if (matches(txs[i], where)) { txs.splice(i, 1); count++; }
      return { count };
    }),
    findFirst: vi.fn(async ({ where }: any) => txs.find(t => matches(t, where)) ?? null),
    findMany: vi.fn(async ({ where }: any) => txs.filter(t => matches(t, where))),
  };
  const bankEntry = {
    create: vi.fn(async ({ data }: any) => { const row = { id: `be-${++seq}`, ...data }; bes.push(row); return row; }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const e of bes) if (matches(e, where)) { Object.assign(e, data); count++; }
      return { count };
    }),
    deleteMany: vi.fn(async ({ where }: any) => {
      let count = 0;
      for (let i = bes.length - 1; i >= 0; i--) if (matches(bes[i], where)) { bes.splice(i, 1); count++; }
      return { count };
    }),
    findFirst: vi.fn(async ({ where }: any) => bes.find(e => matches(e, where)) ?? null),
    findMany: vi.fn(async ({ where }: any) => bes.filter(e => matches(e, where))),
  };

  // matcher simplificado: igualdade de campos escalares presentes no where
  function matches(row: any, where: any): boolean {
    for (const [k, v] of Object.entries(where ?? {})) {
      if (v === null || typeof v !== "object") { if (row[k] !== v) return false; }
      // ignora filtros complexos (date ranges) — não usados neste fluxo
    }
    return true;
  }

  const prismaMock: any = {
    transaction, bankEntry,
    customBank: { findUnique: vi.fn() },
    subscriptionMember: { findFirst: vi.fn() },
    subscriptionPayment: { upsert: vi.fn(), deleteMany: vi.fn() },
    loanPayment: { upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(prismaMock)),
    __txs: txs, __bes: bes, __reset: () => { txs.length = 0; bes.length = 0; seq = 0; },
  };

  return { prismaMock, getServerSessionMock: vi.fn() };
});

vi.mock("next-auth",    () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth",   () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST as createCredit } from "@/app/api/credits/route";
import { DELETE as deleteCredit } from "@/app/api/credits/[id]/route";
import { PATCH as patchTx } from "@/app/api/transactions/[id]/route";
import { reconcile } from "@/lib/finance/reconcile";

function req(body: unknown) {
  return new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const reconcileNow = () => reconcile(
  prismaMock.__txs.map((t: any) => ({ id: t.id, amount: Number(t.amount), isPaid: !!t.isPaid, groupId: t.groupId ?? null, date: t.date })),
  prismaMock.__bes.map((e: any) => ({ id: e.id, amount: Number(e.amount), isPaid: !!e.isPaid, groupId: e.groupId ?? null, month: e.month, year: e.year })),
);

beforeEach(() => {
  prismaMock.__reset();
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });
});

describe("Fluxo financeiro ponta a ponta — receita com banco", () => {
  it("criar → pagar → estornar → excluir mantém os dois ledgers reconciliados", async () => {
    // CRIAR
    const createRes = await createCredit(req({
      description: "Aluguel recebido", amount: 1000, category: "aluguel_rec",
      date: "2026-06-10", bank: "nubank", isPaid: false,
    }));
    expect(createRes.status).toBe(201);
    expect(prismaMock.__txs).toHaveLength(1);
    expect(prismaMock.__bes).toHaveLength(1);
    const txId = prismaMock.__txs[0].id;
    expect(prismaMock.__bes[0].groupId).toBe(`credit-entry-${txId}`);
    expect(reconcileNow()).toEqual([]); // consistente após criar

    // PAGAR (PATCH na transação espelha para o BankEntry)
    const payRes = await patchTx(req({ isPaid: true }), ctx(txId));
    expect(payRes.status).toBe(200);
    expect(prismaMock.__txs[0].isPaid).toBe(true);
    expect(prismaMock.__bes[0].isPaid).toBe(true); // espelho sincronizado
    expect(reconcileNow()).toEqual([]); // consistente após pagar

    // ESTORNAR (desmarcar pagamento)
    const unpayRes = await patchTx(req({ isPaid: false }), ctx(txId));
    expect(unpayRes.status).toBe(200);
    expect(prismaMock.__txs[0].isPaid).toBe(false);
    expect(prismaMock.__bes[0].isPaid).toBe(false);
    expect(reconcileNow()).toEqual([]); // consistente após estornar

    // EXCLUIR (remove transação + espelho atomicamente)
    const delRes = await deleteCredit(req({}), ctx(txId));
    expect(delRes.status).toBe(204);
    expect(prismaMock.__txs).toHaveLength(0);
    expect(prismaMock.__bes).toHaveLength(0); // sem órfão
    expect(reconcileNow()).toEqual([]); // nada pendente
  });

  it("receita SEM banco não cria espelho e permanece reconciliada", async () => {
    const res = await createCredit(req({ description: "Freela", amount: 500, category: "freelance", date: "2026-06-01" }));
    expect(res.status).toBe(201);
    expect(prismaMock.__txs).toHaveLength(1);
    expect(prismaMock.__bes).toHaveLength(0);
    expect(reconcileNow()).toEqual([]);
  });
});
