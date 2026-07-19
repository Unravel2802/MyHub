-- Personal Finance: recurring bills (Phase 2)
-- See docs/finance-plan.md
--
-- A recurring bill (rent, electricity, ...) is a TEMPLATE: one row here, matched
-- by monthly INSTANCES in finance_transactions (bill_id set, paid_at null until
-- paid). Same template/instance shape as the Task Engine's recurrence. Money in
-- integer cents. day_of_month is the due day; generation clamps it to the
-- month's last day (Feb, 30-day months) in code (billRecurrence.dueDateFor).

create table recurring_bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_cents integer not null check (amount_cents >= 0),
  -- Matches a key in financeCategories.ts, same as finance_transactions.category.
  category text not null,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger recurring_bills_set_updated_at
  before update on recurring_bills
  for each row
  execute function set_updated_at();

alter table recurring_bills enable row level security;

create policy recurring_bills_authenticated on recurring_bills
  for all to authenticated using (true) with check (true);

-- Now that recurring_bills exists, wire finance_transactions.bill_id to it and
-- add the idempotency backstop for generated instances.
--
-- PLAIN unique, not a partial index (the 42P10 lesson from migrations
-- 0015/0017/0018). NULL bill_id — every ad-hoc transaction — is DISTINCT under a
-- unique constraint (two NULLs don't compare equal), so ad-hoc rows never
-- collide; only two instances of the same bill on the same due date do, which is
-- exactly the one-instance-per-bill-per-month guard we want. Generation inserts
-- and treats a 23505 as a concurrent-write success, same as the task board.
alter table finance_transactions
  add constraint finance_transactions_bill_id_fkey
  foreign key (bill_id) references recurring_bills (id);

alter table finance_transactions
  add constraint finance_transactions_one_instance_per_bill_month
  unique (bill_id, occurred_on);
