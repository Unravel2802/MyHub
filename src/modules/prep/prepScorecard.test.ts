import { describe, expect, it } from "vitest";
import {
  cumulativeCountsByType,
  entriesInMonth,
  monthOf,
  scorecardFor,
  weakestTopics,
} from "@/src/modules/prep/prepScorecard";
import type { PrepEntry } from "@/src/modules/prep/types";

function entry(overrides: Partial<PrepEntry> & { id: string }): PrepEntry {
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

describe("monthOf", () => {
  it("reads the month off the date string without timezone drift", () => {
    // Parsing this as a Date in a negative-offset zone would land on June 30.
    expect(monthOf("2026-07-01")).toBe("2026-07");
    expect(monthOf("2026-07-31")).toBe("2026-07");
  });
});

describe("entriesInMonth", () => {
  it("keeps only the given month and excludes soft-deleted entries", () => {
    const entries = [
      entry({ id: "in", date: "2026-07-08" }),
      entry({ id: "last-month", date: "2026-06-30" }),
      entry({ id: "next-month", date: "2026-08-01" }),
      entry({ id: "deleted", date: "2026-07-09", deletedAt: "2026-07-10" }),
    ];

    expect(entriesInMonth(entries, "2026-07").map((e) => e.id)).toEqual(["in"]);
  });
});

describe("scorecardFor", () => {
  it("counts reps by type", () => {
    const entries = [
      entry({ id: "a1", entryType: "algorithm" }),
      entry({ id: "a2", entryType: "algorithm" }),
      entry({ id: "sd", entryType: "system_design" }),
      entry({ id: "mock", entryType: "mock_interview" }),
    ];

    expect(scorecardFor(entries, "2026-07").countsByType).toEqual({
      algorithm: 2,
      system_design: 1,
      ml_system_design: 0,
      behavioral: 0,
      mock_interview: 1,
      resume_deep_dive: 0,
    });
  });

  it("computes solve rate over judged attempts only", () => {
    const entries = [
      entry({ id: "s1", outcome: "solved" }),
      entry({ id: "s2", outcome: "solved" }),
      entry({ id: "f1", outcome: "failed" }),
      entry({ id: "p1", outcome: "partial" }),
      // Logged but not yet judged: must not drag the rate down.
      entry({ id: "unjudged", outcome: null }),
    ];

    const scorecard = scorecardFor(entries, "2026-07");

    expect(scorecard.attempted).toBe(5);
    expect(scorecard.solved).toBe(2);
    expect(scorecard.solveRate).toBe(0.5);
  });

  // "No data" and "0% solve rate" must render differently — one is a blank slate,
  // the other is a red flag.
  it("returns a null solve rate when nothing has been judged", () => {
    const scorecard = scorecardFor([entry({ id: "a" })], "2026-07");

    expect(scorecard.solveRate).toBeNull();
    expect(scorecard.averageTimeToSolveMin).toBeNull();
  });

  it("averages time-to-solve over entries that recorded one", () => {
    const entries = [
      entry({ id: "a", timeToSolveMin: 20 }),
      entry({ id: "b", timeToSolveMin: 40 }),
      entry({ id: "c", timeToSolveMin: null }),
    ];

    expect(scorecardFor(entries, "2026-07").averageTimeToSolveMin).toBe(30);
  });

  it("ignores other months", () => {
    const entries = [
      entry({ id: "july", outcome: "solved" }),
      entry({ id: "june", date: "2026-06-30", outcome: "failed" }),
    ];

    const scorecard = scorecardFor(entries, "2026-07");

    expect(scorecard.attempted).toBe(1);
    expect(scorecard.solveRate).toBe(1);
  });
});

describe("weakestTopics", () => {
  it("ranks by solve rate, ascending", () => {
    const entries = [
      entry({ id: "g1", topic: "graphs", outcome: "failed" }),
      entry({ id: "g2", topic: "graphs", outcome: "failed" }),
      entry({ id: "d1", topic: "dp", outcome: "failed" }),
      entry({ id: "d2", topic: "dp", outcome: "solved" }),
      entry({ id: "ar1", topic: "arrays", outcome: "solved" }),
    ];

    expect(weakestTopics(entries).map((t) => t.topic)).toEqual([
      "graphs",
      "dp",
      "arrays",
    ]);
  });

  it("breaks ties on volume, so a topic failed often outranks one failed once", () => {
    const entries = [
      entry({ id: "g1", topic: "graphs", outcome: "failed" }),
      entry({ id: "g2", topic: "graphs", outcome: "failed" }),
      entry({ id: "t1", topic: "tries", outcome: "failed" }),
    ];

    expect(weakestTopics(entries).map((t) => t.topic)).toEqual([
      "graphs",
      "tries",
    ]);
  });

  // An untouched topic isn't weak, it's unmeasured — ranking it 0% would send you
  // to study the thing you have no evidence about.
  it("ignores unjudged and untopiced entries", () => {
    const entries = [
      entry({ id: "unjudged", topic: "graphs", outcome: null }),
      entry({ id: "no-topic", topic: null, outcome: "failed" }),
      entry({ id: "judged", topic: "dp", outcome: "failed" }),
    ];

    expect(weakestTopics(entries)).toEqual([
      { topic: "dp", attempted: 1, solved: 0, solveRate: 0 },
    ]);
  });

  it("only ranks algorithm entries", () => {
    const entries = [
      entry({
        id: "mock",
        entryType: "mock_interview",
        topic: "graphs",
        outcome: "needs_work",
      }),
      entry({ id: "algo", topic: "dp", outcome: "failed" }),
    ];

    expect(weakestTopics(entries).map((t) => t.topic)).toEqual(["dp"]);
  });

  it("honours the limit", () => {
    const entries = [
      entry({ id: "a", topic: "a", outcome: "failed" }),
      entry({ id: "b", topic: "b", outcome: "failed" }),
      entry({ id: "c", topic: "c", outcome: "failed" }),
    ];

    expect(weakestTopics(entries, 2)).toHaveLength(2);
  });
});

describe("cumulativeCountsByType", () => {
  it("counts everything on or before throughDate, across months", () => {
    const entries = [
      entry({ id: "jul", entryType: "algorithm", date: "2026-07-08" }),
      entry({ id: "aug", entryType: "algorithm", date: "2026-08-15" }),
      entry({ id: "sep", entryType: "algorithm", date: "2026-09-01" }),
    ];

    expect(cumulativeCountsByType(entries, "2026-08-31").algorithm).toBe(2);
  });

  it("excludes entries after throughDate", () => {
    const entries = [
      entry({ id: "in", entryType: "algorithm", date: "2026-08-31" }),
      entry({ id: "out", entryType: "algorithm", date: "2026-09-01" }),
    ];

    expect(cumulativeCountsByType(entries, "2026-08-31").algorithm).toBe(1);
  });

  it("excludes soft-deleted entries", () => {
    const entries = [
      entry({
        id: "deleted",
        entryType: "algorithm",
        date: "2026-07-08",
        deletedAt: "2026-07-09T00:00:00.000Z",
      }),
    ];

    expect(cumulativeCountsByType(entries, "2026-12-31").algorithm).toBe(0);
  });

  it("buckets by type independently", () => {
    const entries = [
      entry({ id: "a", entryType: "algorithm", date: "2026-07-01" }),
      entry({ id: "b", entryType: "system_design", date: "2026-07-01" }),
      entry({ id: "c", entryType: "mock_interview", date: "2026-07-01" }),
    ];

    const counts = cumulativeCountsByType(entries, "2026-12-31");
    expect(counts.algorithm).toBe(1);
    expect(counts.system_design).toBe(1);
    expect(counts.mock_interview).toBe(1);
    expect(counts.ml_system_design).toBe(0);
    expect(counts.behavioral).toBe(0);
  });
});
