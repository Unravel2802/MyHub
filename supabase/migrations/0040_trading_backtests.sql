-- Trading backtests: the results of the Python backtest lab in
-- ~/Documents/Trading, imported so strategies can be compared inside MyHub
-- instead of only in a Streamlit window.
--
-- IMPORTED ARTIFACT, not user data. These rows are produced by
-- backtest_engine.simulate() and the CSVs are gitignored regenerable output —
-- the source of truth stays the Python lab. scripts/seedBacktests.ts loads
-- them and is re-runnable; nothing in the app writes here.
--
-- WHY double precision, when migration 0038 insists money is integer cents:
-- these are not a ledger. Entry prices carry full float precision
-- (25.6966176085191) and r_multiple is a sub-cent ratio; rounding either into
-- cents would corrupt the very numbers this table exists to report. 0038's
-- cents rule governs money the user actually traded — this is analysis output.

-- The engine's own exit codes (backtest_engine.simulate). Lowercased from the
-- CSV's STOP/SIGNAL/END_OF_DATA to match every other enum in this schema; the
-- mapping lives in backtestCsv.ts and is unit-tested.
--
-- 'end_of_data' is not an exit the strategy chose — it means the backtest
-- window ended with the position still open, so those trades are censored and
-- shouldn't be read as decisions.
create type trading_backtest_exit_reason as enum (
  'stop',
  'signal',
  'end_of_data'
);

create table trading_backtest_strategies (
  id uuid primary key default gen_random_uuid(),
  -- Stable handle from strategies.py's registry (e.g. 'donchian_breakout').
  -- Used for routing and as the seed's upsert target, so it must not depend on
  -- the display label, which carries human noise like "(original)".
  key text not null,
  -- Exactly as backtest_comparison.csv writes it, so a row can be traced back
  -- to the artifact that produced it without guesswork.
  label text not null,
  -- Summary metrics, one row per strategy, straight from the comparison CSV.
  trades integer not null,
  -- PERCENT (44.88), not a fraction — named _pct so nobody divides by 100
  -- twice. Same for the two below; the engine emits all three as percentages.
  win_rate_pct double precision not null,
  avg_r double precision not null,
  profit_factor double precision not null,
  sharpe double precision not null,
  -- The engine reports Sharpe both after and before costs; keeping both makes
  -- the slippage assumption visible rather than buried.
  sharpe_before_costs double precision not null,
  cagr_pct double precision not null,
  -- NEGATIVE by convention (-20.63) — a drawdown is a fall. Deliberately not
  -- stored as a magnitude, so the sign never has to be re-derived.
  max_dd_pct double precision not null,
  end_value double precision not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PLAIN unique, never partial. This is the seed's ON CONFLICT target, and a
-- partial unique index cannot be one — the 42P10 bug that shipped green three
-- times in this repo (migrations 0015/0017/0018, docs/db-integration-tests.md).
alter table trading_backtest_strategies
  add constraint trading_backtest_strategies_key_unique unique (key);

create table trading_backtest_trades (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references trading_backtest_strategies (id),
  ticker text not null,
  entry_date date not null,
  exit_date date not null,
  entry_price double precision not null,
  stop_price double precision not null,
  exit_price double precision not null,
  -- Fractional: the engine sizes by risk, not round lots.
  shares double precision not null,
  exit_reason trading_backtest_exit_reason not null,
  commission double precision not null default 0,
  pnl_dollars double precision not null,
  -- Profit in units of the risk taken. The engine's headline per-trade metric.
  r_multiple double precision not null,
  -- Calendar days held, as the engine computes it.
  holding_days integer not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A backtest cannot exit before it enters. Cheap guard against a malformed or
-- mis-parsed CSV row landing silently — the seed reads ~2,900 rows unattended.
alter table trading_backtest_trades
  add constraint trading_backtest_trades_dates_ordered check (
    exit_date >= entry_date
  );

-- "Show me this strategy's trades, most recent first" is the only read the
-- browser makes, so index the way it queries.
create index trading_backtest_trades_strategy_idx
  on trading_backtest_trades (strategy_id, exit_date desc)
  where deleted_at is null;

create trigger trading_backtest_strategies_set_updated_at
  before update on trading_backtest_strategies
  for each row
  execute function set_updated_at();

create trigger trading_backtest_trades_set_updated_at
  before update on trading_backtest_trades
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012). Single-user: the gate is
-- "you must be signed in", not per-row ownership.
alter table trading_backtest_strategies enable row level security;

drop policy if exists trading_backtest_strategies_authenticated
  on trading_backtest_strategies;
create policy trading_backtest_strategies_authenticated
  on trading_backtest_strategies
  for all to authenticated using (true) with check (true);

alter table trading_backtest_trades enable row level security;

drop policy if exists trading_backtest_trades_authenticated
  on trading_backtest_trades;
create policy trading_backtest_trades_authenticated
  on trading_backtest_trades
  for all to authenticated using (true) with check (true);
