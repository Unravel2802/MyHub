import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// "Only `globals.css` names a colour" (docs/ui-upgrade-wave3.md Part 3).
//
// This rule has been written in prose THREE times across two documents —
// visual-refresh.md Part 4, color-refresh.md Part 3 rule 2, and
// ui-upgrade-wave3.md Part 5 rule 3 — and broken each time, most recently badly
// enough to need a dedicated migration commit (1974c8f, "migrate last raw-color
// file"). Prose is not a gate.
//
// A raw `bg-zinc-900` in a component is a bug rather than a style choice: the
// semantic token layer is what makes the light/dark switch a single block of
// overrides instead of a `dark:` variant on every utility in the app. A raw
// palette class is invisible or garish in whichever theme it wasn't picked for.
//
// The suite is green today. It exists for what comes next — X5 applies module
// hues across Design Drills, LeetCode and Trading, which is precisely the kind
// of work that reaches for `text-cyan-400`.

const ROOTS = ["src", "app"];
const EXTENSIONS = [".ts", ".tsx"];

// Files allowed to name a colour, and why.
const ALLOWED = new Set([
  // The hue kit itself: the one place a hue name maps to Tailwind classes.
  "src/components/ui/hueClasses.ts",
  // These read globals.css as DATA to assert contrast; the hexes are expected
  // values, not styling.
  "src/lib/palette.test.ts",
  "src/lib/paletteTinted.test.ts",
  // This file's own regex literals.
  "src/lib/noRawColor.test.ts",
]);

const TAILWIND_PALETTES = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
].join("|");

const UTILITIES = [
  "bg",
  "text",
  "border",
  "ring",
  "from",
  "to",
  "via",
  "fill",
  "stroke",
  "shadow",
  "decoration",
  "outline",
  "accent",
  "caret",
  "divide",
  "placeholder",
].join("|");

// `bg-zinc-900`, `text-indigo-400/50`, `dark:hover:border-rose-200` …
const RAW_UTILITY = new RegExp(
  `\\b(?:${UTILITIES})-(?:${TAILWIND_PALETTES})-\\d{2,3}\\b`,
  "g",
);

// A hex literal in a component. `#` also starts a fragment or a private field,
// so require 3/6/8 hex digits and a word boundary.
const RAW_HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((root) => walk(join(process.cwd(), root)))
  .map((full) => relative(process.cwd(), full))
  .filter((path) => !ALLOWED.has(path))
  .sort();

function findAll(path: string, pattern: RegExp): string[] {
  return readFileSync(join(process.cwd(), path), "utf-8").match(pattern) ?? [];
}

describe("only globals.css names a colour", () => {
  it("scans a non-trivial number of files", () => {
    // Guards the guard: a broken walk() would make every assertion below pass
    // vacuously.
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files)("%s uses no raw Tailwind palette utility", (path) => {
    expect(findAll(path, RAW_UTILITY)).toEqual([]);
  });

  it.each(files)("%s uses no hex colour literal", (path) => {
    expect(findAll(path, RAW_HEX)).toEqual([]);
  });
});
