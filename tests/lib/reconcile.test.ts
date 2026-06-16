import { describe, it, expect } from "vitest";
import { reconcile, type ReconTransaction, type ReconBankEntry } from "@/lib/finance/reconcile";

const tx = (over: Partial<ReconTransaction>): ReconTransaction => ({
  id: "tx-1", amount: 100, isPaid: false, groupId: null, date: "2026-06-10", ...over,
});
const be = (over: Partial<ReconBankEntry>): ReconBankEntry => ({
  id: "be-1", amount: 100, isPaid: false, groupId: null, month: 6, year: 2026, ...over,
});

describe("reconcile", () => {
  it("returns no divergences when everything matches (credit-entry)", () => {
    const txs = [tx({ id: "tx-1", amount: 1000, isPaid: true })];
    const bes = [be({ id: "be-1", amount: 1000, isPaid: true, groupId: "credit-entry-tx-1" })];
    expect(reconcile(txs, bes)).toEqual([]);
  });

  it("ignores manual bank entries (no mirror groupId)", () => {
    const bes = [be({ groupId: null }), be({ id: "be-2", groupId: "casa-manual" })];
    expect(reconcile([], bes)).toEqual([]);
  });

  it("ignores sub-entry (mirrors SubscriptionPayment, not Transaction)", () => {
    const bes = [be({ groupId: "sub-entry-s1-m1-6-2026" })];
    expect(reconcile([], bes)).toEqual([]);
  });

  it("flags ORPHAN_MIRROR when the Transaction is missing", () => {
    const bes = [be({ id: "be-x", groupId: "credit-entry-ghost" })];
    const d = reconcile([], bes);
    expect(d).toHaveLength(1);
    expect(d[0].type).toBe("ORPHAN_MIRROR");
    expect(d[0].bankEntryId).toBe("be-x");
  });

  it("flags AMOUNT_MISMATCH", () => {
    const txs = [tx({ id: "tx-1", amount: 1000 })];
    const bes = [be({ groupId: "credit-entry-tx-1", amount: 900 })];
    const d = reconcile(txs, bes);
    expect(d).toHaveLength(1);
    expect(d[0].type).toBe("AMOUNT_MISMATCH");
  });

  it("flags PAID_DESYNC", () => {
    const txs = [tx({ id: "tx-1", amount: 1000, isPaid: false })];
    const bes = [be({ groupId: "credit-entry-tx-1", amount: 1000, isPaid: true })];
    const d = reconcile(txs, bes);
    expect(d).toHaveLength(1);
    expect(d[0].type).toBe("PAID_DESYNC");
  });

  it("tolerates sub-cent Decimal→number drift", () => {
    const txs = [tx({ id: "tx-1", amount: 33.33 })];
    const bes = [be({ groupId: "credit-entry-tx-1", amount: 33.334 })];
    expect(reconcile(txs, bes)).toEqual([]);
  });

  it("resolves salary-entry by groupId + month/year", () => {
    const txs = [tx({ id: "s", amount: 5000, isPaid: true, groupId: "salary-user1", date: "2026-06-05" })];
    const bes = [be({ groupId: "salary-entry-user1-6-2026", amount: 5000, isPaid: true })];
    expect(reconcile(txs, bes)).toEqual([]);
  });

  it("flags salary-entry orphan when month does not match", () => {
    const txs = [tx({ id: "s", amount: 5000, groupId: "salary-user1", date: "2026-05-05" })];
    const bes = [be({ groupId: "salary-entry-user1-6-2026", amount: 5000 })];
    expect(reconcile(txs, bes)[0]?.type).toBe("ORPHAN_MIRROR");
  });

  it("resolves bonus-entry and loan-entry by mapped groupId", () => {
    const txs = [
      tx({ id: "b", amount: 2000, isPaid: true, groupId: "bonus-plr-2026-6-user1", date: "2026-06-01" }),
      tx({ id: "l", amount: 300, isPaid: true, groupId: "loan-tx-loan1-6-2026", date: "2026-06-01" }),
    ];
    const bes = [
      be({ id: "be-b", amount: 2000, isPaid: true, groupId: "bonus-entry-plr-2026-6-user1" }),
      be({ id: "be-l", amount: 300, isPaid: true, groupId: "loan-entry-loan1-6-2026" }),
    ];
    expect(reconcile(txs, bes)).toEqual([]);
  });

  it("aggregates multiple divergences", () => {
    const txs = [tx({ id: "tx-1", amount: 1000, isPaid: false })];
    const bes = [
      be({ id: "be-1", groupId: "credit-entry-tx-1", amount: 900, isPaid: true }), // amount + paid
      be({ id: "be-2", groupId: "credit-entry-missing" }),                          // orphan
    ];
    const d = reconcile(txs, bes);
    expect(d.length).toBe(3);
    expect(d.map(x => x.type).sort()).toEqual(["AMOUNT_MISMATCH", "ORPHAN_MIRROR", "PAID_DESYNC"]);
  });
});
