-- Remove the Reader module (migration 0042) entirely.
--
-- The Lead Architect retired the Reader on 2026-11-12 as unnecessary and chose
-- to DROP its schema rather than leave it dormant. This is a deliberate,
-- one-off exception to the soft-delete rule: that rule governs application
-- code deleting rows, not retiring a whole module's tables. Uploaded PDFs and
-- their annotations are permanently gone after this runs.

-- Tables first (annotations reference documents), then the enum they used.
drop table if exists reader_annotations;
drop table if exists reader_documents;
drop type if exists reader_annotation_kind;

-- Storage. The objects policy is plain SQL and always drops.
drop policy if exists reader_documents_objects_authenticated on storage.objects;

-- The bucket itself only drops when EMPTY. Supabase blocks deleting rows from
-- storage.objects directly in SQL (the bytes live outside Postgres and must be
-- removed through the Storage API), and a bucket with objects can't be
-- deleted. So if PDFs were ever uploaded, empty the 'reader-documents' bucket
-- in the dashboard (Storage -> reader-documents -> select all -> delete),
-- then delete the bucket there too; this statement is then a no-op. Guarded
-- so the migration never fails on a non-empty bucket.
delete from storage.buckets
where id = 'reader-documents'
  and not exists (
    select 1 from storage.objects where bucket_id = 'reader-documents'
  );
