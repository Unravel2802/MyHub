import { describe, expect, it } from "vitest";
import { tradingStats } from "@/src/modules/trading/tradingStats";
import type { TradingEntry, TradingTrade } from "@/src/modules/trading/types";

function trade(
  overrides: Partial<TradingTrade> & { id: string },
): TradingTrade {
  return {
    ticker: "SPY",
    entryDate: "2026-07-01",
    entryPriceCents: 50_000,
    stopPriceCents: 48_000,
    shares: 1,
    exitDate: null,
    exitPriceCents: null,
    exitReason: null,
    pnlCents: null,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

// A closed trade needs all four exit fields — the DB CHECK guarantees it, so the
// fixtures honor it too rather than testing states that cannot exist.
function closed(
  id: string,
  pnlCents: number,
  overrides: Partial<TradingTrade> = {},
): TradingTrade {
  return trade({
    id,
    exitDate: "2026-07-10",
    exitPriceCents: 51_000,
    exitReason: "manual",
    pnlCents,
    ...overrides,
  });
}

function entry(
  overrides: Partial<TradingEntry> & { id: string },
): TradingEntry {
  return {
    date: "2026-07-01",
    ticker: "SPY",
    signal: "buy",
    priceCents: 50_000,
    emaFastCents: null,
    emaSlowCents: null,
    rsi: null,
    emotion: null,
    rulesFollowed: null,
    ruleBreak: null,
    notes: null,
    tradeId: null,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("tradingStats — P&L is counted once", () => {
  // The regression this whole two-table design exists to prevent. The source
  // wrote the same pnl onto the BUY row AND the SELL row, so one winning trade
  // scored twice. Here both entries point at ONE trade, and the trade is the
  // only thing counted.
  it("counts a BUY/SELL pair as a single trade, not two", () => {
    const trades = [closed("t1", 5_000)];
    const entries = [
      entry({ id: "buy", signal: "buy", tradeId: "t1" }),
      entry({ id: "sell", signal: "sell", tradeId: "t1", date: "2026-07-10" }),
    ];

    const stats = tradingStats(trades, entries);

    expect(stats.closedTrades).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.totalPnlCents).toBe(5_000);
    expect(stats.winRate).toBe(1);
  });

  it("does not let extra entries against one trade inflate the P&L", () => {
    const trades = [closed("t1", 5_000)];
    const entries = [
      entry({ id: "buy", signal: "buy", tradeId: "t1" }),
      entry({ id: "hold", signal: "hold", tradeId: null }),
      entry({ id: "sell", signal: "sell", tradeId: "t1" }),
    ];

    expect(tradingStats(trades, entries).totalPnlCents).toBe(5_000);
  });
});

describe("tradingStats — outcomes", () => {
  it("splits wins and losses and computes the rate over closed trades", () => {
    const trades = [
      closed("w1", 3_000),
      closed("w2", 1_000),
      closed("l1", -2_000),
      trade({ id: "open" }),
    ];

    const stats = tradingStats(trades, []);

    expect(stats.closedTrades).toBe(3);
    expect(stats.openTrades).toBe(1);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBeCloseTo(2 / 3);
    expect(stats.totalPnlCents).toBe(2_000);
  });

  it("treats a scratch as neither a win nor a loss, but still a closed trade", () => {
    const stats = tradingStats([closed("w", 1_000), closed("s", 0)], []);

    expect(stats.closedTrades).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    // 1 of 2, NOT 1 of 1 — a scratch must not flatter the rate by vanishing.
    expect(stats.winRate).toBe(0.5);
  });

  it("reports averages as positive magnitudes", () => {
    const stats = tradingStats(
      [closed("w1", 4_000), closed("w2", 2_000), closed("l1", -3_000)],
      [],
    );

    expect(stats.averageWinCents).toBe(3_000);
    expect(stats.averageLossCents).toBe(3_000);
  });

  it("computes expectancy from the win rate and both averages", () => {
    // 2 wins of 3000 avg, 2 losses of 1000 avg → 0.5*3000 − 0.5*1000 = 1000.
    const stats = tradingStats(
      [
        closed("w1", 2_000),
        closed("w2", 4_000),
        closed("l1", -1_000),
        closed("l2", -1_000),
      ],
      [],
    );

    expect(stats.expectancyCents).toBe(1_000);
  });

  it("computes profit factor as gross profit over gross loss", () => {
    const stats = tradingStats([closed("w", 6_000), closed("l", -2_000)], []);

    expect(stats.profitFactor).toBe(3);
  });
});

describe("tradingStats — null vs zero", () => {
  it("returns null rates with no closed trades rather than a misleading 0", () => {
    const stats = tradingStats([trade({ id: "open" })], []);

    expect(stats.closedTrades).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.averageWinCents).toBeNull();
    expect(stats.averageLossCents).toBeNull();
    expect(stats.expectancyCents).toBeNull();
    expect(stats.profitFactor).toBeNull();
    // A total of nothing genuinely is zero, unlike a rate over nothing.
    expect(stats.totalPnlCents).toBe(0);
  });

  it("returns a null profit factor when nothing has lost yet, never Infinity", () => {
    const stats = tradingStats([closed("w", 5_000)], []);

    expect(stats.profitFactor).toBeNull();
    expect(Number.isFinite(stats.profitFactor ?? 0)).toBe(true);
  });

  it("keeps expectancy honest when there are wins but no losses", () => {
    const stats = tradingStats([closed("w1", 2_000), closed("w2", 4_000)], []);

    expect(stats.winRate).toBe(1);
    expect(stats.expectancyCents).toBe(3_000);
  });
});

describe("tradingStats — discipline and habit", () => {
  it("computes rule compliance over judged entries only", () => {
    const entries = [
      entry({ id: "a", rulesFollowed: true }),
      entry({ id: "b", rulesFollowed: true }),
      entry({ id: "c", rulesFollowed: false, ruleBreak: "chased it" }),
      // Unjudged — must not count either way.
      entry({ id: "d", rulesFollowed: null }),
    ];

    expect(tradingStats([], entries).ruleCompliance).toBeCloseTo(2 / 3);
  });

  it("returns null compliance when nothing has been judged", () => {
    expect(
      tradingStats([], [entry({ id: "a", rulesFollowed: null })])
        .ruleCompliance,
    ).toBeNull();
  });

  it("counts distinct dates for days logged", () => {
    const entries = [
      entry({ id: "a", date: "2026-07-01" }),
      entry({ id: "b", date: "2026-07-01" }),
      entry({ id: "c", date: "2026-07-02" }),
    ];

    expect(tradingStats([], entries).daysLogged).toBe(2);
  });
});

describe("tradingStats — soft deletes", () => {
  it("excludes deleted trades and entries from every figure", () => {
    const trades = [
      closed("live", 1_000),
      closed("gone", 9_999, { deletedAt: "2026-07-11T00:00:00.000Z" }),
    ];
    const entries = [
      entry({ id: "live", rulesFollowed: true }),
      entry({
        id: "gone",
        date: "2026-07-09",
        rulesFollowed: false,
        deletedAt: "2026-07-11T00:00:00.000Z",
      }),
    ];

    const stats = tradingStats(trades, entries);

    expect(stats.closedTrades).toBe(1);
    expect(stats.totalPnlCents).toBe(1_000);
    expect(stats.ruleCompliance).toBe(1);
    expect(stats.daysLogged).toBe(1);
  });
});
