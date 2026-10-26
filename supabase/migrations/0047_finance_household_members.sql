-- Personal Finance: the household a monthly rent split is computed over.
-- See docs/handoff/finance-split-bill.md ("Rent split").
--
-- Saved once so each month only the utility totals need typing. Each person's
-- room rent differs (rent_cents); utilities are split evenly across everyone,
-- including you. Exactly one live row may be you (is_me) — your share is shown
-- but never becomes a receivable. A split itself is not stored here: it writes
-- ordinary finance_receivables rows, one per other person.

create table finance_household_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  rent_cents integer not null default 0 check (rent_cents >= 0),
  is_me boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Live names are unique (case-insensitive) — the receivable is keyed by name.
create unique index finance_household_members_name_live
  on finance_household_members (lower(trim(name)))
  where deleted_at is null;

-- At most one live "me".
create unique index finance_household_members_one_me
  on finance_household_members (is_me)
  where is_me and deleted_at is null;

create trigger finance_household_members_set_updated_at
  before update on finance_household_members
  for each row
  execute function set_updated_at();

alter table finance_household_members enable row level security;

create policy finance_household_members_authenticated on finance_household_members
  for all to authenticated using (true) with check (true);
