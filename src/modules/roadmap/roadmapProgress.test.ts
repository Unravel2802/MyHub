import { describe, expect, it } from "vitest";
import {
  currentMonthKey,
  daysUntilGraduation,
  evaluateMonth,
  measureCriterion,
  monthKeyOf,
  overallProgress,
  readinessEvidence,
} from "@/src/modules/roadmap/roadmapProgress";
import type { RoadmapSnapshot } from "@/src/modules/roadmap/roadmapProgress";
import { ROADMAP_MONTHS } from "@/src/modules/roadmap/roadmapCatalog";
import type { RoadmapMonth } from "@/src/modules/roadmap/types";
import type { PrepEntry } from "@/src/modules/prep/types";
import type { Application } from "@/src/modules/jobApplications/types";

const EMPTY: RoadmapSnapshot = {
  prepEntries: [],
  behavioralStories: [],
  applications: [],
  companies: [],
  outreachEntries: [],
};

function prep(overrides: Partial<PrepEntry> & { id: string }): PrepEntry {
  return {
    entryType: "algorithm",
    topic: null,
    date: "2026-09-10",
    durationMin: null,
    timeToSolveMin: null,
    outcome: null,
    mockSubtype: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

function application(
  overrides: Partial<Application> & { id: string },
): Application {
  return {
    companyId: "c1",
    roleTitle: "Role",
    resumeVariant: "swe_backend",
    stage: "applied",
    appliedDate: null,
    lastUpdateDate: "2026-09-10",
    referralSource: null,
    followUpDate: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-09-10T12:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
    ...overrides,
  };
}

const algos = (n: number, date: string) =>
  Array.from({ length: n }, (_, i) => prep({ id: `${date}-${i}`, date }));

const month = (key: string): RoadmapMonth =>
  ROADMAP_MONTHS.find((m) => m.key === key)!;

describe("catalog integrity", () => {
  it("covers Jul 2026 through May 2027 with no gaps or duplicates", () => {
    const keys = ROADMAP_MONTHS.map((m) => m.key);
    expect(keys).toEqual([
      "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
      "2027-01", "2027-02", "2027-03", "2027-04", "2027-05",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("cites a roadmap source for every criterion — no invented targets", () => {
    for (const m of ROADMAP_MONTHS) {
      for (const c of m.criteria) {
        expect(c.source.trim().length, `${c.key} has no source`).toBeGreaterThan(0);
      }
    }
  });

  it("has globally unique criterion keys", () => {
    const keys = ROADMAP_MONTHS.flatMap((m) => m.criteria.map((c) => c.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("measure scope — monthly vs cumulative", () => {
  // The scope distinction is load-bearing. Measure a cumulative target monthly
  // and February's "150 total" becomes unreachable; measure a monthly target
  // cumulatively and September marks itself done in December.
  const snapshot: RoadmapSnapshot = {
    ...EMPTY,
    prepEntries: [...algos(10, "2026-08-05"), ...algos(5, "2026-09-05")],
  };

  it("month scope counts only that month", () => {
    const n = measureCriterion(
      { source: "prep", entryType: "algorithm", scope: "month" },
      snapshot,
      "2026-09",
    );
    expect(n).toBe(5);
  });

  it("cumulative scope counts everything up to and including that month", () => {
    const n = measureCriterion(
      { source: "prep", entryType: "algorithm", scope: "cumulative" },
      snapshot,
      "2026-09",
    );
    expect(n).toBe(15);
  });

  it("cumulative does NOT count months after the target month", () => {
    const n = measureCriterion(
      { source: "prep", entryType: "algorithm", scope: "cumulative" },
      snapshot,
      "2026-08",
    );
    expect(n).toBe(10);
  });

  it("ignores soft-deleted rows", () => {
    const withDeleted: RoadmapSnapshot = {
      ...EMPTY,
      prepEntries: [
        ...algos(3, "2026-09-05"),
        prep({ id: "gone", date: "2026-09-06", deletedAt: "2026-09-07T00:00:00Z" }),
      ],
    };
    expect(
      measureCriterion(
        { source: "prep", entryType: "algorithm", scope: "month" },
        withDeleted,
        "2026-09",
      ),
    ).toBe(3);
  });
});

describe("month status", () => {
  const sept = month("2026-09");

  it("is upcoming before the month starts, never missed", () => {
    // A month you haven't reached yet is not a failure.
    const state = evaluateMonth(sept, EMPTY, new Set(), new Date("2026-08-15T09:00:00"));
    expect(state.status).toBe("upcoming");
  });

  it("is in_progress during the month with criteria outstanding", () => {
    const state = evaluateMonth(sept, EMPTY, new Set(), new Date("2026-09-15T09:00:00"));
    expect(state.status).toBe("in_progress");
  });

  it("is MISSED once the month has passed with criteria unmet", () => {
    // The red ring. Not rolled forward, not softened — a roadmap that hides an
    // incomplete month lets you drift a semester without noticing.
    const state = evaluateMonth(sept, EMPTY, new Set(), new Date("2026-10-01T09:00:00"));
    expect(state.status).toBe("missed");
  });

  it("is done when every criterion is met, even after the month passed", () => {
    const july = month("2026-07");
    const snapshot: RoadmapSnapshot = {
      ...EMPTY,
      prepEntries: [
        ...algos(10, "2026-07-05"),
        prep({ id: "sd", entryType: "system_design", date: "2026-07-06" }),
        prep({ id: "ml", entryType: "ml_system_design", date: "2026-07-07" }),
      ],
      companies: Array.from({ length: 40 }, (_, i) => ({
        id: `c${i}`,
        name: `Co ${i}`,
        tier: "match" as const,
        notes: null,
        deletedAt: null,
        createdAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
      })),
    };
    const ticked = new Set([
      "2026-07.resumes",
      "2026-07.design_doc",
      "2026-07.repo_skeleton",
      "2026-07.explanation_recording",
    ]);

    const state = evaluateMonth(july, snapshot, ticked, new Date("2026-12-01T09:00:00"));
    expect(state.status).toBe("done");
    expect(state.metCount).toBe(state.totalCount);
  });

  it("meets an auto criterion at exactly N, not at N-1", () => {
    const sep = month("2026-09");
    const at14 = evaluateMonth(
      sep,
      { ...EMPTY, prepEntries: algos(14, "2026-09-05") },
      new Set(),
      new Date("2026-09-20T09:00:00"),
    );
    const at15 = evaluateMonth(
      sep,
      { ...EMPTY, prepEntries: algos(15, "2026-09-05") },
      new Set(),
      new Date("2026-09-20T09:00:00"),
    );

    const algoOf = (s: typeof at14) =>
      s.criteria.find((c) => c.criterion.key === "2026-09.algorithms")!;

    expect(algoOf(at14).met).toBe(false);
    expect(algoOf(at14).progress).toEqual({ actual: 14, target: 15 });
    expect(algoOf(at15).met).toBe(true);
  });

  it("a manual criterion is met only by a tick — nothing infers it", () => {
    const july = month("2026-07");
    const state = evaluateMonth(july, EMPTY, new Set(["2026-07.design_doc"]), new Date("2026-07-15T09:00:00"));
    const doc = state.criteria.find((c) => c.criterion.key === "2026-07.design_doc")!;
    const resumes = state.criteria.find((c) => c.criterion.key === "2026-07.resumes")!;

    expect(doc.met).toBe(true);
    expect(doc.progress).toBeNull(); // a checkbox has no "12 of 20"
    expect(resumes.met).toBe(false);
  });
});

describe("monthKeyOf / currentMonthKey", () => {
  it("reads the LOCAL month, not the UTC one", () => {
    // The trap that has bitten this codebase three times: at 23:00 local on the
    // last day of a month in UTC+7, toISOString() already says next month.
    expect(monthKeyOf(new Date("2026-09-30T23:30:00"))).toBe("2026-09");
    expect(monthKeyOf(new Date("2026-10-01T00:30:00"))).toBe("2026-10");
  });

  it("returns null outside the roadmap's span rather than inventing a position", () => {
    expect(currentMonthKey(new Date("2026-09-15T09:00:00"))).toBe("2026-09");
    expect(currentMonthKey(new Date("2026-01-15T09:00:00"))).toBeNull();
    expect(currentMonthKey(new Date("2028-01-15T09:00:00"))).toBeNull();
  });
});

describe("overallProgress & countdown", () => {
  it("is 0 with nothing done", () => {
    const states = ROADMAP_MONTHS.map((m) =>
      evaluateMonth(m, EMPTY, new Set(), new Date("2026-09-15T09:00:00")),
    );
    expect(overallProgress(states)).toBe(0);
  });

  it("counts down to graduation and never goes negative", () => {
    expect(daysUntilGraduation(new Date("2027-05-30T09:00:00"))).toBe(1);
    expect(daysUntilGraduation(new Date("2027-06-30T09:00:00"))).toBe(0);
    expect(daysUntilGraduation(new Date("2026-07-14T09:00:00"))).toBeGreaterThan(300);
  });
});

describe("readinessEvidence — claimed vs measured", () => {
  it("supports Strong when the average solve time clears the bar", () => {
    const snapshot: RoadmapSnapshot = {
      ...EMPTY,
      prepEntries: [
        prep({ id: "a", timeToSolveMin: 22 }),
        prep({ id: "b", timeToSolveMin: 26 }),
      ],
    };
    const result = readinessEvidence("algorithms", snapshot)!;
    expect(result.supported).toBe("strong");
  });

  it("contradicts a Strong claim when the average is 38 minutes", () => {
    // The whole point of the third radar layer.
    const snapshot: RoadmapSnapshot = {
      ...EMPTY,
      prepEntries: [
        prep({ id: "a", timeToSolveMin: 36 }),
        prep({ id: "b", timeToSolveMin: 40 }),
      ],
    };
    const result = readinessEvidence("algorithms", snapshot)!;
    expect(result.supported).toBe("not_started");
    expect(result.detail).toContain("38 min");
  });

  it("supports Minimum at 32 minutes — clears 35 but not 30", () => {
    const snapshot: RoadmapSnapshot = {
      ...EMPTY,
      prepEntries: [prep({ id: "a", timeToSolveMin: 32 })],
    };
    expect(readinessEvidence("algorithms", snapshot)!.supported).toBe("minimum");
  });

  it("says so honestly when there's no data, rather than assuming the worst silently", () => {
    const result = readinessEvidence("algorithms", EMPTY)!;
    expect(result.supported).toBe("not_started");
    expect(result.detail).toBe("No timed attempts yet");
  });

  it("evidences recruiting from the real funnel, excluding researching", () => {
    const snapshot: RoadmapSnapshot = {
      ...EMPTY,
      applications: [
        ...Array.from({ length: 20 }, (_, i) =>
          application({ id: `sent-${i}`, stage: "applied" }),
        ),
        application({ id: "not-sent", stage: "researching" }),
      ],
    };
    const result = readinessEvidence("recruiting", snapshot)!;
    expect(result.supported).toBe("strong");
    expect(result.detail).toContain("20 applications");
  });

  it("returns null where the bar is a judgment, rather than inventing a proxy", () => {
    // Most of the matrix. "Lead 45-min designs with capacity and failure
    // analysis" is not a number, and faking one would be worse than admitting it.
    for (const key of ["backend", "distributed_systems", "ml_systems", "system_design", "portfolio"]) {
      expect(readinessEvidence(key, EMPTY)).toBeNull();
    }
  });
});
