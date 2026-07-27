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
// All money is integer CENTS (src/lib/money.ts). `shares` is the
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

// ---------------------------------------------------------------------------
// Backtests (migration 0040)
//
// Everything below is IMPORTED ARTIFACT from the Python lab, not user data —
// which is why these carry plain floats while the journal above is integer
// cents. Rounding an r_multiple into cents would destroy the number.
// ---------------------------------------------------------------------------

// The engine's exit codes, lowercased from the CSV's STOP/SIGNAL/END_OF_DATA.
// 'end_of_data' means the window ended with the position still open — a
// censored trade, not a decision the strategy made.
export type BacktestExitReason = "stop" | "signal" | "end_of_data";

// One strategy's summary row, from backtest_comparison.csv.
export interface BacktestStrategySummary {
  // Stable registry handle (e.g. 'donchian_breakout'), from backtestCatalog.ts.
  key: string;
  trades: number;
  // PERCENT (44.88), not a fraction — the _pct suffix runs all the way to the
  // database so nobody divides by 100 twice.
  winRatePct: number;
  avgR: number;
  profitFactor: number;
  sharpe: number;
  sharpeBeforeCosts: number;
  cagrPct: number;
  // Negative by convention (-20.63): a drawdown is a fall.
  maxDdPct: number;
  endValue: number;
}

// A strategy as stored, with its display label and row id.
export interface BacktestStrategy extends BacktestStrategySummary {
  id: string;
  // Exactly as backtest_comparison.csv writes it, human noise included
  // ("EMA9/21 Pullback + Filters (original)").
  label: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// One simulated trade, from a backtest_trades_*.csv row. `strategyKey` comes
// from the filename — the per-strategy files don't name themselves.
export interface BacktestTradeRow {
  strategyKey: string;
  ticker: string;
  // yyyy-MM-dd.
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  stopPrice: number;
  exitPrice: number;
  shares: number;
  exitReason: BacktestExitReason;
  commission: number;
  pnlDollars: number;
  rMultiple: number;
  holdingDays: number;
}

// A simulated trade as stored.
export interface BacktestTrade extends Omit<BacktestTradeRow, "strategyKey"> {
  id: string;
  strategyId: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Daily pre-trade checklist (migration 0041)
// ---------------------------------------------------------------------------

// One day's run of the pre-trade checklist. In the source this was a DOM toggle
// that reset on reload and stored nothing; persisting it is what lets the app
// answer "did you actually run the checklist on the days you traded".
export interface TradingChecklistRun {
  id: string;
  // yyyy-MM-dd. One row per day — a PLAIN unique constraint, because this is an
  // ON CONFLICT target (migration 0041).
  date: string;
  // Keys from tradingRulesCatalog.ts's PRE_TRADE_CHECKLIST. A key array rather
  // than a column per item, so retiring or adding a rule needs no migration.
  // Keys of retired items linger in old rows and are ignored on read.
  checkedKeys: string[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
