import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// DB integration tests — the layer the unit + E2E suites can't see. Unit tests
// mock the repository; the Playwright mock accepts any POST. So a CHECK that
// silently fails to reject bad data is invisible everywhere except here. See
// docs/db-integration-tests.md.
//
// Migration 0038 leans on three CHECKs to keep the journal's core invariant —
// P&L counted once, on a trade that is either open or fully closed. A CHECK
// that doesn't actually bite would let the UI write exactly the shape the
// two-table split exists to prevent, and every unit test would stay green.
//
// The repository is imported dynamically in beforeAll so it reads the test-DB
// env that vitest.db.setup.ts installed (its top-level createClient runs at
// import time). `admin` is a raw service-role client for teardown and for the
// raw inserts that bypass the repository's own guardrails.

let TradingRepository: typeof import("@/src/modules/trading/TradingRepository");
let admin: SupabaseClient;

const TEST_TICKER = "__DBTEST__";

beforeAll(async () => {
  TradingRepository = await import("@/src/modules/trading/TradingRepository");
  admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
});

// Entries reference trades, so entries go first.
afterEach(async () => {
  await admin.from("trading_entries").delete().eq("ticker", TEST_TICKER);
  await admin.from("trading_trades").delete().eq("ticker", TEST_TICKER);
});

async function openTrade() {
  return TradingRepository.createTrade({
    ticker: TEST_TICKER,
    entryPriceCents: 50_000,
    stopPriceCents: 48_000,
    shares: 2.5,
  });
}

describe("trading_trades (db)", () => {
  it("round-trips a trade, keeping fractional shares intact", async () => {
    const trade = await openTrade();

    expect(trade.entryPriceCents).toBe(50_000);
    // The reason `shares` is numeric rather than an integer. PostgREST hands
    // numerics back as strings once they're wide enough, which is exactly what
    // tradeFromRow's Number() coercion is there to absorb.
    expect(trade.shares).toBeCloseTo(2.5);
    expect(typeof trade.shares).toBe("number");
    expect(trade.pnlCents).toBeNull();
    expect(trade.exitDate).toBeNull();
  });

  it("closes a trade with all four exit fields at once", async () => {
    const open = await openTrade();

    const closed = await TradingRepository.closeTrade(open.id, {
      exitDate: "2026-07-20",
      exitPriceCents: 52_000,
      exitReason: "manual",
      pnlCents: 5_000,
    });

    expect(closed.exitDate).toBe("2026-07-20");
    expect(closed.exitReason).toBe("manual");
    expect(closed.pnlCents).toBe(5_000);
  });

  it("stores a NEGATIVE pnl — the signed column the cents helpers must respect", async () => {
    const open = await openTrade();

    const closed = await TradingRepository.closeTrade(open.id, {
      exitPriceCents: 47_000,
      exitReason: "stop_loss",
      pnlCents: -7_500,
    });

    expect(closed.pnlCents).toBe(-7_500);
  });

  it("reopens a trade by clearing all four exit fields", async () => {
    const open = await openTrade();
    await TradingRepository.closeTrade(open.id, {
      exitPriceCents: 52_000,
      exitReason: "manual",
      pnlCents: 5_000,
    });

    const reopened = await TradingRepository.reopenTrade(open.id);

    expect(reopened.exitDate).toBeNull();
    expect(reopened.exitPriceCents).toBeNull();
    expect(reopened.exitReason).toBeNull();
    expect(reopened.pnlCents).toBeNull();
  });

  it("REJECTS a half-closed trade — the close-is-atomic CHECK", async () => {
    const open = await openTrade();

    // An exit price with no P&L is precisely the state that would let a trade
    // look closed while contributing nothing to the stats. The repository has
    // no API for this, so go around it: the DB is the thing under test.
    const { error } = await admin
      .from("trading_trades")
      .update({ exit_price_cents: 52_000 })
      .eq("id", open.id);

    expect(error).not.toBeNull();
  });

  it("REJECTS a P&L with no exit — the other half of the same CHECK", async () => {
    const open = await openTrade();

    const { error } = await admin
      .from("trading_trades")
      .update({ pnl_cents: 5_000 })
      .eq("id", open.id);

    expect(error).not.toBeNull();
  });

  it("REJECTS non-positive shares", async () => {
    const { error } = await admin.from("trading_trades").insert({
      ticker: TEST_TICKER,
      entry_price_cents: 50_000,
      shares: 0,
    });

    expect(error).not.toBeNull();
  });

  it("soft-deletes rather than removing the row", async () => {
    const trade = await openTrade();
    await TradingRepository.deleteTrade(trade.id);

    const listed = await TradingRepository.getTrades();
    expect(listed.find((row) => row.id === trade.id)).toBeUndefined();

    const { data } = await admin
      .from("trading_trades")
      .select("deleted_at")
      .eq("id", trade.id)
      .single();
    expect(data?.deleted_at).toEqual(expect.any(String));
  });
});

describe("trading_entries (db)", () => {
  it("links a BUY and a SELL entry to ONE trade", async () => {
    const trade = await openTrade();

    const buy = await TradingRepository.createEntry({
      ticker: TEST_TICKER,
      signal: "buy",
      priceCents: 50_000,
      tradeId: trade.id,
    });
    const sell = await TradingRepository.createEntry({
      ticker: TEST_TICKER,
      signal: "sell",
      priceCents: 52_000,
      tradeId: trade.id,
    });

    // The whole point of the two-table split: two log lines, one P&L bearer.
    expect(buy.tradeId).toBe(trade.id);
    expect(sell.tradeId).toBe(trade.id);
  });

  it("splits the EMAs into two real columns and keeps RSI in range", async () => {
    const entry = await TradingRepository.createEntry({
      ticker: TEST_TICKER,
      signal: "hold",
      emaFastCents: 75_006,
      emaSlowCents: 73_900,
      rsi: 57.25,
    });

    // The source crammed both of these into one free-text field.
    expect(entry.emaFastCents).toBe(75_006);
    expect(entry.emaSlowCents).toBe(73_900);
    expect(entry.rsi).toBeCloseTo(57.25);
    expect(typeof entry.rsi).toBe("number");
  });

  it("REJECTS a rule-break note on an entry that followed the rules", async () => {
    const { error } = await admin.from("trading_entries").insert({
      ticker: TEST_TICKER,
      signal: "buy",
      rules_followed: true,
      rule_break: "should not be storable",
    });

    expect(error).not.toBeNull();
  });

  it("REJECTS a rule-break note when compliance is unjudged", async () => {
    const { error } = await admin.from("trading_entries").insert({
      ticker: TEST_TICKER,
      signal: "buy",
      rules_followed: null,
      rule_break: "unjudged, so this is incoherent",
    });

    expect(error).not.toBeNull();
  });

  it("REJECTS a 'hold' that claims a trade", async () => {
    const trade = await openTrade();

    const { error } = await admin.from("trading_entries").insert({
      ticker: TEST_TICKER,
      signal: "hold",
      trade_id: trade.id,
    });

    expect(error).not.toBeNull();
  });

  it("REJECTS an out-of-range RSI", async () => {
    const { error } = await admin.from("trading_entries").insert({
      ticker: TEST_TICKER,
      signal: "hold",
      rsi: 140,
    });

    expect(error).not.toBeNull();
  });

  it("accepts a rule break when the rules were actually broken", async () => {
    const entry = await TradingRepository.createEntry({
      ticker: TEST_TICKER,
      signal: "buy",
      rulesFollowed: false,
      ruleBreak: "chased the entry after the close",
    });

    expect(entry.rulesFollowed).toBe(false);
    expect(entry.ruleBreak).toBe("chased the entry after the close");
  });
});

describe("trading backtests (db)", () => {
  const TEST_KEY = "__dbtest_strategy__";

  const summary = {
    key: TEST_KEY,
    label: "__dbtest__ Strategy",
    trades: 2,
    win_rate_pct: 44.879898862199745,
    avg_r: 0.13636244046402102,
    profit_factor: 1.587690528378505,
    sharpe: 0.6439756275611636,
    sharpe_before_costs: 0.739615858650829,
    cagr_pct: 3.639123435565672,
    max_dd_pct: -20.633940892779883,
    end_value: 315.72538081408123,
  };

  async function upsertStrategy(overrides: Record<string, unknown> = {}) {
    const { data, error } = await admin
      .from("trading_backtest_strategies")
      .upsert({ ...summary, ...overrides }, { onConflict: "key" })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  afterEach(async () => {
    const { data } = await admin
      .from("trading_backtest_strategies")
      .select("id")
      .eq("key", TEST_KEY);

    for (const row of data ?? []) {
      await admin
        .from("trading_backtest_trades")
        .delete()
        .eq("strategy_id", row.id);
    }
    await admin
      .from("trading_backtest_strategies")
      .delete()
      .eq("key", TEST_KEY);
  });

  // THE load-bearing one. scripts/seedBacktests.ts upserts on `key`, and a
  // PARTIAL unique index cannot be an ON CONFLICT target — that is the 42P10
  // bug that shipped green three times here (migrations 0015/0017/0018). The
  // Playwright mock accepts any POST, so only this catches it.
  it("upserts a strategy on key — a partial index would 42P10 here", async () => {
    const created = await upsertStrategy();
    expect(created.key).toBe(TEST_KEY);

    // The second call is the ON CONFLICT (key) path. It must UPDATE, not throw
    // and not duplicate.
    const updated = await upsertStrategy({ trades: 99 });
    expect(updated.trades).toBe(99);
    expect(updated.id).toBe(created.id);

    const { data } = await admin
      .from("trading_backtest_strategies")
      .select("id")
      .eq("key", TEST_KEY);
    expect(data).toHaveLength(1);
  });

  it("keeps full float precision — the reason these are not cents", async () => {
    const created = await upsertStrategy();

    // Rounding any of these into cents would destroy the metric.
    expect(Number(created.win_rate_pct)).toBeCloseTo(44.879898862199745, 10);
    expect(Number(created.avg_r)).toBeCloseTo(0.13636244046402102, 10);
    // Drawdown stays negative rather than being stored as a magnitude.
    expect(Number(created.max_dd_pct)).toBeLessThan(0);
  });

  it("round-trips a trade through the read surface", async () => {
    const strategy = await upsertStrategy();

    const { error } = await admin.from("trading_backtest_trades").insert({
      strategy_id: strategy.id,
      ticker: "SPY",
      entry_date: "1994-05-03",
      exit_date: "1994-05-09",
      entry_price: 25.6966176085191,
      stop_price: 24.88804560893436,
      exit_price: 25.220239404860155,
      shares: 2.473496486431805,
      exit_reason: "stop",
      commission: 0,
      pnl_dollars: -1.178319812963098,
      r_multiple: -0.589159906481549,
      holding_days: 6,
    });
    expect(error).toBeNull();

    const trades = await TradingRepository.getBacktestTrades(strategy.id);
    expect(trades).toHaveLength(1);
    expect(trades[0].entryPrice).toBeCloseTo(25.6966176085191, 10);
    expect(trades[0].shares).toBeCloseTo(2.473496486431805, 10);
    expect(trades[0].exitReason).toBe("stop");
    // PostgREST hands `double precision` back as a string often enough that
    // the Number() coercion in backtestTradeFromRow is load-bearing.
    expect(typeof trades[0].rMultiple).toBe("number");
  });

  it("REJECTS a trade that exits before it enters", async () => {
    const strategy = await upsertStrategy();

    const { error } = await admin.from("trading_backtest_trades").insert({
      strategy_id: strategy.id,
      ticker: "SPY",
      entry_date: "1994-05-09",
      exit_date: "1994-05-03",
      entry_price: 25,
      stop_price: 24,
      exit_price: 26,
      shares: 1,
      exit_reason: "signal",
      commission: 0,
      pnl_dollars: 1,
      r_multiple: 1,
      holding_days: 1,
    });

    expect(error).not.toBeNull();
  });

  it("accepts all three exit reasons the engine emits", async () => {
    const strategy = await upsertStrategy();

    const { error } = await admin.from("trading_backtest_trades").insert(
      (["stop", "signal", "end_of_data"] as const).map((reason, index) => ({
        strategy_id: strategy.id,
        ticker: "SPY",
        entry_date: "1994-05-03",
        exit_date: "1994-05-09",
        entry_price: 25,
        stop_price: 24,
        exit_price: 26,
        shares: 1,
        exit_reason: reason,
        commission: 0,
        pnl_dollars: index,
        r_multiple: index,
        holding_days: 6,
      })),
    );

    expect(error).toBeNull();
  });
});
