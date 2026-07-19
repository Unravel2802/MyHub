export type TransactionKind = "income" | "expense";

// A ledger row. Money is integer cents (see money.ts) — the UI formats at the
// edge, never stores dollars. `occurredOn` is a yyyy-MM-dd date string.
export interface FinanceTransaction {
  id: string;
  kind: TransactionKind;
  amountCents: number;
  category: string;
  occurredOn: string;
  note: string | null;
  // The recurring bill this row was generated from (Phase 2); null for ad-hoc.
  billId: string | null;
  // Null while a generated bill instance is still due; set when paid. Ad-hoc
  // rows are settled at creation.
  paidAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// The income / expense / net totals for a month, in integer cents.
export interface MonthlySummary {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

// A recurring bill TEMPLATE (rent, utilities, ...). Generates one unpaid
// instance per month into finance_transactions (Phase 2). `dayOfMonth` is the
// due day (1-31), clamped to the month's end by billRecurrence.dueDateFor.
export interface RecurringBill {
  id: string;
  name: string;
  amountCents: number;
  category: string;
  dayOfMonth: number;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// The dashboard's month-to-date figure: settled spend + net, in integer cents.
export interface MonthSpend {
  spentCents: number;
  netCents: number;
}

// A due bill instance enriched with its template name, for the dashboard panel.
// The name lives on recurring_bills (not on the transaction row), so the
// selector joins it in — the raw FinanceTransaction has no name to show.
export interface BillDue {
  transactionId: string;
  billId: string;
  name: string;
  amountCents: number;
  occurredOn: string;
}
