-- Task Engine: completion timestamps
-- See myhub_plan.md Part B, Phase 2 (Momentum foundation)
--
-- Nothing records WHEN a task became done today — only status and updated_at,
-- and updated_at gets overwritten by any later edit, not just a completion.
-- Wave 2's Momentum module (streaks, achievements) needs a real completion
-- timestamp to know "was a task finished today", so this adds one.

alter table tasks add column completed_at timestamptz;

-- Best-effort backfill for tasks that were already done before this column
-- existed: updated_at is the closest approximation of "when it became done"
-- available (the trigger in migration 0001 bumps it on every update, and for
-- a task that's sat in "done" since before this migration, its most recent
-- update is very likely the completion itself). Approximate, not exact —
-- streak history from before 2026-07-13 will be fuzzy. Acceptable: it only
-- affects historical streak data, not anything going forward.
update tasks set completed_at = updated_at where status = 'done';

-- Backs Momentum's streak query ("was anything completed today"), matching
-- the pattern of migration 0003's prep_entries_date_idx / 0006's
-- outreach_log_date_idx: index the column the way it'll actually be queried.
create index tasks_completed_at_idx
  on tasks (completed_at)
  where deleted_at is null and completed_at is not null;
