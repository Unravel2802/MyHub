-- Reader: PDF documents plus highlight/comment annotations.
--
-- The first module in MyHub that stores a BINARY FILE. Everything until now
-- has been rows; a PDF is neither a row nor something to shred into rows, so
-- this migration also creates the project's first Storage bucket. The file
-- lives in Storage, its metadata and annotations live here, and the join
-- between them is `reader_documents.storage_path`.
--
-- WHY NOT bytea: scripts/exportData.ts dumps every table to JSON for backup.
-- A bytea column would put base64 megabytes into every backup run and into
-- any query that forgot to narrow its select — the PDF is an asset, not data
-- the app ever reasons about.

-- Private, NOT public: `public = false` means the bucket is unreadable over a
-- plain URL and every read has to be an authenticated request (or a
-- deliberately-issued signed URL). A public bucket would make any uploaded
-- document world-readable to anyone who learned the path, which for personal
-- reading material — papers, contracts, offer letters — is exactly wrong.
--
-- 50MB ceiling: large enough for a textbook chapter or a long paper, small
-- enough that a mis-drop of a huge file fails fast at the API instead of
-- after a multi-minute upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reader-documents',
  'reader-documents',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do nothing;

-- Storage has its own RLS on storage.objects, entirely separate from the table
-- policies below — enabling RLS on `reader_documents` does nothing for the
-- bytes. Same single-user model as migration 0012: the gate is "you must be
-- signed in", not per-row ownership.
--
-- Scoped to bucket_id so this policy governs ONLY this bucket; a future bucket
-- gets its own policy rather than inheriting one written for PDFs.
drop policy if exists reader_documents_objects_authenticated on storage.objects;
create policy reader_documents_objects_authenticated
  on storage.objects
  for all to authenticated
  using (bucket_id = 'reader-documents')
  with check (bucket_id = 'reader-documents');

create table reader_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Key within the 'reader-documents' bucket, NOT a URL. URLs for a private
  -- bucket are signed and expire, so storing one would persist a value that
  -- is wrong within the hour; the app signs on demand from this path.
  storage_path text not null,
  -- Read from the PDF after upload. Nullable because it's only knowable once
  -- the file has been parsed, and the row is written first.
  page_count integer,
  size_bytes bigint not null,
  -- Resume-where-you-left-off. 1-based to match how PDF.js and every page
  -- selector in the UI number pages; 0 would mean "before page 1", which is
  -- not a place a reader can be.
  last_page_read integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table reader_documents
  add constraint reader_documents_last_page_read_positive check (
    last_page_read >= 1
  );

alter table reader_documents
  add constraint reader_documents_page_count_positive check (
    page_count is null or page_count >= 1
  );

-- One file, one row. A repeat upload of the same path is a bug (the writer
-- generates a fresh key per upload), and without this the orphaned row would
-- be invisible until someone noticed two identical documents in the list.
alter table reader_documents
  add constraint reader_documents_storage_path_unique unique (storage_path);

create type reader_annotation_kind as enum ('highlight', 'comment');

create table reader_annotations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references reader_documents (id),
  -- 1-based, matching reader_documents.last_page_read.
  page_number integer not null,
  kind reader_annotation_kind not null,
  -- The highlighted run of text, captured at creation. Denormalized on
  -- purpose: it makes the annotation list readable without re-rendering the
  -- PDF, and it survives the source file being replaced.
  selected_text text not null,
  -- The user's own note about that passage. Null for a bare highlight; the
  -- 'comment' kind is a highlight that has one.
  comment text,
  -- Hue NAME (see src/components/moduleHues.ts), never a raw color: the app
  -- renders both light and dark themes from the same row, so a stored hex
  -- would be wrong in one of them.
  hue text not null default 'amber',
  -- Where to draw it: an array of {x, y, width, height} rects in NORMALIZED
  -- page coordinates (0-1, origin top-left). Normalized, not pixels, because
  -- pixel rects are only valid at the zoom and viewport they were captured
  -- at — reopening at a different width would scatter every highlight.
  -- A selection spanning multiple lines produces multiple rects, hence array.
  -- Shape is enforced in TypeScript (annotationGeometry.ts) and by the check
  -- below, not by a jsonb schema.
  rects jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table reader_annotations
  add constraint reader_annotations_page_number_positive check (
    page_number >= 1
  );

-- A highlight with no geometry cannot be drawn, so it would be invisible in
-- the document and orphaned in the sidebar. Cheap guard against a serializer
-- bug writing `[]`.
alter table reader_annotations
  add constraint reader_annotations_rects_non_empty check (
    jsonb_typeof(rects) = 'array' and jsonb_array_length(rects) > 0
  );

-- "Everything on this page, in reading order" is what the viewer asks for on
-- every page turn, so index the way it queries.
create index reader_annotations_document_page_idx
  on reader_annotations (document_id, page_number)
  where deleted_at is null;

create trigger reader_documents_set_updated_at
  before update on reader_documents
  for each row
  execute function set_updated_at();

create trigger reader_annotations_set_updated_at
  before update on reader_annotations
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012).
alter table reader_documents enable row level security;

drop policy if exists reader_documents_authenticated on reader_documents;
create policy reader_documents_authenticated
  on reader_documents
  for all to authenticated using (true) with check (true);

alter table reader_annotations enable row level security;

drop policy if exists reader_annotations_authenticated on reader_annotations;
create policy reader_annotations_authenticated
  on reader_annotations
  for all to authenticated using (true) with check (true);
