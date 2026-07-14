-- Task Engine: archiving completed work
-- See myhub_plan.md Part B (Wave 2 follow-up)
--
-- Until now the ONLY way to clear a finished task off the board was to delete
-- it. That soft-deletes, and getTasks excludes soft-deleted rows — so Momentum
-- lost the completion too, and tidying your board silently erased streak
-- history. `delete` was carrying two incompatible meanings: "this was a
-- mistake, it never happened" AND "this happened, I'm done looking at it".
--
-- This column separates them. Archiving hides a task from the board while
-- keeping the row alive and its completed_at intact, so the streak is
-- untouched. Deleting still means it never happened.
--
-- Note this is NOT the whole feature: done tasks also leave the board
-- automatically once their completion week has passed, and that half is derived
-- from completed_at at render time (see taskBoardUtils.isArchived) with nothing
-- written to the database. This column exists solely for the MANUAL "archive it
-- now" action, which can't be inferred from a date.

alter table tasks add column archived_at timestamptz;

-- Archived tasks are excluded from the board but still fetched (Momentum needs
-- their completed_at), so the board filters in memory rather than in the query.
-- The index is here for the archive VIEW, which does ask the database for
-- "everything archived, newest first".
create index tasks_archived_at_idx
  on tasks (archived_at desc)
  where deleted_at is null and archived_at is not null;
