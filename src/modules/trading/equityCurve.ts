import type { TradingTrade } from "@/src/modules/trading/types";

// The equity curve: cumulative realised P&L, one point per closed trade, in the
// order the trades actually closed. Feeds a hand-rolled SVG polyline — no chart
// library, following ReadinessRadar.tsx ("Pure SVG; no chart library — not on
// the approved list"). A polyline needs even less.
//
// Pure. Cents in, cents out.

export interface EquityPoint {
  // yyyy-MM-dd — the exit date, i.e. when this P&L became real.
  date: string;
  tradeId: string;
  // This trade's own contribution, signed.
  pnlCents: number;
  // Running total through and including this trade.
  cumulativeCents: number;
}

export interface EquityCurve {
  points: EquityPoint[];
  // Running total at the end. 0 for an empty curve, which is a true statement
  // here (you have realised nothing) rather than the usual null-vs-zero trap.
  finalCents: number;
  // The largest peak-to-trough fall in the running total, as a POSITIVE cents
  // magnitude. 0 when the curve never fell. Null when there is nothing to
  // measure, because "no drawdown yet" and "never drew down" differ.
  maxDrawdownCents: number | null;
}

// Closed trades only, ordered by exit date. Ties break on `createdAt` so two
// trades closed the same day always plot in a stable, reproducible order — a
// curve that reshuffles between renders is a bug that is very hard to see.
export function equityCurve(trades: TradingTrade[]): EquityCurve {
  const closed = trades
    .filter(
      (trade) =>
        !trade.deletedAt && trade.exitDate !== null && trade.pnlCents !== null,
    )
    .sort(
      (left, right) =>
        left.exitDate!.localeCompare(right.exitDate!) ||
        left.createdAt.localeCompare(right.createdAt),
    );

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  const points: EquityPoint[] = closed.map((trade) => {
    const pnlCents = trade.pnlCents!;
    cumulative += pnlCents;

    // Drawdown is measured from the highest point the curve has REACHED, not
    // from zero — otherwise a profitable account that gives back half its gains
    // would report no drawdown at all.
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);

    return {
      date: trade.exitDate!,
      tradeId: trade.id,
      pnlCents,
      cumulativeCents: cumulative,
    };
  });

  return {
    points,
    finalCents: cumulative,
    maxDrawdownCents: points.length === 0 ? null : maxDrawdown,
  };
}
