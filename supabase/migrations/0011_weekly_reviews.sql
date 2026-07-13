-- Weekly Review ritual
-- See myhub_plan.md Part B, Phase 6 (§14's Sunday review block, §15's quarterly questions)
--
-- One row per Monday-start week. The reflection text is the point, but the
-- `snapshot` column is what makes the history trustworthy: it FREEZES the
-- week's actual numbers at the moment you saved the review. Recomputing them
-- later from live data would quietly rewrite history — soft-delete a prep entry
-- in December and your October review would silently change what it said you'd
-- done that week. A review is a record of what you knew when you wrote it.

create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  -- The Monday of the week under review. Same Monday-start convention as
  -- dashboardSelectors.weekBounds and taskRecurrence.
  week_start date not null,
  went_well text,
  needs_work text,
  next_week_fix text,
  -- The five §15 questions, answered only on quarter-boundary weeks. Null the
  -- rest of the year — jsonb rather than five columns because the question set
  -- belongs to the roadmap, not to the schema, and adding a sixth question
  -- shouldn't be a migration.
  quarterly_answers jsonb,
  -- Frozen WeeklyReviewSnapshot (see reviewLogic.ts). Not null: a review
  -- without its numbers is just a diary entry.
  snapshot jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One review per week. Partial so it honors soft deletes, same as
-- achievements_one_unlock_per_key and tasks_one_instance_per_occurrence.
-- Backs upsertReview's onConflict: "week_start" — re-saving a week's review
-- updates it rather than stacking duplicates.
create unique index weekly_reviews_one_per_week
  on weekly_reviews (week_start)
  where deleted_at is null;

create trigger weekly_reviews_set_updated_at
  before update on weekly_reviews
  for each row
  execute function set_updated_at();
