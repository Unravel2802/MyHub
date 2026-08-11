"use client";

import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HueName } from "@/src/components/moduleHues";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { Panel } from "@/src/components/ui/Panel";
import * as ReaderRepository from "@/src/modules/reader/ReaderRepository";
import { AnnotationSidebar } from "@/src/modules/reader/components/AnnotationSidebar";
import { DocumentLibrary } from "@/src/modules/reader/components/DocumentLibrary";
import {
  PdfViewer,
  type PendingSelection,
} from "@/src/modules/reader/components/PdfViewer";
import { useReaderStore } from "@/src/modules/reader/useReaderStore";
import type { Annotation } from "@/src/modules/reader/types";

// How long to wait after the last page turn before persisting the position.
// setLastPageRead is by far the highest-frequency write in the module — paging
// through a 300-page PDF unthrottled would be 300 round-trips.
const PAGE_SAVE_DEBOUNCE_MS = 800;

export function ReaderPage() {
  const documents = useReaderStore((state) => state.documents);
  const annotations = useReaderStore((state) => state.annotations);
  const openDocumentId = useReaderStore((state) => state.openDocumentId);
  const isUploading = useReaderStore((state) => state.isUploading);
  const error = useReaderStore((state) => state.error);
  const fetchDocuments = useReaderStore((state) => state.fetchDocuments);
  const addDocument = useReaderStore((state) => state.addDocument);
  const deleteDocument = useReaderStore((state) => state.deleteDocument);
  const openDocument = useReaderStore((state) => state.openDocument);
  const setLastPageRead = useReaderStore((state) => state.setLastPageRead);
  const recordPageCount = useReaderStore((state) => state.recordPageCount);
  const addAnnotation = useReaderStore((state) => state.addAnnotation);
  const updateAnnotation = useReaderStore((state) => state.updateAnnotation);
  const deleteAnnotation = useReaderStore((state) => state.deleteAnnotation);

  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(
    null,
  );
  const [jumpToPage, setJumpToPage] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const openDoc = documents.find((doc) => doc.id === openDocumentId) ?? null;

  // The bucket is private, so the viewer needs a freshly signed URL. Signed on
  // open rather than stored, because it expires (SIGNED_URL_TTL_SECONDS).
  const storagePath = openDoc?.storagePath ?? null;
  useEffect(() => {
    if (!storagePath) return;
    let cancelled = false;
    ReaderRepository.getDocumentUrl(storagePath)
      .then((url) => {
        if (!cancelled) setDocumentUrl(url);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setDocumentUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  const handlePageChange = useCallback(
    (pageNumber: number) => {
      if (!openDocumentId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void setLastPageRead(openDocumentId, pageNumber);
      }, PAGE_SAVE_DEBOUNCE_MS);
    },
    [openDocumentId, setLastPageRead],
  );

  const handlePageCount = useCallback(
    (pageCount: number) => {
      if (!openDoc || openDoc.pageCount === pageCount) return;
      void recordPageCount(openDoc.id, pageCount);
    },
    [openDoc, recordPageCount],
  );

  function handleHighlight(selection: PendingSelection, hue: HueName) {
    void addAnnotation({
      hue,
      kind: "highlight",
      pageNumber: selection.pageNumber,
      rects: selection.rects,
      selectedText: selection.selectedText,
    });
  }

  function handleJumpTo(annotation: Annotation) {
    setActiveAnnotationId(annotation.id);
    setJumpToPage(annotation.pageNumber);
  }

  return (
    <PageTemplate
      description="Read PDFs and highlight what matters. Your highlights stay with the document."
      error={error}
      eyebrow="Reader"
      hero={null}
      href="/reader"
      icon={BookOpen}
      title="Reader"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-6">
          {openDoc && documentUrl && storagePath ? (
            <Panel
              aside={
                <button
                  className="text-sm font-medium text-muted transition-colors hover:text-foreground"
                  onClick={() => useReaderStore.getState().closeDocument()}
                  type="button"
                >
                  Close
                </button>
              }
              title={openDoc.title}
            >
              <PdfViewer
                activeAnnotationId={activeAnnotationId}
                annotations={annotations}
                document={{
                  ...openDoc,
                  // Jumping from the sidebar re-seeds the viewer's start page.
                  lastPageRead: jumpToPage ?? openDoc.lastPageRead,
                }}
                key={`${openDoc.id}-${jumpToPage ?? "start"}`}
                onAnnotationClick={setActiveAnnotationId}
                onHighlight={handleHighlight}
                onPageChange={handlePageChange}
                onPageCount={handlePageCount}
                url={documentUrl}
              />
            </Panel>
          ) : null}

          <Panel overline="Library" title="Your documents">
            <DocumentLibrary
              documents={documents}
              isUploading={isUploading}
              onDelete={(id) => void deleteDocument(id)}
              onOpen={(id) => {
                setJumpToPage(null);
                setActiveAnnotationId(null);
                void openDocument(id);
              }}
              onUpload={(input) => void addDocument(input)}
              openDocumentId={openDocumentId}
            />
          </Panel>
        </div>

        <Panel
          overline="Highlights"
          title={
            openDoc ? `${annotations.length} in this document` : "None open"
          }
        >
          {openDoc ? (
            <AnnotationSidebar
              activeId={activeAnnotationId}
              annotations={annotations}
              onDelete={(id) => void deleteAnnotation(id)}
              onJumpTo={handleJumpTo}
              onUpdate={(id, updates) => void updateAnnotation(id, updates)}
            />
          ) : (
            <p className="text-sm text-muted">
              Open a document to see its highlights.
            </p>
          )}
        </Panel>
      </div>
    </PageTemplate>
  );
}
