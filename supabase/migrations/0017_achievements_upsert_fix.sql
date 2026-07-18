-- Momentum: make the achievement unlock upsert actually work
--
-- Same bug, same fix as migration 0015 (roadmap_progress). Migration 0010 gave
-- `achievements` a PARTIAL unique index:
--
--   create unique index achievements_one_unlock_per_key
--     on achievements (key) where deleted_at is null;
--
-- which is correct as an integrity constraint but CANNOT serve as an ON CONFLICT
-- target: PostgREST emits a plain `ON CONFLICT (key)`, and Postgres only infers a
-- partial index if the statement repeats its WHERE clause — which PostgREST never
-- does. So insertUnlocks (MomentumRepository) failed with 42P10 on every unlock
-- and rolled back. No achievement ever persisted, the table stayed empty, and
-- because the store re-derives "newly unlocked" by diffing the earned set against
-- the (always empty) achievements table on every refresh, the unlock toast
-- re-fired on every page change and every reload. The E2E mock faked the upsert,
-- so nothing caught it — exactly the blind spot migration 0015 called out.
--
-- A plain unique constraint is what ON CONFLICT needs. An achievement is a
-- permanent, never-revoked unlock, so one row per key forever is exactly the
-- right integrity model (no soft-delete/re-unlock cycle to preserve, unlike
-- roadmap criteria).

drop index if exists achievements_one_unlock_per_key;

alter table achievements
  add constraint achievements_key_unique unique (key);
