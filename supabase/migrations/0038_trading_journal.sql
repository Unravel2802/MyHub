-- Trading Journal: a daily signal log plus the trades those signals opened and
-- closed. Port of ~/Documents/Trading/trading-journal.html, whose entire
-- persistence was one localStorage key.
--
-- New module, and the first citizen of the "money" mini-app alongside Finance
-- (src/components/miniApps.ts). myhub_plan.md §A.3 previously listed "No
-- Quant/Finance tracking module" — that was a scope assumption (MyHub *is* the
-- job-search tool) which no longer holds, not a rule being broken. Roadmap §13's
-- actual concern, that quant not eat planned engineering time, is honored
-- structurally instead: this module emits NO Event Bus events and is deliberately
-- absent from Momentum's ActivitySnapshot, so trading can never inflate the
-- career streak or heatmap.
--
-- TWO TABLES, and that split is the point. The source logged BUY and SELL as
-- separate rows and wrote the same `pnl` onto BOTH of them, so every closed
-- trade was counted twice in win rate, expectancy and total P&L. Here an ENTRY
-- is one dated log line and a TRADE is the unit of P&L: `pnl_cents` lives on the
-- trade, once, and the BUY entry and its later SELL entry both point at it.
--
-- Money is integer CENTS, never floats (src/lib/money.ts) — the
-- ledger discipline Finance already established. `shares` is the exception and
-- is numeric: fractional share quantities are real (the source data carries
-- values like 2.4734964858), and rounding them would corrupt the P&L they
-- multiply into.

-- Why the trade was closed. 'manual' covers a discretionary exit; the other
-- three are the source system's rule-driven exits (R3 and R4 of its rule set).
create type trading_exit_reason as enum (
  'ema_crossover_bearish',
  'rsi_overbought',
  'stop_loss',
  'manual'
);

-- What the log line records. 'hold' is a real, useful entry — a day you looked
-- and deliberately did nothing is worth keeping — and is the reason `trade_id`
-- below is nullable.
create type trading_signal as enum ('buy', 'sell', 'hold');

-- The source stored these as emoji-prefixed display strings ("😰 Anxious").
-- Normalized to an enum: the emoji is a presentation concern for the UI, not
-- something the database should be matching on.
create type trading_emotion as enum (
  'neutral',
  'anxious',
  'frustrated',
  'excited',
  'confident',
  'uncertain',
  'fomo'
);

create table trading_trades (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  entry_date date not null default current_date,
  entry_price_cents integer not null,
  -- The protective stop. Nullable because a trade can be logged before the stop
  -- is decided, but r-multiple is uncomputable without it (see rMultiple.ts).
  stop_price_cents integer,
  -- Fractional by design — see the header note on why this is not an integer.
  shares numeric not null,
  exit_date date,
  exit_price_cents integer,
  exit_reason trading_exit_reason,
  -- SIGNED: a loss is negative, which is exactly why finance's parseAmount
  -- (non-negative only) cannot be reused as-is for this field. Null while open.
  pnl_cents integer,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- An open trade has all four exit fields null; a closed one has all four set.
-- Modelled on design_drill_attempts_completion_is_atomic (migration 0024) — the
-- point is that no row can claim an exit price without also carrying the P&L it
-- implies, which is what keeps "closed" a single, trustworthy predicate for the
-- stats to filter on.
alter table trading_trades
  add constraint trading_trades_close_is_atomic check (
    (exit_date is null and exit_price_cents is null
      and exit_reason is null and pnl_cents is null)
    or (exit_date is not null and exit_price_cents is not null
      and exit_reason is not null and pnl_cents is not null)
  );

-- Shares must be a positive quantity. A zero would make r-multiple divide by
-- zero; a negative would silently invert every P&L sign downstream.
alter table trading_trades
  add constraint trading_trades_shares_positive check (shares > 0);

-- Prices are positive. Deliberately NOT applied to pnl_cents, which is signed.
alter table trading_trades
  add constraint trading_trades_prices_positive check (
    entry_price_cents > 0
    and (stop_price_cents is null or stop_price_cents > 0)
    and (exit_price_cents is null or exit_price_cents > 0)
  );

create table trading_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  ticker text not null,
  signal trading_signal not null,
  -- The observed price when the line was logged. Nullable: a 'hold' entry is
  -- often just an observation with no price worth recording.
  price_cents integer,
  -- The source crammed both EMAs into ONE free-text field ("750.06 / 739.00"),
  -- which made them unusable for anything but display. Two columns.
  ema_fast_cents integer,
  ema_slow_cents integer,
  -- RSI(14). numeric(5,2) because it is a bounded 0-100 indicator, not money.
  rsi numeric(5, 2),
  emotion trading_emotion,
  -- The discipline signal the source tracked as 'yes'/'no'. Nullable = not yet
  -- judged, matching how prep_entries treats an unjudged outcome.
  rules_followed boolean,
  -- Only meaningful when rules_followed is false; the CHECK below enforces that
  -- rather than trusting the form. NOTE: that CHECK is corrected in migration
  -- 0039 — as written here it passes on a NULL rules_followed.
  rule_break text,
  notes text,
  -- How a BUY line and its later SELL line resolve to ONE trade. Null for a
  -- 'hold', and null for a buy/sell logged before its trade row exists.
  trade_id uuid references trading_trades (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A rule-break note only makes sense on an entry that broke the rules. Without
-- this, a form that flips rules_followed back to true leaves an orphaned
-- explanation behind, and the compliance stat starts disagreeing with what the
-- entry visibly says.
alter table trading_entries
  add constraint trading_entries_rule_break_needs_a_break check (
    rule_break is null or rules_followed = false
  );

alter table trading_entries
  add constraint trading_entries_rsi_in_range check (
    rsi is null or (rsi >= 0 and rsi <= 100)
  );

-- A 'hold' is an observation, not a position, so it must not claim a trade.
alter table trading_entries
  add constraint trading_entries_hold_has_no_trade check (
    signal <> 'hold' or trade_id is null
  );

-- The journal reads "most recent first", and the stats scan closed trades. Both
-- filtered on deleted_at, so both indexes are partial to match.
create index trading_entries_date_idx
  on trading_entries (date desc)
  where deleted_at is null;

-- "Which entries belong to this trade" — the read the trade detail view makes.
create index trading_entries_trade_id_idx
  on trading_entries (trade_id)
  where deleted_at is null and trade_id is not null;

create index trading_trades_entry_date_idx
  on trading_trades (entry_date desc)
  where deleted_at is null;

-- The equity curve and every stat walk CLOSED trades in exit order.
create index trading_trades_exit_date_idx
  on trading_trades (exit_date desc)
  where deleted_at is null and exit_date is not null;

create trigger trading_trades_set_updated_at
  before update on trading_trades
  for each row
  execute function set_updated_at();

create trigger trading_entries_set_updated_at
  before update on trading_entries
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012). Single-user: the gate is
-- "you must be signed in", not per-row ownership.
alter table trading_trades enable row level security;

drop policy if exists trading_trades_authenticated on trading_trades;
create policy trading_trades_authenticated on trading_trades
  for all to authenticated using (true) with check (true);

alter table trading_entries enable row level security;

drop policy if exists trading_entries_authenticated on trading_entries;
create policy trading_entries_authenticated on trading_entries
  for all to authenticated using (true) with check (true);
