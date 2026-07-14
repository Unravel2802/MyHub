import { differenceInCalendarDays, format } from "date-fns";
import type { Application } from "@/src/modules/jobApplications/types";
import type { BehavioralStory, PrepEntry } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";
import type { Company } from "@/src/modules/jobApplications/types";
import {
  GRADUATION_DATE,
  READINESS_AREAS,
  ROADMAP_MONTHS,
} from "@/src/modules/roadmap/roadmapCatalog";
import type {
  Criterion,
  CriterionState,
  Measure,
  MonthKey,
  MonthState,
  MonthStatus,
  ReadinessLevel,
  RoadmapMonth,
} from "@/src/modules/roadmap/types";

// Pure roadmap evaluation. No DB access — the store fetches each module's data
// through that module's own repository and hands it here.

export interface RoadmapSnapshot {
  prepEntries: PrepEntry[];
  behavioralStories: BehavioralStory[];
  applications: Application[];
  companies: Company[];
  outreachEntries: OutreachEntry[];
}

// yyyy-MM of a Date. format(), NOT `.toISOString().slice(0, 7)` — the latter
// reads the UTC month, which is the wrong month for anyone east or west of UTC
// for a few hours around every month boundary. This bug class has already been
// found three times in this codebase (streaks, task archive, board stats);
// it does not get a fourth.
export const monthKeyOf = (date: Date): MonthKey => format(date, "yyyy-MM");

// yyyy-MM of a yyyy-MM-dd string. String-sliced rather than parsed: these are
// calendar dates with no timezone, and constructing a Date would drag the local
// offset in and can shift the month at the boundary. Same reasoning as
// prepScorecard.monthOf.
const monthOfDate = (date: string): MonthKey => date.slice(0, 7);

const live = <T extends { deletedAt: string | null }>(rows: T[]): T[] =>
  rows.filter((row) => !row.deletedAt);

// A story only counts once it's usable in an interview — §6.5's bar is "8
// behavioral stories with concise and extended versions". A titled stub isn't a
// story yet.
const isCompleteStory = (story: BehavioralStory) =>
  (story.conciseVersion?.trim().length ?? 0) > 0 &&
  (story.extendedVersion?.trim().length ?? 0) > 0;

// Count a measure against the snapshot, scoped to `month`.
//
// `scope` is the thing to get right. The roadmap mixes monthly volumes ("15
// algorithm problems" in September) with cumulative totals ("150+ total" by
// February). Measure a cumulative target monthly and February is unreachable;
// measure a monthly target cumulatively and September marks itself done in
// December. Different questions, different answers.
export function measureCriterion(
  measure: Measure,
  snapshot: RoadmapSnapshot,
  month: MonthKey,
): number {
  const inScope = (rowMonth: MonthKey) =>
    measure.scope === "month" ? rowMonth === month : rowMonth <= month;

  switch (measure.source) {
    case "prep":
      return live(snapshot.prepEntries).filter(
        (entry) =>
          entry.entryType === measure.entryType && inScope(monthOfDate(entry.date)),
      ).length;

    case "applications":
      // By createdAt (when you logged it), matching weeklyCadence — appliedDate
      // is nullable and lastUpdateDate moves on unrelated edits.
      return live(snapshot.applications).filter((application) =>
        inScope(monthKeyOf(new Date(application.createdAt))),
      ).length;

    case "outreach":
      return live(snapshot.outreachEntries).filter((entry) =>
        inScope(monthOfDate(entry.date)),
      ).length;

    case "companies":
      return live(snapshot.companies).filter((company) =>
        inScope(monthKeyOf(new Date(company.createdAt))),
      ).length;

    case "behavioralStories":
      return live(snapshot.behavioralStories).filter(
        (story) =>
          isCompleteStory(story) &&
          inScope(monthKeyOf(new Date(story.createdAt))),
      ).length;
  }
}

export function evaluateCriterion(
  criterion: Criterion,
  snapshot: RoadmapSnapshot,
  month: MonthKey,
  ticked: ReadonlySet<string>,
): CriterionState {
  if (criterion.kind === "manual") {
    // A manual criterion is met iff you ticked it. Nothing infers "I wrote a
    // design doc", and pretending otherwise would produce a roadmap that lies.
    return { criterion, met: ticked.has(criterion.key), progress: null };
  }

  const actual = measureCriterion(criterion.measure, snapshot, month);
  return {
    criterion,
    met: actual >= criterion.target,
    progress: { actual, target: criterion.target },
  };
}

export function evaluateMonth(
  month: RoadmapMonth,
  snapshot: RoadmapSnapshot,
  ticked: ReadonlySet<string>,
  today: Date,
): MonthState {
  const criteria = month.criteria.map((criterion) =>
    evaluateCriterion(criterion, snapshot, month.key, ticked),
  );
  const metCount = criteria.filter((state) => state.met).length;
  const totalCount = criteria.length;
  const currentMonth = monthKeyOf(today);

  const status: MonthStatus =
    totalCount > 0 && metCount === totalCount
      ? "done"
      : month.key > currentMonth
        ? "upcoming"
        : month.key < currentMonth
          ? // A PAST month with unmet criteria is MISSED, and it stays that way.
            //
            // The tempting alternative is to roll it forward or quietly show it
            // as "in progress" — which is how you drift for a semester without
            // noticing. §16 ("What to Avoid") is a list of exactly that failure.
            // The red ring is the feature, not an oversight.
            "missed"
          : "in_progress";

  return { month, status, criteria, metCount, totalCount };
}

export function evaluateRoadmap(
  snapshot: RoadmapSnapshot,
  ticked: ReadonlySet<string>,
  today: Date,
): MonthState[] {
  return ROADMAP_MONTHS.map((month) =>
    evaluateMonth(month, snapshot, ticked, today),
  );
}

// Which node is "you are here". Null before the roadmap starts or after it ends
// — the timeline shouldn't invent a position outside its own span.
export function currentMonthKey(today: Date): MonthKey | null {
  const key = monthKeyOf(today);
  return ROADMAP_MONTHS.some((month) => month.key === key) ? key : null;
}

// 0-1, uncapped at 0 — how far along the whole plan you are, by criteria met.
// Drives the fill on the timeline's track.
export function overallProgress(states: MonthState[]): number {
  const total = states.reduce((sum, state) => sum + state.totalCount, 0);
  if (total === 0) return 0;
  const met = states.reduce((sum, state) => sum + state.metCount, 0);
  return met / total;
}

export function daysUntilGraduation(today: Date): number {
  return Math.max(
    0,
    differenceInCalendarDays(new Date(`${GRADUATION_DATE}T00:00:00`), today),
  );
}

// --- readiness ---------------------------------------------------------------

const LEVEL_VALUE: Record<ReadinessLevel, number> = {
  not_started: 0,
  minimum: 1,
  strong: 2,
};

export const levelValue = (level: ReadinessLevel): number => LEVEL_VALUE[level];

export interface ReadinessEvidenceResult {
  // The level the DATA supports, which may be lower than what you claimed.
  supported: ReadinessLevel;
  // Human-readable, e.g. "38 min average — Strong wants 20-30".
  detail: string;
}

// The measured counterpart to a self-assessed level. This is the point of the
// radar chart's third layer: claim Strong on Algorithms while averaging 38
// minutes against a 20-30 target and the dashed polygon visibly pulls in from
// your claim. Self-image versus data.
//
// Returns null where the bar is a judgment ("lead 45-min designs with capacity
// and failure analysis") and no number can honestly stand in for it — most of
// the matrix. Inventing a proxy there would be worse than admitting we can't
// measure it.
export function readinessEvidence(
  areaKey: string,
  snapshot: RoadmapSnapshot,
): ReadinessEvidenceResult | null {
  const area = READINESS_AREAS.find((candidate) => candidate.key === areaKey);
  if (!area?.evidence) return null;

  if (area.evidence.kind === "avgSolveTime") {
    const timed = live(snapshot.prepEntries)
      .filter((entry) => entry.entryType === "algorithm")
      .map((entry) => entry.timeToSolveMin)
      .filter((minutes): minutes is number => minutes !== null);

    if (timed.length === 0) {
      return { supported: "not_started", detail: "No timed attempts yet" };
    }

    const average =
      timed.reduce((sum, minutes) => sum + minutes, 0) / timed.length;
    const max = area.evidence.strongMaxMinutes;
    const rounded = Math.round(average);

    if (average <= max) {
      return {
        supported: "strong",
        detail: `${rounded} min average — clears the ${max} min bar`,
      };
    }
    // §6.1's Minimum bar for algorithms is "mediums in 30-35 min".
    if (average <= 35) {
      return {
        supported: "minimum",
        detail: `${rounded} min average — Strong wants ${max} min or under`,
      };
    }
    return {
      supported: "not_started",
      detail: `${rounded} min average — Minimum wants 35 min or under`,
    };
  }

  // funnelActive
  const sent = live(snapshot.applications).filter(
    (application) => application.stage !== "researching",
  ).length;
  const min = area.evidence.minApplications;

  if (sent === 0) {
    return { supported: "not_started", detail: "No applications sent yet" };
  }
  if (sent >= min) {
    return {
      supported: "strong",
      detail: `${sent} applications sent — funnel is active`,
    };
  }
  return {
    supported: "minimum",
    detail: `${sent} applications sent — an active funnel wants ${min}+`,
  };
}
