import type { NormalizedRect } from "@/src/modules/reader/types";

// The correctness-critical half of the Reader module: turning a live browser
// text selection into geometry that still lands on the right words when the
// document is reopened at a different zoom, window size, or device.
//
// The rule this file exists to enforce: PIXELS NEVER CROSS THE REPOSITORY
// BOUNDARY. A DOMRect from `Range.getClientRects()` is only meaningful at the
// exact scale and scroll position it was measured at. Persist one and every
// highlight scatters the moment the viewport changes. So the viewer converts
// to normalized 0-1 page coordinates on the way in (`toNormalizedRects`) and
// back to pixels on the way out (`toPixelRect`), and nothing else in the
// module touches raw client coordinates.
//
// Both conversions are relative to the PAGE ELEMENT's box — the canvas PDF.js
// renders a page into — not the viewport and not the scroll container.

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Rects narrower or shorter than this (in normalized units) are dropped.
// `getClientRects()` routinely emits zero-width slivers at the boundary
// between two text nodes, and a selection that crosses an element boundary
// picks up one per crossing. Rendering them produces 1px specks scattered
// through the highlight; storing them inflates every row. ~0.0005 of a page
// is well under a character's width and comfortably above a sliver.
const MIN_NORMALIZED_EXTENT = 0.0005;

/**
 * Convert the client rects of a live selection into normalized page rects.
 *
 * `pageRect` is the page element's own bounding box, in the same client
 * coordinate space as `clientRects` (i.e. both from `getBoundingClientRect()`
 * / `getClientRects()` in the same frame). Scroll offsets cancel out because
 * both sides are viewport-relative — which is exactly why this must not be
 * handed a page rect captured at some other moment.
 *
 * Returns rects in the order given (reading order, as the DOM emits them),
 * clamped to the page and with degenerate slivers removed.
 */
export function toNormalizedRects(
  clientRects: readonly PixelRect[],
  pageRect: { width: number; height: number; x: number; y: number },
): NormalizedRect[] {
  // A zero-sized page means the element isn't laid out yet. Dividing by it
  // yields Infinity/NaN, which would be written to the DB as null-ish garbage
  // and fail the rects_non_empty check at best. Refuse instead.
  if (pageRect.width <= 0 || pageRect.height <= 0) return [];

  const normalized: NormalizedRect[] = [];

  for (const rect of clientRects) {
    const raw: NormalizedRect = {
      x: (rect.x - pageRect.x) / pageRect.width,
      y: (rect.y - pageRect.y) / pageRect.height,
      width: rect.width / pageRect.width,
      height: rect.height / pageRect.height,
    };

    const clamped = clampRect(raw);
    if (
      clamped.width < MIN_NORMALIZED_EXTENT ||
      clamped.height < MIN_NORMALIZED_EXTENT
    )
      continue;

    normalized.push(clamped);
  }

  return normalized;
}

/**
 * Convert a stored normalized rect back to pixels for rendering, against the
 * page element's CURRENT size. Returns page-relative offsets, so the caller
 * positions the highlight inside the page element rather than the viewport.
 */
export function toPixelRect(
  rect: NormalizedRect,
  pageSize: { width: number; height: number },
): PixelRect {
  return {
    x: rect.x * pageSize.width,
    y: rect.y * pageSize.height,
    width: rect.width * pageSize.width,
    height: rect.height * pageSize.height,
  };
}

// Clip to the page and drop any part that falls outside it. A selection drag
// that ends past the page edge, or a rect from a floating element overlapping
// the canvas, would otherwise persist coordinates > 1 — which render as a
// highlight hanging off the page.
function clampRect(rect: NormalizedRect): NormalizedRect {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  // The overwhelmingly common case: the selection is inside the page. Return
  // it untouched rather than deriving width/height by subtraction, which
  // reintroduces float error into values that were exact (0.1 measured as
  // 100/1000 comes back out of `bottom - top` as 0.10000000000000003).
  if (rect.x >= 0 && rect.y >= 0 && right <= 1 && bottom <= 1) return rect;

  const left = Math.min(Math.max(rect.x, 0), 1);
  const top = Math.min(Math.max(rect.y, 0), 1);
  // Clamp the far edge before deriving width, so a rect starting inside the
  // page but extending past it is truncated rather than merely shifted.
  const clampedRight = Math.min(Math.max(right, 0), 1);
  const clampedBottom = Math.min(Math.max(bottom, 0), 1);

  return {
    x: left,
    y: top,
    width: Math.max(clampedRight - left, 0),
    height: Math.max(clampedBottom - top, 0),
  };
}

/**
 * The smallest rect containing all of `rects`, or null for an empty list.
 *
 * Used to scroll an annotation into view and to place its comment marker: a
 * multi-line highlight has one rect per line, and "where is this annotation"
 * needs a single answer.
 */
export function boundingRect(
  rects: readonly NormalizedRect[],
): NormalizedRect | null {
  if (rects.length === 0) return null;

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Runtime validation for `rects` read back from jsonb.
 *
 * The column is jsonb — Postgres guarantees it's an array with at least one
 * element (migration 0042's check constraint) and nothing more. TypeScript's
 * `NormalizedRect[]` on the row type is an assertion, not a check, so a row
 * written by an older build, a manual edit, or a future bug arrives as
 * whatever it is. Rendering NaN offsets fails silently and invisibly, so the
 * repository parses through this instead of casting.
 */
export function isNormalizedRectArray(
  value: unknown,
): value is NormalizedRect[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const rect = entry as Record<string, unknown>;
    return (["x", "y", "width", "height"] as const).every((key) => {
      const component = rect[key];
      return typeof component === "number" && Number.isFinite(component);
    });
  });
}
