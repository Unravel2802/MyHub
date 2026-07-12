import { addDays, differenceInHours, format, startOfWeek } from "date-fns";
import type { Task } from "@/src/modules/task/types";
import type {
  Application,
  Interview,
} from "@/src/modules/jobApplications/types";
import type { PrepEntry } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";

// Pure aggregation for the Daily Dashboard (myhub_plan.md §2.3). No DB access —
// callers (the store) fetch each module's data via that module's own
// Repository, and this turns it into what the four panels render. No new table,
// no new repository, per the plan: this module owns aggregation logic only.

// Monday-Sunday boundary as yyyy-MM-dd strings, for comparing against plain
// date columns (occurrenceDate, date). format(), not toISOString():
// toISOString() converts through UTC, which shifts the boundary by a day in
// any zone not exactly UTC+0 — format() reads the local wall-clock date
// instead, matching how taskRecurrence.ts computes the same boundary.
function weekBounds(today: Date): { mondayStr: string; sundayStr: string } {
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const sunday = addDays(monday, 6);
  return {
    mondayStr: format(monday, "yyyy-MM-dd"),
    sundayStr: format(sunday, "yyyy-MM-dd"),
  };
}

// --- Panel 1: this week's recurring schedule blocks --------------------------

// Recurring instances (recurrenceTemplateId set) whose occurrenceDate falls in
// the Monday-start week containing `today`, ordered by date. Deliberately
// narrower than "everything due this week" — the plan names this panel
// "recurring schedule blocks" specifically, not the whole board.
export function thisWeeksScheduleBlocks(tasks: Task[], today: Date): Task[] {
  const { mondayStr, sundayStr } = weekBounds(today);

  return tasks
    .filter(
      (task) =>
        !task.deletedAt &&
        task.recurrenceTemplateId !== null &&
        task.occurrenceDate !== null &&
        task.occurrenceDate >= mondayStr &&
        task.occurrenceDate <= sundayStr,
    )
    .sort((a, b) =>
      (a.occurrenceDate ?? "").localeCompare(b.occurrenceDate ?? ""),
    );
}

// --- Panel 2: applications needing follow-up ---------------------------------

// A stage the application can no longer act on. A rejected/withdrawn/offered
// application isn't "needing follow-up" just because nobody touched it in a
// week — there's no next action left to take. Excluding these is the one
// deliberate extension beyond the plan's literal wording: without it, the
// panel fills with false positives the moment a pipeline has any history,
// which would make the panel something a user learns to ignore.
const TERMINAL_STAGES = new Set(["offer", "rejected", "withdrawn"]);

export function applicationsNeedingFollowUp(
  applications: Application[],
  today: string,
): Application[] {
  return applications.filter((application) => {
    if (application.deletedAt) return false;
    if (TERMINAL_STAGES.has(application.stage)) return false;

    const followUpDue =
      application.followUpDate !== null && application.followUpDate <= today;
    const stale = daysBetween(application.lastUpdateDate, today) > 7;

    return followUpDue || stale;
  });
}

function daysBetween(from: string, to: string): number {
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

// --- Panel 3: prep scorecard vs. checkpoint targets ---------------------------
//
// Deliberately not reimplemented here: use prepScorecard.ts's scorecardFor /
// weakestTopics and prepTargets.ts's activeCheckpoint / progressTowardCheckpoint
// directly. This module only aggregates ACROSS modules; the within-module
// scorecard and target math already exist and are already tested there.

// --- Panel 4: interview post-mortem reminders ---------------------------------
//
// Not one of the plan's four named panels by that name, but promised in the Job
// Application CRM handoff ("the Dashboard is the eventual home for the
// reminder itself") for the roadmap's 24-hour post-mortem habit (§11.2).
//
// Anchored on `scheduledAt` (when the interview happened), not on when someone
// got around to checking the `completed` box — the roadmap's clock starts at
// the interview, not at the checkbox click.
export interface PostMortemReminder {
  interview: Interview;
  hoursSinceScheduled: number;
  isOverdue: boolean;
}

export function interviewsNeedingPostMortem(
  interviews: Interview[],
  now: Date,
): PostMortemReminder[] {
  return interviews
    .filter(
      (interview) =>
        !interview.deletedAt &&
        interview.completed &&
        !interview.postMortemNotes,
    )
    .map((interview) => {
      const hoursSinceScheduled = differenceInHours(
        now,
        new Date(interview.scheduledAt),
      );
      return {
        interview,
        hoursSinceScheduled,
        isOverdue: hoursSinceScheduled > 24,
      };
    })
    .sort((a, b) => b.hoursSinceScheduled - a.hoursSinceScheduled);
}

// --- Panel 5: current month's gate checklist ----------------------------------
//
// "Modeled as a parent Task with subtasks" (§2.3) — no schema change, no FK
// linking a task to "the current gate". That means SOMETHING has to identify
// which top-level task IS this month's gate, and the plan doesn't say what.
//
// Convention chosen here (flag this to the Lead Architect before building UI on
// top of it — it's a naming convention, not a schema fact, and easy to change
// before anyone's created gate tasks by hand, much harder after):
// a top-level, non-deleted task titled exactly "Gate: <Month> <Year>",
// e.g. "Gate: July 2026", generated the same way `format(date, "MMMM yyyy")`
// would produce it. Case-insensitive match on the "Gate:" prefix.
export function gateChecklistTitleFor(date: Date): string {
  const month = date.toLocaleString("en-US", { month: "long" });
  return `Gate: ${month} ${date.getFullYear()}`;
}

export function findGateChecklistTask(tasks: Task[], date: Date): Task | null {
  const title = gateChecklistTitleFor(date).toLowerCase();
  return (
    tasks.find(
      (task) =>
        !task.deletedAt &&
        task.parentTaskId === null &&
        task.title.toLowerCase() === title,
    ) ?? null
  );
}

export interface GateChecklistProgress {
  task: Task;
  subtasks: Task[];
  completed: number;
  total: number;
}

export function gateChecklistProgress(
  tasks: Task[],
  gateTask: Task,
): GateChecklistProgress {
  const subtasks = tasks.filter(
    (task) => !task.deletedAt && task.parentTaskId === gateTask.id,
  );
  return {
    task: gateTask,
    subtasks,
    completed: subtasks.filter((task) => task.status === "done").length,
    total: subtasks.length,
  };
}

// --- Panel 6: weekly cadence (new, 2026-07-13) --------------------------------
//
// engineering_first_roadmap_v2.md §11.2 sets three targets by the WEEK, not the
// month: 5-10 applications/week, 2-3 outreach conversations/week, and 1 mock
// interview/week (ramping to full loops by January). Distinct from Panel 3's
// monthly/cumulative scorecard — a week that's behind on its weekly cadence can
// still be on pace for the month, and conflating the two numbers would hide
// that. Ranges are represented as {min, max?} the same way prepTargets.ts does.

export interface WeeklyCadenceTarget {
  min: number;
  max?: number;
}

export const WEEKLY_APPLICATION_TARGET: WeeklyCadenceTarget = { min: 5, max: 10 };
export const WEEKLY_OUTREACH_TARGET: WeeklyCadenceTarget = { min: 2, max: 3 };
export const WEEKLY_MOCK_INTERVIEW_TARGET: WeeklyCadenceTarget = { min: 1 };

export interface WeeklyCadence {
  applications: { count: number; target: WeeklyCadenceTarget };
  outreach: { count: number; target: WeeklyCadenceTarget };
  mockInterviews: { count: number; target: WeeklyCadenceTarget };
}

// Applications counted by `createdAt` (when the row was logged), not
// `lastUpdateDate` (which bumps on any edit, including one unrelated to a new
// application going out) or `appliedDate` (nullable — not every application
// has been formally submitted yet). createdAt is never null and tracks real
// usage closely enough for a single-user tool: you log an application around
// when you send it.
export function weeklyCadence(
  applications: Application[],
  outreachEntries: OutreachEntry[],
  prepEntries: PrepEntry[],
  today: Date,
): WeeklyCadence {
  const { mondayStr, sundayStr } = weekBounds(today);
  const inWeek = (dateStr: string) =>
    dateStr >= mondayStr && dateStr <= sundayStr;

  const applicationsThisWeek = applications.filter(
    (application) =>
      !application.deletedAt && inWeek(application.createdAt.slice(0, 10)),
  ).length;

  const outreachThisWeek = outreachEntries.filter(
    (entry) => !entry.deletedAt && inWeek(entry.date),
  ).length;

  const mockInterviewsThisWeek = prepEntries.filter(
    (entry) =>
      !entry.deletedAt &&
      entry.entryType === "mock_interview" &&
      inWeek(entry.date),
  ).length;

  return {
    applications: {
      count: applicationsThisWeek,
      target: WEEKLY_APPLICATION_TARGET,
    },
    outreach: { count: outreachThisWeek, target: WEEKLY_OUTREACH_TARGET },
    mockInterviews: {
      count: mockInterviewsThisWeek,
      target: WEEKLY_MOCK_INTERVIEW_TARGET,
    },
  };
}
