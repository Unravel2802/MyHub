"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { hueVar } from "@/src/components/moduleHues";
import { loadPdf, type PdfDocument } from "@/src/modules/reader/pdf";
import { HIGHLIGHT_HUES } from "@/src/modules/reader/highlightHues";
import {
  PdfPage,
  type PendingSelection,
} from "@/src/modules/reader/components/PdfPage";
import type { Annotation, ReaderDocument } from "@/src/modules/reader/types";
import type { HueName } from "@/src/components/moduleHues";

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2] as const;

interface PdfViewerProps {
  document: ReaderDocument;
  url: string;
  annotations: Annotation[];
  activeAnnotationId: string | null;
  onAnnotationClick: (id: string) => void;
  onHighlight: (selection: PendingSelection, hue: HueName) => void;
  onPageChange: (pageNumber: number) => void;
  onPageCount: (pageCount: number) => void;
}

export function PdfViewer({
  document: doc,
  url,
  annotations,
  activeAnnotationId,
  onAnnotationClick,
  onHighlight,
  onPageChange,
  onPageCount,
}: PdfViewerProps) {
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(doc.lastPageRead);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // No reset-to-null here: ReaderPage keys this component by document id, so
    // opening a different document remounts it with fresh state. Clearing
    // inside the effect would be both redundant and a cascading render.
    loadPdf(url)
      .then((loaded) => {
        if (cancelled) return;
        setPdf(loaded);
        onPageCount(loaded.numPages);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setLoadError("That document could not be opened.");
      });
    return () => {
      cancelled = true;
    };
    // onPageCount is intentionally not a dependency: it is recreated per render
    // by the parent, and including it would reload the PDF on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // DERIVED, not clamped into state by an effect: lastPageRead can outlive a
  // file replaced by a shorter one, and storing the correction would mean a
  // render at the bad value followed by a cascading second render.
  const effectivePage = pdf ? Math.min(pageNumber, pdf.numPages) : pageNumber;

  const goToPage = useCallback(
    (next: number) => {
      if (!pdf) return;
      const clamped = Math.min(Math.max(next, 1), pdf.numPages);
      setPageNumber(clamped);
      setPending(null);
      onPageChange(clamped);
    },
    [pdf, onPageChange],
  );

  // Arrow keys page the document, but not while the user is typing a note.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      if (event.key === "ArrowRight") goToPage(effectivePage + 1);
      if (event.key === "ArrowLeft") goToPage(effectivePage - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToPage, effectivePage]);

  const pageAnnotations = annotations.filter(
    (annotation) => annotation.pageNumber === effectivePage,
  );

  if (loadError)
    return (
      <p aria-live="assertive" className="text-sm text-danger" role="alert">
        {loadError}
      </p>
    );

  if (!pdf) return <p className="text-sm text-muted">Opening {doc.title}…</p>;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous page"
            className="rounded-md border border-border p-1.5 text-body transition-colors hover:bg-surface-subtle disabled:opacity-40"
            disabled={effectivePage <= 1}
            onClick={() => goToPage(effectivePage - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <span className="px-2 text-sm tabular-nums text-body">
            {effectivePage} / {pdf.numPages}
          </span>
          <button
            aria-label="Next page"
            className="rounded-md border border-border p-1.5 text-body transition-colors hover:bg-surface-subtle disabled:opacity-40"
            disabled={effectivePage >= pdf.numPages}
            onClick={() => goToPage(effectivePage + 1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            aria-label="Zoom out"
            className="rounded-md border border-border p-1.5 text-body transition-colors hover:bg-surface-subtle disabled:opacity-40"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((index) => Math.max(index - 1, 0))}
            type="button"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <span className="w-12 text-center text-sm tabular-nums text-muted">
            {Math.round(ZOOM_STEPS[zoomIndex] * 100)}%
          </span>
          <button
            aria-label="Zoom in"
            className="rounded-md border border-border p-1.5 text-body transition-colors hover:bg-surface-subtle disabled:opacity-40"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() =>
              setZoomIndex((index) =>
                Math.min(index + 1, ZOOM_STEPS.length - 1),
              )
            }
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {/* The highlight bar appears only with a live selection. Deliberately a
          bar above the page rather than a floating popover at the cursor: a
          popover has to be positioned against a selection that can span lines
          and pages, and it covers the very text you just selected. */}
      {pending ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-border bg-accent-surface px-3 py-2"
          role="group"
          aria-label="Highlight selection"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-body">
            “{pending.selectedText}”
          </span>
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_HUES.map((hue) => (
              <button
                aria-label={`Highlight ${hue}`}
                className="size-5 rounded-full border border-border transition-transform hover:scale-110"
                key={hue}
                onClick={() => {
                  onHighlight(pending, hue);
                  setPending(null);
                  window.getSelection()?.removeAllRanges();
                }}
                style={{
                  background: `color-mix(in srgb, ${hueVar(hue)} 45%, transparent)`,
                }}
                type="button"
              />
            ))}
            <button
              className="ml-1 text-xs text-muted transition-colors hover:text-foreground"
              onClick={() => {
                setPending(null);
                window.getSelection()?.removeAllRanges();
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-auto rounded-lg bg-surface-subtle p-4">
        <PdfPage
          activeAnnotationId={activeAnnotationId}
          annotations={pageAnnotations}
          onAnnotationClick={onAnnotationClick}
          onSelect={setPending}
          pageNumber={effectivePage}
          pdf={pdf}
          scale={ZOOM_STEPS[zoomIndex]}
        />
      </div>
    </div>
  );
}

export type { PendingSelection };
