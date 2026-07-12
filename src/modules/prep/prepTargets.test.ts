import { describe, expect, it } from "vitest";
import {
  activeCheckpoint,
  DECEMBER_2026_CHECKPOINT,
  FEBRUARY_2027_CHECKPOINT,
  progressTowardCheckpoint,
} from "@/src/modules/prep/prepTargets";
import type { PrepEntry } from "@/src/modules/prep/types";

function entry(
  overrides: Partial<PrepEntry> & { id: string; entryType: PrepEntry["entryType"] },
): PrepEntry {
  return {
    topic: null,
    date: "2026-08-01",
    durationMin: null,
    timeToSolveMin: null,
    outcome: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function manyEntries(
  entryType: PrepEntry["entryType"],
  count: number,
  date = "2026-08-01",
): PrepEntry[] {
  return Array.from({ length: count }, (_, i) =>
    entry({ id: `${entryType}-${i}`, entryType, date }),
  );
}

describe("activeCheckpoint", () => {
  it("returns December while on or before its throughDate", () => {
    expect(activeCheckpoint("2026-08-01")).toBe(DECEMBER_2026_CHECKPOINT);
    expect(activeCheckpoint("2026-12-31")).toBe(DECEMBER_2026_CHECKPOINT);
  });

  it("returns February once December has passed", () => {
    expect(activeCheckpoint("2027-01-01")).toBe(FEBRUARY_2027_CHECKPOINT);
    expect(activeCheckpoint("2027-06-01")).toBe(FEBRUARY_2027_CHECKPOINT);
  });
});

describe("progressTowardCheckpoint", () => {
  it("computes actual/target/progress per type against the December checkpoint", () => {
    const entries = [
      ...manyEntries("algorithm", 50),
      ...manyEntries("system_design", 3),
      ...manyEntries("ml_system_design", 1),
      ...manyEntries("mock_interview", 7),
    ];

    const progress = progressTowardCheckpoint(entries, DECEMBER_2026_CHECKPOINT);

    expect(progress.algorithm).toEqual({ actual: 50, target: 75, progress: 50 / 75 });
    expect(progress.systemDesign).toEqual({ actual: 3, target: 6, progress: 0.5 });
    expect(progress.mlSystemDesign).toEqual({ actual: 1, target: 2, progress: 0.5 });
    expect(progress.mockInterview).toEqual({
      actual: 7,
      target: 14,
      progress: 0.5,
    });
  });

  it("lets progress exceed 1 once the target is beaten, rather than capping", () => {
    const entries = manyEntries("algorithm", 160);

    const progress = progressTowardCheckpoint(entries, FEBRUARY_2027_CHECKPOINT);

    expect(progress.algorithm.actual).toBe(160);
    expect(progress.algorithm.target).toBe(150);
    expect(progress.algorithm.progress).toBeGreaterThan(1);
  });

  it("only counts entries on or before the checkpoint's throughDate", () => {
    const entries = [
      ...manyEntries("algorithm", 40, "2026-11-01"),
      ...manyEntries("algorithm", 40, "2027-01-15"), // after December's cutoff
    ];

    const progress = progressTowardCheckpoint(entries, DECEMBER_2026_CHECKPOINT);

    expect(progress.algorithm.actual).toBe(40);
  });
});
