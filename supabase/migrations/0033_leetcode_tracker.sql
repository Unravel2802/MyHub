-- LeetCode Tracker: a revisitable problem bank + attempt history for algorithm
-- practice, with a Notion-style table/board view over it.
--
-- New module (not in myhub_plan.md — no wave scoped this). Prep Tracker's
-- 'algorithm' entry_type (migration 0003) already logs algorithm reps, but as
-- loose, unlinked rows: topic is free text, so nothing ties two attempts at
-- "Two Sum" together into one revisitable record. That's the same "problem
-- bank vs. rep log" split Design Drills already drew for system-design
-- practice (migration 0024's note, myhub_plan.md §2.3) — this is the LeetCode
-- analogue: a problem here is the reusable record, an attempt is one sitting
-- against it. Kept as its own sibling module rather than new columns on
-- prep_entries for the same reason. Cross-module: emits `leetcode.attempt_logged`
-- on the Event Bus (src/lib/events.ts) rather than writing into prep_entries
-- directly, per architecture rule 1.

create type leetcode_difficulty as enum ('easy', 'medium', 'hard');

-- Manual status the user sets on the problem itself (the board/kanban
-- grouping) — distinct from an individual attempt's outcome below. A problem
-- can be 'solved' overall while its most recent attempt was 'partial', e.g.
-- if it was solved on a prior sitting and is only being revisited for speed.
create type leetcode_status as enum (
  'to_review',
  'in_progress',
  'solved',
  'needs_revisit'
);

-- Mirrors prep_entries' algorithm outcome values (migration 0003) but kept as
-- a distinct type rather than reused: this table's shape is independently
-- owned by this module and shouldn't be coupled to Prep Tracker's enum.
create type leetcode_outcome as enum ('solved', 'partial', 'failed');

create table leetcode_problems (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  difficulty leetcode_difficulty not null,
  -- Free-form pattern/topic tags (e.g. 'DP', 'Two Pointers') — the Notion-style
  -- table/board filters and groups by these, so no fixed enum.
  tags text[] not null default '{}',
  status leetcode_status not null default 'to_review',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table leetcode_attempts (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references leetcode_problems (id),
  date date not null default current_date,
  time_to_solve_min int,
  outcome leetcode_outcome not null,
  -- The write-up / post-mortem for this sitting, so past attempts stay
  -- reviewable, not just their outcome. Mirrors design_drill_attempts.notes.
  notes text,
  -- User's own solution for this attempt. Rendered client-side via
  -- highlight.js (CLAUDE.md: "user's own scratchpad text" is the one
  -- sanctioned dangerouslySetInnerHTML use) — never through Markdown.tsx,
  -- and never raw HTML from anywhere else.
  solution_code text,
  solution_language text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- solution_language is meaningless without accompanying code; keep the pair
-- atomic rather than letting the UI render a language tag over an empty box.
alter table leetcode_attempts
  add constraint leetcode_attempts_solution_pair check (
    (solution_code is null and solution_language is null)
    or (solution_code is not null and solution_language is not null)
  );

-- Board/table view groups and filters by (status, difficulty); tags is
-- queried via the GIN index below for "filter by pattern".
create index leetcode_problems_status_difficulty_idx
  on leetcode_problems (status, difficulty)
  where deleted_at is null;

create index leetcode_problems_tags_idx
  on leetcode_problems using gin (tags)
  where deleted_at is null;

-- "This problem's attempt history" and "recent attempts across all problems"
-- are the two reads the detail view and history feed need.
create index leetcode_attempts_problem_id_idx
  on leetcode_attempts (problem_id)
  where deleted_at is null;

create index leetcode_attempts_date_idx
  on leetcode_attempts (date desc)
  where deleted_at is null;

create trigger leetcode_problems_set_updated_at
  before update on leetcode_problems
  for each row
  execute function set_updated_at();

create trigger leetcode_attempts_set_updated_at
  before update on leetcode_attempts
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012). Single-user: the gate is
-- "you must be signed in", not per-row ownership.
alter table leetcode_problems enable row level security;

drop policy if exists leetcode_problems_authenticated on leetcode_problems;
create policy leetcode_problems_authenticated on leetcode_problems
  for all to authenticated using (true) with check (true);

alter table leetcode_attempts enable row level security;

drop policy if exists leetcode_attempts_authenticated on leetcode_attempts;
create policy leetcode_attempts_authenticated on leetcode_attempts
  for all to authenticated using (true) with check (true);
