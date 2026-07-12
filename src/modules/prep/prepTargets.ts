import { cumulativeCountsByType } from "@/src/modules/prep/prepScorecard";
import type { PrepEntry } from "@/src/modules/prep/types";

// Roadmap checkpoint targets (engineering_first_roadmap_v2.md §6.5, §18),
// added 2026-07-13 once the actual file — not fragments — landed in the repo.
//
// Scope note: only the two checkpoints with UNAMBIGUOUS, directly-schema-
// mappable numbers are encoded here. Two things from the roadmap are
// deliberately NOT encoded, and this is a judgment call worth flagging rather
// than silently forcing a fit:
//   - §11.3's interview-prep time allocation (Algorithms 35% / System design
//     25% / Behavioral 15% / ML systems 15% / Resume-deep-dive 10%) doesn't
//     map cleanly onto PrepEntryType: "Resume/project deep-dive" isn't a
//     logged entry type at all, and "mock_interview" entries aren't in the
//     allocation table. Building this would mean inventing a mapping the
//     roadmap doesn't specify — flag to the Lead Architect if this is wanted.
//   - The roadmap's month-by-month "mock" targets (e.g. November: "two coding
//     mocks, two system-design mocks, one ML-system-design mock") assume a
//     mock-interview SUBTYPE (coding vs. system-design vs. ML-system-design)
//     that PrepEntries doesn't capture — `entry_type: "mock_interview"` is one
//     bucket with a free-text `topic`, not a structured subtype. The December
//     checkpoint below uses a single COMBINED mock-interview target for this
//     reason (6 + 6 + 2 from §6.5's semester review, summed) rather than
//     three separate untrackable numbers.

export interface CumulativeCheckpoint {
  label: string;
  // yyyy-MM-dd — counts include entries on or before this date.
  throughDate: string;
  algorithm: { min: number; max?: number };
  systemDesign: { min: number };
  mlSystemDesign: { min: number };
  // Combined across mock subtypes — see the scope note above.
  mockInterview: { min: number };
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
export function progressTowardCheckpoint(
  entries: PrepEntry[],
  checkpoint: CumulativeCheckpoint,
): CheckpointProgress {
  const counts = cumulativeCountsByType(entries, checkpoint.throughDate);

  return {
    checkpoint,
    algorithm: progressFor(counts.algorithm, checkpoint.algorithm.min),
    systemDesign: progressFor(counts.system_design, checkpoint.systemDesign.min),
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
