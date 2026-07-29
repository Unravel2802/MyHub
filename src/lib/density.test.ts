import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The density gate (docs/ui-upgrade-wave3.md §2.3, C3).
//
// "The app is spacious when empty and will be dense when full — backwards for
// a dashboard." The fix is a tightened 8-32px spacing ramp (down from the
// 16-64px spread panels were actually using) plus a single named floor height
// for empty containers, so X4/X6 apply a token instead of picking a number.
// A token that is never checked can still drift back to the wide ramp one
// "just this once" px value at a time — this reads the ACTUAL `@theme inline`
// block in globals.css, the same approach palette.test.ts uses for color, so a
// value edited back toward 16-64px fails the unit suite rather than waiting to
// be noticed on screen.

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");

// Pull the `@theme inline { ... }` block and parse its `--name: <n>rem;`
// declarations into a map of pixel values (the ramp is defined in rem; 1rem is
// fixed at 16px everywhere in this app — no user-scalable root font-size).
function parseThemeSpacing(): Record<string, number> {
  const start = css.indexOf("@theme inline {");
  if (start === -1) throw new Error("missing @theme inline block");
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
  const body = css.slice(open + 1, end);
  const px: Record<string, number> = {};
  for (const match of body.matchAll(/(--spacing-[\w-]+):\s*([\d.]+)rem\s*;/g))
    px[match[1]] = parseFloat(match[2]) * 16;
  return px;
}

const spacing = parseThemeSpacing();

describe("density ramp", () => {
  it.each([
    ["--spacing-xs", 8],
    ["--spacing-sm", 16],
    ["--spacing-md", 24],
    ["--spacing-lg", 32],
  ])("%s is exactly %dpx", (token, expectedPx) => {
    expect(spacing[token], `${token} missing from @theme inline`).toBe(
      expectedPx,
    );
  });

  it("stays within the 8-32px dashboard ramp, not the old 16-64px spread", () => {
    const ramp = [
      "--spacing-xs",
      "--spacing-sm",
      "--spacing-md",
      "--spacing-lg",
    ];
    for (const token of ramp) {
      expect(spacing[token]).toBeGreaterThanOrEqual(8);
      expect(spacing[token]).toBeLessThanOrEqual(32);
    }
  });

  it("is strictly ascending, xs through lg", () => {
    const ramp = [
      spacing["--spacing-xs"],
      spacing["--spacing-sm"],
      spacing["--spacing-md"],
      spacing["--spacing-lg"],
    ];
    for (let i = 1; i < ramp.length; i++)
      expect(ramp[i]).toBeGreaterThan(ramp[i - 1]);
  });
});

describe("empty-container floor", () => {
  it("--spacing-empty is exactly 120px, per §2.3's min-h-[120px] rule", () => {
    expect(spacing["--spacing-empty"]).toBe(120);
  });

  it("is its own token, not aliased into the xs-lg ramp", () => {
    // 120px deliberately sits above --spacing-lg (32px): it is a floor HEIGHT
    // for one situation (an empty state's container), not another rung on the
    // general-purpose gap/padding ramp. If this ever collapses to equal one of
    // the ramp steps, `min-h-empty` and the ramp have been conflated into one
    // token doing two jobs.
    expect(spacing["--spacing-empty"]).not.toBe(spacing["--spacing-lg"]);
  });
});
