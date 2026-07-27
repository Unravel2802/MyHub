// Why the trade was closed. 'manual' is a discretionary exit; the rest are the
// source system's rule-driven exits.
export type TradingExitReason =
  "ema_crossover_bearish" | "rsi_overbought" | "stop_loss" | "manual";

// What a log line records. 'hold' — you looked and deliberately did nothing —
// is a real entry worth keeping, and is why `tradeId` is nullable.
export type TradingSignal = "buy" | "sell" | "hold";

// The source stored these as emoji-prefixed strings ("😰 Anxious"); the emoji is
// the UI's business, not the data's.
export type TradingEmotion =
  | "neutral"
  | "anxious"
  | "frustrated"
  | "excited"
  | "confident"
  | "uncertain"
  | "fomo";

// The unit of P&L. The source counted P&L on both the BUY row and the SELL row,
// double-counting every closed trade in its own stats; here it lives here, once,
// and entries point at it.
//
// All money is integer CENTS (src/modules/finance/money.ts). `shares` is the
// deliberate exception — fractional quantities are real, and rounding them would
// corrupt the P&L they multiply into.
export interface TradingTrade {
  id: string;
  ticker: string;
  // yyyy-MM-dd. The day the position was opened, not the day it was logged.
  entryDate: string;
  entryPriceCents: number;
  // Null when the stop hasn't been decided. rMultiple is uncomputable without it.
  stopPriceCents: number | null;
  shares: number;
  // The four exit fields move together — the DB's close-is-atomic CHECK means a
  // trade is open with all four null, or closed with all four set. Nothing in
  // between, so `exitDate !== null` is a trustworthy "is closed" predicate.
  exitDate: string | null;
  exitPriceCents: number | null;
  exitReason: TradingExitReason | null;
  // SIGNED — a loss is negative. This is why finance's `parseAmount` (which
  // rejects negatives) can't be reused for it unchanged.
  pnlCents: number | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// One dated line in the journal. This is the DIARY; TradingTrade is the ledger.
export interface TradingEntry {
  id: string;
  // yyyy-MM-dd. The day observed, not the day logged.
  date: string;
  ticker: string;
  signal: TradingSignal;
  // Null is normal on a 'hold' — often just an observation.
  priceCents: number | null;
  // The source crammed both EMAs into one free-text field ("750.06 / 739.00").
  emaFastCents: number | null;
  emaSlowCents: number | null;
  // RSI(14), 0-100. Not money, so not cents.
  rsi: number | null;
  emotion: TradingEmotion | null;
  // Null means "not yet judged", matching how PrepEntry treats an unjudged
  // outcome. The DB rejects a `ruleBreak` unless this is explicitly false.
  rulesFollowed: boolean | null;
  ruleBreak: string | null;
  notes: string | null;
  // How a BUY line and its later SELL line resolve to one trade. Always null on
  // a 'hold' (DB-enforced).
  tradeId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
