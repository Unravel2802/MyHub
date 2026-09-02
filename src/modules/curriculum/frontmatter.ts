// A deliberately tiny frontmatter reader for the chapter files.
//
// NOT `gray-matter`, and not a YAML parser. The approved-dependency list in
// CLAUDE.md is short on purpose, and what we need here is one flat block of
// `key: value` lines — a real YAML parser would buy anchors, nested maps and
// multi-document streams, none of which a chapter header should ever contain.
// Keeping it to this file also means the rules are enforceable in a unit test
// instead of documented in a README nobody rereads.
//
// The grammar, in full:
//
//     ---
//     title: Why caching exists
//     minutes: 25
//     summary: A short line, quotes optional
//     ---
//     # the markdown body starts here
//
// Anything richer (lists, nesting, block scalars) is not supported and is read
// as a plain string, which is the honest failure: the value shows up wrong in
// the UI rather than the whole page failing to build.

export interface Frontmatter {
  data: Record<string, string>;
  body: string;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(source: string): Frontmatter {
  // A BOM ahead of the fence is common in files that have been through a text
  // editor on Windows, and would otherwise make the regex miss entirely,
  // silently turning the whole header into body text.
  const text = source.replace(/^﻿/, "");
  const match = FENCE.exec(text);
  if (!match) return { data: {}, body: text.trim() };

  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (key === "") continue;
    data[key] = unquote(trimmed.slice(separator + 1).trim());
  }

  return { data, body: text.slice(match[0].length).trim() };
}

// Quotes are optional in the header, so a title that happens to contain a colon
// can be written `title: "Caching: why it exists"` and survive the split above.
function unquote(value: string): string {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return quoted && value.length >= 2 ? value.slice(1, -1) : value;
}

// A positive integer, or null. Null rather than 0 for anything unparseable:
// "0 min read" is a claim, "no estimate" is the truth.
export function parseMinutes(value: string | undefined): number | null {
  if (value === undefined) return null;
  const minutes = Number.parseInt(value.trim(), 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

// Drop the body's opening `# Heading` when it just repeats the chapter title.
//
// A chapter file naturally opens with its own H1 — that is what markdown looks
// like, and it is what any author (or model) will write. But the reader page
// already renders the title from the frontmatter as the page's H1, so the two
// together produce a visible duplicate heading and TWO h1s on one document,
// which is a real accessibility defect rather than a cosmetic one.
//
// Stripping here rather than asking authors not to write it: the instruction
// would be obeyed unevenly across hundreds of generated files, and the failure
// is silent.
export function stripLeadingTitle(body: string, title: string): string {
  const match = /^#\s+(.+?)\s*$/m.exec(body.split("\n\n")[0] ?? "");
  if (!match) return body;
  if (normalize(match[1]) !== normalize(title)) return body;
  // Only the first line goes; everything after the heading is kept verbatim.
  return body.slice(body.indexOf("\n") + 1).trimStart();
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
