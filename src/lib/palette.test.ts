import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The automated AA gate (docs/color-refresh.md K1). Contrast has been
// hand-verified twice this project — this makes the third check a red test
// instead of a discovery. It reads the ACTUAL globals.css, so a token edited to
// a prettier-but-illegible shade fails the unit suite, not a user's eyes.

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");

// Pull the `:root { ... }` and first `.dark { ... }` blocks and parse their
// `--name: #hex;` declarations into a map.
function parseBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`missing ${selector} block`);
  const open = css.indexOf("{", start);
  // Match to the balanced close brace.
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
  const body = css.slice(open + 1, end);
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    vars[match[1]] = match[2];
  }
  return vars;
}

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(c.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
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
  // Kit extension 2026-08-12. See globals.css for why yellow is absent and why
  // these are siblings of existing hues rather than new territory.
  "sky",
  "purple",
  "pink",
  "slate",
  "stone",
] as const;

// The three roles every hue must define. A hue that ships its text role but not
// its surface/border is a half-hue that fails at the first badge.
const HUE_ROLES = ["", "-surface", "-border"] as const;

// Text-role semantic tokens that carry copy. `-surface`/`-border` roles are
// backgrounds and don't need AA against text; they're excluded on purpose.
const TEXT_TOKENS = [
  "--foreground",
  "--body",
  "--muted",
  "--subtle",
  "--accent-strong",
];

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("%s theme meets WCAG AA on its surfaces", (_theme, selector) => {
  const vars = parseBlock(selector);
  const surfaces = [vars["--surface"], vars["--surface-subtle"]];

  it.each(TEXT_TOKENS)("%s clears 4.5:1 on every surface", (token) => {
    const color = vars[token];
    expect(color, `${token} missing`).toBeTruthy();
    for (const surface of surfaces) {
      expect(
        contrast(color, surface),
        `${token} on ${surface}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it.each(HUES)("hue %s text-role clears 4.5:1 on every surface", (hue) => {
    const color = vars[`--hue-${hue}`];
    expect(color, `--hue-${hue} missing`).toBeTruthy();
    for (const surface of surfaces) {
      expect(
        contrast(color, surface),
        `--hue-${hue} on ${surface}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it.each(HUES)("hue %s defines all three roles", (hue) => {
    for (const role of HUE_ROLES) {
      expect(
        vars[`--hue-${hue}${role}`],
        `--hue-${hue}${role} missing`,
      ).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// A hue can be defined in BOTH theme blocks and still be unusable: Tailwind only
// generates `bg-hue-x-surface` if the role is mapped in `@theme inline`. Miss
// that and the class silently does nothing — no build error, no runtime error,
// just an unstyled badge that nobody notices until it ships. Adding five hues at
// once is exactly when that slips, so it gets a test.
describe("every hue role is exposed as a Tailwind utility", () => {
  it.each(HUES)("hue %s is mapped in @theme inline", (hue) => {
    for (const role of HUE_ROLES) {
      const name = `--hue-${hue}${role}`;
      expect(css, `${name} not mapped in @theme inline`).toContain(
        `--color-hue-${hue}${role}: var(${name});`,
      );
    }
  });
});
