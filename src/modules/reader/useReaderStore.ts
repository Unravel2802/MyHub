import { create } from "zustand";
import type { HueName } from "@/src/components/moduleHues";
import type {
  Annotation,
  AnnotationKind,
  NormalizedRect,
  ReaderDocument,
} from "@/src/modules/reader/types";

// Published store contract for the Reader module. One store per module
// (CLAUDE.md); components never call ReaderRepository directly.
//
// Actions below throw `not implemented` — they're the mechanical
// optimistic-set-then-rollback plumbing for Codex to fill in against this
// shape, following useTaskStore/useNoteStore. `toUserMessage` is already
// written because CLAUDE.md rule 6 (console.error the real error, return a
// generic string, never leak a Postgres message into the UI) is a correctness
// rule, not boilerplate.

export interface ReaderStore {
  documents: ReaderDocument[];
  // Annotations for the OPEN document only, not every document's. The viewer
  // shows one document at a time, and eagerly holding every annotation in the
  // library would grow without bound for no reader benefit.
  annotations: Annotation[];
  openDocumentId: string | null;
  isLoading: boolean;
  // Distinct from isLoading: an upload is slow and needs its own progress
  // affordance, and the library list stays usable while one is in flight.
  isUploading: boolean;
  // Per-annotation in-flight tracking so the UI can disable a single
  // highlight's controls, matching useTaskStore's pendingIds.
  pendingIds: string[];
  error: string | null;

  fetchDocuments: () => Promise<void>;
  /**
   * Upload a PDF and add it to the library. Rejects non-PDFs and oversized
   * files before uploading (see ReaderRepository's typed errors) — the store
   * surfaces those two specifically, since "wrong file type" is something the
   * user can act on, unlike a generic failure.
   */
  addDocument: (input: { title: string; file: File }) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  /**
   * Load a document's annotations and mark it open. Clears the previous
   * document's annotations first, so a slow fetch can't briefly render the
   * last document's highlights over this one's pages.
   */
  openDocument: (id: string) => Promise<void>;
  closeDocument: () => void;

  /** Debounce at the call site — this fires on every page turn. */
  setLastPageRead: (id: string, pageNumber: number) => Promise<void>;
  recordPageCount: (id: string, pageCount: number) => Promise<void>;

  addAnnotation: (input: {
    pageNumber: number;
    kind: AnnotationKind;
    selectedText: string;
    comment?: string | null;
    hue?: HueName;
    // Already normalized — annotationGeometry.toNormalizedRects owns the
    // conversion, at the one place that can see the page element.
    rects: NormalizedRect[];
  }) => Promise<void>;
  updateAnnotation: (
    id: string,
    updates: { comment?: string | null; hue?: HueName },
  ) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

// CLAUDE.md rule 6: log the real error, return a generic message. The two
// typed upload errors are the exception — they describe something the user
// chose and can fix, so their own messages are safe and useful to show.
export function toUserMessage(error: unknown): string {
  console.error(error);
  if (
    error instanceof Error &&
    (error.name === "UnsupportedFileTypeError" ||
      error.name === "FileTooLargeError")
  )
    return error.message;
  return FAILURE_MESSAGE;
}

const NOT_IMPLEMENTED = () => {
  throw new Error("not implemented");
};

export const useReaderStore = create<ReaderStore>(() => ({
  documents: [],
  annotations: [],
  openDocumentId: null,
  isLoading: false,
  isUploading: false,
  pendingIds: [],
  error: null,

  fetchDocuments: NOT_IMPLEMENTED,
  addDocument: NOT_IMPLEMENTED,
  deleteDocument: NOT_IMPLEMENTED,
  openDocument: NOT_IMPLEMENTED,
  closeDocument: NOT_IMPLEMENTED,
  setLastPageRead: NOT_IMPLEMENTED,
  recordPageCount: NOT_IMPLEMENTED,
  addAnnotation: NOT_IMPLEMENTED,
  updateAnnotation: NOT_IMPLEMENTED,
  deleteAnnotation: NOT_IMPLEMENTED,
}));
