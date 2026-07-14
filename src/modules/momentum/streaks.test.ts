import { describe, expect, it } from "vitest";
import { activityDates, computeStreak } from "@/src/modules/momentum/streaks";
import type { Task } from "@/src/modules/task/types";
import type { Application } from "@/src/modules/jobApplications/types";
import type { PrepEntry } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    description: null,
    status: "done",
    position: 0,
    dueDate: null,
    parentTaskId: null,
    recursWeekly: false,
    weekday: null,
    recurrenceTemplateId: null,
    occurrenceDate: null,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function prepEntry(overrides: Partial<PrepEntry> & { id: string }): PrepEntry {
  return {
    entryType: "algorithm",
    topic: null,
    date: "2026-07-13",
    durationMin: null,
    timeToSolveMin: null,
    outcome: null,
    mockSubtype: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
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
    date: "2026-07-13",
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
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
    appliedDate: null,
    lastUpdateDate: "2026-07-13",
    referralSource: null,
    followUpDate: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

const EMPTY = {
  tasks: [],
  prepEntries: [],
  applications: [],
  outreachEntries: [],
};

describe("activityDates", () => {
  it("counts a day active for any of the four activity kinds", () => {
    const days = activityDates({
      tasks: [
        task({ id: "t", completedAt: "2026-07-10T12:00:00.000Z" }),
      ],
      prepEntries: [prepEntry({ id: "p", date: "2026-07-11" })],
      applications: [
        application({ id: "a", createdAt: "2026-07-12T12:00:00.000Z" }),
      ],
      outreachEntries: [outreachEntry({ id: "o", date: "2026-07-13" })],
    });

    expect([...days].sort()).toEqual([
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
    ]);
  });

  it("ignores tasks that were never completed", () => {
    const days = activityDates({
      ...EMPTY,
      tasks: [task({ id: "open", status: "todo", completedAt: null })],
    });

    expect(days.size).toBe(0);
  });

  it("ignores soft-deleted rows of every kind", () => {
    const deleted = "2026-07-14T00:00:00.000Z";
    const days = activityDates({
      tasks: [
        task({
          id: "t",
          completedAt: "2026-07-10T12:00:00.000Z",
          deletedAt: deleted,
        }),
      ],
      prepEntries: [
        prepEntry({ id: "p", date: "2026-07-11", deletedAt: deleted }),
      ],
      applications: [application({ id: "a", deletedAt: deleted })],
      outreachEntries: [
        outreachEntry({ id: "o", date: "2026-07-13", deletedAt: deleted }),
      ],
    });

    expect(days.size).toBe(0);
  });

  it("uses the local wall-clock day of a completion timestamp", () => {
    // The timezone trap: .slice(0,10) on this ISO string yields the UTC date.
    // format() yields the LOCAL date, which is what the user actually
    // experienced. Whichever zone the test runs in, the two must agree with
    // date-fns' local reading, not with a naive string slice.
    const completedAt = "2026-07-10T23:30:00.000Z";
    const days = activityDates({
      ...EMPTY,
      tasks: [task({ id: "t", completedAt })],
    });

    const expected = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(completedAt));

    expect([...days]).toEqual([expected]);
  });
});

describe("computeStreak", () => {
  const today = new Date("2026-07-13T09:00:00");

  it("counts a run ending today and marks it active", () => {
    const days = new Set(["2026-07-11", "2026-07-12", "2026-07-13"]);

    expect(computeStreak(days, today)).toEqual({
      current: 3,
      longest: 3,
      activeToday: true,
    });
  });

  it("keeps the streak alive on a day you haven't logged yet", () => {
    // The grace rule: at 9am with nothing logged, yesterday's run still counts.
    // Reading 0 here would be both wrong and demoralizing.
    const days = new Set(["2026-07-11", "2026-07-12"]);

    expect(computeStreak(days, today)).toEqual({
      current: 2,
      longest: 2,
      activeToday: false,
    });
  });

  it("breaks the streak once two days have passed with nothing logged", () => {
    const days = new Set(["2026-07-10", "2026-07-11"]);

    const streak = computeStreak(days, today);
    expect(streak.current).toBe(0);
    expect(streak.activeToday).toBe(false);
    // The history is still there, though.
    expect(streak.longest).toBe(2);
  });

  it("reports the longest historical run even when the current one is shorter", () => {
    const days = new Set([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-07-13",
    ]);

    expect(computeStreak(days, today)).toEqual({
      current: 1,
      longest: 5,
      activeToday: true,
    });
  });

  it("returns a zero streak for no activity at all", () => {
    expect(computeStreak(new Set(), today)).toEqual({
      current: 0,
      longest: 0,
      activeToday: false,
    });
  });

  it("counts a run across a month boundary", () => {
    const days = new Set(["2026-06-29", "2026-06-30", "2026-07-01"]);

    expect(computeStreak(days, new Date("2026-07-01T09:00:00")).current).toBe(3);
  });
});

describe("activityDates — malformed and missing timestamps", () => {
  // format() throws RangeError on an Invalid Date, and activityDates runs inside
  // the momentum refresh that EVERY page mounts. One bad row was taking out the
  // streak for the whole app ("RangeError: Invalid time value" in the console).
  it("skips a task whose completedAt is undefined rather than throwing", () => {
    const t = { ...task({ id: "t", status: "done" }) } as Task;
    delete (t as Partial<Task>).completedAt;

    expect(() => activityDates({ ...EMPTY, tasks: [t] })).not.toThrow();
    expect(activityDates({ ...EMPTY, tasks: [t] }).size).toBe(0);
  });

  it("skips a malformed completedAt", () => {
    const t = task({ id: "t", completedAt: "not-a-date" });

    expect(() => activityDates({ ...EMPTY, tasks: [t] })).not.toThrow();
    expect(activityDates({ ...EMPTY, tasks: [t] }).size).toBe(0);
  });

  it("still counts the good rows alongside a bad one", () => {
    const bad = task({ id: "bad", completedAt: "garbage" });
    const good = task({ id: "good", completedAt: "2026-07-10T12:00:00.000Z" });

    const days = activityDates({ ...EMPTY, tasks: [bad, good] });
    expect(days.size).toBe(1);
  });
});
