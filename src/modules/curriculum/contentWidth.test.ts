import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A width gate on the chapter files' fenced blocks.
//
// Diagrams and code are the one thing in a chapter that CANNOT reflow: prose
// wraps to any viewport, a `pre` scrolls horizontally instead. A diagram wider
// than a phone's text column means the reader drags it sideways to read a
// picture, which is worse than no picture.
//
// The authoring prompt asks for 76; this gate allows 80 — the universal
// terminal width — so a diagram that is a few columns over is not a build
// failure, while one written at 120 columns is. It exists mostly to catch
// GENERATED content: chapters arrive from a model in bulk, and nobody is going
// to eyeball every fence.

const ROOT = join(process.cwd(), "content", "curriculum");
const MAX_WIDTH = 80;

function markdownFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return entry.endsWith(".md") ? [path] : [];
  });
}

interface Offender {
  file: string;
  line: number;
  width: number;
}

function overWideFencedLines(file: string): Offender[] {
  const out: Offender[] = [];
  let inFence = false;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (line.startsWith("```")) {
        inFence = !inFence;
        return;
      }
      // Only inside fences. Prose is wrapped by the browser and a long
      // markdown line is not a rendering problem.
      if (inFence && line.length > MAX_WIDTH) {
        out.push({
          file: file.slice(ROOT.length + 1),
          line: index + 1,
          width: line.length,
        });
      }
    });
  return out;
}

describe("curriculum chapter fenced blocks", () => {
  const files = markdownFiles(ROOT);

  it("finds the chapter files at all", () => {
    // Guards against the glob silently returning nothing and the width
    // assertion below passing vacuously forever.
    expect(files.length).toBeGreaterThan(0);
  });

  it(`keeps every fenced line at or under ${MAX_WIDTH} columns`, () => {
    const offenders = files.flatMap(overWideFencedLines);
    expect(
      offenders.map((o) => `${o.file}:${o.line} is ${o.width} cols`),
    ).toEqual([]);
  });
});
