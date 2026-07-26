// Which identity hue each module owns (docs/color-refresh.md). Keyed by nav
// href so any consumer — the nav, a page header, a hero StatCard — resolves the
// same answer from one import.
//
// The values are hue NAMES, not colors. A component turns a name into color by
// setting the `--hue` CSS variable inline (`style={{ "--hue": `var(--hue-${h})` }}`)
// and using the hue-* utilities / tokens. Components never name a raw color —
// that's the rule the whole two-theme system rests on.

import { miniAppFor } from "@/src/components/miniApps";

export type HueName =
  | "amber"
  | "orange"
  | "rose"
  | "violet"
  | "blue"
  | "cyan"
  | "teal"
  | "emerald"
  | "fuchsia"
  | "lime"
  | "accent"; // indigo, the brand hue — the hub keeps it

export const MODULE_HUES: Record<string, HueName> = {
  "/dashboard": "accent", // the hub keeps the brand color
  "/roadmap": "violet", // sibling of indigo — the "meta" pages share a family
  "/": "amber", // Task Engine — its Todo dot is already amber
  "/prep": "cyan", // cool / technical
  "/applications": "blue", // the pipeline
  "/outreach": "rose", // human contact
  "/achievements": "orange", // the flame
  "/review": "teal", // calm, reflective
  "/offers": "emerald", // money and go-signals
  "/notes": "fuchsia", // Knowledge Base — the one remaining unclaimed hue
  "/finance": "lime", // Personal Finance — money reads green; emerald is Offers
};

// Resolution is a FALLBACK CHAIN, not a single lookup:
//
//   1. the module's own hue, if it has claimed one (above)
//   2. its mini-app's hue (miniApps.ts)
//   3. the brand accent
//
// Step 2 exists because all ten named hues are claimed, so every module added
// from here on would otherwise land on generic `accent` — Design Drills already
// does. Inheriting the mini-app's hue means a new module reads as a sibling of
// the ones it ships beside instead of as "uncategorised".
//
// Deliberately NOT hue-per-mini-app: collapsing the nine Career modules onto
// one color would throw away the per-module identity docs/color-refresh.md was
// built to give them. Step 1 always wins.
export function hueFor(href: string): HueName {
  return MODULE_HUES[href] ?? miniAppFor(href)?.hue ?? "accent";
}

// The CSS value to drop into a `--hue` custom property. `accent` resolves to the
// existing brand token; every other name resolves to its hue-kit token.
export function hueVar(hue: HueName): string {
  return hue === "accent" ? "var(--accent)" : `var(--hue-${hue})`;
}
