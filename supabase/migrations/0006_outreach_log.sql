-- Outreach Log: OutreachLog table
-- See myhub_plan.md §2.3 (Outreach Log) and §2.5 (why this exists)
--
-- Fifth MVP module, added 2026-07-13 once engineering_first_roadmap_v2.md §11.1/
-- §11.2 showed a weekly-tracked activity (2-3 outreach conversations/week) with
-- nowhere to log it. Deliberately its own table, not a field bolted onto
-- Applications: a conversation doesn't always correspond to an application yet.

create type outreach_channel as enum (
  'linkedin',
  'email',
  'alumni_network',
  'professor_referral',
  'other'
);

create table outreach_log (
  id uuid primary key default gen_random_uuid(),
  contact_name text,
  company_id uuid references companies (id),
  channel outreach_channel not null,
  date date not null default current_date,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The Dashboard's weekly-cadence panel queries "how many this week" — index the
-- way it queries, same as prep_entries (migration 0003) and applications
-- (migration 0004).
create index outreach_log_date_idx
  on outreach_log (date)
  where deleted_at is null;

create trigger outreach_log_set_updated_at
  before update on outreach_log
  for each row
  execute function set_updated_at();
