import type { HueName } from "@/src/components/moduleHues";

export type FinanceCategoryKey =
  | "rent"
  | "utilities"
  | "groceries"
  | "transport"
  | "dining"
  | "subscriptions"
  | "health"
  | "savings"
  | "stipend"
  | "reimbursement"
  | "other_income"
  | "other";

export const FINANCE_CATEGORY_HUES: Record<FinanceCategoryKey, HueName> = {
  rent: "violet",
  utilities: "amber",
  groceries: "emerald",
  transport: "blue",
  dining: "orange",
  subscriptions: "fuchsia",
  health: "rose",
  savings: "lime",
  stipend: "teal",
  reimbursement: "teal", // income sibling of stipend; Codex may re-tune
  other_income: "cyan",
  other: "accent",
};
