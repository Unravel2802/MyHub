import type { PrepEntry, PrepEntryType } from "@/src/modules/prep/types";

// §11.3's interview-prep time allocation: what share of practice TIME should
// go to each area. This is a different question from prepTargets.ts's REP
// COUNTS (e.g. "6 system-design mocks by December") — a rep count target and
// a time-allocation target can both be met or missed independently, so they
// stay separate modules rather than one merged "progress" concept.
//
// mock_interview is deliberately excluded from both the numerator and the
// denominator: §11.3's table has no mock-interview row (mocks are logged and
// tracked separately, via prepTargets.ts's mockInterview/bySubtype targets),
// so counting mock minutes here would understate every other area's actual
// share of "regular prep time."
export const TARGET_ALLOCATION: Record<
  Exclude<PrepEntryType, "mock_interview">,
  number
> = {
  algorithm: 0.35,
  system_design: 0.25,
  behavioral: 0.15,
  ml_system_design: 0.15,
  resume_deep_dive: 0.1,
};

export type AllocationArea = keyof typeof TARGET_ALLOCATION;

export interface AreaAllocation {
  area: AllocationArea;
  targetPct: number;
  minutes: number;
  // Share of ALLOCATION-ELIGIBLE minutes (mock_interview excluded from the
  // denominator too) spent on this area. Null when no eligible minutes have
  // been logged yet — 0% and "no data" must render differently.
  actualPct: number | null;
}

// Sums `durationMin` per §11.3 area across `entries`, optionally scoped to
// entries on or after `fromDate` (yyyy-MM-dd, inclusive). Entries with a null
// durationMin contribute 0 minutes but still exist — they're not excluded
// the way mock_interview entries are.
//
// `additionalAlgorithmMinutes` folds in LeetCode attempt time computed by the
// caller via leetcodeBoard.ts's totalAttemptTimeMin. It stays a plain number
// so this module remains PrepEntry-only and does not import LeetCode types.
export function timeAllocation(
  entries: PrepEntry[],
  fromDate?: string,
  additionalAlgorithmMinutes = 0,
): AreaAllocation[] {
  const scoped = entries.filter(
    (entry) =>
      !entry.deletedAt &&
      entry.entryType !== "mock_interview" &&
      (fromDate === undefined || entry.date >= fromDate),
  );

  const minutesByArea = new Map<AllocationArea, number>();
  let totalMinutes = 0;

  for (const entry of scoped) {
    const area = entry.entryType as AllocationArea;
    const minutes = entry.durationMin ?? 0;
    minutesByArea.set(area, (minutesByArea.get(area) ?? 0) + minutes);
    totalMinutes += minutes;
  }

  minutesByArea.set(
    "algorithm",
    (minutesByArea.get("algorithm") ?? 0) + additionalAlgorithmMinutes,
  );
  totalMinutes += additionalAlgorithmMinutes;

  return (Object.keys(TARGET_ALLOCATION) as AllocationArea[]).map((area) => {
    const minutes = minutesByArea.get(area) ?? 0;
    return {
      area,
      targetPct: TARGET_ALLOCATION[area],
      minutes,
      actualPct: totalMinutes === 0 ? null : minutes / totalMinutes,
    };
  });
}
