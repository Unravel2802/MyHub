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
