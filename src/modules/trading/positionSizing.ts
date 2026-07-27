// Position sizing: how many shares to buy so that being stopped out costs a
// fixed, pre-decided amount. Rule R5 of the source system — risk exactly a set
// fraction per trade, and let the stop distance decide the size, never the other
// way round.
//
// Pure, and deliberately takes the account size as an ARGUMENT rather than
// reading a constant: the source hardcoded $100 at 2%, but that number changes
// as the account does, and baking it in here would make every stat silently
// wrong the first time it moved.

// The source's default: risk 2% of the account on any single trade.
export const DEFAULT_RISK_FRACTION = 0.02;

// What one trade is allowed to lose, in cents. Rounded to a whole cent because
// it is money the UI will display.
export function riskBudgetCents(
  accountCents: number,
  riskFraction: number = DEFAULT_RISK_FRACTION,
): number | null {
  if (accountCents <= 0) return null;
  if (riskFraction <= 0 || riskFraction > 1) return null;
  return Math.round(accountCents * riskFraction);
}

// shares = risk budget ÷ risk per share.
//
// NOT rounded to whole shares: fractional quantities are real in this system,
// and rounding down here would quietly under-risk every position while rounding
// up would breach the very limit this function exists to enforce.
//
// Null when the stop is at or above entry — that risks nothing per share, so no
// size satisfies the budget and dividing would yield Infinity.
export function sharesForRisk(
  entryPriceCents: number,
  stopPriceCents: number,
  riskCents: number,
): number | null {
  const perShare = entryPriceCents - stopPriceCents;
  if (perShare <= 0) return null;
  if (riskCents <= 0) return null;
  return riskCents / perShare;
}

// The whole sizing decision in one call, for a form that knows the account size
// and the two prices. Null propagates from either step rather than silently
// falling back to a size that was never actually justified.
export function positionSize(
  accountCents: number,
  entryPriceCents: number,
  stopPriceCents: number,
  riskFraction: number = DEFAULT_RISK_FRACTION,
): { riskCents: number; shares: number } | null {
  const riskCents = riskBudgetCents(accountCents, riskFraction);
  if (riskCents === null) return null;

  const shares = sharesForRisk(entryPriceCents, stopPriceCents, riskCents);
  if (shares === null) return null;

  return { riskCents, shares };
}
