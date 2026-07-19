import { isInMonth } from "@/src/modules/finance/financePeriods";
import { sumCents } from "@/src/modules/finance/money";
import type {
  FinanceTransaction,
  MonthlySummary,
  MonthSpend,
} from "@/src/modules/finance/types";

// The income / expense / net totals for the month containing `date`. Only
// SETTLED rows count (paid_at not null) — an unpaid bill instance is an
// obligation, not money that has moved, so it must never inflate the summary.
// Soft-deleted rows are excluded.
export function monthlySummary(
  transactions: FinanceTransaction[],
  date: Date,
): MonthlySummary {
  const settled = transactions.filter(
    (transaction) =>
      transaction.deletedAt === null &&
      transaction.paidAt !== null &&
      isInMonth(transaction.occurredOn, date),
  );

  const incomeCents = sumCents(
    settled
      .filter((transaction) => transaction.kind === "income")
      .map((transaction) => transaction.amountCents),
  );
  const expenseCents = sumCents(
    settled
      .filter((transaction) => transaction.kind === "expense")
      .map((transaction) => transaction.amountCents),
  );

  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

// The unpaid bill instances due in the month containing `date` — generated
// rows (bill_id set) that haven't been paid yet. Drives the dashboard's
// "bills due this month" panel. Soft-deleted rows excluded.
export function billsDueThisMonth(
  transactions: FinanceTransaction[],
  date: Date,
): FinanceTransaction[] {
  return transactions
    .filter(
      (transaction) =>
        transaction.deletedAt === null &&
        transaction.billId !== null &&
        transaction.paidAt === null &&
        isInMonth(transaction.occurredOn, date),
    )
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
}

// Month-to-date settled spend and net for the dashboard, derived from the same
// settled-only rule as monthlySummary.
export function monthToDateSpend(
  transactions: FinanceTransaction[],
  date: Date,
): MonthSpend {
  const summary = monthlySummary(transactions, date);
  return { spentCents: summary.expenseCents, netCents: summary.netCents };
}
