import type { PrepEntry, PrepEntryType } from "@/src/modules/prep/types";

// Pure scorecard aggregation. No DB access: the repository loads entries, this
// turns them into the numbers the roadmap tracks (§6.1 diagnostics, §15 monthly
// scorecards) and the Dashboard renders.
//
// Targets themselves are NOT here — they live in engineering_first_roadmap_v2.md,
// which isn't in the repo yet. This computes the "actual" side; comparing it to a
// target is the Dashboard's job once those numbers exist.

export type CountsByType = Record<PrepEntryType, number>;

export interface Scorecard {
  countsByType: CountsByType;
  // Algorithm entries only.
  solved: number;
  attempted: number;
  // Share of judged algorithm attempts that were solved outright, 0-1. Null when
  // nothing has been judged yet — a solve rate of 0% and "no data" are different
  // things and the Dashboard must not render them the same way.
  solveRate: number | null;
  averageTimeToSolveMin: number | null;
}

const EMPTY_COUNTS: CountsByType = {
  algorithm: 0,
  system_design: 0,
  ml_system_design: 0,
  behavioral: 0,
  mock_interview: 0,
};

// yyyy-MM of a yyyy-MM-dd date string. String-sliced rather than parsed: these
// are calendar dates with no timezone, and constructing a Date would drag the
// local offset in and can shift the month at the boundary.
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function entriesInMonth(
  entries: PrepEntry[],
  month: string,
): PrepEntry[] {
  return entries.filter(
    (entry) => !entry.deletedAt && monthOf(entry.date) === month,
  );
}

export function scorecardFor(entries: PrepEntry[], month: string): Scorecard {
  const scoped = entriesInMonth(entries, month);
  const countsByType = { ...EMPTY_COUNTS };

  for (const entry of scoped) {
    countsByType[entry.entryType] += 1;
  }

  const algorithms = scoped.filter((entry) => entry.entryType === "algorithm");
  const judged = algorithms.filter((entry) => entry.outcome !== null);
  const solved = algorithms.filter((entry) => entry.outcome === "solved");

  const timed = algorithms
    .map((entry) => entry.timeToSolveMin)
    .filter((minutes): minutes is number => minutes !== null);

  return {
    countsByType,
    solved: solved.length,
    attempted: algorithms.length,
    solveRate: judged.length === 0 ? null : solved.length / judged.length,
    averageTimeToSolveMin:
      timed.length === 0
        ? null
        : timed.reduce((total, minutes) => total + minutes, 0) / timed.length,
  };
}

// Counts across ALL entries up to and including `throughDate` (yyyy-MM-dd),
// not scoped to a single month. Roadmap checkpoints (§6.5's December and
// February gates) are cumulative-since-July targets, not monthly ones — this
// is scorecardFor's monthly scoping's counterpart for that use, not a
// duplicate of it.
export function cumulativeCountsByType(
  entries: PrepEntry[],
  throughDate: string,
): CountsByType {
  const counts = { ...EMPTY_COUNTS };
  for (const entry of entries) {
    if (entry.deletedAt) continue;
    if (entry.date > throughDate) continue;
    counts[entry.entryType] += 1;
  }
  return counts;
}

export interface TopicStat {
  topic: string;
  attempted: number;
  solved: number;
  solveRate: number;
}

// Weakest topics by solve rate (roadmap §6.1). Only topics with a judged attempt
// are ranked — an untouched topic isn't weak, it's unmeasured. Ties break on
// volume, so a topic failed five times outranks one failed once.
export function weakestTopics(
  entries: PrepEntry[],
  limit = 3,
  month?: string,
): TopicStat[] {
  const scoped = (
    month ? entriesInMonth(entries, month) : entries.filter((e) => !e.deletedAt)
  ).filter(
    (entry) =>
      entry.entryType === "algorithm" &&
      entry.topic !== null &&
      entry.outcome !== null,
  );

  const byTopic = new Map<string, { attempted: number; solved: number }>();

  for (const entry of scoped) {
    const topic = entry.topic!;
    const stat = byTopic.get(topic) ?? { attempted: 0, solved: 0 };
    stat.attempted += 1;
    if (entry.outcome === "solved") stat.solved += 1;
    byTopic.set(topic, stat);
  }

  return [...byTopic.entries()]
    .map(([topic, stat]) => ({
      topic,
      attempted: stat.attempted,
      solved: stat.solved,
      solveRate: stat.solved / stat.attempted,
    }))
    .sort((a, b) => a.solveRate - b.solveRate || b.attempted - a.attempted)
    .slice(0, limit);
}
