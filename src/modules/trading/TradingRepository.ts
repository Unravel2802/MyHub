import type {
  BacktestExitReason,
  BacktestStrategy,
  BacktestTrade,
  TradingEmotion,
  TradingEntry,
  TradingExitReason,
  TradingSignal,
  TradingTrade,
} from "@/src/modules/trading/types";
import { format } from "date-fns";
import { supabase } from "@/src/lib/supabaseClient";

interface TradingTradeRow {
  id: string;
  ticker: string;
  entry_date: string;
  entry_price_cents: number;
  stop_price_cents: number | null;
  shares: number;
  exit_date: string | null;
  exit_price_cents: number | null;
  exit_reason: TradingExitReason | null;
  pnl_cents: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TradingEntryRow {
  id: string;
  date: string;
  ticker: string;
  signal: TradingSignal;
  price_cents: number | null;
  ema_fast_cents: number | null;
  ema_slow_cents: number | null;
  rsi: number | null;
  emotion: TradingEmotion | null;
  rules_followed: boolean | null;
  rule_break: string | null;
  notes: string | null;
  trade_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function tradeFromRow(row: TradingTradeRow): TradingTrade {
  return {
    id: row.id,
    ticker: row.ticker,
    entryDate: row.entry_date,
    entryPriceCents: row.entry_price_cents,
    stopPriceCents: row.stop_price_cents,
    // Postgres `numeric` arrives as a string through PostgREST when it exceeds
    // what a JS number safely holds — and shares is fractional by design, so
    // never trust it to already be a number.
    shares: Number(row.shares),
    exitDate: row.exit_date,
    exitPriceCents: row.exit_price_cents,
    exitReason: row.exit_reason,
    pnlCents: row.pnl_cents,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function entryFromRow(row: TradingEntryRow): TradingEntry {
  return {
    id: row.id,
    date: row.date,
    ticker: row.ticker,
    signal: row.signal,
    priceCents: row.price_cents,
    emaFastCents: row.ema_fast_cents,
    emaSlowCents: row.ema_slow_cents,
    // Same `numeric` caveat as shares.
    rsi: row.rsi === null ? null : Number(row.rsi),
    emotion: row.emotion,
    rulesFollowed: row.rules_followed,
    ruleBreak: row.rule_break,
    notes: row.notes,
    tradeId: row.trade_id,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Published contract for the Trading Journal (a new module — see migration
// 0038's header for the two-table split and why P&L lives on the trade).
// Soft deletes only: `deleted_at`, never a DELETE.
//
// This module emits NO Event Bus events, deliberately — see the migration
// header. Nothing outside it consumes trading activity, and Momentum must not.

export interface CreateTradeInput {
  ticker: string;
  // yyyy-MM-dd. Defaults to today when omitted.
  entryDate?: string;
  entryPriceCents: number;
  stopPriceCents?: number | null;
  shares: number;
}

function tradeWrite(input: Partial<CreateTradeInput>) {
  return {
    ...(input.ticker !== undefined && { ticker: input.ticker }),
    ...(input.entryDate !== undefined && { entry_date: input.entryDate }),
    ...(input.entryPriceCents !== undefined && {
      entry_price_cents: input.entryPriceCents,
    }),
    ...(input.stopPriceCents !== undefined && {
      stop_price_cents: input.stopPriceCents,
    }),
    ...(input.shares !== undefined && { shares: input.shares }),
  };
}

// Closing a trade sets all four exit fields together, because the DB's
// close-is-atomic CHECK rejects any subset. `pnlCents` is SIGNED.
export interface CloseTradeInput {
  exitDate?: string;
  exitPriceCents: number;
  exitReason: TradingExitReason;
  pnlCents: number;
}

export async function getTrades(): Promise<TradingTrade[]> {
  const { data, error } = await supabase
    .from("trading_trades")
    .select("*")
    .is("deleted_at", null)
    .order("entry_date", { ascending: false });

  if (error) throw error;
  return data.map(tradeFromRow);
}

export async function createTrade(
  input: CreateTradeInput,
): Promise<TradingTrade> {
  const { data, error } = await supabase
    .from("trading_trades")
    .insert({
      ...tradeWrite(input),
      entry_date: input.entryDate ?? format(new Date(), "yyyy-MM-dd"),
    })
    .select()
    .single();

  if (error) throw error;
  return tradeFromRow(data);
}

// Edits the OPEN side of a trade (a corrected stop, a fixed share count).
// Closing goes through closeTrade so the four exit fields can't drift apart.
export async function updateTrade(
  id: string,
  updates: Partial<CreateTradeInput>,
): Promise<TradingTrade> {
  const { data, error } = await supabase
    .from("trading_trades")
    .update(tradeWrite(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return tradeFromRow(data);
}

export async function closeTrade(
  id: string,
  input: CloseTradeInput,
): Promise<TradingTrade> {
  const { data, error } = await supabase
    .from("trading_trades")
    .update({
      exit_date: input.exitDate ?? format(new Date(), "yyyy-MM-dd"),
      exit_price_cents: input.exitPriceCents,
      exit_reason: input.exitReason,
      pnl_cents: input.pnlCents,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return tradeFromRow(data);
}

// Reopens a closed trade by clearing all four exit fields at once — again, the
// CHECK forbids clearing only some of them.
export async function reopenTrade(id: string): Promise<TradingTrade> {
  const { data, error } = await supabase
    .from("trading_trades")
    .update({
      exit_date: null,
      exit_price_cents: null,
      exit_reason: null,
      pnl_cents: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return tradeFromRow(data);
}

export async function deleteTrade(id: string): Promise<void> {
  const { error } = await supabase
    .from("trading_trades")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export interface CreateEntryInput {
  // yyyy-MM-dd. Defaults to today when omitted.
  date?: string;
  ticker: string;
  signal: TradingSignal;
  priceCents?: number | null;
  emaFastCents?: number | null;
  emaSlowCents?: number | null;
  rsi?: number | null;
  emotion?: TradingEmotion | null;
  rulesFollowed?: boolean | null;
  // The DB rejects this unless `rulesFollowed` is explicitly false.
  ruleBreak?: string | null;
  notes?: string | null;
  // The DB rejects a non-null value on a 'hold'.
  tradeId?: string | null;
}

function entryWrite(input: Partial<CreateEntryInput>) {
  return {
    ...(input.date !== undefined && { date: input.date }),
    ...(input.ticker !== undefined && { ticker: input.ticker }),
    ...(input.signal !== undefined && { signal: input.signal }),
    ...(input.priceCents !== undefined && { price_cents: input.priceCents }),
    ...(input.emaFastCents !== undefined && {
      ema_fast_cents: input.emaFastCents,
    }),
    ...(input.emaSlowCents !== undefined && {
      ema_slow_cents: input.emaSlowCents,
    }),
    ...(input.rsi !== undefined && { rsi: input.rsi }),
    ...(input.emotion !== undefined && { emotion: input.emotion }),
    ...(input.rulesFollowed !== undefined && {
      rules_followed: input.rulesFollowed,
    }),
    ...(input.ruleBreak !== undefined && { rule_break: input.ruleBreak }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.tradeId !== undefined && { trade_id: input.tradeId }),
  };
}

export async function getEntries(): Promise<TradingEntry[]> {
  const { data, error } = await supabase
    .from("trading_entries")
    .select("*")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (error) throw error;
  return data.map(entryFromRow);
}

export async function createEntry(
  input: CreateEntryInput,
): Promise<TradingEntry> {
  const { data, error } = await supabase
    .from("trading_entries")
    .insert({
      ...entryWrite(input),
      date: input.date ?? format(new Date(), "yyyy-MM-dd"),
    })
    .select()
    .single();

  if (error) throw error;
  return entryFromRow(data);
}

export async function updateEntry(
  id: string,
  updates: Partial<CreateEntryInput>,
): Promise<TradingEntry> {
  const { data, error } = await supabase
    .from("trading_entries")
    .update(entryWrite(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return entryFromRow(data);
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("trading_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Backtests (migration 0040) — READ ONLY.
//
// These rows are an imported artifact from the Python lab, loaded by
// scripts/seedBacktests.ts and owned by it. The app never writes here, so there
// is deliberately no create/update/delete surface: the way to change a backtest
// is to re-run the lab and re-seed, not to edit a result in the UI.
// ---------------------------------------------------------------------------

interface BacktestStrategyRow {
  id: string;
  key: string;
  label: string;
  trades: number;
  win_rate_pct: number;
  avg_r: number;
  profit_factor: number;
  sharpe: number;
  sharpe_before_costs: number;
  cagr_pct: number;
  max_dd_pct: number;
  end_value: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BacktestTradeRowShape {
  id: string;
  strategy_id: string;
  ticker: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  stop_price: number;
  exit_price: number;
  shares: number;
  exit_reason: BacktestExitReason;
  commission: number;
  pnl_dollars: number;
  r_multiple: number;
  holding_days: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function backtestStrategyFromRow(row: BacktestStrategyRow): BacktestStrategy {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    trades: row.trades,
    // `double precision` can arrive as a string through PostgREST, same caveat
    // as `shares` on the journal side — coerce rather than trust.
    winRatePct: Number(row.win_rate_pct),
    avgR: Number(row.avg_r),
    profitFactor: Number(row.profit_factor),
    sharpe: Number(row.sharpe),
    sharpeBeforeCosts: Number(row.sharpe_before_costs),
    cagrPct: Number(row.cagr_pct),
    maxDdPct: Number(row.max_dd_pct),
    endValue: Number(row.end_value),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function backtestTradeFromRow(row: BacktestTradeRowShape): BacktestTrade {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    ticker: row.ticker,
    entryDate: row.entry_date,
    exitDate: row.exit_date,
    entryPrice: Number(row.entry_price),
    stopPrice: Number(row.stop_price),
    exitPrice: Number(row.exit_price),
    shares: Number(row.shares),
    exitReason: row.exit_reason,
    commission: Number(row.commission),
    pnlDollars: Number(row.pnl_dollars),
    rMultiple: Number(row.r_multiple),
    holdingDays: row.holding_days,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBacktestStrategies(): Promise<BacktestStrategy[]> {
  const { data, error } = await supabase
    .from("trading_backtest_strategies")
    .select("*")
    .is("deleted_at", null)
    .order("label", { ascending: true });

  if (error) throw error;
  return data.map(backtestStrategyFromRow);
}

// Scoped to ONE strategy on purpose. The five files total ~2,900 trades, and
// the browser only ever shows one strategy at a time — fetching the lot to
// filter client-side would pull the whole corpus for every view.
// PostgREST caps an un-ranged response at 1000 rows and reports no error when
// it does. macd_momentum has 1,576 trades, so the obvious single-select version
// of this silently returned 1000 of them and the totals just quietly disagreed
// with the seed — no throw, no warning, nothing to notice in the UI.
//
// So page explicitly until a short page arrives. `order` is applied per request
// and the ordering is total (exit_date, then id as a tiebreak), which it must be
// — paging over a non-deterministic order can drop and duplicate rows across
// page boundaries.
const PAGE_SIZE = 1000;

export async function getBacktestTrades(
  strategyId: string,
): Promise<BacktestTrade[]> {
  const rows: BacktestTradeRowShape[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("trading_backtest_trades")
      .select("*")
      .eq("strategy_id", strategyId)
      .is("deleted_at", null)
      .order("exit_date", { ascending: false })
      // Without this tiebreak, trades sharing an exit_date could reshuffle
      // between page requests and land in two pages or none.
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...data);

    // A short page means the end. Guarding on `< PAGE_SIZE` rather than
    // `length === 0` saves one round-trip on an exact multiple.
    if (data.length < PAGE_SIZE) break;
  }

  return rows.map(backtestTradeFromRow);
}
