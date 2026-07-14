-- Roadmap: manual ticks and self-assessed readiness
-- See docs/roadmap-module.md
--
-- The roadmap's CONTENT is static — it lives in engineering_first_roadmap_v2.md
-- and changes only via a commit — so the catalog of months, criteria and
-- readiness bars lives in code (roadmapCatalog.ts), exactly like
-- achievementCatalog. This table stores only what's genuinely DATA: what you
-- ticked, and how you rate yourself.
--
-- Deliberately NOT stored: anything derivable. "20 algorithms" is computed from
-- prep_entries at read time and can never be ticked by hand — the number IS the
-- truth. A roadmap you can mark complete without doing the work is a roadmap
-- that lies to you.

create type roadmap_entry_kind as enum ('criterion', 'readiness');

-- not_started -> minimum -> strong, matching §6.1's matrix. Only meaningful for
-- `readiness` rows; a criterion is simply ticked or not (its presence here IS
-- the tick).
create type readiness_level as enum ('not_started', 'minimum', 'strong');

create table roadmap_progress (
  id uuid primary key default gen_random_uuid(),
  kind roadmap_entry_kind not null,
  -- Matches a key in roadmapCatalog.ts. Plain text, not an enum: adding a
  -- criterion should be a code change, not a migration.
  item_key text not null,
  -- Set for kind = 'criterion'. When you ticked it.
  completed_at timestamptz,
  -- Set for kind = 'readiness'. Your self-assessed level for that area.
  level readiness_level,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A criterion row must carry a tick; a readiness row must carry a level. Keeps
-- the two shapes from bleeding into each other in one table.
alter table roadmap_progress
  add constraint roadmap_progress_shape_matches_kind check (
    (kind = 'criterion' and completed_at is not null and level is null)
    or (kind = 'readiness' and level is not null and completed_at is null)
  );

-- One row per item. Partial so it honors soft deletes, and it backs the
-- upsert's onConflict — un-ticking is a soft delete, re-ticking reuses the key.
-- Same idempotency backstop as achievements_one_unlock_per_key.
create unique index roadmap_progress_one_per_item
  on roadmap_progress (item_key)
  where deleted_at is null;

create trigger roadmap_progress_set_updated_at
  before update on roadmap_progress
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012). Single-user: the gate is
-- "you must be signed in", not per-row ownership.
alter table roadmap_progress enable row level security;

drop policy if exists roadmap_progress_authenticated on roadmap_progress;
create policy roadmap_progress_authenticated on roadmap_progress
  for all to authenticated using (true) with check (true);
