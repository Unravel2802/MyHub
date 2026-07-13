import { addDays, differenceInHours, format, startOfWeek } from "date-fns";
import type { Task } from "@/src/modules/task/types";
import type {
  Application,
  Interview,
} from "@/src/modules/jobApplications/types";
import type { BehavioralStory, PrepEntry } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";
import type { AchievementKey } from "@/src/modules/momentum/achievementCatalog";
import { activityDates, computeStreak } from "@/src/modules/momentum/streaks";

// The rules engine (myhub_plan.md Part B, Phase 5). Pure: takes everything the
// app knows, returns the set of achievement keys currently EARNED. It has no
// concept of what was earned before — that diff is `newUnlocks`, below.
//
// Architecture note: this reads other modules' TYPES, which is allowed, but it
// must not import their selectors — rule 1. Where a predicate already exists
// elsewhere (the gate-checklist title convention in dashboardSelectors.ts), it
// is deliberately DUPLICATED here rather than imported. That's the rule's cost,
// paid knowingly: a four-line predicate copied is cheaper than a cross-module
// dependency, but if the gate naming convention ever changes, both copies must
// change. Flagged in the plan; noted here where someone would actually hit it.

export interface AchievementSnapshot {
  tasks: Task[];
  prepEntries: PrepEntry[];
  behavioralStories: BehavioralStory[];
  applications: Application[];
  interviews: Interview[];
  outreachEntries: OutreachEntry[];
  today: Date;
}

const live = <T extends { deletedAt: string | null }>(rows: T[]): T[] =>
  rows.filter((row) => !row.deletedAt);

export function evaluateAchievements(
  snapshot: AchievementSnapshot,
): AchievementKey[] {
  const tasks = live(snapshot.tasks);
  const prepEntries = live(snapshot.prepEntries);
  const stories = live(snapshot.behavioralStories);
  const applications = live(snapshot.applications);
  const interviews = live(snapshot.interviews);
  const outreachEntries = live(snapshot.outreachEntries);

  const countOfType = (type: PrepEntry["entryType"]) =>
    prepEntries.filter((entry) => entry.entryType === type).length;

  const algorithms = countOfType("algorithm");
  const systemDesign = countOfType("system_design");
  const mlSystemDesign = countOfType("ml_system_design");
  // Every mock counts, including legacy rows with no subtype — the December
  // target is 14 mocks total, and a mock you logged before subtypes existed was
  // still a mock you did.
  const mocks = countOfType("mock_interview");

  // A "story" only counts once it's actually usable in an interview, which
  // §6.5 defines as having BOTH a concise and an extended version. A titled
  // stub isn't a story yet.
  const completeStories = stories.filter(
    (story) =>
      (story.conciseVersion?.trim().length ?? 0) > 0 &&
      (story.extendedVersion?.trim().length ?? 0) > 0,
  ).length;

  const streak = computeStreak(
    activityDates({
      tasks,
      prepEntries,
      applications,
      outreachEntries,
    }),
    snapshot.today,
  );

  const earned: AchievementKey[] = [];
  const award = (key: AchievementKey, condition: boolean) => {
    if (condition) earned.push(key);
  };

  award("first_prep_entry", prepEntries.length >= 1);
  award("algorithms_10", algorithms >= 10);
  award("algorithms_50", algorithms >= 50);
  award("algorithms_75", algorithms >= 75);
  award("algorithms_100", algorithms >= 100);
  award("algorithms_150", algorithms >= 150);

  award("system_design_6", systemDesign >= 6);
  award("system_design_10", systemDesign >= 10);
  award("ml_system_design_5", mlSystemDesign >= 5);
  award("first_mock", mocks >= 1);
  award("mocks_14", mocks >= 14);
  award("behavioral_stories_8", completeStories >= 8);

  award("first_application", applications.length >= 1);
  award("applications_10", applications.length >= 10);
  award("applications_50", applications.length >= 50);
  award("first_outreach", outreachEntries.length >= 1);
  award("first_interview", interviews.length >= 1);
  award("post_mortem_24h", hasFreshPostMortem(interviews));

  award(
    "perfect_cadence_week",
    hasPerfectWeek(applications, outreachEntries, prepEntries, snapshot.today),
  );
  award("gate_complete", hasCompletedGate(tasks));
  award("streak_7", streak.longest >= 7);
  award("streak_30", streak.longest >= 30);
  award("streak_100", streak.longest >= 100);

  return earned;
}

// Which of the earned achievements aren't already persisted. The store diffs
// against what the DB says is unlocked, so an achievement never re-fires a
// toast on reload.
export function newUnlocks(
  earned: AchievementKey[],
  persisted: ReadonlySet<string>,
): AchievementKey[] {
  return earned.filter((key) => !persisted.has(key));
}

// Post-mortem written within 24h of the interview itself — measured from
// `scheduledAt` (when the interview happened), not from when the `completed`
// box got ticked. The roadmap's clock starts at the interview.
function hasFreshPostMortem(interviews: Interview[]): boolean {
  return interviews.some((interview) => {
    if (interview.postMortemLoggedAt === null) return false;
    const hours = differenceInHours(
      new Date(interview.postMortemLoggedAt),
      new Date(interview.scheduledAt),
    );
    // Guard the negative case: a post-mortem timestamped BEFORE the interview
    // is data corruption, not a heroically early reflection.
    return hours >= 0 && hours <= 24;
  });
}

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

// A "perfect week" is any COMPLETED Monday-Sunday week that hit all three
// §11.2 cadence targets. Completed, not current: the current week is still
// accumulating, so awarding it mid-week would be awarding an incomplete result,
// and — worse — a week that qualifies on Wednesday could stop qualifying by
// Sunday if nothing about it changed except the passage of time. Past weeks are
// immutable, so the achievement is stable once earned.
function hasPerfectWeek(
  applications: Application[],
  outreachEntries: OutreachEntry[],
  prepEntries: PrepEntry[],
  today: Date,
): boolean {
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

  const weeks = new Map<
    string,
    { applications: number; outreach: number; mocks: number }
  >();

  const bump = (
    day: string,
    field: "applications" | "outreach" | "mocks",
  ): void => {
    const weekStart = startOfWeek(new Date(`${day}T00:00:00`), {
      weekStartsOn: 1,
    });
    // Skip the in-progress week entirely.
    if (weekStart >= currentWeekStart) return;
    const key = dayKey(weekStart);
    const bucket = weeks.get(key) ?? {
      applications: 0,
      outreach: 0,
      mocks: 0,
    };
    bucket[field] += 1;
    weeks.set(key, bucket);
  };

  // Applications are counted by createdAt (when you logged it), matching
  // dashboardSelectors.weeklyCadence — appliedDate is nullable and
  // lastUpdateDate moves on unrelated edits.
  for (const application of applications) {
    bump(dayKey(new Date(application.createdAt)), "applications");
  }
  for (const entry of outreachEntries) {
    bump(entry.date, "outreach");
  }
  for (const entry of prepEntries) {
    if (entry.entryType !== "mock_interview") continue;
    bump(entry.date, "mocks");
  }

  for (const week of weeks.values()) {
    if (week.applications >= 5 && week.outreach >= 2 && week.mocks >= 1) {
      return true;
    }
  }
  return false;
}

// The gate-checklist convention, duplicated from dashboardSelectors.ts on
// purpose (see the architecture note at the top of this file): a top-level task
// titled "Gate: <Month> <Year>". A gate counts as cleared only if it HAS
// subtasks and all of them are done — an empty gate task marked done is not an
// achievement, it's an empty checklist.
function hasCompletedGate(tasks: Task[]): boolean {
  const gateTasks = tasks.filter(
    (task) =>
      task.parentTaskId === null && /^gate:\s/i.test(task.title.trim()),
  );

  return gateTasks.some((gate) => {
    const subtasks = tasks.filter((task) => task.parentTaskId === gate.id);
    return (
      subtasks.length > 0 && subtasks.every((task) => task.status === "done")
    );
  });
}

// Re-exported so the store doesn't need a second import just to build a
// snapshot's `today`.
export const weekStartOf = (date: Date) =>
  startOfWeek(date, { weekStartsOn: 1 });
export const weekEndOf = (date: Date) => addDays(weekStartOf(date), 6);
