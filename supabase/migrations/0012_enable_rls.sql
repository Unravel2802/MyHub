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

-- `to authenticated` is what makes this a real gate: the anon role is not
-- granted, so an unauthenticated client sees nothing on any table, even though
-- the predicate itself is `true`.
create policy tasks_authenticated on tasks
  for all to authenticated using (true) with check (true);
create policy prep_entries_authenticated on prep_entries
  for all to authenticated using (true) with check (true);
create policy behavioral_stories_authenticated on behavioral_stories
  for all to authenticated using (true) with check (true);
create policy companies_authenticated on companies
  for all to authenticated using (true) with check (true);
create policy applications_authenticated on applications
  for all to authenticated using (true) with check (true);
create policy interviews_authenticated on interviews
  for all to authenticated using (true) with check (true);
create policy outreach_log_authenticated on outreach_log
  for all to authenticated using (true) with check (true);
create policy achievements_authenticated on achievements
  for all to authenticated using (true) with check (true);
create policy weekly_reviews_authenticated on weekly_reviews
  for all to authenticated using (true) with check (true);
