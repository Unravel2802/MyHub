import { isInMonth } from "@/src/modules/finance/financePeriods";
import { sumCents } from "@/src/modules/finance/money";
import type {
  BillDue,
  Budget,
  BudgetProgress,
  FinanceTransaction,
  MonthlySummary,
  MonthSpend,
  RecurringBill,
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
// rows (bill_id set) that haven't been paid yet, each enriched with its bill's
// name from `bills` (the transaction row carries no name). Drives the
// dashboard's "bills due this month" panel. Soft-deleted rows excluded; a bill
// whose template is gone falls back to a generic label rather than dropping.
export function billsDueThisMonth(
  transactions: FinanceTransaction[],
  bills: RecurringBill[],
  date: Date,
): BillDue[] {
  const nameByBillId = new Map(bills.map((bill) => [bill.id, bill.name]));

  return transactions
    .filter(
      (transaction) =>
        transaction.deletedAt === null &&
        transaction.billId !== null &&
        transaction.paidAt === null &&
        isInMonth(transaction.occurredOn, date),
    )
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
    .map((transaction) => ({
      transactionId: transaction.id,
      billId: transaction.billId as string,
      name: nameByBillId.get(transaction.billId as string) ?? "Recurring bill",
      amountCents: transaction.amountCents,
      occurredOn: transaction.occurredOn,
    }));
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

// This month's settled spend per budgeted category against its limit. Only
// SETTLED expenses count (an unpaid due bill isn't spent yet), same rule as the
// summary. Soft-deleted budgets and transactions are excluded.
export function budgetProgressForMonth(
  transactions: FinanceTransaction[],
  budgets: Budget[],
  date: Date,
): BudgetProgress[] {
  const spentByCategory = new Map<string, number>();
  for (const transaction of transactions) {
    if (
      transaction.deletedAt === null &&
      transaction.kind === "expense" &&
      transaction.paidAt !== null &&
      isInMonth(transaction.occurredOn, date)
    ) {
      spentByCategory.set(
        transaction.category,
        (spentByCategory.get(transaction.category) ?? 0) +
          transaction.amountCents,
      );
    }
  }

  return budgets
    .filter((budget) => budget.deletedAt === null)
    .map((budget) => ({
      category: budget.category,
      limitCents: budget.amountCents,
      spentCents: spentByCategory.get(budget.category) ?? 0,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
