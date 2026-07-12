-- Task Engine: description + minimal weekly recurrence
-- See myhub_plan.md §2.3 (Task Engine)
--
-- Template/instance model: a row with recurs_weekly = true is a *rule*, not a
-- work item. It never appears on the board. Each week it generates an ordinary
-- task (the instance) carrying recurrence_template_id + occurrence_date. The
-- instance is what gets dragged and completed; the template survives to generate
-- next week's.

alter table tasks
  add column description text,
  add column recurs_weekly boolean not null default false,
  add column weekday smallint,
  add column recurrence_template_id uuid references tasks (id),
  add column occurrence_date date;

-- A template repeats on exactly one weekday (0 = Sunday, matching JS getDay()).
-- A non-template has no weekday at all.
alter table tasks
  add constraint tasks_weekday_matches_recurrence check (
    (recurs_weekly and weekday between 0 and 6)
    or (not recurs_weekly and weekday is null)
  );

-- An instance carries both of its recurrence fields, or neither.
alter table tasks
  add constraint tasks_instance_fields_together check (
    (recurrence_template_id is null and occurrence_date is null)
    or (recurrence_template_id is not null and occurrence_date is not null)
  );

-- A template is a rule, so it cannot itself be a generated instance.
alter table tasks
  add constraint tasks_template_is_not_instance check (
    not (recurs_weekly and recurrence_template_id is not null)
  );

-- Idempotent regeneration. Two concurrent page loads cannot both insert the same
-- occurrence. Note this index intentionally counts soft-deleted rows: deleting
-- this week's instance means "I'm not doing it this week", so it must not come
-- back on the next load. Next week's occurrence is a different date, so it still
-- generates normally.
create unique index tasks_one_instance_per_occurrence
  on tasks (recurrence_template_id, occurrence_date)
  where recurrence_template_id is not null;

create index tasks_templates_idx
  on tasks (weekday)
  where recurs_weekly and deleted_at is null;
