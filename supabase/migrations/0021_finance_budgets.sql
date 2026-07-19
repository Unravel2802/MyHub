-- Personal Finance: per-category budgets (Phase 3)
-- See docs/finance-plan.md
--
-- A standing monthly spending limit per category. One row per category — a
-- PLAIN unique constraint (the 42P10 lesson, migrations 0015/0017/0018) so
-- upsertBudget's ON CONFLICT (category) works and can revive a soft-deleted
-- budget by clearing deleted_at. Money in integer cents.

create table finance_budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount_cents integer not null check (amount_cents >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger finance_budgets_set_updated_at
  before update on finance_budgets
  for each row
  execute function set_updated_at();

alter table finance_budgets
  add constraint finance_budgets_category_unique unique (category);

alter table finance_budgets enable row level security;

create policy finance_budgets_authenticated on finance_budgets
  for all to authenticated using (true) with check (true);
