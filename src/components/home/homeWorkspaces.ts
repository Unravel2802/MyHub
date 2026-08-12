import { LayoutGrid, type LucideIcon } from "lucide-react";
import { NAV_ITEMS, type NavItem } from "@/src/components/appNav";
import {
  CORE_TOOL_HREFS,
  MINI_APPS,
  MINI_APP_HREFS,
} from "@/src/components/miniApps";
import type { HueName } from "@/src/components/moduleHues";

export interface HomeWorkspace {
  key: string;
  label: string;
  hue: HueName;
  icon: LucideIcon;
  href: string;
  // The planet's starting position on the orbit, in the reference CLUSTERS
  // table's own degree convention (0 = up, via orbitGeometry.planetStartAngle).
  // Career 30 / Money 150 / Core 270 are its literal values.
  deg: number;
  modules: NavItem[];
}

// The hub's orbital view groups nav entries the same way AppShell's sidebar
// does (miniApps.ts): Career and Money each keep their MINI_APPS hue. The
// third node, "Core Tools", is synthetic — built here, not added to
// miniApps.ts, because that file's CORE_TOOL_HREFS comment is explicit that
// these hrefs belong to no mini-app app-wide. This grouping exists only to
// give the hub's third orbit node something to show. `accent` (the brand hue)
// marks it as neutral rather than claiming one of the ten named hues.
const MINI_APP_DEGREES: Record<string, number> = { career: 30, money: 150 };

export const HOME_WORKSPACES: readonly HomeWorkspace[] = [
  ...MINI_APPS.map((app) => ({
    key: app.key,
    label: app.label,
    hue: app.hue,
    icon: app.icon,
    href: app.href,
    deg: MINI_APP_DEGREES[app.key] ?? 0,
    modules: NAV_ITEMS.filter((item) =>
      MINI_APP_HREFS[app.key].includes(item.href),
    ),
  })),
  {
    key: "core",
    label: "Core Tools",
    hue: "accent" as HueName,
    icon: LayoutGrid,
    href: CORE_TOOL_HREFS[0],
    deg: 270,
    modules: NAV_ITEMS.filter((item) => CORE_TOOL_HREFS.includes(item.href)),
  },
];
