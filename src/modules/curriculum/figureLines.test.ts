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

describe("chapter figure regressions", () => {
  it("parses the exact media conclusion as box, text and arrow", () => {
    expect(
      parseFigure("□  media dominates storage → object storage + CDN").lines,
    ).toEqual([
      [
        { kind: "box", text: "□" },
        { kind: "text", text: "  media dominates storage " },
        { kind: "arrow", text: "→ object storage + CDN" },
      ],
    ]);
  });

  it("preserves a blank line between labels", () => {
    expect(parseFigure("  TIME\n\n  LATENCY").lines).toEqual([
      [{ kind: "label", text: "TIME" }],
      [{ kind: "text", text: "" }],
      [{ kind: "label", text: "LATENCY" }],
    ]);
  });

  it("applies flags after leading glyphs and gives flags precedence over arrows", () => {
    expect(parseFigure("✗  wrong → answer ← explanation").lines[0]).toEqual([
      { kind: "cross", text: "✗" },
      { kind: "text", text: "  wrong → answer " },
      { kind: "flag", text: "← explanation" },
    ]);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";

it("parses the estimation chapter's verbatim numbers, conclusions and mistakes blocks", () => {
  const chapter = readFileSync(
    path.join(
      process.cwd(),
      "content/curriculum/systems-design.estimation/01-back-of-envelope.md",
    ),
    "utf8",
  );
  const blocks = [...chapter.matchAll(/```text\n([\s\S]*?)\n```/g)].map(
    (match) => match[1],
  );
  const numbers = parseFigure(blocks[0]);
  expect(
    numbers.lines
      .flat()
      .filter((segment) => segment.kind === "label")
      .map((segment) => segment.text),
  ).toEqual(["TIME", "LATENCY", "SIZES", "CAPACITY"]);
  const worked = parseFigure(
    blocks.find((block) => block.includes("← DOMINATES"))!,
  );
  expect(
    worked.lines.flat().filter((segment) => segment.kind === "flag"),
  ).toEqual([{ kind: "flag", text: "← DOMINATES" }]);
  const conclusions = parseFigure(
    blocks.find((block) => block.includes("the conclusions that fall out"))!,
  );
  expect(conclusions.title).toBe(
    "the conclusions that fall out, without any further work",
  );
  expect(
    conclusions.lines.flat().filter((segment) => segment.kind === "box"),
  ).toHaveLength(4);
  expect(
    conclusions.lines.flat().filter((segment) => segment.kind === "arrow"),
  ).toHaveLength(4);
  const mistakes = parseFigure(
    blocks.find((block) => block.includes("✗  computing average"))!,
  );
  expect(
    mistakes.lines.flat().filter((segment) => segment.kind === "cross"),
  ).toHaveLength(6);
});
