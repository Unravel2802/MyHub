-- Job CRM: application notes + interview lifecycle timestamps
-- See myhub_plan.md Part B, Phase 4 (Job CRM depth)
--
-- Two things Wave 2 needs that the CRM doesn't currently record:
--
--   1. Applications have nowhere to put a takeaway. §11.2 asks for one
--      specific, actionable lesson per rejection; there's no column for it.
--   2. Interviews record THAT they were completed and THAT a post-mortem was
--      written, but not WHEN either happened. updated_at can't stand in — any
--      later edit overwrites it. Phase 5's "post-mortem within 24h of the
--      interview" achievement needs both instants as stored data rather than
--      something reconstructed after the fact.

alter table applications add column notes text;

alter table interviews add column completed_at timestamptz;
alter table interviews add column post_mortem_logged_at timestamptz;

-- Best-effort backfill, same reasoning as migration 0007's completed_at: for a
-- row that's already in its final state, updated_at is the closest available
-- approximation of when it got there. Approximate, not exact — it only affects
-- achievement history from before this migration, never anything going forward.
update interviews set completed_at = updated_at where completed = true;
update interviews
  set post_mortem_logged_at = updated_at
  where post_mortem_notes is not null and post_mortem_notes <> '';
