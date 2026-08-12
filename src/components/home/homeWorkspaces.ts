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
// does (miniApps.ts), and adds one synthetic node: "Core Tools" is built here,
// not in miniApps.ts, because that file's CORE_TOOL_HREFS comment is explicit
// that those hrefs belong to no mini-app app-wide. This grouping exists only
// to give the hub a node for them.
//
// Evenly spaced at 360/5 = 72 degrees, so no two planets start bunched. The
// reference's own 270/30/150 was the same idea for three.
const MINI_APP_DEGREES: Record<string, number> = {
  progress: 0,
  jobs: 72,
  money: 144,
  practice: 216,
};
const CORE_DEG = 288;

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
    // Task Engine's amber, following the same "spine module's hue" rule the
    // mini-apps use. This was `accent` while there were only three planets;
    // with five, indigo at hue angle 243 sat directly between Job Search's
    // blue (224) and Progress's violet (263) and made three of the five nodes
    // read as one colour. Amber (26) is the widest gap available.
    hue: "amber" as HueName,
    icon: LayoutGrid,
    href: CORE_TOOL_HREFS[0],
    deg: CORE_DEG,
    modules: NAV_ITEMS.filter((item) => CORE_TOOL_HREFS.includes(item.href)),
  },
];
