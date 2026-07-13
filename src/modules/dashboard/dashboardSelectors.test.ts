import { describe, expect, it } from "vitest";
import {
  applicationsNeedingFollowUp,
  findGateChecklistTask,
  gateChecklistProgress,
  gateChecklistTitleFor,
  interviewsNeedingPostMortem,
  thisWeeksScheduleBlocks,
  weeklyCadence,
} from "@/src/modules/dashboard/dashboardSelectors";
import type { Task } from "@/src/modules/task/types";
import type {
  Application,
  Interview,
} from "@/src/modules/jobApplications/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";
import type { PrepEntry } from "@/src/modules/prep/types";

// 2026-07-08 is a Wednesday in the Mon 2026-07-06 .. Sun 2026-07-12 week.
const WEDNESDAY = new Date("2026-07-08T09:00:00");

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    description: null,
    status: "todo",
    position: 0,
    dueDate: null,
    parentTaskId: null,
    recursWeekly: false,
    weekday: null,
    recurrenceTemplateId: null,
    occurrenceDate: null,
    completedAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function application(
  overrides: Partial<Application> & { id: string },
): Application {
  return {
    companyId: "company-1",
    roleTitle: "Role",
    resumeVariant: "swe_backend",
    stage: "applied",
    appliedDate: "2026-07-01",
    lastUpdateDate: "2026-07-01",
    referralSource: null,
    followUpDate: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function interview(overrides: Partial<Interview> & { id: string }): Interview {
  return {
    applicationId: "app-1",
    roundType: "coding",
    scheduledAt: "2026-07-08T15:00:00.000Z",
    completed: false,
    outcome: null,
    postMortemNotes: null,
    completedAt: null,
    postMortemLoggedAt: null,
    deletedAt: null,
    createdAt: "2026-07-08T15:00:00.000Z",
    updatedAt: "2026-07-08T15:00:00.000Z",
    ...overrides,
  };
}

function outreachEntry(
  overrides: Partial<OutreachEntry> & { id: string },
): OutreachEntry {
  return {
    contactName: null,
    companyId: null,
    channel: "linkedin",
    date: "2026-07-08",
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

function prepEntry(overrides: Partial<PrepEntry> & { id: string }): PrepEntry {
  return {
    entryType: "algorithm",
    topic: null,
    date: "2026-07-08",
    durationMin: null,
    timeToSolveMin: null,
    outcome: null,
    mockSubtype: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("thisWeeksScheduleBlocks", () => {
  it("keeps recurring instances within the current Monday-start week", () => {
    const tasks = [
      task({
        id: "mon",
        recurrenceTemplateId: "template",
        occurrenceDate: "2026-07-06",
      }),
      task({
        id: "sun",
        recurrenceTemplateId: "template",
        occurrenceDate: "2026-07-12",
      }),
      task({
        id: "next-week",
        recurrenceTemplateId: "template",
        occurrenceDate: "2026-07-13",
      }),
      task({
        id: "last-week",
        recurrenceTemplateId: "template",
        occurrenceDate: "2026-06-29",
      }),
    ];

    expect(thisWeeksScheduleBlocks(tasks, WEDNESDAY).map((t) => t.id)).toEqual([
      "mon",
      "sun",
    ]);
  });

  it("excludes ordinary tasks even if their due date is this week", () => {
    const tasks = [
      task({ id: "ordinary", dueDate: "2026-07-08" }),
      task({
        id: "recurring",
        recurrenceTemplateId: "template",
        occurrenceDate: "2026-07-08",
      }),
    ];

    expect(thisWeeksScheduleBlocks(tasks, WEDNESDAY).map((t) => t.id)).toEqual([
      "recurring",
    ]);
  });

  it("sorts by occurrence date", () => {
    const tasks = [
      task({
        id: "fri",
        recurrenceTemplateId: "t",
        occurrenceDate: "2026-07-10",
      }),
      task({
        id: "mon",
        recurrenceTemplateId: "t",
        occurrenceDate: "2026-07-06",
      }),
    ];

    expect(thisWeeksScheduleBlocks(tasks, WEDNESDAY).map((t) => t.id)).toEqual([
      "mon",
      "fri",
    ]);
  });
});

describe("applicationsNeedingFollowUp", () => {
  const today = "2026-07-12";

  it("flags a followUpDate that is today or earlier", () => {
    const apps = [
      application({
        id: "due-today",
        followUpDate: "2026-07-12",
        lastUpdateDate: "2026-07-11",
      }),
      application({
        id: "overdue",
        followUpDate: "2026-07-01",
        lastUpdateDate: "2026-07-11",
      }),
      // Recent lastUpdateDate so this is isolated to the followUpDate clause —
      // otherwise it would also get flagged as stale via the OR condition.
      application({
        id: "future",
        followUpDate: "2026-07-20",
        lastUpdateDate: "2026-07-11",
      }),
    ];

    expect(applicationsNeedingFollowUp(apps, today).map((a) => a.id)).toEqual([
      "due-today",
      "overdue",
    ]);
  });

  it("flags no update in more than 7 days even with no followUpDate set", () => {
    const apps = [
      application({ id: "stale", lastUpdateDate: "2026-07-01" }),
      application({ id: "fresh", lastUpdateDate: "2026-07-10" }),
    ];

    expect(applicationsNeedingFollowUp(apps, today).map((a) => a.id)).toEqual([
      "stale",
    ]);
  });

  // The deliberate extension beyond the plan's literal wording: a rejected
  // application has no next action, so it shouldn't clutter the panel just
  // because nobody's touched the row since it closed out.
  it("excludes terminal stages regardless of staleness", () => {
    const apps = [
      application({
        id: "rejected",
        stage: "rejected",
        lastUpdateDate: "2026-06-01",
      }),
      application({
        id: "withdrawn",
        stage: "withdrawn",
        lastUpdateDate: "2026-06-01",
        followUpDate: "2026-07-01",
      }),
      application({
        id: "offer",
        stage: "offer",
        lastUpdateDate: "2026-06-01",
      }),
      application({
        id: "still-open",
        stage: "onsite",
        lastUpdateDate: "2026-06-01",
      }),
    ];

    expect(applicationsNeedingFollowUp(apps, today).map((a) => a.id)).toEqual([
      "still-open",
    ]);
  });

  it("excludes soft-deleted applications", () => {
    const apps = [
      application({
        id: "deleted",
        lastUpdateDate: "2026-06-01",
        deletedAt: "2026-07-01T00:00:00.000Z",
      }),
    ];

    expect(applicationsNeedingFollowUp(apps, today)).toEqual([]);
  });
});

describe("interviewsNeedingPostMortem", () => {
  it("flags completed interviews with no post-mortem notes", () => {
    const now = new Date("2026-07-09T15:00:00.000Z");
    const interviews = [
      interview({ id: "done-no-notes", completed: true }),
      interview({
        id: "done-with-notes",
        completed: true,
        postMortemNotes: "Went well",
      }),
      interview({ id: "not-done", completed: false }),
    ];

    const flagged = interviewsNeedingPostMortem(interviews, now);
    expect(flagged.map((r) => r.interview.id)).toEqual(["done-no-notes"]);
  });

  it("marks overdue only past the 24-hour window, anchored on scheduledAt", () => {
    const justUnder = new Date("2026-07-09T14:00:00.000Z"); // 23h after 15:00
    const justOver = new Date("2026-07-09T16:00:00.000Z"); // 25h after 15:00
    const interviews = [interview({ id: "i", completed: true })];

    expect(
      interviewsNeedingPostMortem(interviews, justUnder)[0].isOverdue,
    ).toBe(false);
    expect(interviewsNeedingPostMortem(interviews, justOver)[0].isOverdue).toBe(
      true,
    );
  });

  it("sorts most overdue first", () => {
    const now = new Date("2026-07-10T15:00:00.000Z");
    const interviews = [
      interview({
        id: "recent",
        completed: true,
        scheduledAt: "2026-07-10T10:00:00.000Z",
      }),
      interview({
        id: "old",
        completed: true,
        scheduledAt: "2026-07-08T10:00:00.000Z",
      }),
    ];

    expect(
      interviewsNeedingPostMortem(interviews, now).map((r) => r.interview.id),
    ).toEqual(["old", "recent"]);
  });
});

describe("gate checklist", () => {
  it("builds the expected title from a date", () => {
    expect(gateChecklistTitleFor(new Date("2026-07-15"))).toBe(
      "Gate: July 2026",
    );
  });

  it("finds a top-level task matching this month's gate title, case-insensitively", () => {
    const tasks = [
      task({ id: "gate", title: "gate: july 2026", parentTaskId: null }),
      task({ id: "other", title: "Gate: June 2026", parentTaskId: null }),
    ];

    const found = findGateChecklistTask(tasks, new Date("2026-07-15"));
    expect(found?.id).toBe("gate");
  });

  it("does not match a subtask even with the right title", () => {
    const tasks = [
      task({
        id: "nested",
        title: "Gate: July 2026",
        parentTaskId: "parent",
      }),
    ];

    expect(findGateChecklistTask(tasks, new Date("2026-07-15"))).toBeNull();
  });

  it("computes completion over direct subtasks only", () => {
    const gate = task({ id: "gate", title: "Gate: July 2026" });
    const tasks = [
      gate,
      task({ id: "sub-1", parentTaskId: "gate", status: "done" }),
      task({ id: "sub-2", parentTaskId: "gate", status: "todo" }),
      task({
        id: "deleted-sub",
        parentTaskId: "gate",
        status: "done",
        deletedAt: "2026-07-01T00:00:00.000Z",
      }),
    ];

    const progress = gateChecklistProgress(tasks, gate);
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(1);
  });
});

describe("weeklyCadence", () => {
  it("counts applications by createdAt within the current week", () => {
    const applications = [
      application({ id: "in", createdAt: "2026-07-08T00:00:00.000Z" }),
      application({ id: "monday", createdAt: "2026-07-06T00:00:00.000Z" }),
      application({ id: "before", createdAt: "2026-06-29T00:00:00.000Z" }),
      application({ id: "after", createdAt: "2026-07-13T00:00:00.000Z" }),
    ];

    const cadence = weeklyCadence(applications, [], [], WEDNESDAY);

    expect(cadence.applications.count).toBe(2);
    expect(cadence.applications.target).toEqual({ min: 5, max: 10 });
  });

  it("excludes soft-deleted applications from the weekly count", () => {
    const applications = [
      application({
        id: "deleted",
        createdAt: "2026-07-08T00:00:00.000Z",
        deletedAt: "2026-07-09T00:00:00.000Z",
      }),
    ];

    expect(weeklyCadence(applications, [], [], WEDNESDAY).applications.count).toBe(
      0,
    );
  });

  it("counts outreach entries by date within the current week", () => {
    const outreach = [
      outreachEntry({ id: "in", date: "2026-07-08" }),
      outreachEntry({ id: "sunday", date: "2026-07-12" }),
      outreachEntry({ id: "next-week", date: "2026-07-13" }),
    ];

    const cadence = weeklyCadence([], outreach, [], WEDNESDAY);

    expect(cadence.outreach.count).toBe(2);
    expect(cadence.outreach.target).toEqual({ min: 2, max: 3 });
  });

  it("counts only mock_interview prep entries within the current week", () => {
    const entries = [
      prepEntry({ id: "mock", entryType: "mock_interview", date: "2026-07-08" }),
      prepEntry({ id: "algo", entryType: "algorithm", date: "2026-07-08" }),
      prepEntry({
        id: "mock-next-week",
        entryType: "mock_interview",
        date: "2026-07-13",
      }),
    ];

    const cadence = weeklyCadence([], [], entries, WEDNESDAY);

    expect(cadence.mockInterviews.count).toBe(1);
    expect(cadence.mockInterviews.target).toEqual({ min: 1 });
  });
});
