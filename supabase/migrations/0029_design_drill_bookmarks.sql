-- Design Drills: bookmarks ("star this drill" for quick access / filtering).
--
-- Its own table, NOT a column on design_drills: that row is the shared
-- problem-bank definition, while a bookmark is user state — a bespoke
-- `bookmarked` column there would be a God-column that muddies the seed rows and
-- can't be soft-deleted independently. Single-user app, so the row is the whole
-- fact; RLS is the usual "must be signed in" gate, matching every other table.
--
-- Soft-delete like everything else: un-bookmarking sets deleted_at rather than
-- deleting the row. A PARTIAL unique index (only where deleted_at is null) keeps
-- at most one *active* bookmark per drill while still allowing the
-- bookmark → un-bookmark → re-bookmark cycle to append a fresh row.

create table if not exists design_drill_bookmarks (
  id uuid primary key default gen_random_uuid(),
  drill_id uuid not null references design_drills (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists design_drill_bookmarks_active_drill_idx
  on design_drill_bookmarks (drill_id)
  where deleted_at is null;

create trigger design_drill_bookmarks_set_updated_at
  before update on design_drill_bookmarks
  for each row
  execute function set_updated_at();

alter table design_drill_bookmarks enable row level security;

drop policy if exists design_drill_bookmarks_authenticated on design_drill_bookmarks;
create policy design_drill_bookmarks_authenticated on design_drill_bookmarks
  for all to authenticated using (true) with check (true);
