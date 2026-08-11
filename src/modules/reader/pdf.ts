import type { TextLayerParameters } from "pdfjs-dist/types/src/display/text_layer";

// PDF.js setup, isolated here so no component imports the library directly and
// the worker is configured exactly once.
//
// The import is DYNAMIC and deliberately so. pdfjs-dist touches browser
// globals at module scope (`const SCALE_MATRIX = new DOMMatrix()`), which
// throws during Next's server render even from a "use client" component —
// "use client" means "also hydrate on the client", not "never runs on the
// server". A static import produced a server-side exception on every load of
// /reader. Importing inside an async function defers it to the browser, where
// those globals exist.
//
// workerSrc points at a file in public/, NEVER a CDN: this page renders the
// user's private documents, and a CDN URL would add a third-party request to
// that page. The worker is copied from pdfjs-dist/build/ and committed.
type PdfjsModule = typeof import("pdfjs-dist");

let modulePromise: Promise<PdfjsModule> | null = null;

function getPdfjs(): Promise<PdfjsModule> {
  // Cached as the PROMISE, not the resolved module: two pages mounting at once
  // would otherwise each start their own import and race to set workerSrc.
  modulePromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return pdfjs;
  });
  return modulePromise;
}

export async function loadPdf(url: string) {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({ url }).promise;
}

export async function createTextLayer(parameters: TextLayerParameters) {
  const pdfjs = await getPdfjs();
  return new pdfjs.TextLayer(parameters);
}

/**
 * Size a layer container to a viewport and apply its transform.
 *
 * NOT optional, and the failure is silent: without it the text layer's spans
 * are laid out against an untransformed box, so they sit tens of pixels away
 * from the glyphs they represent. Selection then anchors to the wrong place —
 * highlights save "successfully" with perfectly valid normalized coordinates
 * that point at empty paper. Caught by looking at a screenshot; the E2E
 * assertions could not see it, because 0-1 coordinates were still 0-1.
 */
export async function applyLayerDimensions(
  container: HTMLDivElement,
  viewport: Parameters<PdfjsModule["setLayerDimensions"]>[1],
) {
  const pdfjs = await getPdfjs();
  pdfjs.setLayerDimensions(container, viewport);
}

export type PdfDocument = Awaited<ReturnType<typeof loadPdf>>;
