import { parseAmount } from "@/src/lib/money";
import type { TradingSignal } from "@/src/modules/trading/types";

// Validation for the trading journal's entry form.
//
// Pure and separate from the component because it is the only part of that
// form with rules, and it was previously interleaved with an async submit
// handler — unreachable from a test without rendering the form, filling
// sixteen fields, and clicking. The component now validates, then submits.

export interface TradingEntryDraft {
  ticker: string;
  signal: TradingSignal;
  price: string;
  emaFast: string;
  emaSlow: string;
  rsi: string;
  entryPrice: string;
  stopPrice: string;
  shares: string;
}

export interface TradingEntryValidation {
  errors: Record<string, string>;
  /** UPPERCASED and trimmed — the canonical form that gets stored. */
  ticker: string;
  priceCents: number | null;
  emaFastCents: number | null;
  emaSlowCents: number | null;
  rsi: number | null;
  entryPriceCents: number | null;
  stopPriceCents: number | null;
  shares: number | null;
}

export function validateTradingEntry(
  draft: TradingEntryDraft,
): TradingEntryValidation {
  const errors: Record<string, string> = {};
  const ticker = draft.ticker.trim().toUpperCase();

  // Optional by default: an observation can be logged without every indicator.
  // `required` flips it, and also rejects zero — a zero entry or stop price is
  // not a real order.
  function money(raw: string, key: string, required = false): number | null {
    if (!raw.trim()) {
      if (required) errors[key] = "Enter an amount";
      return null;
    }
    const cents = parseAmount(raw);
    if (cents === null || (required && cents <= 0)) {
      errors[key] = "Enter a valid positive amount";
      return null;
    }
    return cents;
  }

  if (!ticker) errors.ticker = "Enter a ticker";

  const priceCents = money(draft.price, "price");
  const emaFastCents = money(draft.emaFast, "emaFast");
  const emaSlowCents = money(draft.emaSlow, "emaSlow");

  const rsi = draft.rsi.trim() ? Number(draft.rsi) : null;
  // RSI is a bounded oscillator; anything outside 0-100 is a typo, not a
  // reading.
  if (rsi !== null && (!Number.isFinite(rsi) || rsi < 0 || rsi > 100)) {
    errors.rsi = "RSI must be between 0 and 100";
  }

  let entryPriceCents: number | null = null;
  let stopPriceCents: number | null = null;
  const shares = draft.shares.trim() ? Number(draft.shares) : null;

  // Only a BUY opens a position, so only a buy needs the fields that define
  // one. Requiring them on a hold or a sell would block logging an
  // observation.
  if (draft.signal === "buy") {
    entryPriceCents = money(draft.entryPrice, "entryPrice", true);
    stopPriceCents = money(draft.stopPrice, "stopPrice", true);
    if (shares === null || !Number.isFinite(shares) || shares <= 0) {
      errors.shares = "Enter a positive share quantity";
    }
  }

  return {
    errors,
    ticker,
    priceCents,
    emaFastCents,
    emaSlowCents,
    rsi,
    entryPriceCents,
    stopPriceCents,
    shares,
  };
}
