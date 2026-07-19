-- Personal Finance: "Owed to me" receivables
-- See docs/handoff/finance-receivables.md
--
-- Money someone owes YOU that hasn't arrived yet — a request/receivable, NOT a
-- transaction. It lives in its own table precisely so it does NOT count as
-- income until paid: recording it as a settled transaction up front would
-- inflate your income before the money exists. When marked paid, the repository
-- creates a real settled income transaction and links it via transaction_id.

create table finance_receivables (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  amount_cents integer not null check (amount_cents >= 0),
  reason text,
  -- When you plan to request it / expect it back. Null = no date.
  due_on date,
  status text not null default 'not_requested'
    check (status in ('not_requested', 'requested', 'paid')),
  -- The settled income transaction created when this was marked paid; null until.
  transaction_id uuid references finance_transactions (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger finance_receivables_set_updated_at
  before update on finance_receivables
  for each row
  execute function set_updated_at();

alter table finance_receivables enable row level security;

create policy finance_receivables_authenticated on finance_receivables
  for all to authenticated using (true) with check (true);
