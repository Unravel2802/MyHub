import type {
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
