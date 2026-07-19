# Handoff — Finance Budgets + Runway, Phase 3 (Claude Code → Codex)

Contract published for Phase 3 — the final finance phase (docs/finance-plan.md).
Migrations `0021_finance_budgets.sql` and `0022_finance_settings.sql` must be
applied to Supabase before this works.

## What's published (mine — don't change the interface)

- **migration 0021** — `finance_budgets` (category, amount_cents, soft-delete,
  RLS) with a PLAIN unique `(category)`.
- **migration 0022** — `finance_settings`, a single-row table (`id boolean
primary key check (id)`) holding `current_savings_cents`.
- **types.ts** — `Budget`, `BudgetProgress`, `FinanceSettings`, `Runway`.
- **runway.ts** — `computeRunway(transactions, savingsCents, today, windowMonths=3)`.
  Averages net burn over trailing COMPLETE months with activity; returns **null**
  (render "—") when not depleting savings or when there's no data. Unit-tested.
- **financeSelectors** — `budgetProgressForMonth(transactions, budgets, date)`
  (settled expenses per budgeted category vs its limit). Unit-tested.
- **FinanceRepository** — `getBudgets`, `upsertBudget(category, amountCents)`
  (upsert on the unique category, revives soft-deleted), `deleteBudget(id)`,
  `getSettings`, `updateSavings(cents)`.
- **useFinanceStore** — `budgets`, `settings`, `fetchBudgets`, `upsertBudget`,
  `deleteBudget`, `fetchSettings`, `updateSavings`; plus derived
  `budgetProgressForMonth(date)` and `runwayFor(date)`.

## What's yours

1. **Budgets UI** on /finance — set/edit/remove a monthly limit per category
   (category from `categoriesForKind('expense')`, amount via `parseAmount`).
   Render `store.budgetProgressForMonth(month)` as per-category progress
   (**reuse the `ProgressBar` primitive**, hue via the existing
   financeCategoryHues map). Over-budget (spent > limit) should read clearly —
   `ProgressBar` clamps the fill but the number can exceed 100%.
2. **Runway card** — a "current savings" editable field wired to
   `store.settings` + `store.updateSavings`, and the runway from
   `store.runwayFor(month)`. Render `runway.months` as e.g. "4.2 months of
   runway"; when it's `null`, render "—" (never a fake number) with a short
   explanation ("you're not drawing down savings" / "not enough history").
   Call `store.fetchSettings()` + `store.fetchBudgets()` on mount.
3. **Never tint absence** — a zero/empty budget list, a "—" runway: untinted.
4. **Tests** — extend `useFinanceStore.test.ts` (budget upsert/delete +
   savings update, optimistic where applicable; the FinanceRepository mock
   already lists getBudgets/upsertBudget/deleteBudget/getSettings/updateSavings)
   and the finance E2E (set a budget → progress shows; set savings → runway
   shows or "—").

## Notes

- Money is integer cents throughout — `parseAmount` in, `formatCents` out.
- Budget progress counts SETTLED expenses only (an unpaid due bill isn't spent
  yet), same rule as the month summary.
- This completes the finance module. No further phases.
