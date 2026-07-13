-- Momentum: achievement unlocks
-- See myhub_plan.md Part B, Phase 5 (Momentum module)
--
-- One row per unlocked achievement. The catalog itself (titles, descriptions,
-- thresholds) lives in code, not here — it's static content that changes with
-- the roadmap, and a table would just be a second place to keep in sync. This
-- table records only the fact and the instant of each unlock.

create table achievements (
  id uuid primary key default gen_random_uuid(),
  -- Matches an AchievementKey in src/modules/momentum/achievementCatalog.ts.
  -- Deliberately a plain text column, not an enum: adding an achievement should
  -- be a code change, not a migration.
  key text not null,
  unlocked_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The idempotency backstop. The store already guards against double-unlocking
-- in memory (in-flight guard + synchronous diff-set update), but that only
-- protects a single tab: two tabs open, both evaluating the same threshold
-- crossing, would otherwise each insert a row and each pop a toast. This makes
-- the second insert a no-op at the database.
--
-- Partial, so it still honors soft deletes: an achievement that was somehow
-- soft-deleted can be legitimately re-unlocked later. Same lesson as
-- migration 0002's tasks_one_instance_per_occurrence.
create unique index achievements_one_unlock_per_key
  on achievements (key)
  where deleted_at is null;

create trigger achievements_set_updated_at
  before update on achievements
  for each row
  execute function set_updated_at();
