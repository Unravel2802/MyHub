import { describe, expect, it } from "vitest";
import {
  drillCoverage,
  reviewQueue,
} from "@/src/modules/designDrills/progress";
import type {
  DesignDrill,
  DesignDrillAttempt,
  DesignDrillSelfRating,
} from "@/src/modules/designDrills/types";

const NOW = new Date("2026-07-21T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function drill(id: string, overrides: Partial<DesignDrill> = {}): DesignDrill {
  return {
    id,
    slug: id,
    category: "system_design",
    difficulty: "core",
    title: id,
    prompt: "",
    rubric: [],
    solution: "",
    solutionDetail: null,
    estimatedMinutes: 30,
    tags: [],
    deletedAt: null,
    createdAt: daysAgo(100),
    updatedAt: daysAgo(100),
    ...overrides,
  };
}

function attempt(
  drillId: string,
  completedDaysAgo: number | null,
  selfRating: DesignDrillSelfRating | null,
  overrides: Partial<DesignDrillAttempt> = {},
): DesignDrillAttempt {
  const completed = completedDaysAgo === null;
  return {
    id: `${drillId}-${completedDaysAgo ?? "open"}-${selfRating ?? "none"}`,
    drillId,
    startedAt: daysAgo(completedDaysAgo ?? 0),
    completedAt: completed ? null : daysAgo(completedDaysAgo as number),
    durationSec: completed ? null : 1200,
    notes: null,
    rubricHits: [],
    selfRating: completed ? null : selfRating,
    deletedAt: null,
    createdAt: daysAgo(completedDaysAgo ?? 0),
    updatedAt: daysAgo(completedDaysAgo ?? 0),
    ...overrides,
  };
}

describe("reviewQueue", () => {
  it("puts never-attempted drills first, easiest difficulty then title", () => {
    const drills = [
      drill("b-core", { difficulty: "core" }),
      drill("a-advanced", { difficulty: "advanced" }),
      drill("c-warmup", { difficulty: "warmup" }),
    ];

    const queue = reviewQueue(drills, [], NOW);

    expect(queue.map((item) => item.drill.id)).toEqual([
      "c-warmup",
      "b-core",
      "a-advanced",
    ]);
    expect(queue.every((item) => item.reason === "never_attempted")).toBe(true);
    expect(queue[0].dueInDays).toBeNull();
  });

  it("classifies due vs practiced by the rating's interval", () => {
    // weak interval = 2d, strong interval = 21d. Both last practiced 3 days ago:
    // the weak one is overdue, the strong one is not.
    const drills = [drill("weak"), drill("strong")];
    const attempts = [
      attempt("weak", 3, "weak"),
      attempt("strong", 3, "strong"),
    ];

    const queue = reviewQueue(drills, attempts, NOW);
    const byId = Object.fromEntries(queue.map((i) => [i.drill.id, i]));

    expect(byId.weak.reason).toBe("due");
    expect(byId.weak.dueInDays).toBeLessThanOrEqual(0);
    expect(byId.strong.reason).toBe("practiced");
    expect(byId.strong.dueInDays).toBeGreaterThan(0);
    // Due sorts ahead of practiced.
    expect(queue[0].drill.id).toBe("weak");
  });

  it("orders due drills most-overdue first", () => {
    const drills = [drill("recent"), drill("stale")];
    const attempts = [
      attempt("recent", 3, "weak"), // 1 day overdue
      attempt("stale", 30, "weak"), // 28 days overdue
    ];

    const queue = reviewQueue(drills, attempts, NOW);

    expect(queue.map((i) => i.drill.id)).toEqual(["stale", "recent"]);
  });

  it("uses only the latest completed attempt and ignores in-progress/deleted ones", () => {
    const drills = [drill("d")];
    const attempts = [
      attempt("d", 40, "weak"), // old
      attempt("d", 1, "strong"), // latest → not due (21d interval)
      attempt("d", null, null), // in progress, ignored
      attempt("d", 0, "weak", { deletedAt: daysAgo(0) }), // deleted, ignored
    ];

    const queue = reviewQueue(drills, attempts, NOW);

    expect(queue[0].reason).toBe("practiced");
    expect(queue[0].lastRating).toBe("strong");
  });

  it("excludes soft-deleted drills", () => {
    const drills = [drill("live"), drill("gone", { deletedAt: daysAgo(1) })];

    const queue = reviewQueue(drills, [], NOW);

    expect(queue.map((i) => i.drill.id)).toEqual(["live"]);
  });
});

describe("drillCoverage", () => {
  const drills = [
    drill("sd-warmup", { category: "system_design", difficulty: "warmup" }),
    drill("sd-core", { category: "system_design", difficulty: "core" }),
    drill("ml-core", { category: "ml_system_design", difficulty: "core" }),
    drill("ml-adv", { category: "ml_system_design", difficulty: "advanced" }),
  ];

  it("counts totals and distinct attempted drills per bucket", () => {
    const attempts = [
      attempt("sd-warmup", 5, "solid"),
      attempt("sd-warmup", 2, "strong"), // same drill, still one attempted
      attempt("ml-core", 1, "weak"),
      attempt("ml-adv", null, null), // in-progress → not attempted
    ];

    const coverage = drillCoverage(drills, attempts);

    expect(coverage.overall).toEqual({ total: 4, attempted: 2 });
    expect(coverage.byCategory.system_design).toEqual({
      total: 2,
      attempted: 1,
    });
    expect(coverage.byCategory.ml_system_design).toEqual({
      total: 2,
      attempted: 1,
    });
    expect(coverage.byDifficulty.warmup).toEqual({ total: 1, attempted: 1 });
    expect(coverage.byDifficulty.advanced).toEqual({ total: 1, attempted: 0 });
  });

  it("tallies latest-rating counts from the most recent completed attempt", () => {
    const attempts = [
      attempt("sd-warmup", 5, "weak"),
      attempt("sd-warmup", 2, "strong"), // latest for this drill → strong
      attempt("ml-core", 1, "solid"),
    ];

    const coverage = drillCoverage(drills, attempts);

    expect(coverage.latestRatingCounts).toEqual({
      strong: 1,
      solid: 1,
      weak: 0,
    });
  });

  it("ignores deleted drills and attempts", () => {
    const withDeleted: DesignDrill[] = [
      ...drills,
      drill("dead", { deletedAt: daysAgo(1) }),
    ];
    const attempts = [
      attempt("sd-core", 3, "solid"),
      attempt("ml-core", 2, "weak", { deletedAt: daysAgo(1) }), // deleted
    ];

    const coverage = drillCoverage(withDeleted, attempts);

    expect(coverage.overall).toEqual({ total: 4, attempted: 1 });
    expect(coverage.latestRatingCounts).toEqual({
      strong: 0,
      solid: 1,
      weak: 0,
    });
  });
});
