import { describe, it, expect } from "vitest";
import { buildPortfolioSeries } from "@/lib/finance/portfolio";

const NOW = new Date("2026-03-15T00:00:00Z");

describe("buildPortfolioSeries", () => {
  it("returns empty when there are no snapshots", () => {
    expect(buildPortfolioSeries([], NOW)).toEqual([]);
    expect(buildPortfolioSeries([{ snapshots: [] }], NOW)).toEqual([]);
  });

  it("forward-fills the last known value across months", () => {
    const series = buildPortfolioSeries(
      [{ snapshots: [{ date: "2026-01-10T00:00:00Z", value: 1000 }] }],
      NOW,
    );
    // jan, fev, mar — valor mantém 1000 mesmo sem novos snapshots
    expect(series.map(p => p.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(series.map(p => p.value)).toEqual([1000, 1000, 1000]);
  });

  it("sums multiple assets and includes one only from its first snapshot month", () => {
    const series = buildPortfolioSeries(
      [
        { snapshots: [{ date: "2026-01-05T00:00:00Z", value: 1000 }] },
        { snapshots: [{ date: "2026-02-20T00:00:00Z", value: 500 }] },
      ],
      NOW,
    );
    // jan: só o ativo A (1000); fev e mar: A + B (1500)
    expect(series).toEqual([
      { key: "2026-01", label: "jan/26", value: 1000 },
      { key: "2026-02", label: "fev/26", value: 1500 },
      { key: "2026-03", label: "mar/26", value: 1500 },
    ]);
  });

  it("uses the latest snapshot within a month (value change reflected)", () => {
    const series = buildPortfolioSeries(
      [{ snapshots: [
        { date: "2026-01-05T00:00:00Z", value: 1000 },
        { date: "2026-02-10T00:00:00Z", value: 1200 },
        { date: "2026-02-25T00:00:00Z", value: 1300 },
      ] }],
      NOW,
    );
    expect(series.map(p => p.value)).toEqual([1000, 1300, 1300]);
  });

  it("caps the result to the most recent maxMonths", () => {
    const series = buildPortfolioSeries(
      [{ snapshots: [{ date: "2024-01-01T00:00:00Z", value: 100 }] }],
      NOW,
      6,
    );
    expect(series).toHaveLength(6);
    expect(series[series.length - 1].key).toBe("2026-03");
  });

  it("handles unordered snapshots defensively", () => {
    const series = buildPortfolioSeries(
      [{ snapshots: [
        { date: "2026-02-25T00:00:00Z", value: 1300 },
        { date: "2026-01-05T00:00:00Z", value: 1000 },
      ] }],
      NOW,
    );
    expect(series.map(p => p.value)).toEqual([1000, 1300, 1300]);
  });
});
