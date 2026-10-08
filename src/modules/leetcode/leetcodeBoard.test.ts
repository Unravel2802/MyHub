import { describe, expect, it } from "vitest";
import {
  LEETCODE_STATUSES,
  attemptStats,
  attemptsForProblem,
  dayLabel,
  groupByLastAttemptDay,
  groupByStatus,
  problemCountInMonth,
  problemCountThrough,
  totalAttemptTimeMin,
} from "@/src/modules/leetcode/leetcodeBoard";
import type {
  LeetCodeAttempt,
  LeetCodeProblem,
} from "@/src/modules/leetcode/types";

const timestamp = "2026-07-24T00:00:00.000Z";

function problem(overrides: Partial<LeetCodeProblem> = {}): LeetCodeProblem {
  return {
    id: "p1",
    title: "Two Sum",
    questionNumber: null,
    difficulty: "easy",
    tags: [],
    notes: null,
    status: "to_review",
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function attempt(overrides: Partial<LeetCodeAttempt> = {}): LeetCodeAttempt {
  return {
    id: "a1",
    problemId: "p1",
    date: "2026-07-24",
    timeToSolveMin: 20,
    outcome: "solved",
    notes: null,
    solutionCode: null,
    solutionLanguage: null,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("groupByStatus", () => {
  it("includes every status column, even when empty", () => {
    const groups = groupByStatus([]);
    expect(Object.keys(groups).sort()).toEqual([...LEETCODE_STATUSES].sort());
    expect(groups.solved).toEqual([]);
  });

  it("buckets problems by their status", () => {
    const p1 = problem({ id: "p1", status: "to_review" });
    const p2 = problem({ id: "p2", status: "solved" });
    const p3 = problem({ id: "p3", status: "solved" });

    const groups = groupByStatus([p1, p2, p3]);

    expect(groups.to_review).toEqual([p1]);
    expect(groups.solved).toEqual([p2, p3]);
    expect(groups.in_progress).toEqual([]);
    expect(groups.needs_revisit).toEqual([]);
  });
});

describe("attemptsForProblem", () => {
  it("filters attempts to the given problem", () => {
    const a1 = attempt({ id: "a1", problemId: "p1" });
    const a2 = attempt({ id: "a2", problemId: "p2" });
    const a3 = attempt({ id: "a3", problemId: "p1" });

    expect(attemptsForProblem([a1, a2, a3], "p1")).toEqual([a1, a3]);
  });
});

describe("attemptStats", () => {
  it("counts attempts and reports the most recent as first-in-order", () => {
    const latest = attempt({ id: "latest", date: "2026-07-24" });
    const older = attempt({ id: "older", date: "2026-07-01" });

    // Assumes caller passes attempts already sorted most-recent-first, as
    // LeetCodeRepository.getAttempts returns them.
    const stats = attemptStats([latest, older], "p1");

    expect(stats.count).toBe(2);
    expect(stats.lastAttempt).toEqual(latest);
  });

  it("reports zero/null for a problem with no attempts", () => {
    const stats = attemptStats([attempt({ problemId: "other" })], "p1");
    expect(stats).toEqual({ count: 0, lastAttempt: null });
  });
});

describe("problemCountInMonth", () => {
  it("counts only problems added within the given month", () => {
    const problems = [
      problem({ id: "p1", createdAt: "2026-07-01T00:00:00.000Z" }),
      problem({ id: "p2", createdAt: "2026-07-24T00:00:00.000Z" }),
      problem({ id: "p3", createdAt: "2026-08-01T00:00:00.000Z" }),
    ];

    expect(problemCountInMonth(problems, "2026-07")).toBe(2);
    expect(problemCountInMonth(problems, "2026-08")).toBe(1);
    expect(problemCountInMonth(problems, "2026-09")).toBe(0);
  });
});

describe("problemCountThrough", () => {
  it("counts only problems added on or before the given date", () => {
    const problems = [
      problem({ id: "p1", createdAt: "2026-07-01T00:00:00.000Z" }),
      problem({ id: "p2", createdAt: "2026-07-24T23:59:59.000Z" }),
      problem({ id: "p3", createdAt: "2026-08-01T00:00:00.000Z" }),
    ];

    expect(problemCountThrough(problems, "2026-07-24")).toBe(2);
    expect(problemCountThrough(problems, "2026-06-30")).toBe(0);
  });
});

describe("totalAttemptTimeMin", () => {
  it("sums all attempt time and treats null as zero", () => {
    const attempts = [
      attempt({ id: "a1", timeToSolveMin: 25 }),
      attempt({ id: "a2", timeToSolveMin: null }),
      attempt({ id: "a3", timeToSolveMin: 40 }),
    ];

    expect(totalAttemptTimeMin(attempts)).toBe(65);
  });

  it("excludes attempts logged before fromDate", () => {
    const attempts = [
      attempt({
        id: "old",
        timeToSolveMin: 60,
        date: "2026-07-31",
      }),
      attempt({
        id: "boundary",
        timeToSolveMin: 20,
        date: "2026-08-01",
      }),
      attempt({
        id: "new",
        timeToSolveMin: 30,
        date: "2026-08-12",
      }),
    ];

    expect(totalAttemptTimeMin(attempts, "2026-08-01")).toBe(50);
  });
});

describe("dayLabel", () => {
  it("names today and yesterday", () => {
    expect(dayLabel("2026-10-07", "2026-10-07")).toBe("Today");
    expect(dayLabel("2026-10-06", "2026-10-07")).toBe("Yesterday");
  });

  it("counts calendar days across a month boundary", () => {
    expect(dayLabel("2026-09-30", "2026-10-01")).toBe("Yesterday");
  });

  it("formats older days, adding the year only when it differs", () => {
    expect(dayLabel("2026-10-05", "2026-10-07")).toBe("Mon, Oct 5");
    expect(dayLabel("2025-12-31", "2026-01-01")).toBe("Yesterday");
    expect(dayLabel("2025-12-30", "2026-01-01")).toBe("Tue, Dec 30, 2025");
  });
});

describe("groupByLastAttemptDay", () => {
  const today = "2026-10-07";

  it("returns no groups for no problems", () => {
    expect(groupByLastAttemptDay([], [], today)).toEqual([]);
  });

  it("groups by last attempt date in the order the rows arrive", () => {
    const p1 = problem({ id: "p1", difficulty: "easy", status: "solved" });
    const p2 = problem({ id: "p2", difficulty: "medium", status: "to_review" });
    const p3 = problem({ id: "p3", difficulty: "medium", status: "solved" });
    const attempts = [
      attempt({
        id: "a1",
        problemId: "p1",
        date: "2026-10-07",
        timeToSolveMin: 10,
      }),
      attempt({
        id: "a2",
        problemId: "p2",
        date: "2026-10-07",
        timeToSolveMin: 35,
      }),
      attempt({
        id: "a3",
        problemId: "p3",
        date: "2026-10-06",
        timeToSolveMin: 25,
      }),
    ];

    const groups = groupByLastAttemptDay([p1, p2, p3], attempts, today);
    expect(groups.map((group) => group.label)).toEqual(["Today", "Yesterday"]);
    expect(groups[0]).toMatchObject({
      date: "2026-10-07",
      problems: [p1, p2],
      byDifficulty: { easy: 1, medium: 1, hard: 0 },
      byStatus: { solved: 1, to_review: 1, in_progress: 0, needs_revisit: 0 },
      timeMin: 45,
    });
    expect(groups[1]).toMatchObject({ problems: [p3], timeMin: 25 });

    // Ascending sort reverses the rows; the groups follow.
    const reversed = groupByLastAttemptDay([p3, p2, p1], attempts, today);
    expect(reversed.map((group) => group.date)).toEqual([
      "2026-10-06",
      "2026-10-07",
    ]);
  });

  it("files a re-attempted problem under its latest day only", () => {
    const p1 = problem({ id: "p1" });
    const p2 = problem({ id: "p2" });
    const attempts = [
      attempt({
        id: "a1",
        problemId: "p1",
        date: "2026-10-07",
        timeToSolveMin: 20,
      }),
      attempt({
        id: "a2",
        problemId: "p1",
        date: "2026-10-06",
        timeToSolveMin: 40,
      }),
      attempt({
        id: "a3",
        problemId: "p2",
        date: "2026-10-06",
        timeToSolveMin: 15,
      }),
    ];

    const groups = groupByLastAttemptDay([p1, p2], attempts, today);
    expect(groups[0]).toMatchObject({
      date: "2026-10-07",
      problems: [p1],
      timeMin: 20,
    });
    // Oct 6's 40-minute sitting at p1 belongs to a row shown under Oct 7, so
    // Oct 6's header doesn't count it.
    expect(groups[1]).toMatchObject({
      date: "2026-10-06",
      problems: [p2],
      timeMin: 15,
    });
  });

  it("does not rely on attempts arriving most-recent-first", () => {
    const p1 = problem({ id: "p1" });
    const attempts = [
      attempt({ id: "a1", problemId: "p1", date: "2026-10-01" }),
      attempt({ id: "a2", problemId: "p1", date: "2026-10-07" }),
    ];
    expect(groupByLastAttemptDay([p1], attempts, today)[0].date).toBe(
      "2026-10-07",
    );
  });

  it("sums every sitting on the day and treats null time as zero", () => {
    const p1 = problem({ id: "p1" });
    const attempts = [
      attempt({
        id: "a1",
        problemId: "p1",
        date: "2026-10-07",
        timeToSolveMin: 30,
      }),
      attempt({
        id: "a2",
        problemId: "p1",
        date: "2026-10-07",
        timeToSolveMin: 12,
      }),
      attempt({
        id: "a3",
        problemId: "p1",
        date: "2026-10-07",
        timeToSolveMin: null,
      }),
    ];
    expect(groupByLastAttemptDay([p1], attempts, today)[0].timeMin).toBe(42);
  });

  it("ignores time from problems the table filtered out", () => {
    const shown = problem({ id: "p1" });
    const attempts = [
      attempt({
        id: "a1",
        problemId: "p1",
        date: "2026-10-07",
        timeToSolveMin: 10,
      }),
      attempt({
        id: "a2",
        problemId: "hidden",
        date: "2026-10-07",
        timeToSolveMin: 50,
      }),
    ];
    expect(groupByLastAttemptDay([shown], attempts, today)[0].timeMin).toBe(10);
  });

  it("puts never-attempted problems in a trailing group", () => {
    const fresh = problem({ id: "fresh", difficulty: "hard" });
    const done = problem({ id: "done" });
    const attempts = [attempt({ problemId: "done", date: "2026-10-07" })];

    const groups = groupByLastAttemptDay([fresh, done], attempts, today);
    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Not attempted",
    ]);
    expect(groups[1]).toMatchObject({
      date: null,
      problems: [fresh],
      byDifficulty: { easy: 0, medium: 0, hard: 1 },
      timeMin: 0,
    });
  });
});
