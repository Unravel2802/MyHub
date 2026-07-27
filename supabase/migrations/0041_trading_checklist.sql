-- The daily pre-trade checklist: one row per day recording which discipline
-- items were ticked before trading.
--
-- In the source (trading-journal.html) this was a pure DOM toggle — the
-- checkboxes reset on every reload and nothing was ever stored, so the "Daily
-- Rules" tab could not answer the one question worth asking of it: did you
-- actually run the checklist on the days you traded? Persisting it is the whole
-- point of porting it.
--
-- The items themselves live in CODE (src/modules/trading/tradingRulesCatalog.ts),
-- not in a table — static classification, same pattern as financeCategories.ts
-- and achievementCatalog.ts. This table stores only WHICH keys were ticked, so
-- editing a rule's wording never requires a data migration.

create table trading_checklist_runs (
  id uuid primary key default gen_random_uuid(),
  -- One run per calendar day. `date`, not a timestamp: the checklist is a daily
  -- ritual, and the question is "was it done that day", not "at what instant".
  date date not null default current_date,
  -- Keys from tradingRulesCatalog.ts's PRE_TRADE_CHECKLIST. Deliberately a
  -- key array rather than a boolean column per item: the checklist has changed
  -- before and will again, and a column-per-item schema would need a migration
  -- every time. An unknown key here means a retired item — the UI ignores it
  -- rather than the read failing.
  checked_keys text[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PLAIN unique, never partial. Ticking a box upserts on `date`, and a partial
-- unique index CANNOT be an ON CONFLICT target — PostgREST emits a bare
-- ON CONFLICT (date) and the write silently rolls back with 42P10. That bug
-- shipped green three times in this repo (migrations 0015/0017/0018) precisely
-- because the unit and Playwright suites cannot see it; see
-- docs/db-integration-tests.md and the db test covering this exact upsert.
alter table trading_checklist_runs
  add constraint trading_checklist_runs_date_unique unique (date);

-- The checklist reads "today", and the compliance history reads a date range —
-- both most-recent-first.
create index trading_checklist_runs_date_idx
  on trading_checklist_runs (date desc)
  where deleted_at is null;

create trigger trading_checklist_runs_set_updated_at
  before update on trading_checklist_runs
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012). Single-user: the gate is
-- "you must be signed in", not per-row ownership.
alter table trading_checklist_runs enable row level security;

drop policy if exists trading_checklist_runs_authenticated
  on trading_checklist_runs;
create policy trading_checklist_runs_authenticated
  on trading_checklist_runs
  for all to authenticated using (true) with check (true);
