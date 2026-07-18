// Published contract for the shared AppShell (myhub_plan.md Part B, Phase 1).
// The five nav entries below are exactly what src/modules/task/components/
// Sidebar.tsx already renders — AppShell.tsx should map over this list rather
// than hand-writing five <Link>s the way every page currently does.
//
// Later Wave 2 phases append here, in this file, rather than each page
// hand-adding its own <Link> the way Phase 1 is deleting: Phase 5 (Momentum)
// adds Achievements, Phase 6 (Weekly Review) adds Weekly Review, Phase 8
// (Offers) adds Offer Evaluator.

import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  // Optional per-item icon (Wave 4 Workstream C). Type only — the actual
  // icon-per-module assignment is app-knowledge Codex fills in. Rendered
  // decoratively (aria-hidden) and inherits the item's module hue via
  // currentColor, so it never names a raw color.
  icon?: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/", label: "Task Engine" },
  { href: "/prep", label: "Prep Tracker" },
  { href: "/applications", label: "Job CRM" },
  { href: "/outreach", label: "Outreach Log" },
  { href: "/achievements", label: "Achievements" },
  { href: "/review", label: "Weekly Review" },
  { href: "/offers", label: "Offer Evaluator" },
  { href: "/notes", label: "Knowledge Base" },
];
