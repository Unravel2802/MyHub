import { subMonths } from "date-fns";
import { monthKeyOf } from "@/src/modules/finance/financePeriods";
import type { FinanceTransaction, Runway } from "@/src/modules/finance/types";

// How many months current savings last at the recent average monthly NET BURN
// (settled expenses minus income). The job-search runway metric.
//
// Returns null — the UI renders "—", never a misleading number — when there is
// nothing to project from (no completed-month activity) or when the average net
// is non-positive (you're breaking even or saving, so savings aren't being
// depleted and a finite runway would be wrong).
//
// Only COMPLETE months count: the current, still-partial month is excluded so a
// half-finished month doesn't halve the apparent burn. The average is over the
// trailing `windowMonths` complete months that actually had activity, so an
// empty month doesn't dilute the rate to zero.
export function computeRunway(
  transactions: FinanceTransaction[],
  currentSavingsCents: number,
  today: Date,
  windowMonths = 3,
): Runway | null {
  const currentKey = monthKeyOf(today);
  const windowKeys = new Set<string>();
  for (let i = 1; i <= windowMonths; i++) {
    windowKeys.add(monthKeyOf(subMonths(today, i)));
  }

  const netByMonth = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.deletedAt !== null || transaction.paidAt === null) continue;
    // occurredOn is already a local yyyy-MM-dd string, so slicing the month is
    // safe here (this is NOT the toISOString().slice UTC bug).
    const monthKey = transaction.occurredOn.slice(0, 7);
    if (monthKey === currentKey || !windowKeys.has(monthKey)) continue;
    const delta =
      transaction.kind === "expense"
        ? transaction.amountCents
        : -transaction.amountCents;
    netByMonth.set(monthKey, (netByMonth.get(monthKey) ?? 0) + delta);
  }

  if (netByMonth.size === 0) return null;

  const totalBurn = [...netByMonth.values()].reduce(
    (sum, monthNet) => sum + monthNet,
    0,
  );
  const avgMonthlyBurnCents = Math.round(totalBurn / netByMonth.size);
  if (avgMonthlyBurnCents <= 0) return null;

  return {
    months: currentSavingsCents / avgMonthlyBurnCents,
    avgMonthlyBurnCents,
  };
}
