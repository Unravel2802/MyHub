-- Enable Row Level Security on every table
-- See myhub_plan.md Part B, Phase 7 (Auth + RLS)
--
-- Until now the anon key could read and write everything — fine for a
-- local-only tool, not fine the moment this is deployed anywhere reachable.
--
-- MyHub is deliberately SINGLE-USER: there are no user_id columns and no
-- per-row ownership, because there is exactly one person's data in this
-- database. So the policy is not "you may see your own rows" but "you must be
-- signed in at all." That's the entire security model, and it's the right one
-- for the actual threat (a stranger finding the URL), not a watered-down
-- version of a multi-tenant one.
--
-- If MyHub ever becomes multi-user, this migration is where that assumption
-- breaks, and every policy below needs a user_id predicate. Noted here rather
-- than discovered later.
--
-- Note on the RPC: task_descendant_ids (migration 0005) is SECURITY INVOKER
-- (the default), so it executes as the calling user and RLS applies THROUGH it.
-- No separate grant is needed, and a SECURITY DEFINER function here would have
-- quietly punched a hole straight through these policies.

alter table tasks enable row level security;
alter table prep_entries enable row level security;
alter table behavioral_stories enable row level security;
alter table companies enable row level security;
alter table applications enable row level security;
alter table interviews enable row level security;
alter table outreach_log enable row level security;
alter table achievements enable row level security;
alter table weekly_reviews enable row level security;

-- Drop any pre-existing dev escape hatch before granting the real policy.
--
-- This is not hypothetical: a `dev_full_access` policy (to public, for all,
-- using (true)) was sitting on `tasks` from early development, and Postgres ORs
-- policies together — so it silently defeated tasks_authenticated no matter how
-- many times this migration ran. RLS was ON and the table was still world-
-- readable. Enabling RLS is therefore NOT enough on its own; you must also know
-- that nothing else already grants access.
--
-- Anything permissive and unqualified belongs in this list, not just the one we
-- actually hit. If you add a policy by hand while debugging, add its drop here.
drop policy if exists dev_full_access on tasks;
drop policy if exists dev_full_access on prep_entries;
drop policy if exists dev_full_access on behavioral_stories;
drop policy if exists dev_full_access on companies;
drop policy if exists dev_full_access on applications;
drop policy if exists dev_full_access on interviews;
drop policy if exists dev_full_access on outreach_log;
drop policy if exists dev_full_access on achievements;
drop policy if exists dev_full_access on weekly_reviews;

-- `to authenticated` is what makes this a real gate: the anon role is not
-- granted, so an unauthenticated client sees nothing on any table, even though
-- the predicate itself is `true`.
--
-- Each `create` is preceded by a `drop ... if exists` so this file is safely
-- RE-RUNNABLE. `create policy` has no `if not exists`, so without these a
-- partial re-run aborts on 42710 ("policy already exists") — which is exactly
-- what happened here, and it aborted BEFORE reaching anything that would have
-- fixed the problem. A security migration that can't be re-run is a security
-- migration you can't verify.
drop policy if exists tasks_authenticated on tasks;
create policy tasks_authenticated on tasks
  for all to authenticated using (true) with check (true);

drop policy if exists prep_entries_authenticated on prep_entries;
create policy prep_entries_authenticated on prep_entries
  for all to authenticated using (true) with check (true);

drop policy if exists behavioral_stories_authenticated on behavioral_stories;
create policy behavioral_stories_authenticated on behavioral_stories
  for all to authenticated using (true) with check (true);

drop policy if exists companies_authenticated on companies;
create policy companies_authenticated on companies
  for all to authenticated using (true) with check (true);

drop policy if exists applications_authenticated on applications;
create policy applications_authenticated on applications
  for all to authenticated using (true) with check (true);

drop policy if exists interviews_authenticated on interviews;
create policy interviews_authenticated on interviews
  for all to authenticated using (true) with check (true);

drop policy if exists outreach_log_authenticated on outreach_log;
create policy outreach_log_authenticated on outreach_log
  for all to authenticated using (true) with check (true);

drop policy if exists achievements_authenticated on achievements;
create policy achievements_authenticated on achievements
  for all to authenticated using (true) with check (true);

drop policy if exists weekly_reviews_authenticated on weekly_reviews;
create policy weekly_reviews_authenticated on weekly_reviews
  for all to authenticated using (true) with check (true);

-- Verify after applying (anon key, unauthenticated). Every count must be 0:
--
--   select count(*) from tasks;   -- 0 if RLS is enforcing, not "no rows exist"
--
-- Confirm with the row counts you know are there. A table that is merely EMPTY
-- also returns 0, so only a table with data proves anything — `tasks` was the
-- only one populated here, which is why it was the only table whose leak was
-- visible at all.
