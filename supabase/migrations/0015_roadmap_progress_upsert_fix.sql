-- Roadmap: make the upsert actually work
--
-- Migration 0014 gave roadmap_progress a PARTIAL unique index:
--
--   create unique index roadmap_progress_one_per_item
--     on roadmap_progress (item_key) where deleted_at is null;
--
-- which is the pattern the rest of this schema uses (achievements,
-- weekly_reviews, task recurrence) and is correct *as an integrity constraint*.
-- But it cannot serve as an ON CONFLICT target: PostgREST emits a plain
-- `ON CONFLICT (item_key)`, and Postgres will only infer a PARTIAL index if the
-- statement repeats its WHERE clause — which PostgREST never does.
--
-- Result: every upsert failed with 42P10 ("no unique or exclusion constraint
-- matching the ON CONFLICT specification"). Ticking a criterion and claiming a
-- readiness level both silently failed and rolled back. The E2E mock faked the
-- upsert, so nothing caught it until the page was driven against a real database.
--
-- The elsewhere-correct partial index is wrong HERE because this table is
-- upserted by key. A plain unique constraint is what ON CONFLICT needs, and it
-- costs nothing: un-ticking soft-deletes the row, and re-ticking UPSERTS the same
-- row and clears deleted_at, so there is never a second live row for a key
-- anyway. One row per item_key, forever.

drop index if exists roadmap_progress_one_per_item;

alter table roadmap_progress
  add constraint roadmap_progress_item_key_unique unique (item_key);
