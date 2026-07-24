import { cumulativeCountsByType } from "@/src/modules/prep/prepScorecard";
import type { MockSubtype, PrepEntry } from "@/src/modules/prep/types";

// Roadmap checkpoint targets (engineering_first_roadmap_v2.md §6.5, §18),
// added 2026-07-13 once the actual file — not fragments — landed in the repo.
//
// Update (Wave 2 Phase 3, migration 0008): mock_interview entries can now
// carry a MockSubtype (coding / system_design / ml_system_design), so the
// per-subtype December targets below are trackable — see bySubtype and
// mockSubtypeProgress. §11.3's time-allocation percentages are still handled
// separately, in prepAllocation.ts, not here: allocation is a % of logged
// time across ALL entry types (including the new resume_deep_dive), which is
// a different shape of question than "how many of each thing have I done."

export interface CumulativeCheckpoint {
  label: string;
  // yyyy-MM-dd — counts include entries on or before this date.
  throughDate: string;
  algorithm: { min: number; max?: number };
  systemDesign: { min: number };
  mlSystemDesign: { min: number };
  // Combined across mock subtypes, kept for the pre-Phase-3 combined view.
  mockInterview: { min: number };
  // Per-subtype breakdown of the same checkpoint. Optional: only December's
  // checkpoint has a stated per-subtype split (§6.5's semester review); the
  // February checkpoint doesn't restate the mocks, so it has none.
  bySubtype?: Record<MockSubtype, number>;
}

// §6.5 December "semester review": target ranges/counts are as stated in the
// roadmap text, not derived.
export const DECEMBER_2026_CHECKPOINT: CumulativeCheckpoint = {
  label: "December 2026 semester review",
  throughDate: "2026-12-31",
  algorithm: { min: 75, max: 100 },
  systemDesign: { min: 6 },
  mlSystemDesign: { min: 2 },
  mockInterview: { min: 14 }, // 6 coding + 6 system-design + 2 ML-system-design
  bySubtype: { coding: 6, system_design: 6, ml_system_design: 2 },
};

// §6.5 February "Technical targets by end of February".
export const FEBRUARY_2027_CHECKPOINT: CumulativeCheckpoint = {
  label: "February 2027 targets",
  throughDate: "2027-02-28",
  algorithm: { min: 150 },
  systemDesign: { min: 10 },
  mlSystemDesign: { min: 5 },
  mockInterview: { min: 0 }, // not restated at this checkpoint; not a regression to track as 0
};

// §6.5 February: "8 behavioral stories with concise and extended versions."
// This counts BehavioralStories rows, not PrepEntries — a written story is a
// different thing from an entry_type: "behavioral" practice-session log.
export const FEBRUARY_2027_BEHAVIORAL_STORY_TARGET = 8;

export interface TargetProgress {
  actual: number;
  target: number;
  // 0-1+, uncapped: can exceed 1 once the target is exceeded, so the UI can
  // show "150/150 (100%)" and "180/150 (120%)" distinctly rather than both
  // reading as a maxed-out bar.
  progress: number;
}

function progressFor(actual: number, target: number): TargetProgress {
  return { actual, target, progress: target === 0 ? 1 : actual / target };
}

export interface CheckpointProgress {
  checkpoint: CumulativeCheckpoint;
  algorithm: TargetProgress;
  systemDesign: TargetProgress;
  mlSystemDesign: TargetProgress;
  mockInterview: TargetProgress;
}

// Cumulative actuals (from July onward — PrepEntries has no data before the
// roadmap started, so "all entries up to throughDate" is equivalent to
// "since the roadmap began") compared against one checkpoint's targets.
//
// `additionalAlgorithmCount` folds in reps logged outside prep_entries —
// today that's LeetCode Tracker attempts through the checkpoint's
// throughDate (Prep Tracker's component computes that via leetcodeBoard.ts's
// attemptCountThrough and passes it in). Plain number, not a LeetCode-typed
// parameter — see the identical note on prepScorecard.ts's scorecardFor.
export function progressTowardCheckpoint(
  entries: PrepEntry[],
  checkpoint: CumulativeCheckpoint,
  additionalAlgorithmCount = 0,
): CheckpointProgress {
  const counts = cumulativeCountsByType(entries, checkpoint.throughDate);
  const algorithmActual = counts.algorithm + additionalAlgorithmCount;

  return {
    checkpoint,
    algorithm: progressFor(algorithmActual, checkpoint.algorithm.min),
    systemDesign: progressFor(
      counts.system_design,
      checkpoint.systemDesign.min,
    ),
    mlSystemDesign: progressFor(
      counts.ml_system_design,
      checkpoint.mlSystemDesign.min,
    ),
    mockInterview: progressFor(
      counts.mock_interview,
      checkpoint.mockInterview.min,
    ),
  };
}

// Which checkpoint is "active" for a given date: the next one that hasn't
// passed yet, or the last one if both have. The Dashboard shows progress
// toward whichever checkpoint is currently relevant, not both at once.
export function activeCheckpoint(today: string): CumulativeCheckpoint {
  if (today <= DECEMBER_2026_CHECKPOINT.throughDate) {
    return DECEMBER_2026_CHECKPOINT;
  }
  return FEBRUARY_2027_CHECKPOINT;
}

export interface MockSubtypeProgress {
  checkpoint: CumulativeCheckpoint;
  bySubtype: Record<MockSubtype, TargetProgress>;
  // Mocks logged with no subtype (pre-Phase-3 rows, or logged without picking
  // one). They already count toward `mockInterview` in progressTowardCheckpoint
  // — surfaced here separately so the UI can show "n unclassified mocks"
  // instead of silently crediting them to a subtype they were never assigned
  // to.
  unclassified: number;
}

// Per-subtype counterpart to progressTowardCheckpoint's combined mockInterview
// number. Returns null when the checkpoint has no per-subtype targets (only
// December's does — see CumulativeCheckpoint.bySubtype).
export function mockSubtypeProgress(
  entries: PrepEntry[],
  checkpoint: CumulativeCheckpoint,
): MockSubtypeProgress | null {
  if (!checkpoint.bySubtype) return null;

  const mocks = entries.filter(
    (entry) =>
      !entry.deletedAt &&
      entry.entryType === "mock_interview" &&
      entry.date <= checkpoint.throughDate,
  );

  const countFor = (subtype: MockSubtype) =>
    mocks.filter((entry) => entry.mockSubtype === subtype).length;

  const bySubtype = Object.fromEntries(
    (Object.keys(checkpoint.bySubtype) as MockSubtype[]).map((subtype) => [
      subtype,
      progressFor(countFor(subtype), checkpoint.bySubtype![subtype]),
    ]),
  ) as Record<MockSubtype, TargetProgress>;

  const unclassified = mocks.filter(
    (entry) => entry.mockSubtype === null,
  ).length;

  return { checkpoint, bySubtype, unclassified };
}
