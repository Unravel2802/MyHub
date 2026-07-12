-- Job Application CRM: Companies, Applications, Interviews
-- See myhub_plan.md §2.3 (Job Application CRM)
--
-- Note the distinction from Prep Tracker: `interviews` here are real interviews
-- tied to a specific application. PrepEntries with entry_type = 'mock_interview'
-- are practice reps in a separate table. Do not conflate the two.

create type company_tier as enum ('reach', 'match', 'safety');

create type resume_variant as enum ('swe_backend', 'mle_ml_infra');

create type application_stage as enum (
  'researching',
  'applied',
  'oa',
  'phone_screen',
  'onsite',
  'offer',
  'rejected',
  'withdrawn'
);

create type interview_round_type as enum (
  'coding',
  'system_design',
  'ml_system_design',
  'behavioral',
  'other'
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier company_tier not null,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  role_title text not null,
  resume_variant resume_variant not null,
  stage application_stage not null default 'researching',
  applied_date date,
  -- Defaults to creation time so "no update in >7 days" (§2.3 Dashboard panel) is
  -- meaningful from the first row, not null until someone touches it.
  last_update_date date not null default current_date,
  referral_source text,
  follow_up_date date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id),
  round_type interview_round_type not null,
  scheduled_at timestamptz not null,
  completed boolean not null default false,
  outcome text,
  post_mortem_notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_company_id_idx on applications (company_id);
create index applications_stage_idx
  on applications (stage)
  where deleted_at is null;
-- Backs the Dashboard's "needs follow-up" panel: follow_up_date today-or-earlier,
-- or no update in >7 days (§2.3).
create index applications_follow_up_idx
  on applications (follow_up_date)
  where deleted_at is null;
create index applications_last_update_idx
  on applications (last_update_date)
  where deleted_at is null;

create index interviews_application_id_idx on interviews (application_id);
-- Backs the Dashboard's post-mortem reminder: completed interviews with no notes
-- yet, within the roadmap's 24-hour window (§11.2).
create index interviews_completed_idx
  on interviews (completed, scheduled_at)
  where deleted_at is null;

create trigger companies_set_updated_at
  before update on companies
  for each row
  execute function set_updated_at();

create trigger applications_set_updated_at
  before update on applications
  for each row
  execute function set_updated_at();

create trigger interviews_set_updated_at
  before update on interviews
  for each row
  execute function set_updated_at();
