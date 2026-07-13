import { describe, expect, it } from "vitest";
import {
  activeCheckpoint,
  DECEMBER_2026_CHECKPOINT,
  FEBRUARY_2027_CHECKPOINT,
  mockSubtypeProgress,
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
    mockSubtype: null,
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

describe("mockSubtypeProgress", () => {
  it("returns null when the checkpoint has no per-subtype targets", () => {
    expect(mockSubtypeProgress([], FEBRUARY_2027_CHECKPOINT)).toBeNull();
  });

  it("splits mock counts by subtype against December's per-subtype targets", () => {
    const entries = [
      ...Array.from({ length: 4 }, (_, i) =>
        entry({
          id: `coding-${i}`,
          entryType: "mock_interview",
          mockSubtype: "coding",
        }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        entry({
          id: `system-design-${i}`,
          entryType: "mock_interview",
          mockSubtype: "system_design",
        }),
      ),
      entry({
        id: "ml-1",
        entryType: "mock_interview",
        mockSubtype: "ml_system_design",
      }),
    ];

    const progress = mockSubtypeProgress(entries, DECEMBER_2026_CHECKPOINT);

    expect(progress).not.toBeNull();
    expect(progress!.bySubtype.coding).toEqual({
      actual: 4,
      target: 6,
      progress: 4 / 6,
    });
    expect(progress!.bySubtype.system_design).toEqual({
      actual: 2,
      target: 6,
      progress: 2 / 6,
    });
    expect(progress!.bySubtype.ml_system_design).toEqual({
      actual: 1,
      target: 2,
      progress: 0.5,
    });
    expect(progress!.unclassified).toBe(0);
  });

  it("counts legacy NULL-subtype mocks as unclassified, not silently toward a subtype", () => {
    const entries = [
      entry({
        id: "classified",
        entryType: "mock_interview",
        mockSubtype: "coding",
      }),
      entry({ id: "legacy-1", entryType: "mock_interview", mockSubtype: null }),
      entry({ id: "legacy-2", entryType: "mock_interview", mockSubtype: null }),
    ];

    const progress = mockSubtypeProgress(entries, DECEMBER_2026_CHECKPOINT);

    expect(progress!.bySubtype.coding.actual).toBe(1);
    expect(progress!.unclassified).toBe(2);
  });
});
