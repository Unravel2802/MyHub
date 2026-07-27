import { describe, expect, it } from "vitest";
import { equityCurve } from "@/src/modules/trading/equityCurve";
import type { TradingTrade } from "@/src/modules/trading/types";

function closed(
  id: string,
  exitDate: string,
  pnlCents: number,
  overrides: Partial<TradingTrade> = {},
): TradingTrade {
  return {
    id,
    ticker: "SPY",
    entryDate: "2026-07-01",
    entryPriceCents: 50_000,
    stopPriceCents: 48_000,
    shares: 1,
    exitDate,
    exitPriceCents: 51_000,
    exitReason: "manual",
    pnlCents,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("equityCurve", () => {
  it("accumulates realised P&L in exit order, not entry order", () => {
    const trades = [
      closed("late", "2026-07-20", 1_000, { entryDate: "2026-07-02" }),
      closed("early", "2026-07-10", 3_000, { entryDate: "2026-07-05" }),
    ];

    const curve = equityCurve(trades);

    expect(curve.points.map((point) => point.tradeId)).toEqual([
      "early",
      "late",
    ]);
    expect(curve.points.map((point) => point.cumulativeCents)).toEqual([
      3_000, 4_000,
    ]);
    expect(curve.finalCents).toBe(4_000);
  });

  it("carries losses through the running total", () => {
    const curve = equityCurve([
      closed("a", "2026-07-01", 5_000),
      closed("b", "2026-07-02", -2_000),
      closed("c", "2026-07-03", 1_000),
    ]);

    expect(curve.points.map((point) => point.cumulativeCents)).toEqual([
      5_000, 3_000, 4_000,
    ]);
    expect(curve.finalCents).toBe(4_000);
  });

  it("breaks same-day ties on createdAt so the curve is reproducible", () => {
    const trades = [
      closed("second", "2026-07-10", 1_000, {
        createdAt: "2026-07-05T00:00:00.000Z",
      }),
      closed("first", "2026-07-10", 2_000, {
        createdAt: "2026-07-01T00:00:00.000Z",
      }),
    ];

    expect(equityCurve(trades).points.map((point) => point.tradeId)).toEqual([
      "first",
      "second",
    ]);
  });

  it("excludes open and soft-deleted trades", () => {
    const trades = [
      closed("live", "2026-07-01", 1_000),
      closed("gone", "2026-07-02", 9_999, {
        deletedAt: "2026-07-03T00:00:00.000Z",
      }),
      closed("open", "2026-07-04", 0, {
        exitDate: null,
        exitPriceCents: null,
        exitReason: null,
        pnlCents: null,
      }),
    ];

    const curve = equityCurve(trades);

    expect(curve.points).toHaveLength(1);
    expect(curve.finalCents).toBe(1_000);
  });

  it("measures drawdown from the running peak, not from zero", () => {
    // Up to 10000, back down to 4000 → the worst fall is 6000, even though the
    // account never went negative. Measuring from zero would report none.
    const curve = equityCurve([
      closed("a", "2026-07-01", 10_000),
      closed("b", "2026-07-02", -6_000),
      closed("c", "2026-07-03", 3_000),
    ]);

    expect(curve.maxDrawdownCents).toBe(6_000);
    expect(curve.finalCents).toBe(7_000);
  });

  it("reports zero drawdown for a curve that only ever rose", () => {
    const curve = equityCurve([
      closed("a", "2026-07-01", 1_000),
      closed("b", "2026-07-02", 2_000),
    ]);

    expect(curve.maxDrawdownCents).toBe(0);
  });

  it("returns an empty curve with a null drawdown, not a zero one", () => {
    const curve = equityCurve([]);

    expect(curve.points).toEqual([]);
    expect(curve.finalCents).toBe(0);
    // "Nothing to measure" is not the same claim as "never drew down".
    expect(curve.maxDrawdownCents).toBeNull();
  });
});
