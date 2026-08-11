"use client";

import { useEffect, useRef, useState } from "react";
import { hueVar } from "@/src/components/moduleHues";
import {
  toNormalizedRects,
  toPixelRect,
} from "@/src/modules/reader/annotationGeometry";
import {
  applyLayerDimensions,
  createTextLayer,
  type PdfDocument,
} from "@/src/modules/reader/pdf";
import type { Annotation, NormalizedRect } from "@/src/modules/reader/types";

export interface PendingSelection {
  pageNumber: number;
  selectedText: string;
  rects: NormalizedRect[];
}

interface PdfPageProps {
  pdf: PdfDocument;
  pageNumber: number;
  scale: number;
  annotations: Annotation[];
  onSelect: (selection: PendingSelection) => void;
  activeAnnotationId: string | null;
  onAnnotationClick: (id: string) => void;
}

// One rendered page: a canvas for the pixels, a transparent text layer over it
// for selection, and a highlight layer under that for saved annotations.
//
// The canvas is rendered at devicePixelRatio and scaled down with CSS, so text
// stays sharp on retina displays instead of rendering at 1x and blurring.
export function PdfPage({
  pdf,
  pageNumber,
  scale,
  annotations,
  onSelect,
  activeAnnotationId,
  onAnnotationClick,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    // Held so the effect's cleanup can cancel an in-flight render; without it,
    // changing zoom quickly leaves two renders racing for the same canvas and
    // React logs "Cannot use the same canvas during multiple render()".
    let renderTask: { cancel: () => void } | null = null;
    let textLayer: Awaited<ReturnType<typeof createTextLayer>> | null = null;

    async function render() {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textContainer = textLayerRef.current;
      if (!canvas || !textContainer) return;

      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setSize({ height: viewport.height, width: viewport.width });

      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const task = page.render({ canvas, canvasContext: context, viewport });
      renderTask = task;
      try {
        await task.promise;
      } catch (error) {
        // A cancelled render is the expected outcome of zooming mid-paint,
        // not a failure worth surfacing.
        if (!cancelled) console.error(error);
        return;
      }
      if (cancelled) return;

      // The text layer is what makes select-to-highlight possible at all: it
      // positions invisible spans over the canvas so the browser's own
      // selection works on real text rather than a picture of text.
      textContainer.replaceChildren();
      // Must precede render(): it sizes the container and applies the
      // viewport transform the spans are positioned against.
      await applyLayerDimensions(textContainer, viewport);
      textLayer = await createTextLayer({
        container: textContainer,
        textContentSource: await page.getTextContent(),
        viewport,
      });
      await textLayer.render();
    }

    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  // Convert the live selection into normalized rects the moment the pointer is
  // released — both the client rects and the page box must be measured in the
  // same frame, or their scroll offsets won't cancel (annotationGeometry.ts).
  function handleMouseUp() {
    const selection = window.getSelection();
    const page = pageRef.current;
    if (!selection || selection.isCollapsed || !page) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    // Ignore a selection that started outside this page.
    if (!page.contains(range.commonAncestorContainer)) return;

    const rects = toNormalizedRects(
      Array.from(range.getClientRects()),
      page.getBoundingClientRect(),
    );
    if (rects.length === 0) return;

    onSelect({ pageNumber, rects, selectedText: text });
  }

  return (
    <div
      className="relative mx-auto shadow-lg"
      data-page-number={pageNumber}
      onMouseUp={handleMouseUp}
      ref={pageRef}
      style={{ height: size?.height, width: size?.width }}
    >
      <canvas className="block rounded-sm bg-white" ref={canvasRef} />

      {/* Saved highlights, under the text layer so selection still works over
          them. pointer-events are re-enabled per-rect for click-to-focus. */}
      {size ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {annotations.flatMap((annotation) =>
            annotation.rects.map((rect, index) => {
              const pixel = toPixelRect(rect, size);
              const isActive = annotation.id === activeAnnotationId;
              return (
                <button
                  className="pointer-events-auto absolute cursor-pointer rounded-[1px] transition-colors"
                  key={`${annotation.id}-${index}`}
                  onClick={() => onAnnotationClick(annotation.id)}
                  style={{
                    background: `color-mix(in srgb, ${hueVar(annotation.hue)} ${isActive ? 55 : 32}%, transparent)`,
                    height: pixel.height,
                    left: pixel.x,
                    top: pixel.y,
                    width: pixel.width,
                  }}
                  tabIndex={-1}
                  type="button"
                />
              );
            }),
          )}
        </div>
      ) : null}

      {/* PDF.js positions absolutely-placed spans in here. `select-text` and
          the transparent colour come from pdfjs' own text-layer conventions —
          the spans must be invisible but selectable. */}
      <div
        // The span rules are Tailwind arbitrary variants rather than a
        // stylesheet rule: pdf.js emits `left`/`top` percentages inline, which
        // do nothing until the span is positioned. A plain `.pdf-text-layer
        // span` rule in globals.css did not win the cascade here, and the
        // failure is silent and awful — the spans stack at the top of the
        // page, so selection anchors tens of pixels from the words you see.
        className="pdf-text-layer absolute inset-0 select-text [&_br]:absolute [&_span]:absolute [&_span]:origin-top-left [&_span]:whitespace-pre [&_span]:text-transparent [&_span]:[font-size:calc(var(--total-scale-factor,1)*var(--font-height,0px))] [&_span]:[transform:scaleX(var(--scale-x,1))]"
        ref={textLayerRef}
        style={{
          // pdf.js v6 reads --total-scale-factor (its own inline width/height
          // are `round(down, var(--total-scale-factor) * 612px, …)`).
          // --scale-factor is the older name and is ignored; both are set so
          // the layer is correct either way.
          ["--scale-factor" as string]: scale,
          ["--total-scale-factor" as string]: scale,
        }}
      />
    </div>
  );
}
