-- Personal Finance: single-row settings (Phase 3)
-- See docs/finance-plan.md
--
-- Holds the current-savings figure the runway metric needs (savings ÷ average
-- monthly burn = how many months of job-search the savings sustain).
-- Deliberately a SINGLE row: `id boolean primary key check (id)` can only ever
-- be true, so exactly one settings row can exist. updateSavings upserts on id.

create table finance_settings (
  id boolean primary key default true check (id),
  current_savings_cents integer not null default 0 check (current_savings_cents >= 0),
  updated_at timestamptz not null default now()
);

create trigger finance_settings_set_updated_at
  before update on finance_settings
  for each row
  execute function set_updated_at();

alter table finance_settings enable row level security;

create policy finance_settings_authenticated on finance_settings
  for all to authenticated using (true) with check (true);
