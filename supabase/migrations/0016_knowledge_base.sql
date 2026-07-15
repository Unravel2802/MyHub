-- Knowledge Base: Notes + NoteLinks
-- See myhub_plan.md Part A §A.2 ("sketched so the shape exists when picked up")
--
-- A note is plain markdown; a link between two notes is directional at the row
-- level (one is "source", one is "target") but bi-directional at the query
-- level (a note's linked-notes list doesn't care which side it was on).

create table notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table note_links (
  id uuid primary key default gen_random_uuid(),
  source_note_id uuid not null references notes (id),
  target_note_id uuid not null references notes (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- Repeated at the repository layer as a typed SelfLinkError, thrown before
  -- the request ever reaches Supabase — this constraint is the backstop for
  -- anything that bypasses the repository (a bad migration, a psql console),
  -- not the primary guard a user ever hits.
  constraint note_links_no_self_link check (source_note_id <> target_note_id)
);

-- "A note's linked notes" is always looked up as `source = X or target = X`,
-- so both directions need their own index rather than relying on the
-- unordered-pair index below, which is keyed by (least, greatest) and doesn't
-- serve a plain equality lookup on one arbitrary side.
create index note_links_source_idx on note_links (source_note_id);
create index note_links_target_idx on note_links (target_note_id);

-- The undirected pair (A, B) can only exist once regardless of which note is
-- "source" — least/greatest instead of normalizing storage order, so A->B and
-- a later B->A attempt collide as the same edge without forcing the app to
-- decide a canonical row order up front.
create unique index note_links_unordered_pair_idx
  on note_links (least(source_note_id, target_note_id), greatest(source_note_id, target_note_id))
  where deleted_at is null;

create trigger notes_set_updated_at
  before update on notes
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012). Single-user: the gate is
-- "you must be signed in", not per-row ownership.
alter table notes enable row level security;

drop policy if exists notes_authenticated on notes;
create policy notes_authenticated on notes
  for all to authenticated using (true) with check (true);

alter table note_links enable row level security;

drop policy if exists note_links_authenticated on note_links;
create policy note_links_authenticated on note_links
  for all to authenticated using (true) with check (true);
