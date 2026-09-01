-- Curriculum: which chapters of the engineering textbook you have read.
--
-- Same split as roadmap_progress (migration 0014): the CATALOG is code, only
-- your progress is data. The topic graph lives in curriculumCatalog.ts and the
-- chapter prose lives in content/curriculum/**.md — both change via a commit,
-- not via a click, so neither belongs in a table. What is genuinely data is the
-- part that is about you: which chapters you have finished, and which ones you
-- flagged to come back to.
--
-- Deliberately ONE row per lesson rather than roadmap_progress's two-kind
-- shape: "read" and "starred" are two facts about the same chapter, not two
-- different kinds of entry, and keeping them on one row means starring a
-- chapter you have not read yet does not need a second row to exist first.

create table curriculum_progress (
  id uuid primary key default gen_random_uuid(),
  -- "<topicId>/<lessonId>", e.g. "backend.caching/01-why-caching-exists".
  -- Plain text, not a foreign key: the lessons live on the filesystem, so
  -- there is no table to point at, and adding a chapter must stay a matter of
  -- dropping in a markdown file.
  item_key text not null,
  -- Null means "not finished". Un-completing sets this back to null rather
  -- than soft-deleting the row, because the row still carries `starred` — a
  -- delete would silently drop a flag the user set deliberately.
  completed_at timestamptz,
  -- "Come back to this." Independent of completion on purpose: the chapters
  -- worth re-reading are usually ones you have already read once.
  starred boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per chapter, and the ON CONFLICT target for the repository's upsert.
--
-- A PLAIN unique constraint, deliberately, not the `where deleted_at is null`
-- partial index that most of this schema uses. Migration 0015 is the writeup:
-- PostgREST emits a bare `ON CONFLICT (item_key)`, and Postgres will only infer
-- a partial index if the statement repeats its WHERE clause, which PostgREST
-- never does — so a partial index here would make every upsert fail with 42P10
-- and every tick silently roll back. That bug shipped once already on
-- roadmap_progress and took a real database to find, because the E2E mock was
-- faking the upsert.
--
-- Nothing is lost: this table's rows are never soft-deleted by the application
-- (un-reading nulls completed_at, it does not delete the row — see above), so
-- there is never a second live row for a key to permit.
alter table curriculum_progress
  add constraint curriculum_progress_item_key_unique unique (item_key);

-- The dashboard/momentum question is "what did I read lately", which is a scan
-- ordered by completion. Partial on `completed_at is not null` so the index
-- holds only the rows that can answer it — the unread majority is dead weight
-- in it otherwise.
create index curriculum_progress_completed_at_idx
  on curriculum_progress (completed_at desc)
  where deleted_at is null and completed_at is not null;

create trigger curriculum_progress_set_updated_at
  before update on curriculum_progress
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012). Single-user: the gate is
-- "you must be signed in", not per-row ownership.
alter table curriculum_progress enable row level security;

drop policy if exists curriculum_progress_authenticated on curriculum_progress;
create policy curriculum_progress_authenticated
  on curriculum_progress
  for all to authenticated using (true) with check (true);
