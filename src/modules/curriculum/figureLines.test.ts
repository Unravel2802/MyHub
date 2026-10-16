import { describe, expect, it } from "vitest";
import { parseFigure } from "@/src/modules/curriculum/figureLines";

describe("parseFigure", () => {
  it("extracts labels, flags, arrows, boxes and crosses", () => {
    const result = parseFigure(
      "  1. QPS\n  LATENCY (from the distributed track)\n  = 20M × 2 MB = 40 TB/day  ← DOMINATES\n  □ cache → warm it\n  ✗ mistakes",
    );
    expect(result.title).toBeNull();
    expect(result.lines[0]).toEqual([
      { kind: "dim", text: "1. " },
      { kind: "label", text: "QPS" },
    ]);
    expect(result.lines[2].at(-1)).toEqual({
      kind: "flag",
      text: "← DOMINATES",
    });
    expect(result.lines[3][0]).toEqual({ kind: "box", text: "□" });
    expect(result.lines[4][0]).toEqual({ kind: "cross", text: "✗" });
  });

  it("only extracts a lowercase title when followed by a blank line", () => {
    expect(
      parseFigure("the conclusions that fall out:\n\n□ one\n→ two").title,
    ).toBe("the conclusions that fall out");
    expect(parseFigure("a table\nrow: 1").title).toBeNull();
    expect(() => parseFigure("\n\n")).not.toThrow();
  });
});
