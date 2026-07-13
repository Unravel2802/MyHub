-- Prep Tracker: mock interview subtypes + resume/project deep-dive entries
-- See myhub_plan.md Part B, Phase 3 (Prep depth)
--
-- The roadmap's month-by-month mock targets (§6.5) are per-subtype (coding /
-- system-design / ML-system-design), but entry_type: 'mock_interview' has been
-- one undifferentiated bucket since migration 0003. This adds the subtype
-- without touching existing rows' meaning: NULL stays valid and means
-- "mock logged before this migration, or logged without picking a subtype" —
-- it must keep counting toward the combined target rather than vanishing.
--
-- §11.3's time-allocation table also has a "Resume/project deep-dive" row that
-- prep_entry_type has no slot for; this adds it as a sixth entry type.

create type mock_subtype as enum ('coding', 'system_design', 'ml_system_design');

alter table prep_entries add column mock_subtype mock_subtype;

alter table prep_entries
  add constraint prep_entries_mock_subtype_is_mock_only check (
    mock_subtype is null or entry_type = 'mock_interview'
  );

-- Postgres forbids using a new enum value in the same transaction it's added
-- in, so this migration only adds the label — nothing here may reference
-- 'resume_deep_dive' yet. The existing outcome CHECK (migration 0003) already
-- covers it correctly: entry_type <> 'algorithm' routes to pass/needs_work,
-- and 'resume_deep_dive' <> 'algorithm' is true, so no CHECK edit is needed.
alter type prep_entry_type add value 'resume_deep_dive';
