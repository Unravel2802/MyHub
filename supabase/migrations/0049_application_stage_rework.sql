-- Job CRM: rework the application stages (user request, 2026-11-04).
--
--   - `phone_screen` becomes `interview` — the stage covers any first-round
--     interview, not only a phone call.
--   - New `awaiting_result`, after `onsite`: interviews are done and the
--     decision is pending.
--   - `withdrawn` is removed. Existing withdrawn rows become `rejected`, the
--     only remaining closed-without-offer stage, so they stay out of the
--     dashboard's follow-up list exactly as before.
--
-- Postgres can't drop an enum value, so the type is rebuilt and every row
-- converted. Nothing else (views, functions, other columns) uses the type.

alter type application_stage rename to application_stage_old;

create type application_stage as enum (
  'researching',
  'applied',
  'oa',
  'interview',
  'onsite',
  'awaiting_result',
  'offer',
  'rejected'
);

alter table applications alter column stage drop default;

alter table applications
  alter column stage type application_stage
  using (
    case stage::text
      when 'phone_screen' then 'interview'
      when 'withdrawn' then 'rejected'
      else stage::text
    end
  )::application_stage;

alter table applications alter column stage set default 'researching';

drop type application_stage_old;
