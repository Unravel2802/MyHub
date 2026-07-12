export type PrepEntryType =
  | "algorithm"
  | "system_design"
  | "ml_system_design"
  | "behavioral"
  | "mock_interview";

// Outcomes are scoped to the entry type they describe, and the DB enforces it
// (see migration 0003): algorithm entries are solved/partial/failed, everything
// else passes or needs work. Null means "logged but not yet judged".
export type AlgorithmOutcome = "solved" | "partial" | "failed";
export type SessionOutcome = "pass" | "needs_work";
export type PrepOutcome = AlgorithmOutcome | SessionOutcome;

export interface PrepEntry {
  id: string;
  entryType: PrepEntryType;
  topic: string | null;
  // yyyy-MM-dd. The day the rep happened, not the day it was logged.
  date: string;
  durationMin: number | null;
  // Algorithm entries only — the roadmap tracks average time-to-solve (§6.1).
  timeToSolveMin: number | null;
  outcome: PrepOutcome | null;
  // The post-mortem / reflection.
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BehavioralStory {
  id: string;
  title: string;
  theme: string | null;
  conciseVersion: string | null;
  extendedVersion: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
