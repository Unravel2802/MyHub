import type { HueName } from "@/src/components/moduleHues";
import type {
  Annotation,
  AnnotationKind,
  NormalizedRect,
  ReaderDocument,
} from "@/src/modules/reader/types";

// Published contract for the Reader module (migration 0042). Soft deletes
// only, all DB access routed through here — no Supabase call belongs in a
// component. See docs/handoff/reader.md for what's left for Codex.
//
// The function signatures, the row->domain mapping rules, and the storage
// conventions below are FIXED. Bodies marked `not implemented` are mechanical
// Supabase round-trips for Codex to fill in against this contract (CLAUDE.md's
// capacity amendment). If a signature looks wrong, flag it — don't change it.

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
  throw new Error("not implemented");
}

export async function getDocument(_id: string): Promise<ReaderDocument | null> {
  throw new Error("not implemented");
}

/**
 * Upload the file to the bucket, then insert its row.
 *
 * Ordering matters and is part of the contract: upload FIRST, insert second.
 * A row whose bytes failed to upload is a document that opens to nothing and
 * needs manual cleanup; an uploaded object with no row is invisible, costs a
 * few MB, and is reclaimable. Failing in the less harmful direction is the
 * whole point.
 *
 * `storagePath` must be generated (crypto.randomUUID + ".pdf"), never derived
 * from the filename: two uploads of "paper.pdf" would collide, and the column
 * is unique.
 */
export async function createDocument(
  _input: CreateDocumentInput,
): Promise<ReaderDocument> {
  throw new Error("not implemented");
}

/**
 * A time-limited URL for fetching the document's bytes, for PDF.js to load.
 * Never store the result — it expires (SIGNED_URL_TTL_SECONDS).
 */
export async function getDocumentUrl(_storagePath: string): Promise<string> {
  throw new Error("not implemented");
}

/**
 * Written once, after PDF.js reports the page count on first open. Separate
 * from updateLastPageRead because it's a one-time correction of unknown
 * metadata, not part of the reading loop.
 */
export async function setPageCount(
  _id: string,
  _pageCount: number,
): Promise<ReaderDocument> {
  throw new Error("not implemented");
}

/**
 * Resume position. Called on page turn, so the UI must debounce it — this
 * fires far more often than any other write in the module.
 */
export async function updateLastPageRead(
  _id: string,
  _pageNumber: number,
): Promise<ReaderDocument> {
  throw new Error("not implemented");
}

/**
 * Soft-delete the row. Deliberately does NOT remove the Storage object:
 * architecture rule 4 is soft deletes only, and hard-deleting the bytes would
 * make the surviving row unopenable — a "deleted" document that can never be
 * restored. Reclaiming orphaned objects is a separate, deliberate sweep.
 */
export async function deleteDocument(_id: string): Promise<void> {
  throw new Error("not implemented");
}

export async function getAnnotations(
  _documentId: string,
): Promise<Annotation[]> {
  throw new Error("not implemented");
}

export async function createAnnotation(
  _input: CreateAnnotationInput,
): Promise<Annotation> {
  throw new Error("not implemented");
}

/**
 * Edit an annotation's note or colour. `rects`, `pageNumber` and
 * `selectedText` are deliberately absent: they describe a specific passage in
 * the document, and changing them would silently re-point the annotation at
 * text the user never selected. Re-anchoring means deleting and re-creating.
 */
export async function updateAnnotation(
  _id: string,
  _updates: { comment?: string | null; hue?: HueName },
): Promise<Annotation> {
  throw new Error("not implemented");
}

export async function deleteAnnotation(_id: string): Promise<void> {
  throw new Error("not implemented");
}
