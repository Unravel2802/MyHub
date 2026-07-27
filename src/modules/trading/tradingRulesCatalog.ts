// The trading system's rules, ported verbatim from
// ~/Documents/Trading/systematic-trading-plan.html and trading-journal.html.
//
// Static classification lives in CODE, not a table — the same pattern as
// financeCategories.ts / achievementCatalog.ts / backtestCatalog.ts. Rules are
// authored, versioned and reviewed like code; a rules TABLE would mean editing
// discipline through a form, which is exactly the wrong affordance for the one
// part of a trading system that is supposed to be hard to change on a whim.
//
// Only PRE_TRADE_CHECKLIST keys are persisted (trading_checklist_runs.checked_keys,
// migration 0041). The other two lists are reference text and store nothing, so
// their wording can change freely. A checklist key must NOT be renamed casually —
// a rename orphans every historical tick of that item.

export interface TradingRule {
  // Stable identifier. For SYSTEM_RULES this is the source's own R-number.
  key: string;
  title: string;
  detail: string;
}

// R1-R8, the mechanical system. Reference only — these describe what the
// strategy does, so nothing here is tickable.
export const SYSTEM_RULES: readonly TradingRule[] = [
  {
    key: "R1",
    title: "Universe",
    detail:
      "Trade SPY, QQQ, or IWM only. Liquid, low-spread, well-understood. No individual stocks until you're profitable for 3+ months.",
  },
  {
    key: "R2",
    title: "Entry signal",
    detail:
      "Buy when the 9-day EMA crosses above the 21-day EMA AND the RSI(14) is between 40–65. Both conditions must be true.",
  },
  {
    key: "R3",
    title: "Exit signal",
    detail:
      "Sell when the 9-day EMA crosses below the 21-day EMA OR RSI exceeds 75 (overbought exit).",
  },
  {
    key: "R4",
    title: "Stop-loss",
    detail:
      "Place stop at 2× ATR(14) below your entry price. Calculated automatically. Never move it wider.",
  },
  {
    key: "R5",
    title: "Position size",
    detail:
      "Risk exactly 2% of account per trade. Formula: shares = (account × 0.02) / (entry − stop).",
  },
  {
    key: "R6",
    title: "Timing",
    detail:
      "Check signals after 4pm ET each day. Place orders as limit orders for next morning open ±0.1%.",
  },
  {
    key: "R7",
    title: "Max positions",
    detail:
      "One position at a time. With $100, you do not diversify — you focus.",
  },
  {
    key: "R8",
    title: "Daily loss limit",
    detail:
      "If account drops 5% in a single day, stop trading for the rest of that week. No exceptions.",
  },
];

// The seven "Iron Rules — Never Break These". Reference only: these are
// prohibitions, and a checkbox saying "I did not average down" is theatre. What
// actually records a breach is an entry with rulesFollowed=false and a
// ruleBreak note (migration 0038), which feeds tradingStats' ruleCompliance.
export const IRON_RULES: readonly TradingRule[] = [
  {
    key: "iron_no_signal_no_trade",
    title: "Never trade without a signal",
    detail:
      "If the script says HOLD, you hold. Boredom is not a trade signal. Gut feeling is not a trade signal.",
  },
  {
    key: "iron_never_widen_stop",
    title: "Never move your stop-loss wider",
    detail:
      "You set it before you enter. It does not move. Ever. The only exception: moving it tighter to lock in profit (a trailing stop).",
  },
  {
    key: "iron_max_two_percent",
    title: "Never risk more than 2% per trade",
    detail:
      "The formula gives you your position size. You use that number. Not more.",
  },
  {
    key: "iron_never_average_down",
    title: "Never average down into a loser",
    detail:
      'If a trade is going against you, the stop-loss exits it. You do not buy more to "lower your cost basis."',
  },
  {
    key: "iron_no_first_fifteen",
    title: "Never trade during the first 15 minutes of market open",
    detail:
      "9:30–9:45am ET is chaotic and unpredictable. Your strategy uses daily closes — stay out of the open.",
  },
  {
    key: "iron_no_earnings_or_macro",
    title: "Never trade on earnings or major macro events",
    detail:
      "Check the economic calendar before each trade. No positions through Fed decisions or earnings of your ETF's top holdings.",
  },
  {
    key: "iron_log_every_trade",
    title: "Log every trade",
    detail:
      "Date, ticker, signal, entry, stop, target, exit, P&L, and one sentence about how you felt. Review every Sunday.",
  },
];

// The seven items actually ticked each day, from trading-journal.html's RULES
// array. THESE KEYS ARE PERSISTED — renaming one orphans every historical tick
// of that item, so treat them as a data contract, not display strings. The
// title and detail are free to be reworded.
export const PRE_TRADE_CHECKLIST: readonly TradingRule[] = [
  {
    key: "ran_signal_check",
    title: "I ran signal_check.py today",
    detail:
      "Script executed after market close. I have fresh data for all three tickers.",
  },
  {
    key: "checked_econ_calendar",
    title: "I checked the economic calendar",
    detail:
      "No major macro events today (Fed decision, CPI, NFP). If there are, I will not trade.",
  },
  {
    key: "signal_is_objective",
    title: "My signal is clear and objective",
    detail:
      "I am not interpreting or guessing. The script output is unambiguous.",
  },
  {
    key: "stop_known_before_entry",
    title: "I know my stop-loss before entering",
    detail:
      "Entry − 2×ATR is calculated. I will place it immediately after my buy fills.",
  },
  {
    key: "risking_two_percent_max",
    title: "I am risking no more than 2% ($2)",
    detail: "Position size is calculated by formula, not by feel.",
  },
  {
    key: "not_emotional",
    title: "I am not in an emotional state",
    detail:
      "No frustration from yesterday's trade. No FOMO. No revenge trading.",
  },
  {
    key: "will_not_override",
    title: "I will not override the signal today",
    detail:
      "Whatever the script says, I follow. No second-guessing, no gut overrides.",
  },
];

const CHECKLIST_KEYS = new Set(PRE_TRADE_CHECKLIST.map((rule) => rule.key));

// Whether a stored key still corresponds to a live checklist item. Stored rows
// can outlive the catalog: a retired item's key stays in old rows forever, and
// the UI must skip it rather than rendering a blank row or throwing.
export function isLiveChecklistKey(key: string): boolean {
  return CHECKLIST_KEYS.has(key);
}

// How complete a day's checklist is, 0-1, counting only keys that still exist.
// Null when the catalog is empty — a rate over nothing is not zero, the same
// discipline tradingStats and prepScorecard follow.
export function checklistCompletion(checkedKeys: string[]): number | null {
  if (PRE_TRADE_CHECKLIST.length === 0) return null;
  const live = new Set(checkedKeys.filter(isLiveChecklistKey));
  return live.size / PRE_TRADE_CHECKLIST.length;
}

// A day counts as fully checked only when every live item is ticked. Kept
// separate from checklistCompletion because "did you complete the ritual" is a
// yes/no question and 6-of-7 is a no.
export function isChecklistComplete(checkedKeys: string[]): boolean {
  return checklistCompletion(checkedKeys) === 1;
}
