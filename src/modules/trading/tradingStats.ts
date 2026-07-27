import { averageRMultiple } from "@/src/modules/trading/rMultiple";
import type { TradingEntry, TradingTrade } from "@/src/modules/trading/types";

// Performance stats for the journal. Pure — the repository loads the rows, this
// turns them into the numbers the source system tracked (win rate >45%, positive
// expectancy, avg win ≥1.5-2× avg loss).
//
// THIS IS WHERE THE DOUBLE-COUNT DIES. Every P&L figure below is computed over
// TRADES, never entries. The source counted both the BUY row and the SELL row of
// the same position, so a single winning trade lifted its win rate twice and its
// total P&L twice over. A trade is counted here exactly once, by construction:
// it is one row.
//
// Null-vs-zero discipline throughout, matching prepScorecard.ts: a rate over no
// data is `null`, never 0. "No trades yet" and "every trade lost" are different
// facts and must not render the same way.

export interface TradingStats {
  // Closed trades only — an open position has no realised outcome to score.
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  // Share of closed trades that made money, 0-1. Null when nothing has closed.
  // A scratch (exactly 0) counts in the denominator but is not a win — it is
  // neither, and inflating the rate with it would flatter the record.
  winRate: number | null;
  // Positive magnitudes in cents (an "average loss" of 4200 means $42 lost).
  averageWinCents: number | null;
  averageLossCents: number | null;
  // (winRate × avgWin) − ((1 − winRate) × avgLoss), in cents: what one more
  // trade is worth on average. The source's own formula. Null without data.
  expectancyCents: number | null;
  // Gross profit ÷ gross loss. Null when nothing has lost yet — the honest
  // answer is "undefined", not Infinity.
  profitFactor: number | null;
  totalPnlCents: number;
  averageRMultiple: number | null;
  // Share of judged ENTRIES where the rules were followed, 0-1. Computed over
  // entries rather than trades because discipline is a property of the daily
  // decision, including the 'hold' days where the discipline was not trading.
  // Entries with `rulesFollowed === null` are unjudged and excluded entirely.
  ruleCompliance: number | null;
  // Distinct dates with at least one entry — the "days logged" habit metric.
  daysLogged: number;
}

const active = <T extends { deletedAt: string | null }>(rows: T[]): T[] =>
  rows.filter((row) => !row.deletedAt);

// A trade is closed iff it has an exit. The DB's close-is-atomic CHECK
// guarantees exitDate and pnlCents move together, so this single predicate is
// enough and pnlCents is non-null wherever it holds.
const isClosed = (trade: TradingTrade): boolean => trade.exitDate !== null;

const mean = (values: number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;

export function tradingStats(
  trades: TradingTrade[],
  entries: TradingEntry[],
): TradingStats {
  const liveTrades = active(trades);
  const closed = liveTrades.filter(isClosed);
  const open = liveTrades.length - closed.length;

  const pnls = closed.map((trade) => trade.pnlCents ?? 0);
  const winPnls = pnls.filter((pnl) => pnl > 0);
  const lossPnls = pnls.filter((pnl) => pnl < 0);

  const grossProfit = winPnls.reduce((total, pnl) => total + pnl, 0);
  // Magnitude, not the signed sum — profit factor is a ratio of sizes.
  const grossLoss = lossPnls.reduce((total, pnl) => total + Math.abs(pnl), 0);

  const winRate = closed.length === 0 ? null : winPnls.length / closed.length;
  const averageWinCents = mean(winPnls);
  const averageLossCents = mean(lossPnls.map(Math.abs));

  // Expectancy needs all three inputs. With no losses yet, avgLoss is null and
  // the loss term contributes nothing rather than poisoning the result.
  const expectancyCents =
    winRate === null
      ? null
      : winRate * (averageWinCents ?? 0) -
        (1 - winRate) * (averageLossCents ?? 0);

  const judged = active(entries).filter(
    (entry) => entry.rulesFollowed !== null,
  );
  const followed = judged.filter((entry) => entry.rulesFollowed === true);

  const loggedDates = new Set(active(entries).map((entry) => entry.date));

  return {
    closedTrades: closed.length,
    openTrades: open,
    wins: winPnls.length,
    losses: lossPnls.length,
    winRate,
    averageWinCents,
    averageLossCents,
    expectancyCents,
    profitFactor: grossLoss === 0 ? null : grossProfit / grossLoss,
    totalPnlCents: pnls.reduce((total, pnl) => total + pnl, 0),
    averageRMultiple: averageRMultiple(closed),
    ruleCompliance:
      judged.length === 0 ? null : followed.length / judged.length,
    daysLogged: loggedDates.size,
  };
}
