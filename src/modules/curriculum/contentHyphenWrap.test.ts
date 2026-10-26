import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A gate on hyphenated compounds split across prose lines.
//
// Chapters are hard-wrapped at ~80 columns, and a generator wrapping by hand
// will happily break "boundary-burst" as "boundary-" / "burst". Markdown joins
// a soft line break with a SPACE, so the reader renders "boundary- burst" —
// a typo that exists only in the rendered page, invisible in the source diff.
//
// Like the fence-width gate beside it, this exists to catch GENERATED content:
// chapters arrive from a model in bulk, and nobody is going to eyeball every
// line ending.
//
// Fenced blocks are exempt (they render verbatim, so a split there is shown as
// written), as are list-item lines starting with "-" and table rows, where a
// trailing hyphen is either a bullet marker or cell content.

const ROOT = join(process.cwd(), "content", "curriculum");

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
  text: string;
}

const SPLIT_COMPOUND = /[A-Za-z]-\s*$/;

function splitCompoundLines(file: string): Offender[] {
  const out: Offender[] = [];
  let inFence = false;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (line.startsWith("```")) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;
      const body = line.trimStart();
      if (body.startsWith("-") || body.startsWith("|")) return;
      if (SPLIT_COMPOUND.test(line)) {
        out.push({
          file: file.slice(ROOT.length + 1),
          line: index + 1,
          text: line.trim(),
        });
      }
    });
  return out;
}

describe("curriculum chapter prose line endings", () => {
  const files = markdownFiles(ROOT);

  it("finds the chapter files at all", () => {
    // Guards against the walk silently returning nothing and the assertion
    // below passing vacuously forever.
    expect(files.length).toBeGreaterThan(0);
  });

  it("never splits a hyphenated compound across two prose lines", () => {
    const offenders = files.flatMap(splitCompoundLines);
    expect(
      offenders.map((o) => `${o.file}:${o.line} ends "${o.text.slice(-24)}"`),
    ).toEqual([]);
  });
});
