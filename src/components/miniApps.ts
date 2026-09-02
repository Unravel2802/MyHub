import {
  Briefcase,
  Dumbbell,
  Landmark,
  Rocket,
  type LucideIcon,
} from "lucide-react";
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

// 2026-08-13: "Career" was split. It had grown to NINE members — two thirds of
// the whole app under one heading, and one orbit node whose expansion was an
// unreadable ring of nine moons. Four-ish is the ceiling that keeps a group
// scannable and its moon ring legible, so Career became Practice / Job Search
// / Progress along the seams that were already there: what you DO to get
// better, what you SEND to employers, and what you use to TRACK either.
export type MiniAppKey = "practice" | "jobs" | "progress" | "money";

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

// Each group's hue is its spine module's own hue — the established rule (see
// Money's note below). They're also checked against each other for SEPARATION,
// because these five are the orbit's planet colours and sit side by side: by
// hue angle cyan 193, blue 224, violet 263, lime 86, plus Core Tools' amber 26
// leaves at least ~30 degrees between any two. Indigo/accent was deliberately
// given up for Core Tools here — at 243 it sat between blue and violet, making
// three of the five nodes read as the same colour.
export const MINI_APPS: readonly MiniApp[] = [
  {
    key: "practice",
    label: "Practice",
    // Prep Tracker's own cyan — "cool / technical", and Prep is the spine of
    // deliberate practice. Design Drills inherits it (it claims no hue).
    hue: "cyan",
    icon: Dumbbell,
    href: "/prep",
  },
  {
    key: "jobs",
    label: "Job Search",
    // Job CRM's blue — "the pipeline", which is what this group is.
    hue: "blue",
    icon: Briefcase,
    href: "/applications",
  },
  {
    key: "progress",
    label: "Progress",
    // Roadmap's violet, the "meta" family: these are the pages you read ABOUT
    // your work rather than do work in. Inherits what Career used to carry.
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
  // What you do to get better at the work.
  practice: ["/prep", "/design-drills", "/curriculum"],
  // What you send outward, and what comes back — the pipeline end to end.
  jobs: ["/applications", "/outreach", "/offers"],
  // Where you look to see how any of it is going.
  progress: ["/dashboard", "/roadmap", "/achievements", "/review"],
  money: ["/finance", "/trading"],
};

// Cross-cutting tools that deliberately belong to NO mini-app: you reach for
// them whichever one you're in. They render ungrouped, above the groups.
// Explicit rather than "whatever's left over" so a nav entry that was simply
// forgotten shows up as a test failure (see miniApps.test.ts) instead of
// silently becoming a core tool.
export const CORE_TOOL_HREFS: readonly string[] = [
  "/tasks",
  "/notes",
  "/reader",
];

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
