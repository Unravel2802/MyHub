import { create } from "zustand";
import type { HueName } from "@/src/components/moduleHues";
import { emit } from "@/src/lib/events";
import * as ReaderRepository from "@/src/modules/reader/ReaderRepository";
import type {
  Annotation,
  AnnotationKind,
  NormalizedRect,
  ReaderDocument,
} from "@/src/modules/reader/types";

// Published store contract for the Reader module. One store per module
// (CLAUDE.md); components never call ReaderRepository directly.

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

export const useReaderStore = create<ReaderStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((x) => x !== id) });

  return {
    documents: [],
    annotations: [],
    openDocumentId: null,
    isLoading: false,
    isUploading: false,
    pendingIds: [],
    error: null,

    fetchDocuments: async () => {
      set({ isLoading: true, error: null });
      try {
        set({
          documents: await ReaderRepository.getDocuments(),
          isLoading: false,
        });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    // No optimistic insert: the row's id and storagePath are generated during
    // the upload, so there is nothing truthful to show until it returns.
    // `isUploading` carries the feedback instead.
    addDocument: async (input) => {
      set({ isUploading: true, error: null });
      try {
        const created = await ReaderRepository.createDocument(input);
        set({
          documents: [created, ...get().documents],
          isUploading: false,
        });
        emit({
          type: "reader.document_added",
          payload: { documentId: created.id },
          timestamp: Date.now(),
        });
      } catch (error) {
        set({ isUploading: false, error: toUserMessage(error) });
      }
    },

    deleteDocument: async (id) => {
      const previous = get().documents;
      set({
        documents: previous.filter((doc) => doc.id !== id),
        error: null,
      });
      // Closing a deleted document that's currently open, so the viewer can't
      // keep rendering a row that no longer exists.
      if (get().openDocumentId === id)
        set({ openDocumentId: null, annotations: [] });
      try {
        await ReaderRepository.deleteDocument(id);
      } catch (error) {
        set({ documents: previous, error: toUserMessage(error) });
      }
    },

    openDocument: async (id) => {
      // Clear FIRST: a slow annotation fetch would otherwise leave the
      // previous document's highlights painted over this one's pages.
      set({
        openDocumentId: id,
        annotations: [],
        isLoading: true,
        error: null,
      });
      try {
        const annotations = await ReaderRepository.getAnnotations(id);
        // Bail if the user opened something else while this was in flight —
        // otherwise the slower response wins and paints the wrong document.
        if (get().openDocumentId !== id) return;
        set({ annotations, isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    closeDocument: () =>
      set({ openDocumentId: null, annotations: [], error: null }),

    setLastPageRead: async (id, pageNumber) => {
      const previous = get().documents;
      set({
        documents: previous.map((doc) =>
          doc.id === id ? { ...doc, lastPageRead: pageNumber } : doc,
        ),
      });
      try {
        await ReaderRepository.updateLastPageRead(id, pageNumber);
      } catch (error) {
        // Deliberately silent in the UI: failing to save a scroll position is
        // not worth an error banner over the document you're reading. Logged
        // via toUserMessage's console.error, and the next page turn retries.
        toUserMessage(error);
        set({ documents: previous });
      }
    },

    recordPageCount: async (id, pageCount) => {
      try {
        const updated = await ReaderRepository.setPageCount(id, pageCount);
        set({
          documents: get().documents.map((doc) =>
            doc.id === id ? updated : doc,
          ),
        });
      } catch (error) {
        // Same reasoning as setLastPageRead: metadata, not the reading itself.
        toUserMessage(error);
      }
    },

    addAnnotation: async (input) => {
      const documentId = get().openDocumentId;
      if (!documentId) return;

      const now = new Date().toISOString();
      const optimistic: Annotation = {
        id: `optimistic-${crypto.randomUUID()}`,
        documentId,
        pageNumber: input.pageNumber,
        kind: input.kind,
        selectedText: input.selectedText,
        comment: input.comment ?? null,
        hue: input.hue ?? "amber",
        rects: input.rects,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const previous = get().annotations;
      set({ annotations: [...previous, optimistic], error: null });

      try {
        const created = await ReaderRepository.createAnnotation({
          ...input,
          documentId,
        });
        set({
          annotations: get().annotations.map((annotation) =>
            annotation.id === optimistic.id ? created : annotation,
          ),
        });
        emit({
          type: "reader.annotation_added",
          payload: { annotationId: created.id, documentId },
          timestamp: Date.now(),
        });
      } catch (error) {
        set({ annotations: previous, error: toUserMessage(error) });
      }
    },

    updateAnnotation: async (id, updates) => {
      const previous = get().annotations;
      set({
        annotations: previous.map((annotation) =>
          annotation.id === id
            ? {
                ...annotation,
                ...(updates.comment !== undefined && {
                  comment: updates.comment,
                  kind: updates.comment
                    ? ("comment" as const)
                    : ("highlight" as const),
                }),
                ...(updates.hue !== undefined && { hue: updates.hue }),
              }
            : annotation,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await ReaderRepository.updateAnnotation(id, updates);
        set({
          annotations: get().annotations.map((annotation) =>
            annotation.id === id ? updated : annotation,
          ),
        });
      } catch (error) {
        set({ annotations: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteAnnotation: async (id) => {
      const previous = get().annotations;
      set({
        annotations: previous.filter((annotation) => annotation.id !== id),
        error: null,
      });
      try {
        await ReaderRepository.deleteAnnotation(id);
      } catch (error) {
        set({ annotations: previous, error: toUserMessage(error) });
      }
    },
  };
});
