// Which identity hue each module owns (docs/color-refresh.md). Keyed by nav
// href so any consumer — the nav, a page header, a hero StatCard — resolves the
// same answer from one import.
//
// The values are hue NAMES, not colors. A component turns a name into color by
// setting the `--hue` CSS variable inline (`style={{ "--hue": `var(--hue-${h})` }}`)
// and using the hue-* utilities / tokens. Components never name a raw color —
// that's the rule the whole two-theme system rests on.

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
};

// The default for anything not in the map: the brand accent.
export function hueFor(href: string): HueName {
  return MODULE_HUES[href] ?? "accent";
}

// The CSS value to drop into a `--hue` custom property. `accent` resolves to the
// existing brand token; every other name resolves to its hue-kit token.
export function hueVar(hue: HueName): string {
  return hue === "accent" ? "var(--accent)" : `var(--hue-${hue})`;
}
