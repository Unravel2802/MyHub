import { supabase } from "@/src/lib/supabaseClient";
import type { HueName } from "@/src/components/moduleHues";
import { isNormalizedRectArray } from "@/src/modules/reader/annotationGeometry";
import type {
  Annotation,
  AnnotationKind,
  NormalizedRect,
  ReaderDocument,
} from "@/src/modules/reader/types";

// Published contract for the Reader module (migration 0042). Soft deletes
// only, all DB access routed through here — no Supabase call belongs in a
// component. See docs/handoff/reader.md.

export const READER_BUCKET = "reader-documents";

// Signed-URL lifetime for reading a document. The bucket is private, so the
// viewer fetches bytes through a signed URL rather than a public one; an hour
// is long enough for a reading session without leaving a working link lying
// around in browser history indefinitely.
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Thrown when an upload isn't a PDF. Checked in the repository rather than
 * relying only on the bucket's `allowed_mime_types` (migration 0042) so the
 * store can surface a specific, actionable message instead of a generic
 * failure after a pointless round-trip.
 */
export class UnsupportedFileTypeError extends Error {
  constructor() {
    super("Only PDF files can be added to the reader.");
    this.name = "UnsupportedFileTypeError";
  }
}

/**
 * Thrown when a file exceeds the bucket's 50MB ceiling. Same reasoning as
 * above: fail before uploading 50MB, not after.
 */
export class FileTooLargeError extends Error {
  constructor() {
    super("That file is too large — the limit is 50MB.");
    this.name = "FileTooLargeError";
  }
}

export const MAX_UPLOAD_BYTES = 52_428_800;

interface DocumentRow {
  id: string;
  title: string;
  storage_path: string;
  page_count: number | null;
  size_bytes: number;
  last_page_read: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AnnotationRow {
  id: string;
  document_id: string;
  page_number: number;
  kind: AnnotationKind;
  selected_text: string;
  comment: string | null;
  hue: string;
  rects: unknown;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function documentFromRow(row: DocumentRow): ReaderDocument {
  return {
    id: row.id,
    title: row.title,
    storagePath: row.storage_path,
    pageCount: row.page_count,
    sizeBytes: row.size_bytes,
    lastPageRead: row.last_page_read,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function annotationFromRow(row: AnnotationRow): Annotation {
  // `rects` is jsonb: Postgres guarantees a non-empty array (migration 0042's
  // check constraint) and nothing about what's inside it. Casting to
  // NormalizedRect[] would be an assertion, not a check — and a malformed row
  // renders as an invisible, NaN-positioned highlight that is impossible to
  // diagnose from the UI. Parse, and drop the geometry if it's wrong.
  const rects: NormalizedRect[] = isNormalizedRectArray(row.rects)
    ? row.rects
    : [];
  if (rects.length === 0)
    console.error(
      `Annotation ${row.id} has malformed rects and cannot be drawn.`,
      row.rects,
    );

  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: row.page_number,
    kind: row.kind,
    selectedText: row.selected_text,
    comment: row.comment,
    hue: row.hue as HueName,
    rects,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateDocumentInput {
  title: string;
  file: File;
}

export interface CreateAnnotationInput {
  documentId: string;
  pageNumber: number;
  kind: AnnotationKind;
  selectedText: string;
  comment?: string | null;
  hue?: HueName;
  // Must already be normalized — see annotationGeometry.toNormalizedRects.
  // Raw client rects are a bug at this boundary, not something to convert
  // here: the repository has no access to the page element they were
  // measured against.
  rects: NormalizedRect[];
}

export async function getDocuments(): Promise<ReaderDocument[]> {
  const { data, error } = await supabase
    .from("reader_documents")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as DocumentRow[]).map(documentFromRow);
}

export async function getDocument(id: string): Promise<ReaderDocument | null> {
  const { data, error } = await supabase
    .from("reader_documents")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? documentFromRow(data as DocumentRow) : null;
}

/**
 * Upload the file to the bucket, then insert its row.
 *
 * Ordering matters and is part of the contract: upload FIRST, insert second.
 * A row whose bytes failed to upload is a document that opens to nothing and
 * needs manual cleanup; an uploaded object with no row is invisible, costs a
 * few MB, and is reclaimable. Failing in the less harmful direction is the
 * whole point.
 */
export async function createDocument(
  input: CreateDocumentInput,
): Promise<ReaderDocument> {
  if (input.file.type !== "application/pdf")
    throw new UnsupportedFileTypeError();
  if (input.file.size > MAX_UPLOAD_BYTES) throw new FileTooLargeError();

  // Generated, never derived from the filename: two uploads of "paper.pdf"
  // would collide on a unique column.
  const storagePath = `${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(READER_BUCKET)
    .upload(storagePath, input.file, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("reader_documents")
    .insert({
      title: input.title,
      storage_path: storagePath,
      size_bytes: input.file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return documentFromRow(data as DocumentRow);
}

/**
 * A time-limited URL for fetching the document's bytes, for PDF.js to load.
 * Never store the result — it expires (SIGNED_URL_TTL_SECONDS).
 */
export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(READER_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Written once, after PDF.js reports the page count on first open. Separate
 * from updateLastPageRead because it's a one-time correction of unknown
 * metadata, not part of the reading loop.
 */
export async function setPageCount(
  id: string,
  pageCount: number,
): Promise<ReaderDocument> {
  const { data, error } = await supabase
    .from("reader_documents")
    .update({ page_count: pageCount })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return documentFromRow(data as DocumentRow);
}

/**
 * Resume position. Called on page turn, so the UI must debounce it — this
 * fires far more often than any other write in the module.
 */
export async function updateLastPageRead(
  id: string,
  pageNumber: number,
): Promise<ReaderDocument> {
  const { data, error } = await supabase
    .from("reader_documents")
    .update({ last_page_read: pageNumber })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return documentFromRow(data as DocumentRow);
}

/**
 * Soft-delete the row. Deliberately does NOT remove the Storage object:
 * architecture rule 4 is soft deletes only, and hard-deleting the bytes would
 * make the surviving row unopenable — a "deleted" document that can never be
 * restored. Reclaiming orphaned objects is a separate, deliberate sweep.
 */
export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from("reader_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getAnnotations(
  documentId: string,
): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from("reader_annotations")
    .select("*")
    .eq("document_id", documentId)
    .is("deleted_at", null)
    .order("page_number", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AnnotationRow[]).map(annotationFromRow);
}

export async function createAnnotation(
  input: CreateAnnotationInput,
): Promise<Annotation> {
  const { data, error } = await supabase
    .from("reader_annotations")
    .insert({
      document_id: input.documentId,
      page_number: input.pageNumber,
      kind: input.kind,
      selected_text: input.selectedText,
      comment: input.comment ?? null,
      hue: input.hue ?? "amber",
      rects: input.rects,
    })
    .select()
    .single();
  if (error) throw error;
  return annotationFromRow(data as AnnotationRow);
}

/**
 * Edit an annotation's note or colour. `rects`, `pageNumber` and
 * `selectedText` are deliberately absent: they describe a specific passage in
 * the document, and changing them would silently re-point the annotation at
 * text the user never selected. Re-anchoring means deleting and re-creating.
 */
export async function updateAnnotation(
  id: string,
  updates: { comment?: string | null; hue?: HueName },
): Promise<Annotation> {
  const { data, error } = await supabase
    .from("reader_annotations")
    .update({
      ...(updates.comment !== undefined && { comment: updates.comment }),
      ...(updates.hue !== undefined && { hue: updates.hue }),
      // A highlight that gains a note becomes a comment; clearing the note
      // turns it back. Kind is derived, never set by the caller, so the two
      // can't disagree.
      ...(updates.comment !== undefined && {
        kind: updates.comment ? "comment" : "highlight",
      }),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return annotationFromRow(data as AnnotationRow);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const { error } = await supabase
    .from("reader_annotations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
