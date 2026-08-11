import type { HueName } from "@/src/components/moduleHues";

export interface ReaderDocument {
  id: string;
  title: string;
  // Key within the 'reader-documents' Storage bucket. Not a URL — the bucket
  // is private, so URLs are signed on demand and expire (migration 0042).
  storagePath: string;
  pageCount: number | null;
  sizeBytes: number;
  // 1-based, matching PDF.js page numbering.
  lastPageRead: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AnnotationKind = "highlight" | "comment";

/**
 * One rectangle in NORMALIZED page coordinates: 0-1 on both axes, origin at
 * the page's top-left, independent of zoom and viewport.
 *
 * This is the unit the database stores and the only unit that crosses the
 * repository boundary. Pixels never do — see annotationGeometry.ts.
 */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  documentId: string;
  // 1-based.
  pageNumber: number;
  kind: AnnotationKind;
  selectedText: string;
  // Null for a bare highlight. A `comment` is a highlight that has one.
  comment: string | null;
  hue: HueName;
  // One rect per line the selection spans, in reading order.
  rects: NormalizedRect[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
