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
