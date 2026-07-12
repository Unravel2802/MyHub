-- Prep Tracker: PrepEntries + BehavioralStories
-- See myhub_plan.md §2.3 (Prep Tracker)
--
-- Simplest schema of the four MVP modules: no nesting, no self-joins.

create type prep_entry_type as enum (
  'algorithm',
  'system_design',
  'ml_system_design',
  'behavioral',
  'mock_interview'
);

-- §2.3 left this open ("store as free-form text if a fixed enum is too rigid").
-- Going with an enum: the roadmap's scorecards count solve *rates*, and free text
-- makes that a string-matching exercise. The per-entry_type validity rules are a
-- CHECK constraint below rather than separate columns.
create type prep_outcome as enum (
  'solved',
  'partial',
  'failed',
  'pass',
  'needs_work'
);

create table prep_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type prep_entry_type not null,
  topic text,
  date date not null default current_date,
  duration_min int,
  -- Algorithm entries only: the roadmap tracks average time-to-solve (§6.1).
  time_to_solve_min int,
  outcome prep_outcome,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Outcomes are scoped to the kind of entry they describe: an algorithm problem is
-- solved/partial/failed, everything else passes or needs work. Always nullable —
-- you can log a rep before you've judged it.
alter table prep_entries
  add constraint prep_entries_outcome_matches_type check (
    outcome is null
    or (entry_type = 'algorithm' and outcome in ('solved', 'partial', 'failed'))
    or (entry_type <> 'algorithm' and outcome in ('pass', 'needs_work'))
  );

-- time_to_solve_min is meaningless outside algorithm entries; keep it out rather
-- than letting the scorecard average over rows that never had one.
alter table prep_entries
  add constraint prep_entries_time_to_solve_is_algorithm_only check (
    time_to_solve_min is null or entry_type = 'algorithm'
  );

create table behavioral_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  theme text,
  concise_version text,
  extended_version text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The scorecard reads "this month, by type", so index the way it queries.
create index prep_entries_date_idx
  on prep_entries (date, entry_type)
  where deleted_at is null;

create trigger prep_entries_set_updated_at
  before update on prep_entries
  for each row
  execute function set_updated_at();

create trigger behavioral_stories_set_updated_at
  before update on behavioral_stories
  for each row
  execute function set_updated_at();
