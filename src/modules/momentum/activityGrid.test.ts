import { describe, expect, it } from "vitest";
import { buildActivityGrid } from "@/src/modules/momentum/activityGrid";
import { activityCounts } from "@/src/modules/momentum/streaks";
import type { ActivitySnapshot } from "@/src/modules/momentum/streaks";
import type { Task } from "@/src/modules/task/types";
import type { PrepEntry } from "@/src/modules/prep/types";

const EMPTY: ActivitySnapshot = {
  tasks: [],
  prepEntries: [],
  applications: [],
  outreachEntries: [],
};

function prep(overrides: Partial<PrepEntry> & { id: string }): PrepEntry {
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
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("activityCounts", () => {
  it("sums all four sources per day", () => {
    const counts = activityCounts({
      ...EMPTY,
      prepEntries: [
        prep({ id: "a", date: "2026-07-13" }),
        prep({ id: "b", date: "2026-07-13" }),
      ],
      tasks: [task({ id: "t", completedAt: "2026-07-13T14:00:00.000Z" })],
    });
    expect(counts.get("2026-07-13")).toBe(3);
  });

  it("ignores soft-deleted rows", () => {
    const counts = activityCounts({
      ...EMPTY,
      prepEntries: [
        prep({ id: "a", date: "2026-07-13" }),
        prep({ id: "gone", date: "2026-07-13", deletedAt: "2026-07-14T00:00:00Z" }),
      ],
    });
    expect(counts.get("2026-07-13")).toBe(1);
  });

  it("uses the LOCAL day of a completion instant, not the UTC one", () => {
    // The recurring trap: a 23:30Z completion is a different UTC vs local day
    // outside UTC+0. The count must land on the local wall-clock day.
    const completedAt = "2026-07-13T23:30:00.000Z";
    const counts = activityCounts({
      ...EMPTY,
      tasks: [task({ id: "t", completedAt })],
    });
    const expected = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(completedAt));
    expect([...counts.keys()]).toEqual([expected]);
  });
});

describe("buildActivityGrid", () => {
  const today = new Date("2026-07-15T09:00:00"); // a Wednesday

  it("starts each column on Monday", () => {
    const grid = buildActivityGrid(new Map(), new Date("2026-07-08T00:00:00"), today);
    // First cell of the first week is the Monday on/before `from`.
    expect(grid.weeks[0][0].key).toBe("2026-07-06");
  });

  it("marks days after today as future spacers, not empty days", () => {
    const grid = buildActivityGrid(new Map(), new Date("2026-07-13T00:00:00"), today);
    const flat = grid.weeks.flat();

    const wed = flat.find((d) => d.key === "2026-07-15")!; // today
    const thu = flat.find((d) => d.key === "2026-07-16")!; // tomorrow
    expect(wed.future).toBe(false);
    expect(thu.future).toBe(true);
    // You can't have failed to act on a day that hasn't happened.
    expect(thu.count).toBe(0);
  });

  it("buckets counts into the fixed emerald ramp", () => {
    const counts = new Map([
      ["2026-07-13", 1], // level 1
      ["2026-07-14", 3], // level 2
      ["2026-07-15", 9], // level 4
    ]);
    const grid = buildActivityGrid(counts, new Date("2026-07-13T00:00:00"), today);
    const flat = grid.weeks.flat();
    expect(flat.find((d) => d.key === "2026-07-13")!.level).toBe(1);
    expect(flat.find((d) => d.key === "2026-07-14")!.level).toBe(2);
    expect(flat.find((d) => d.key === "2026-07-15")!.level).toBe(4);
  });

  it("keeps an empty past day at level 0 — absence is not activity", () => {
    const grid = buildActivityGrid(new Map(), new Date("2026-07-13T00:00:00"), today);
    const mon = grid.weeks.flat().find((d) => d.key === "2026-07-13")!;
    expect(mon.count).toBe(0);
    expect(mon.level).toBe(0);
  });

  it("totals only real (non-future) activity", () => {
    const counts = new Map([
      ["2026-07-13", 2],
      ["2026-07-14", 3],
    ]);
    const grid = buildActivityGrid(counts, new Date("2026-07-13T00:00:00"), today);
    expect(grid.total).toBe(5);
    expect(grid.activeDays).toBe(2);
  });
});
