import { addDays, format, subDays } from "date-fns";
import type { Task } from "@/src/modules/task/types";
import type { Application } from "@/src/modules/jobApplications/types";
import type { PrepEntry } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";

// Streak date math (myhub_plan.md Part B, Phase 5). Pure — the store fetches
// each module's data through that module's own Repository and hands it here.

export interface ActivitySnapshot {
  tasks: Task[];
  prepEntries: PrepEntry[];
  applications: Application[];
  outreachEntries: OutreachEntry[];
}

export interface Streak {
  current: number;
  longest: number;
  activeToday: boolean;
}

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

// A timestamp from a row that may be missing the column entirely (undefined),
// null, or malformed. format() throws RangeError on an Invalid Date, and this
// runs inside the momentum refresh that every page mounts — one bad row would
// take out the streak for the whole app. Return null and skip the row instead.
function safeDayKey(timestamp: string | null | undefined): string | null {
  if (timestamp == null) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : dayKey(date);
}

// A day counts as active if you did ANY of the four things that move the
// roadmap forward: logged a prep rep, completed a task, logged an application,
// or had an outreach conversation.
//
// Timezone discipline, and the reason this isn't a one-liner: `date` columns
// (prep, outreach) are already local wall-clock calendar dates and are used
// as-is. `completedAt` / `createdAt` are timestamptz INSTANTS, so they must be
// converted to a local calendar day via format() — NOT `.slice(0, 10)`, which
// reads the UTC date out of an ISO string and lands on the wrong day for
// anyone not at UTC+0. Finishing a task at 9pm in UTC+7 would otherwise credit
// tomorrow, silently breaking the streak you actually earned. This matches
// weekBounds() in dashboardSelectors.ts, which made the same call.
export function activityDates(snapshot: ActivitySnapshot): Set<string> {
  const days = new Set<string>();

  for (const entry of snapshot.prepEntries) {
    if (entry.deletedAt) continue;
    days.add(entry.date);
  }

  for (const entry of snapshot.outreachEntries) {
    if (entry.deletedAt) continue;
    days.add(entry.date);
  }

  for (const task of snapshot.tasks) {
    if (task.deletedAt) continue;
    const day = safeDayKey(task.completedAt);
    if (day !== null) days.add(day);
  }

  for (const application of snapshot.applications) {
    if (application.deletedAt) continue;
    const day = safeDayKey(application.createdAt);
    if (day !== null) days.add(day);
  }

  return days;
}

// The per-day COUNT variant, for the activity heatmap. activityDates answers
// "was this day active?"; this answers "how active?" — the four sources summed
// per local wall-clock day. Same timezone discipline (safeDayKey, never
// .slice), same soft-delete filtering, deliberately kept as a sibling rather
// than folded in so activityDates stays a cheap Set for the streak math.
export function activityCounts(
  snapshot: ActivitySnapshot,
): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (day: string | null) => {
    if (day === null) return;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  };

  for (const entry of snapshot.prepEntries) {
    if (!entry.deletedAt) bump(entry.date);
  }
  for (const entry of snapshot.outreachEntries) {
    if (!entry.deletedAt) bump(entry.date);
  }
  for (const task of snapshot.tasks) {
    if (!task.deletedAt) bump(safeDayKey(task.completedAt));
  }
  for (const application of snapshot.applications) {
    if (!application.deletedAt) bump(safeDayKey(application.createdAt));
  }

  return counts;
}

// `current` counts the run of consecutive active days ending TODAY or
// YESTERDAY. The yesterday grace is deliberate: at 9am, having not yet done
// today's work, your streak should still read as alive — it hasn't been broken,
// you just haven't fed it yet. Ending the run strictly at today would flash a
// demoralizing 0 every morning, which is the exact opposite of what a streak is
// for. `activeToday` is what the UI uses to distinguish "lit" from "at risk".
//
// `longest` is the longest run anywhere in the history, which can exceed
// `current`.
export function computeStreak(activeDays: Set<string>, today: Date): Streak {
  const todayKey = dayKey(today);
  const activeToday = activeDays.has(todayKey);

  const anchor = activeToday
    ? today
    : activeDays.has(dayKey(subDays(today, 1)))
      ? subDays(today, 1)
      : null;

  let current = 0;
  if (anchor !== null) {
    let cursor = anchor;
    while (activeDays.has(dayKey(cursor))) {
      current += 1;
      cursor = subDays(cursor, 1);
    }
  }

  return { current, longest: longestRun(activeDays), activeToday };
}

// Walks each run from its start only — a day whose predecessor is also active
// isn't the start of anything, so it's skipped rather than re-walked. Keeps
// this linear in the number of active days rather than quadratic.
function longestRun(activeDays: Set<string>): number {
  let longest = 0;

  for (const day of activeDays) {
    const previous = dayKey(subDays(new Date(`${day}T00:00:00`), 1));
    if (activeDays.has(previous)) continue;

    let length = 0;
    let cursor = new Date(`${day}T00:00:00`);
    while (activeDays.has(dayKey(cursor))) {
      length += 1;
      cursor = addDays(cursor, 1);
    }
    longest = Math.max(longest, length);
  }

  return longest;
}
