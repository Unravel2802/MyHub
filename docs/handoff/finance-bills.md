# Handoff — Finance Recurring Bills + Dashboard, Phase 2 (Claude Code → Codex)

Contract published for Phase 2 of the finance module (docs/finance-plan.md).
Migration `0020_recurring_bills.sql` must be applied to Supabase before this
works (the human applies it, same as 0019).

## What's published (mine — don't change the interface)

- **migration 0020** — `recurring_bills` (name, amount_cents, category,
  day_of_month, active, soft-delete, RLS) + the FK on
  `finance_transactions.bill_id` + the PLAIN unique `(bill_id, occurred_on)`.
- **`billRecurrence.ts`** — `dueDateFor` (clamps to month end), `missingBillInstances`,
  `billOccurrenceKey`. Unit-tested.
- **types.ts** — `RecurringBill`, `MonthSpend`.
- **FinanceRepository** — `getBills`, `createBill`, `updateBill`, `deleteBill`
  (soft), `regenerateMonthlyBillInstances(today)` (idempotent — inserts unpaid
  instances, 23505 = concurrent-write success), `payBillInstance(id)` (sets
  `paid_at`).
- **useFinanceStore** — `bills`, `fetchBills`, `createBill`/`updateBill`/
  `deleteBill`, `payBill(transactionId)` (optimistic). `fetchTransactions` now
  regenerates this month's bill instances before reading, so due bills appear on
  the finance page automatically.
- **financeSelectors** — `billsDueThisMonth`, `monthToDateSpend`.
- **useDashboardStore** — already regenerates bills + reads finance, and exposes
  `billsDue: FinanceTransaction[]` and `monthSpend: MonthSpend | null`.

## What's yours

1. **Bills management UI** on `/finance` — a section to list/add/edit/deactivate
   recurring bills (name, amount via `parseAmount`, category from
   `categoriesForKind('expense')`, day-of-month 1–31, active toggle). Wire to
   `store.fetchBills` (call on mount) + `createBill`/`updateBill`/`deleteBill`.
2. **Due vs paid in the ledger** — a generated bill instance is an expense with
   `billId != null` and `paidAt == null`. Mark it visually as "due" and add a
   "Mark paid" button that calls `store.payBill(transaction.id)`. Once paid it
   counts toward the month summary; while due it does not.
3. **Two dashboard panels** — render `dashboard.billsDue` ("Bills due this
   month", each with name/amount/due date via `formatCents`) and
   `dashboard.monthSpend` ("Month-to-date", spent + net). Follow the existing
   dashboard panel style (e.g. the schedule / follow-ups panels). **Never tint
   absence** — an empty bills list or a zero spend renders "—"/an EmptyState,
   untinted.
4. **Tests** — extend `useFinanceStore.test.ts` (bill CRUD + `payBill` optimistic
   - rollback; the FinanceRepository mock already lists the new methods) and the
     finance E2E (add a bill → its instance appears due → mark paid → summary
     updates). A dashboard E2E asserting the two panels render is welcome.

## Not in this phase

Budgets and the runway metric are Phase 3 (`finance_budgets`, `finance_settings`,
`budgetProgress`, `runway`). `payBillInstance` keeps the bill's expected amount;
if the actual differed, the user edits the transaction — no partial-payment model
in this phase.
