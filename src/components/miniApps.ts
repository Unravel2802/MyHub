import { Landmark, Rocket, type LucideIcon } from "lucide-react";
import type { HueName } from "@/src/components/moduleHues";

// MyHub is a platform of MINI-APPS, not a single job-search tool: the
// engineering roadmap is one mini-app, money (finance + trading) is another, a
// blog is planned. This catalog is the level above `appNav.ts`'s flat list —
// the nav groups by it, `hueFor()` falls back through it, and the hub landing
// renders a card per entry.
//
// Static classification lives in CODE, not a table — same pattern as
// financeCategories.ts / achievementCatalog.ts / roadmapCatalog.ts.
//
// Only mini-apps that actually EXIST belong here. Blog is planned but unbuilt;
// it gets an entry when it ships, not before.

export type MiniAppKey = "career" | "money";

export interface MiniApp {
  key: MiniAppKey;
  label: string;
  // The group's identity hue. Used for the nav group heading and the hub card
  // — NOT forced onto member modules, which keep their own hues (see
  // moduleHues.ts's fallback chain and docs/color-refresh.md).
  hue: HueName;
  icon: LucideIcon;
  // Where "open this mini-app" goes.
  href: string;
}

export const MINI_APPS: readonly MiniApp[] = [
  {
    key: "career",
    label: "Career",
    // Violet is already the "meta" family (Roadmap owns it), and the roadmap
    // IS this mini-app's spine.
    hue: "violet",
    icon: Rocket,
    href: "/dashboard",
  },
  {
    key: "money",
    label: "Money",
    // Lime is already Finances'; the mini-app inherits its first member's hue
    // rather than claiming a twelfth.
    hue: "lime",
    icon: Landmark,
    href: "/finance",
  },
];

// Which nav hrefs belong to which mini-app. Kept here rather than as a field on
// NavItem so there is ONE place to read membership from, and so moduleHues.ts
// can resolve a hue without importing the nav list (which would pull every
// lucide icon into anything that asks for a color).
export const MINI_APP_HREFS: Record<MiniAppKey, readonly string[]> = {
  career: [
    "/dashboard",
    "/roadmap",
    "/prep",
    "/design-drills",
    "/applications",
    "/outreach",
    "/achievements",
    "/review",
    "/offers",
  ],
  money: ["/finance"],
};

// Cross-cutting tools that deliberately belong to NO mini-app: you reach for
// them whichever one you're in. They render ungrouped, above the groups.
// Explicit rather than "whatever's left over" so a nav entry that was simply
// forgotten shows up as a test failure (see miniApps.test.ts) instead of
// silently becoming a core tool.
export const CORE_TOOL_HREFS: readonly string[] = ["/", "/notes"];

const MINI_APP_BY_HREF = new Map<string, MiniApp>(
  MINI_APPS.flatMap((app) =>
    MINI_APP_HREFS[app.key].map((href) => [href, app] as const),
  ),
);

// The mini-app a nav href belongs to, or undefined for a core tool (or an href
// nobody has classified yet).
export function miniAppFor(href: string): MiniApp | undefined {
  return MINI_APP_BY_HREF.get(href);
}
