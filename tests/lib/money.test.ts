import { describe, it, expect } from "vitest";
import { roundMoney, splitInstallments } from "@/lib/money";

describe("roundMoney", () => {
  it("rounds to 2 decimals", () => {
    expect(roundMoney(33.333333)).toBe(33.33);
    expect(roundMoney(33.335)).toBe(33.34);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3); // float-safe
  });
});

describe("splitInstallments", () => {
  it("sums EXACTLY to the total (no lost cents)", () => {
    for (const [total, n] of [[100, 3], [10, 3], [99.99, 7], [1, 6], [0.05, 4], [1234.56, 11]] as const) {
      const parts = splitInstallments(total, n);
      const sum = parts.reduce((a, b) => a + b, 0);
      expect(roundMoney(sum)).toBe(roundMoney(total));
      expect(parts).toHaveLength(n);
    }
  });

  it("distributes the leftover cents to the first installments", () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitInstallments(10, 3)).toEqual([3.34, 3.33, 3.33]);
  });

  it("returns exact division when divisible", () => {
    expect(splitInstallments(100, 4)).toEqual([25, 25, 25, 25]);
  });

  it("handles n=1 (à vista)", () => {
    expect(splitInstallments(99.99, 1)).toEqual([99.99]);
  });

  it("clamps invalid n to at least 1", () => {
    expect(splitInstallments(50, 0)).toEqual([50]);
  });

  it("each installment never differs by more than 1 cent", () => {
    const parts = splitInstallments(100, 7);
    const max = Math.max(...parts);
    const min = Math.min(...parts);
    expect(roundMoney(max - min)).toBe(0.01);
  });
});
