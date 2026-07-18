-- Weekly Review: make the upsert actually work
--
-- The third and last instance of the 42P10 bug fixed in migrations 0015
-- (roadmap_progress) and 0017 (achievements). Migration 0011 gave
-- `weekly_reviews` a PARTIAL unique index:
--
--   create unique index weekly_reviews_one_per_week
--     on weekly_reviews (week_start) where deleted_at is null;
--
-- correct as an integrity constraint but unusable as an ON CONFLICT target:
-- PostgREST emits a bare `ON CONFLICT (week_start)`, and Postgres won't infer a
-- partial index unless the statement repeats its WHERE clause. So upsertReview
-- (ReviewRepository) failed with 42P10 on every save and rolled back — saving a
-- weekly review silently did nothing. Confirmed against the real database: the
-- upsert returns 42P10. The E2E mock accepts any POST, so the suite never saw it.
--
-- A plain unique constraint is what ON CONFLICT needs. The app never
-- soft-deletes a review (ReviewRepository has no delete path), so one row per
-- week_start forever is the right integrity model, same as achievements.

drop index if exists weekly_reviews_one_per_week;

alter table weekly_reviews
  add constraint weekly_reviews_week_start_unique unique (week_start);
