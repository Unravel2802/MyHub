// The finance category catalog — static classification that lives in code, not
// a table (same pattern as achievementCatalog.ts / roadmapCatalog.ts). A
// transaction's `category` column holds one of these keys. Codex owns the
// category -> hue map used to color them (app-knowledge, like the
// funnel-stage -> hue map); this file is just the valid keys + labels.

export interface FinanceCategory {
  key: string;
  label: string;
  // Which transaction kinds this category is offered for. "both" shows up in
  // either dropdown.
  kind: "expense" | "income" | "both";
}

export const FINANCE_CATEGORIES: FinanceCategory[] = [
  { key: "rent", label: "Rent", kind: "expense" },
  { key: "utilities", label: "Utilities", kind: "expense" }, // gas, electricity, water
  { key: "groceries", label: "Groceries", kind: "expense" },
  { key: "transport", label: "Transport", kind: "expense" },
  { key: "dining", label: "Dining out", kind: "expense" },
  { key: "subscriptions", label: "Subscriptions", kind: "expense" },
  { key: "health", label: "Health", kind: "expense" },
  { key: "savings", label: "Savings", kind: "expense" },
  { key: "stipend", label: "Internship / salary", kind: "income" },
  { key: "reimbursement", label: "Reimbursement", kind: "income" }, // money owed to you, once paid
  { key: "other_income", label: "Other income", kind: "income" },
  { key: "other", label: "Other", kind: "both" },
];

const CATEGORY_KEYS = new Set(
  FINANCE_CATEGORIES.map((category) => category.key),
);

export function isFinanceCategory(key: string): boolean {
  return CATEGORY_KEYS.has(key);
}

export function categoriesForKind(
  kind: "income" | "expense",
): FinanceCategory[] {
  return FINANCE_CATEGORIES.filter(
    (category) => category.kind === kind || category.kind === "both",
  );
}
