// Tab / Shift+Tab indentation for a plain <textarea>.
//
// Shared because it was written twice, byte for byte identical, in
// KnowledgeBasePage (note body) and CodePad (Design Drills scratchpad) — two
// modules that must never import each other. Both need the same thing: Tab
// should indent rather than move focus, which means reimplementing what a real
// editor does for free.
//
// Pure and returns the next selection alongside the next text, because the
// caller has to restore the caret itself: writing `value` resets a textarea's
// selection to the end, so an indent that did not return `start`/`end` would
// dump the cursor at the bottom of the document on every Tab.

export const INDENT = "  ";

export interface IndentResult {
  next: string;
  start: number;
  end: number;
}

export function computeIndent(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  dedent: boolean,
): IndentResult {
  // A plain caret with no selection: insert one indent at the caret. Shift+Tab
  // falls through to the line logic below, since there is a line to dedent
  // even when nothing is selected.
  if (selectionStart === selectionEnd && !dedent) {
    const next = `${current.slice(0, selectionStart)}${INDENT}${current.slice(selectionEnd)}`;
    const cursor = selectionStart + INDENT.length;
    return { next, start: cursor, end: cursor };
  }

  // Expand the selection to whole lines: indenting is a line operation, so a
  // selection starting mid-word still shifts that entire line.
  const lineStart = current.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextNewline = current.indexOf(
    "\n",
    Math.max(selectionEnd - 1, lineStart),
  );
  const lineEnd = nextNewline === -1 ? current.length : nextNewline;

  const lines = current.slice(lineStart, lineEnd).split("\n");
  // Tracked so the caret keeps its position relative to the text on the first
  // line, rather than jumping to the line start.
  let firstLineDelta = 0;
  const nextLines = lines.map((line, index) => {
    if (dedent) {
      // 1-2 spaces, not exactly INDENT: a half-indented line should still
      // dedent rather than being left alone.
      const match = /^ {1,2}/.exec(line);
      if (!match) return line;
      if (index === 0) firstLineDelta = -match[0].length;
      return line.slice(match[0].length);
    }
    if (index === 0) firstLineDelta = INDENT.length;
    return `${INDENT}${line}`;
  });

  const nextBlock = nextLines.join("\n");
  const next = `${current.slice(0, lineStart)}${nextBlock}${current.slice(lineEnd)}`;

  return {
    next,
    // Clamped to lineStart so dedenting a line that is already flush cannot
    // push the caret before the line it belongs to.
    start: Math.max(lineStart, selectionStart + firstLineDelta),
    end: lineStart + nextBlock.length,
  };
}
