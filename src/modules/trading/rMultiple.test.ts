import { describe, expect, it } from "vitest";
import {
  averageRMultiple,
  initialRiskCents,
  rMultiple,
} from "@/src/modules/trading/rMultiple";
import type { TradingTrade } from "@/src/modules/trading/types";

function trade(
  overrides: Partial<TradingTrade> & { id: string },
): TradingTrade {
  return {
    ticker: "SPY",
    entryDate: "2026-07-01",
    entryPriceCents: 50_000,
    stopPriceCents: 48_000,
    shares: 1,
    exitDate: "2026-07-10",
    exitPriceCents: 52_000,
    exitReason: "manual",
    pnlCents: 2_000,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("initialRiskCents", () => {
  it("is the stop distance times the share count", () => {
    // (50000 − 48000) × 2 = 4000 cents at risk.
    expect(initialRiskCents(trade({ id: "t", shares: 2 }))).toBe(4_000);
  });

  it("handles fractional shares without rounding them away", () => {
    // The whole reason shares is numeric: 2000 × 2.5 = 5000, not 4000 or 6000.
    expect(initialRiskCents(trade({ id: "t", shares: 2.5 }))).toBe(5_000);
  });

  it("is null with no stop set — risk is unknown, not zero", () => {
    expect(
      initialRiskCents(trade({ id: "t", stopPriceCents: null })),
    ).toBeNull();
  });

  it("is null when the stop is at or above entry rather than dividing by zero", () => {
    expect(
      initialRiskCents(trade({ id: "t", stopPriceCents: 50_000 })),
    ).toBeNull();
    expect(
      initialRiskCents(trade({ id: "t", stopPriceCents: 51_000 })),
    ).toBeNull();
  });
});

describe("rMultiple", () => {
  it("expresses profit in units of the risk taken", () => {
    // Risked 2000, made 2000 → exactly 1R.
    expect(rMultiple(trade({ id: "t" }))).toBe(1);
  });

  it("is negative on a loss", () => {
    // Risked 2000, lost 1000 → −0.5R.
    expect(rMultiple(trade({ id: "t", pnlCents: -1_000 }))).toBe(-0.5);
  });

  it("is null while the trade is open", () => {
    expect(
      rMultiple(
        trade({
          id: "t",
          exitDate: null,
          exitPriceCents: null,
          exitReason: null,
          pnlCents: null,
        }),
      ),
    ).toBeNull();
  });

  it("is null when the risk is unknowable, never 0", () => {
    // 0 would read as "broke even"; the truth is "not measurable".
    expect(rMultiple(trade({ id: "t", stopPriceCents: null }))).toBeNull();
  });
});

describe("averageRMultiple", () => {
  it("averages only the trades that have an R", () => {
    const trades = [
      trade({ id: "a" }), // 1R
      trade({ id: "b", pnlCents: 6_000 }), // 3R
      trade({ id: "c", stopPriceCents: null }), // no R — excluded
    ];

    expect(averageRMultiple(trades)).toBe(2);
  });

  it("is null when nothing qualifies", () => {
    expect(averageRMultiple([])).toBeNull();
    expect(
      averageRMultiple([trade({ id: "a", stopPriceCents: null })]),
    ).toBeNull();
  });

  it("ignores soft-deleted trades", () => {
    const trades = [
      trade({ id: "live" }), // 1R
      trade({
        id: "gone",
        pnlCents: 20_000,
        deletedAt: "2026-07-11T00:00:00.000Z",
      }),
    ];

    expect(averageRMultiple(trades)).toBe(1);
  });
});
