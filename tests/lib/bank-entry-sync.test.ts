import { describe, it, expect } from "vitest";
import {
  MIRROR_GROUP_PREFIXES,
  isMirrorGroupId,
  manualBankEntryWhere,
} from "@/lib/bank-entry-sync";

describe("isMirrorGroupId", () => {
  it("returns false for null/undefined/empty (manual entries)", () => {
    expect(isMirrorGroupId(null)).toBe(false);
    expect(isMirrorGroupId(undefined)).toBe(false);
    expect(isMirrorGroupId("")).toBe(false);
  });

  it("returns false for genuinely manual groupIds", () => {
    expect(isMirrorGroupId("manual-123")).toBe(false);
    expect(isMirrorGroupId("casa-aluguel")).toBe(false);
  });

  it("flags every mirror prefix as a mirror", () => {
    expect(isMirrorGroupId("salary-entry-user1-6-2026")).toBe(true);
    expect(isMirrorGroupId("bonus-entry-plr-2026-6-user1")).toBe(true);
    expect(isMirrorGroupId("credit-entry-abc123")).toBe(true);
    expect(isMirrorGroupId("loan-entry-loan1-6-2026")).toBe(true);
    expect(isMirrorGroupId("sub-entry-sub1-mem1-6-2026")).toBe(true);
  });

  it("covers all declared prefixes", () => {
    for (const prefix of MIRROR_GROUP_PREFIXES) {
      expect(isMirrorGroupId(`${prefix}whatever`)).toBe(true);
    }
  });
});

describe("manualBankEntryWhere", () => {
  it("builds an OR that keeps null groupId and excludes every mirror prefix", () => {
    const where = manualBankEntryWhere();
    expect(where.OR[0]).toEqual({ groupId: null });
    const notClause = where.OR[1].NOT as Array<{ groupId: { startsWith: string } }>;
    const excluded = notClause.map(c => c.groupId.startsWith);
    // every mirror prefix must be present in the NOT list
    for (const prefix of MIRROR_GROUP_PREFIXES) {
      expect(excluded).toContain(prefix);
    }
    // and nothing else
    expect(notClause).toHaveLength(MIRROR_GROUP_PREFIXES.length);
  });
});
