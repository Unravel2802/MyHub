# Handoff — Finance Ledger, Phase 1 (Claude Code → Codex)

Contract published for the Personal Finance module's Phase 1 (ledger). Full spec:
`docs/finance-plan.md`. Migration `0019_finance_transactions.sql` must be applied
to Supabase before the feature works (the human applies it, same as 0017/0018).

## What's published (mine — don't change the interface)

- **`migration 0019`** — `finance_transactions` (integer `amount_cents`, `kind`,
  `category`, `occurred_on`, `note`, `bill_id`, `paid_at`, soft-delete, RLS).
- **`src/modules/finance/types.ts`** — `FinanceTransaction`, `TransactionKind`,
  `MonthlySummary`.
- **`money.ts`** — `parseAmount` (string → integer cents, or null), `formatCents`,
  `sumCents`. **All money stays in integer cents**; format only at the UI edge.
- **`financePeriods.ts`** — `monthKeyOf`, `monthBounds`, `isInMonth` (local-time,
  via `format()` — never `.slice()`).
- **`financeCategories.ts`** — the category catalog + `categoriesForKind`. The
  **category → hue map is yours** (app-knowledge, like the funnel-stage → hue map).
- **`financeSelectors.ts`** — `monthlySummary` (settled rows only; unpaid bill
  instances and soft-deletes excluded).
- **`FinanceRepository.ts`** — `getTransactions`, `createTransaction`,
  `updateTransaction`, `deleteTransaction` (fully implemented, soft-delete).
- **`useFinanceStore.ts`** — `transactions`, `isLoading`/`isCreating`/`pendingIds`/
  `error`, the four CRUD actions (optimistic + rollback), `summaryForMonth`.
- Nav: `/finance` → "Finances", hue `lime` (new `HueName`, propagated through
  `globals.css`, `hueClasses.ts`, `palette.test.ts`).

## What's yours

1. **The real `/finance` page** — `app/finance/page.tsx` is a placeholder mounting
   `AppShell` + an `EmptyState`. Replace the body with the ledger UI: a month
   switcher, the transaction list (grouped/sorted by `occurredOn`), a
   `monthlySummary` header (in / out / net via `formatCents`), and an add/edit
   form (`react-hook-form` or controlled state). Follow `WeeklyReview.tsx` /
   `PrepTracker.tsx` for the `PageHeader` + form patterns.
2. **The add/edit form** — kind toggle (income/expense), amount (parse with
   `parseAmount`, show a validation error when it returns null — never send a bad
   value), `categoriesForKind(kind)` dropdown, date, optional note.
3. **The category → hue map** — a `Record<categoryKey, HueName>` for coloring
   category badges/dots. This is the app-knowledge constant that's yours.
4. **Unit + E2E** — a `useFinanceStore` test (mock `FinanceRepository`, like
   `useDashboardStore.test.ts`) covering optimistic create/update/delete +
   rollback; a Playwright spec for add → appears in list → summary updates →
   edit → delete.

## Not in this phase

Recurring bills, budgets, runway, and the dashboard panels are Phases 2–3
(`docs/finance-plan.md`). `bill_id`/`paid_at` exist on the row now but nothing
generates bill instances yet — every ad-hoc transaction is created settled
(`paid_at = now()`), so `monthlySummary` counts it immediately.
