import { describe, expect, it } from "vitest";
import { computeIndent, INDENT } from "@/src/lib/textIndent";

// This logic shipped twice, byte-for-byte duplicated across two modules, and
// was never tested in either. These pin the behaviour both call sites relied
// on before it was shared.

describe("computeIndent — inserting", () => {
  it("inserts one indent at a bare caret", () => {
    const { next, start, end } = computeIndent("hello", 5, 5, false);
    expect(next).toBe(`hello${INDENT}`);
    // Caret sits after the inserted indent, not at the end of the document.
    expect(start).toBe(7);
    expect(end).toBe(7);
  });

  it("indents the whole line even when the selection starts mid-word", () => {
    const { next } = computeIndent("hello world", 6, 8, false);
    expect(next).toBe(`${INDENT}hello world`);
  });

  it("indents every line of a multi-line selection", () => {
    const { next } = computeIndent("one\ntwo\nthree", 0, 13, false);
    expect(next).toBe(`${INDENT}one\n${INDENT}two\n${INDENT}three`);
  });

  it("leaves text outside the selected lines untouched", () => {
    const { next } = computeIndent("keep\ntarget\nkeep", 5, 11, false);
    expect(next).toBe(`keep\n${INDENT}target\nkeep`);
  });
});

describe("computeIndent — dedenting", () => {
  it("removes a full indent", () => {
    const { next } = computeIndent(`${INDENT}hello`, 2, 2, true);
    expect(next).toBe("hello");
  });

  // A half-indented line should still dedent — hence / {1,2}/ rather than an
  // exact-INDENT match.
  it("removes a single stray space", () => {
    const { next } = computeIndent(" hello", 1, 1, true);
    expect(next).toBe("hello");
  });

  it("leaves an already-flush line alone", () => {
    const { next } = computeIndent("hello", 0, 5, true);
    expect(next).toBe("hello");
  });

  it("never pushes the caret before the line it belongs to", () => {
    const { start } = computeIndent("hello", 0, 0, true);
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it("dedents each line independently, skipping flush ones", () => {
    const { next } = computeIndent(
      `${INDENT}one\ntwo\n${INDENT}three`,
      0,
      16,
      true,
    );
    expect(next).toBe("one\ntwo\nthree");
  });
});

describe("computeIndent — round trip", () => {
  it("dedent undoes indent for a multi-line selection", () => {
    const original = "alpha\nbeta";
    const indented = computeIndent(original, 0, original.length, false);
    const dedented = computeIndent(
      indented.next,
      indented.start,
      indented.end,
      true,
    );
    expect(dedented.next).toBe(original);
  });
});
