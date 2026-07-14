import type { PrepEntryType } from "@/src/modules/prep/types";

// The roadmap module (docs/roadmap-module.md). The CATALOG is code — the
// roadmap's content is static and changes via a commit. Only ticks and
// self-assessments are data.

export type MonthKey = string; // "2026-07"

export type MonthStatus = "done" | "in_progress" | "upcoming" | "missed";

export type ReadinessLevel = "not_started" | "minimum" | "strong";

// Where an auto criterion's number comes from, declared as DATA so the catalog
// stays pure and the measuring lives in roadmapProgress.ts.
//
// `scope` is load-bearing and easy to get wrong: the roadmap mixes MONTHLY
// volumes ("15 algorithm problems" in September) with CUMULATIVE totals
// ("150+ algorithm problems total" by February). Measuring a cumulative target
// against a single month's entries would make February permanently unreachable;
// measuring a monthly target cumulatively would mark September done in
// December. They are different questions.
export type Measure =
  | { source: "prep"; entryType: PrepEntryType; scope: "month" | "cumulative" }
  | { source: "applications"; scope: "month" | "cumulative" }
  | { source: "outreach"; scope: "month" | "cumulative" }
  | { source: "companies"; scope: "cumulative" }
  // Only stories with BOTH a concise and an extended version count — §6.5's bar.
  // A titled stub isn't a story yet.
  | { source: "behavioralStories"; scope: "cumulative" };

export interface AutoCriterion {
  kind: "auto";
  key: string;
  label: string;
  // The roadmap line this number came from. Same discipline as
  // achievementCatalog: if it can't be cited, it doesn't belong.
  source: string;
  target: number;
  measure: Measure;
}

export interface ManualCriterion {
  kind: "manual";
  key: string;
  label: string;
  source: string;
}

export type Criterion = AutoCriterion | ManualCriterion;

export interface RoadmapMonth {
  key: MonthKey;
  label: string;
  theme: string;
  // Verbatim from the roadmap's "**<Month> gate:**" line. Empty for the months
  // that don't declare one (April, May — decision months, not delivery months).
  gate: string;
  criteria: Criterion[];
}

export interface ReadinessArea {
  key: string;
  label: string;
  // Both verbatim from §6.1's matrix.
  minimum: string;
  strong: string;
  // How to EVIDENCE a claim, where the data exists. Null where the bar is a
  // judgment ("lead 45-min designs with capacity and failure analysis") and no
  // number can honestly stand in for it.
  evidence: ReadinessEvidence | null;
}

export type ReadinessEvidence =
  // §6.1 Strong: "Most mediums in 20-30 min, clean explanation".
  | { kind: "avgSolveTime"; strongMaxMinutes: number }
  // §6.1 Strong: "Role-specific resumes, tracked funnel, active mock loops".
  | { kind: "funnelActive"; minApplications: number };

// --- runtime state (computed, never stored) ---------------------------------

export interface CriterionState {
  criterion: Criterion;
  met: boolean;
  // Auto criteria only. Null for manual ones — a checkbox has no "12 of 20".
  progress: { actual: number; target: number } | null;
}

export interface MonthState {
  month: RoadmapMonth;
  status: MonthStatus;
  criteria: CriterionState[];
  metCount: number;
  totalCount: number;
}

export interface RoadmapTick {
  itemKey: string;
  completedAt: string;
}

export interface ReadinessAssessment {
  areaKey: string;
  level: ReadinessLevel;
}
