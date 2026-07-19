-- Personal Finance: the transaction ledger
-- See docs/finance-plan.md (Phase 1)
--
-- One ledger table holds BOTH ad-hoc transactions and generated recurring-bill
-- instances, mirroring the Task Engine (tasks holds ad-hoc tasks + recurrence
-- instances). Money is stored as integer CENTS — never a float/numeric that
-- invites rounding drift. `kind` gives direction; `amount_cents` is always >= 0.
--
-- `bill_id` links a row to the recurring_bills template it was generated from
-- (migration 0020, Phase 2); null for ad-hoc entries. Its FK and the
-- (bill_id, occurred_on) uniqueness backstop land WITH migration 0020, when the
-- referenced table and the generation logic exist. That backstop will be a PLAIN
-- unique constraint — a partial index cannot be an ON CONFLICT target (the 42P10
-- lesson, migrations 0015/0017/0018).
--
-- `paid_at` is null while a generated bill instance is still DUE; ad-hoc rows are
-- settled at creation (the repository stamps paid_at = now()).

create table finance_transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  -- Always positive; direction comes from `kind`. Integer cents, never a float.
  amount_cents integer not null check (amount_cents >= 0),
  -- Matches a key in src/modules/finance/financeCategories.ts. Plain text, not
  -- an enum: adding a category should be a code change, not a migration (same
  -- reasoning as achievements.key and the roadmap catalog).
  category text not null,
  -- The day the money moved. For an unpaid generated bill instance, the due date.
  occurred_on date not null,
  note text,
  -- Set on rows generated from a recurring bill (Phase 2); null = ad-hoc. FK
  -- added in migration 0020, once recurring_bills exists.
  bill_id uuid,
  -- Null while a generated bill instance is still due; ad-hoc rows settle on
  -- creation. Marking a bill paid sets this.
  paid_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_transactions_occurred_on_idx
  on finance_transactions (occurred_on)
  where deleted_at is null;

create trigger finance_transactions_set_updated_at
  before update on finance_transactions
  for each row
  execute function set_updated_at();

-- Single-user gate, same model as migration 0012: signed-in or nothing.
alter table finance_transactions enable row level security;

create policy finance_transactions_authenticated on finance_transactions
  for all to authenticated using (true) with check (true);
