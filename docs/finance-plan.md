# Personal Finance Tracker — Plan

Net-new module, outside the original job-search roadmap. Added because the user
is now handling recurring living costs (rent, gas, electricity, …) and wants to
track them inside MyHub.

**Not investment advice** — this is expense/income record-keeping only. No
portfolio, no securities, no personalized financial advice.

## Locked scope (user decisions, 2026-07-19)

- **Full tracker**: ledger → recurring bills → budgets + runway (all three phases).
- **Income and expenses** both (enables net cash flow and runway).
- **Dashboard surfaces**: "bills due this month" and "month-to-date spend".

## Architecture fit (inherited constraints)

- New module `src/modules/finance/`. One Zustand store (`useFinanceStore`), one
  `FinanceRepository.ts`. Own tables — no God Table.
- **Money is integer cents, never floats.** Every amount column is
  `integer amount_cents`; all arithmetic stays in cents; formatting to dollars
  happens only at the UI edge (`money.ts`).
- **Soft deletes** (`deleted_at`) on every table; **RLS** policies on every table
  mirroring migration 0012.
- **Categories live in code**, not a table — `financeCategories.ts`, the same
  "static classification lives in code" pattern as `achievementCatalog.ts` /
  `roadmapCatalog.ts`. A `category` text column references the catalog. The
  category→hue map is Codex's app-knowledge (like the funnel-stage→hue map).
- **No Event Bus additions.** Nothing consumes finance events (momentum tracks
  job-search activity, not spending). The dashboard reads finance through the
  repository, the established cross-module read pattern. If a future feature
  needs a finance event, that's a new contract change, not a speculative hook.
- **Repository pattern** for all DB access; **store errors** are generic to the
  user, real error to `console.error` (`toUserMessage` helper).
- **Date math via `format()`, never `.slice(0, 10)`** — the timezone bug class
  that has recurred repeatedly in this repo.
- **Every idempotency/uniqueness index is a PLAIN unique constraint, never a
  partial index** — direct application of the 42P10 bug fixed in migrations
  0015/0017/0018. A partial unique index (`where deleted_at is null`) cannot be
  an `ON CONFLICT` target and silently fails every upsert.

## Data model

The core modeling choice mirrors the Task Engine: **one ledger table holds both
ad-hoc transactions and generated recurring-bill instances**, exactly as `tasks`
holds ad-hoc tasks plus recurrence instances (`recurrence_template_id`). This
avoids double-counting a bill as both an "obligation" and a "transaction".

### `finance_transactions` (migration 0019)

| column                     | type                               | notes                                                                 |
| -------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `id`                       | uuid pk                            | `default gen_random_uuid()`                                           |
| `kind`                     | text not null                      | `check (kind in ('income','expense'))`                                |
| `amount_cents`             | integer not null                   | `check (amount_cents >= 0)` — always positive; `kind` gives direction |
| `category`                 | text not null                      | validated in code against `financeCategories`                         |
| `occurred_on`              | date not null                      | when money moved; for an unpaid bill instance, the due date           |
| `note`                     | text                               |                                                                       |
| `bill_id`                  | uuid null                          | `references recurring_bills(id)`; null = ad-hoc                       |
| `paid_at`                  | timestamptz null                   | ad-hoc rows settle on create; a bill instance stays null until paid   |
| `deleted_at`               | timestamptz                        |                                                                       |
| `created_at`, `updated_at` | timestamptz not null default now() | `updated_at` via `set_updated_at` trigger                             |

Derived reads:

- **Bills due this month** = `bill_id is not null and paid_at is null and occurred_on` in month.
- **Month-to-date spend** = `kind='expense' and paid_at is not null`, bucketed by month.

### `recurring_bills` (migration 0020) — templates

`id`, `name` (e.g. "Rent", "Electricity"), `amount_cents`, `category`,
`day_of_month smallint check (between 1 and 31)`, `active boolean not null
default true`, `deleted_at`, timestamps.

Generates one unpaid instance per active bill per month into
`finance_transactions`, idempotently. Uniqueness backstop:

```sql
alter table finance_transactions
  add constraint finance_transactions_one_instance_per_bill_month
  unique (bill_id, occurred_on);
```

PLAIN unique (not partial) so it can be an `ON CONFLICT` target. Generation
mirrors `TaskRepository.regenerateWeeklyInstances` and handles the 23505
unique-violation as a concurrent-write success.

### `finance_budgets` (migration 0021)

`id`, `category text`, `amount_cents` (monthly limit), `deleted_at`, timestamps.
Plain `unique (category)` — one standing monthly limit per category. Budget
progress = sum of that category's expenses in the current month vs the limit.

### `finance_settings` (migration 0022, Phase 3)

Single row: `current_savings_cents integer not null default 0`, `updated_at`.
Runway needs a real savings figure, not just net-flow-since-you-started. Guarded
to a single row (e.g. a fixed `id` or a `check` on a singleton column).

## Pure / correctness-critical logic (Claude-owned, unit-tested)

- `money.ts` — `parseAmount("12.50") → 1250`, `formatCents(1250) → "$12.50"`; sums
  stay in integer cents. Handles negative-guard, bad input.
- `financePeriods.ts` — month bounds and "which month does date X belong to",
  via `date-fns` `format()` (timezone-safe).
- `billRecurrence.ts` — `dueDateFor(bill, month)`, `missingBillInstances(bills,
existingKeys, today)`, mirroring `taskRecurrence.ts`.
- `financeSelectors.ts` — `monthlySummary` (in / out / net), `monthToDateSpend`,
  `billsDueThisMonth`, `budgetProgress`.
- `runway.ts` — `runway = current_savings_cents ÷ avg monthly net burn`; returns
  `null` (renders "—") when burn is zero or positive (never a misleading number).

## Repository surface (Claude publishes the interface first)

```
getTransactions(range?) / createTransaction / updateTransaction / deleteTransaction (soft)
getBills / createBill / updateBill / deleteBill (soft)
regenerateMonthlyBillInstances(today): FinanceTransaction[]   // idempotent
payBillInstance(transactionId)                                // sets paid_at, actual amount
getBudgets / upsertBudget / deleteBudget (soft)
getSettings / updateSavings(cents)                            // Phase 3
```

## Store (`useFinanceStore`)

`transactions`, `bills`, `budgets`, `settings`, `selectedMonth`, `isLoading`,
`error`, `pendingIds`, plus all actions with optimistic update + rollback and a
`toUserMessage` helper (console.error the real error, generic string to the UI).

## Dashboard integration

Two pure selectors added to `dashboardSelectors.ts` (`billsDueThisMonth`,
`monthToDateSpend`), rendered as two dashboard panels (Codex). The dashboard
store calls `regenerateMonthlyBillInstances()` **before** reading — the same
generate-then-read fix applied to the weekly schedule, so bills appear even if
`/finance` is never opened that month.

## New module hue: `lime`

All 10 existing `HueName`s are taken; money reads green and emerald is Offers.
Add `lime`:

- `moduleHues.ts` — add to the `HueName` union and `MODULE_HUES['/finance'] = 'lime'`.
- `globals.css` — `--hue-lime` / `-surface` / `-border` tokens (light + dark),
  cleared against the WCAG AA gate; plus `@theme` mappings.
- `hueClasses.ts` — add `lime` to all five maps (`HUE_DOT`, `HUE_NAV_ACTIVE`,
  `HUE_BADGE`, `HUE_PROGRESS`, `HUE_STATCARD`).
- `palette.test.ts` — add `lime` to `HUES` so its text token is AA-gated.
- `appNav.ts` — `{ href: "/finance", label: "Finances", icon: <lucide icon> }`.

## Migrations

- `0019_finance_transactions.sql` (+ RLS)
- `0020_recurring_bills.sql` (+ RLS, plain unique `(bill_id, occurred_on)`)
- `0021_finance_budgets.sql` (+ RLS, plain unique `(category)`)
- `0022_finance_settings.sql` (+ RLS, single-row guard) — Phase 3

## Phasing & Claude/Codex split

| Phase                     | Claude (contract-first)                                                                                                                                            | Codex                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **1 — Ledger**            | migration 0019 + RLS; `money` / `financePeriods` / catalog; `FinanceRepository` (txn CRUD) + `useFinanceStore` interfaces; `monthlySummary`; the `lime` hue        | `/finance` page, txn form (react-hook-form), month switcher + list, category→hue map, E2E |
| **2 — Bills + dashboard** | migration 0020; `billRecurrence` + `regenerateMonthlyBillInstances` + `payBillInstance`; `billsDue` / `monthToDate` selectors; dashboard generate-then-read wiring | bills CRUD UI, mark-paid, the two dashboard panels, E2E                                   |
| **3 — Budgets + runway**  | migrations 0021–0022; `budgetProgress` + `runway`                                                                                                                  | budgets UI (reuse `ProgressBar`), runway card + savings editor, E2E                       |

## Verification

- Unit gate (`money`, periods, recurrence, runway, budget) + the `palette.test.ts`
  AA gate for `lime`.
- Because the Playwright mock accepts any POST (the blind spot that hid the 42P10
  bugs), **each migration is verified against the real database with a
  service-role probe** — insert/upsert actually persists, and the recurring-bill
  `ON CONFLICT` does not 42P10 — the same probe method used to confirm the
  achievement/weekly-review fixes.
- E2E for the ledger add/edit flow, bill mark-paid, and budget progress.

## Open items (revisit if the user prefers otherwise)

- Budgets are a standing monthly limit per category, not per-category-per-month
  history. History would need a `(category, month)` table; deferred unless wanted.
- Savings is a user-set figure (`finance_settings`), not a computed running
  balance from a seeded starting balance. Simpler and more honest for runway.
