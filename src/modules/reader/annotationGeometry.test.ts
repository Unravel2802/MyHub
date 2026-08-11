import { describe, expect, it } from "vitest";
import {
  boundingRect,
  isNormalizedRectArray,
  toNormalizedRects,
  toPixelRect,
} from "@/src/modules/reader/annotationGeometry";

// A page element 800x1000 CSS px, offset 100,50 inside the viewport.
const PAGE = { height: 1000, width: 800, x: 100, y: 50 };

describe("toNormalizedRects", () => {
  it("converts client rects to page-relative 0-1 coordinates", () => {
    // A rect at viewport 300,250 is 200,200 into the page => 0.25, 0.2.
    const rects = toNormalizedRects(
      [{ height: 100, width: 400, x: 300, y: 250 }],
      PAGE,
    );

    expect(rects).toEqual([{ height: 0.1, width: 0.5, x: 0.25, y: 0.2 }]);
  });

  it("round-trips back to the same pixels at the original size", () => {
    const [normalized] = toNormalizedRects(
      [{ height: 100, width: 400, x: 300, y: 250 }],
      PAGE,
    );

    // Page-relative, so the page's viewport offset is not added back.
    expect(toPixelRect(normalized, PAGE)).toEqual({
      height: 100,
      width: 400,
      x: 200,
      y: 200,
    });
  });

  // The whole reason coordinates are normalized: reopening at a different
  // zoom must put the highlight on the same words.
  it("survives a change of zoom", () => {
    const [normalized] = toNormalizedRects(
      [{ height: 100, width: 400, x: 300, y: 250 }],
      PAGE,
    );

    // Same page rendered at 1.5x.
    expect(toPixelRect(normalized, { height: 1500, width: 1200 })).toEqual({
      height: 150,
      width: 600,
      x: 300,
      y: 300,
    });
  });

  it("keeps one rect per line, in reading order", () => {
    const rects = toNormalizedRects(
      [
        { height: 20, width: 600, x: 100, y: 50 },
        { height: 20, width: 300, x: 100, y: 70 },
      ],
      PAGE,
    );

    expect(rects).toHaveLength(2);
    expect(rects[0].y).toBeLessThan(rects[1].y);
  });

  // getClientRects() emits zero-width slivers at text-node boundaries; they
  // render as specks and bloat the stored array.
  it("drops degenerate slivers", () => {
    const rects = toNormalizedRects(
      [
        { height: 20, width: 400, x: 300, y: 250 },
        { height: 20, width: 0, x: 700, y: 250 },
        { height: 0, width: 400, x: 300, y: 300 },
      ],
      PAGE,
    );

    expect(rects).toHaveLength(1);
    expect(rects[0].width).toBeCloseTo(0.5);
  });

  it("clips a selection that runs past the page edge", () => {
    // Starts inside the page, extends 200px beyond its right/bottom edge.
    const rects = toNormalizedRects(
      [{ height: 200, width: 400, x: 700, y: 950 }],
      PAGE,
    );

    const [rect] = rects;
    expect(rect.x + rect.width).toBeLessThanOrEqual(1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(1);
    // Truncated, not shifted: the visible part keeps its own origin.
    expect(rect.x).toBeCloseTo(0.75);
    expect(rect.width).toBeCloseTo(0.25);
  });

  it("discards a rect entirely outside the page", () => {
    expect(
      toNormalizedRects([{ height: 20, width: 100, x: 2000, y: 250 }], PAGE),
    ).toEqual([]);
  });

  // An unlaid-out page divides by zero; Infinity/NaN must never reach the DB.
  it("returns nothing when the page has no size yet", () => {
    expect(
      toNormalizedRects([{ height: 20, width: 400, x: 300, y: 250 }], {
        height: 0,
        width: 0,
        x: 0,
        y: 0,
      }),
    ).toEqual([]);
  });
});

describe("boundingRect", () => {
  it("spans every rect in a multi-line selection", () => {
    // toBeCloseTo, not toEqual: the span is a sum of measured edges, so
    // ordinary float error is expected here and carries no meaning.
    const rect = boundingRect([
      { height: 0.02, width: 0.6, x: 0.2, y: 0.1 },
      { height: 0.02, width: 0.3, x: 0.1, y: 0.13 },
    ]);

    expect(rect?.x).toBeCloseTo(0.1);
    expect(rect?.y).toBeCloseTo(0.1);
    expect(rect?.width).toBeCloseTo(0.7);
    expect(rect?.height).toBeCloseTo(0.05);
  });

  it("is null for an empty list", () => {
    expect(boundingRect([])).toBeNull();
  });
});

describe("isNormalizedRectArray", () => {
  it("accepts a well-formed array", () => {
    expect(
      isNormalizedRectArray([{ height: 0.02, width: 0.5, x: 0.1, y: 0.2 }]),
    ).toBe(true);
  });

  it.each([
    ["not an array", { height: 1, width: 1, x: 0, y: 0 }],
    ["an empty array", []],
    ["a null entry", [null]],
    ["a missing component", [{ width: 0.5, x: 0.1, y: 0.2 }]],
    [
      "a non-numeric component",
      [{ height: 0.02, width: "0.5", x: 0.1, y: 0.2 }],
    ],
    // NaN survives a typeof check and renders as an invisible, unfixable
    // highlight — the exact failure this guard exists for.
    ["NaN", [{ height: 0.02, width: Number.NaN, x: 0.1, y: 0.2 }]],
  ])("rejects %s", (_label, value) => {
    expect(isNormalizedRectArray(value)).toBe(false);
  });
});
