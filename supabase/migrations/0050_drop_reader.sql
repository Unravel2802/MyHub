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

-- The 'reader-documents' BUCKET is NOT dropped here, and can't be: Supabase's
-- storage.protect_delete() trigger rejects any SQL delete from storage.buckets
-- or storage.objects ("Direct deletion from storage tables is not allowed"),
-- even for an empty bucket — and because the SQL editor runs a script as one
-- transaction, attempting it rolls back the drops above too. Delete it through
-- the Storage API instead: dashboard -> Storage -> reader-documents -> empty
-- the bucket, then delete it.
