import { describe, expect, it } from "vitest";
import { TARGET_ALLOCATION, timeAllocation } from "@/src/modules/prep/prepAllocation";
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

describe("timeAllocation", () => {
  it("sums minutes per §11.3 area and computes actualPct against eligible minutes", () => {
    const entries = [
      entry({ id: "a1", entryType: "algorithm", durationMin: 70 }),
      entry({ id: "a2", entryType: "algorithm", durationMin: 30 }),
      entry({ id: "sd", entryType: "system_design", durationMin: 50 }),
      entry({ id: "beh", entryType: "behavioral", durationMin: 20 }),
      entry({ id: "ml", entryType: "ml_system_design", durationMin: 20 }),
      entry({ id: "rdd", entryType: "resume_deep_dive", durationMin: 10 }),
    ];

    const allocation = timeAllocation(entries);
    const totalEligibleMinutes = 200;

    const algorithm = allocation.find((a) => a.area === "algorithm")!;
    expect(algorithm.minutes).toBe(100);
    expect(algorithm.targetPct).toBe(TARGET_ALLOCATION.algorithm);
    expect(algorithm.actualPct).toBeCloseTo(100 / totalEligibleMinutes);

    const resumeDeepDive = allocation.find((a) => a.area === "resume_deep_dive")!;
    expect(resumeDeepDive.minutes).toBe(10);
    expect(resumeDeepDive.actualPct).toBeCloseTo(10 / totalEligibleMinutes);
  });

  it("excludes mock_interview minutes from both the numerator and the denominator", () => {
    const entries = [
      entry({ id: "a1", entryType: "algorithm", durationMin: 50 }),
      entry({ id: "mock", entryType: "mock_interview", durationMin: 999 }),
    ];

    const allocation = timeAllocation(entries);
    const algorithm = allocation.find((a) => a.area === "algorithm")!;

    // If mock minutes leaked into the denominator, this would be far below 1.
    expect(algorithm.actualPct).toBe(1);
    expect(allocation.some((a) => (a.area as string) === "mock_interview")).toBe(
      false,
    );
  });

  it("returns null actualPct, not zero, when no eligible minutes are logged", () => {
    const entries = [entry({ id: "mock", entryType: "mock_interview", durationMin: 60 })];

    const allocation = timeAllocation(entries);

    for (const area of allocation) {
      expect(area.actualPct).toBeNull();
      expect(area.minutes).toBe(0);
    }
  });

  it("scopes to entries on or after fromDate when provided", () => {
    const entries = [
      entry({
        id: "old",
        entryType: "algorithm",
        durationMin: 100,
        date: "2026-07-01",
      }),
      entry({
        id: "new",
        entryType: "algorithm",
        durationMin: 50,
        date: "2026-08-01",
      }),
    ];

    const allocation = timeAllocation(entries, "2026-08-01");
    const algorithm = allocation.find((a) => a.area === "algorithm")!;

    expect(algorithm.minutes).toBe(50);
  });
});
