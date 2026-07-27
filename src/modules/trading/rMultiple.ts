import type { TradingTrade } from "@/src/modules/trading/types";

// R-multiple: profit measured in units of the risk you actually took, which is
// the only way two trades of different size are comparable. A +2R win on a small
// position is a better decision than a +$50 win on a huge one.
//
// Pure. All cents in, dimensionless ratio out.

// What the trade stood to lose if the stop had been hit, in cents:
// (entry − stop) × shares. This is the INITIAL risk, fixed at entry — not
// recomputed against a trailing stop, because R is meant to answer "how many
// times my planned risk did this return", and a moving denominator makes that
// unanswerable.
//
// Null when it cannot be known or would be meaningless: no stop set, or a stop
// at/above entry (which risks nothing, or is a typo — either way dividing by it
// would produce Infinity or a sign-flipped R rather than an honest "unknown").
export function initialRiskCents(trade: TradingTrade): number | null {
  if (trade.stopPriceCents === null) return null;
  const perShare = trade.entryPriceCents - trade.stopPriceCents;
  if (perShare <= 0) return null;
  return perShare * trade.shares;
}

// P&L ÷ initial risk. Null while the trade is open, and null whenever the risk
// itself is unknown — never 0, which would read as "broke even" when the truth
// is "not measurable".
export function rMultiple(trade: TradingTrade): number | null {
  if (trade.pnlCents === null) return null;
  const risk = initialRiskCents(trade);
  if (risk === null) return null;
  return trade.pnlCents / risk;
}

// Mean R across trades that have one. Null when none qualify — an average of
// nothing is not zero.
export function averageRMultiple(trades: TradingTrade[]): number | null {
  const values = trades
    .filter((trade) => !trade.deletedAt)
    .map(rMultiple)
    .filter((r): r is number => r !== null);

  if (values.length === 0) return null;
  return values.reduce((total, r) => total + r, 0) / values.length;
}
