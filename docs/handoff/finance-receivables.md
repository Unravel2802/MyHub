# Handoff — "Owed to me" Receivables (Claude Code → Codex)

Contract published for the "Owed to me" tracker — a follow-up feature that lives
on /finance alongside Recurring Bills, Budgets, and Transactions. Migration
`0023_finance_receivables.sql` must be applied to Supabase before it works.

Why a table and not just a category: money someone owes you hasn't arrived, so
it must NOT count as income until paid. Recording it as a settled transaction up
front would inflate income. A receivable becomes an income transaction only when
you mark it paid.

## What's published (mine — don't change the interface)

- **migration 0023** — `finance_receivables` (person, amount_cents, reason,
  due_on, status ∈ not_requested|requested|paid, transaction_id → the income
  transaction created when paid, soft-delete, RLS).
- **types.ts** — `Receivable`, `ReceivableStatus`.
- **financeCategories.ts** — new **`reimbursement`** income category (the paid
  receivable's ledger entry uses it). Already added to `financeCategoryHues`
  (mapped to `teal`, the income family) to keep the sync test green — re-tune
  that hue if you prefer.
- **FinanceRepository** — `getReceivables`, `createReceivable`,
  `updateReceivable`, `deleteReceivable`, and `markReceivablePaid(id)`, which
  creates a SETTLED income transaction (category "reimbursement", dated today,
  note = person[: reason]) and marks the receivable paid + linked. It guards
  double-conversion (an already-paid receivable returns its existing transaction,
  never a second one).
- **useFinanceStore** — `receivables`, `fetchReceivables`, `createReceivable`,
  `updateReceivable`, `deleteReceivable`, `markReceivablePaid` (the new income
  transaction lands in `transactions` automatically), plus derived
  `outstandingReceivables()` and `totalOwedCents()`.
- **financeSelectors** — `outstandingReceivables` (unpaid, soonest-due-first) and
  `totalOwedCents`. Unit-tested.

## What's yours

1. **"Owed to me" panel** on /finance (a new Panel beside Recurring Bills /
   Budgets). Call `store.fetchReceivables()` on mount. Show
   `store.outstandingReceivables()` with a headline `formatCents(store.totalOwedCents())`
   total owed. Each row: person, amount, reason, due date, and a status.
2. **Add/edit form** (a dialog like the others): person, amount (via parseAmount,
   block on null), optional reason, optional due date, status. Wire
   create/update/deleteReceivable.
3. **Status + "Mark paid"** — let the user advance status (Not requested →
   Requested), and a "Mark paid" action calling `store.markReceivablePaid(id)`.
   After it, the row shows paid and a matching income transaction appears in the
   ledger + the month summary (it's real, settled money now).
4. **The "forgot to request" nudge** — surface entries with status
   "not_requested" prominently (that's the whole point: not forgetting). A count
   or a highlighted subsection within the panel is enough. Never tint absence
   (no outstanding → an untinted EmptyState / "—").
5. **Tests** — extend useFinanceStore.test.ts (receivable CRUD + markReceivablePaid
   moves it to paid AND prepends the income transaction; the FinanceRepository
   mock already lists the new methods) and the finance E2E (add a receivable →
   it shows outstanding → mark paid → it's paid + a reimbursement income row is
   in the ledger and the summary reflects it).

## Notes

- Money is integer cents; parseAmount in, formatCents out.
- markReceivablePaid is the ONLY path from receivable → income — don't create the
  income transaction yourself in the UI.
- Dashboard placement was considered and declined — keep it on /finance for now.
  A dashboard "you're owed $X, N not yet requested" nudge is an easy future
  follow-up (the selectors already support it), not part of this task.
