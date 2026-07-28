import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The gap in the original AA gate (docs/ui-upgrade-wave3.md Part 3).
//
// `palette.test.ts` checks every text token against `--surface` and
// `--surface-subtle` — the neutral surfaces. But the app routinely puts
// COLOURED text on its own TINTED surface, and that pairing has never been
// measured:
//
//   text-danger        on bg-danger-surface     every error banner, 13 of them
//   text-success       on bg-success-surface    StatCard tone="success"
//   text-accent-strong on bg-accent-surface     StatCard tone="accent"
//   text-hue-X         on bg-hue-X-surface      StatCard hue={...}
//
// Those are exactly the combinations the neutral-surface test cannot see. A
// token can clear 4.5:1 on white and still be illegible on its own tint.

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");

function parseBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`missing ${selector} block`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const vars: Record<string, string> = {};
  for (const match of css
    .slice(open + 1, end)
    .matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g))
    vars[match[1]] = match[2];
  return vars;
}

function luminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const HUES = [
  "amber",
  "orange",
  "rose",
  "violet",
  "blue",
  "cyan",
  "teal",
  "emerald",
  "fuchsia",
  "lime",
] as const;

// A stat value and a banner message are ordinary body copy, so AA is 4.5:1 —
// the same bar the neutral-surface gate holds these tokens to. Nothing here is
// large-text, which is the only case that would justify 3:1.
const AA = 4.5;

// text token -> the tinted surface it is actually rendered on
const PAIRS: [string, string][] = [
  ["--danger", "--danger-surface"],
  ["--success", "--success-surface"],
  ["--accent-strong", "--accent-surface"],
  ...HUES.map(
    (hue) => [`--hue-${hue}`, `--hue-${hue}-surface`] as [string, string],
  ),
];

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("%s theme: coloured text on its own tinted surface", (_theme, selector) => {
  const vars = parseBlock(selector);

  it.each(PAIRS)("%s clears AA on %s", (token, surface) => {
    const fg = vars[token];
    const bg = vars[surface];
    expect(fg, `${token} missing`).toBeTruthy();
    expect(bg, `${surface} missing`).toBeTruthy();
    expect(
      contrast(fg, bg),
      `${token} (${fg}) on ${surface} (${bg})`,
    ).toBeGreaterThanOrEqual(AA);
  });
});
