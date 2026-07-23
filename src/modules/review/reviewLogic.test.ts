import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  isQuarterBoundaryWeek,
  QUARTERLY_QUESTIONS,
  weekStartKeyOf,
} from "@/src/modules/review/reviewLogic";
import type { Application } from "@/src/modules/jobApplications/types";
import type { PrepEntry } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";

function application(
  overrides: Partial<Application> & { id: string },
): Application {
  return {
    companyId: "company-1",
    roleTitle: "Role",
    resumeVariant: "swe_backend",
    stage: "applied",
    appliedDate: null,
    lastUpdateDate: "2026-07-08",
    referralSource: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-08T12:00:00.000Z",
    updatedAt: "2026-07-08T12:00:00.000Z",
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
    outcome: "solved",
    mockSubtype: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
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

describe("weekStartKeyOf", () => {
  it("returns the Monday of the week, in local wall-clock terms", () => {
    // 2026-07-08 is a Wednesday; its Monday is 2026-07-06.
    expect(weekStartKeyOf(new Date("2026-07-08T09:00:00"))).toBe("2026-07-06");
    // A Monday is its own week start.
    expect(weekStartKeyOf(new Date("2026-07-06T09:00:00"))).toBe("2026-07-06");
    // Sunday belongs to the week that STARTED on Monday, not the next one.
    expect(weekStartKeyOf(new Date("2026-07-12T23:00:00"))).toBe("2026-07-06");
  });
});

describe("isQuarterBoundaryWeek", () => {
  it("flags the week containing the last day of each quarter", () => {
    // 2026-03-31 is a Tuesday → week of Mon 2026-03-30.
    expect(isQuarterBoundaryWeek(new Date("2026-03-30T09:00:00"))).toBe(true);
    // 2026-06-30 is a Tuesday → week of Mon 2026-06-29.
    expect(isQuarterBoundaryWeek(new Date("2026-06-29T09:00:00"))).toBe(true);
    // 2026-09-30 is a Wednesday → week of Mon 2026-09-28.
    expect(isQuarterBoundaryWeek(new Date("2026-09-28T09:00:00"))).toBe(true);
    // 2026-12-31 is a Thursday → week of Mon 2026-12-28.
    expect(isQuarterBoundaryWeek(new Date("2026-12-28T09:00:00"))).toBe(true);
  });

  it("does not flag an ordinary mid-quarter week", () => {
    expect(isQuarterBoundaryWeek(new Date("2026-07-06T09:00:00"))).toBe(false);
    expect(isQuarterBoundaryWeek(new Date("2026-02-09T09:00:00"))).toBe(false);
    expect(isQuarterBoundaryWeek(new Date("2026-11-16T09:00:00"))).toBe(false);
  });

  it("flags the week from any day within it, not just its Monday", () => {
    // Sunday of the Q4 week — same week, same answer.
    expect(isQuarterBoundaryWeek(new Date("2027-01-03T09:00:00"))).toBe(true);
  });

  it("handles a week that straddles the New Year without asking twice", () => {
    // Mon 2026-12-28 .. Sun 2027-01-03 contains 2026-12-31 (end of Q4 2026).
    // It also contains days in 2027 — but Q1 2027 ends in March, so this week
    // closes exactly one quarter and is flagged exactly once.
    const straddling = new Date("2026-12-30T09:00:00");
    expect(isQuarterBoundaryWeek(straddling)).toBe(true);

    // The week immediately after is a plain Q1 week.
    expect(isQuarterBoundaryWeek(new Date("2027-01-05T09:00:00"))).toBe(false);
  });

  it("flags a quarter-end that lands exactly on a Sunday", () => {
    // 2029-09-30 is a Sunday — the last day of its own week (Mon 2029-09-24).
    expect(isQuarterBoundaryWeek(new Date("2029-09-24T09:00:00"))).toBe(true);
  });

  it("flags a quarter-end that lands exactly on a Monday", () => {
    // 2030-09-30 is a Monday — the first day of its week.
    expect(isQuarterBoundaryWeek(new Date("2030-09-30T09:00:00"))).toBe(true);
    // And the week BEFORE it must not be flagged, even though it's adjacent.
    expect(isQuarterBoundaryWeek(new Date("2030-09-23T09:00:00"))).toBe(false);
  });
});

describe("QUARTERLY_QUESTIONS", () => {
  it("carries the five §15 questions verbatim", () => {
    expect(QUARTERLY_QUESTIONS).toHaveLength(5);
    expect(QUARTERLY_QUESTIONS[0]).toBe("Am I becoming more technically rare?");
    expect(QUARTERLY_QUESTIONS[4]).toBe(
      "Is the quant hobby staying a hobby, or quietly eating planned time?",
    );
  });
});

describe("buildSnapshot", () => {
  // Wednesday of the week Mon 2026-07-06 .. Sun 2026-07-12.
  const today = new Date("2026-07-08T09:00:00");

  it("composes the week's cadence, the month's scorecard, and checkpoint progress", () => {
    const snapshot = buildSnapshot(
      [
        application({ id: "a1", createdAt: "2026-07-07T12:00:00.000Z" }),
        application({ id: "a2", createdAt: "2026-07-08T12:00:00.000Z" }),
      ],
      [outreachEntry({ id: "o1", date: "2026-07-07" })],
      [
        prepEntry({ id: "p1", date: "2026-07-07" }),
        prepEntry({
          id: "m1",
          entryType: "mock_interview",
          date: "2026-07-08",
          outcome: "pass",
        }),
      ],
      today,
    );

    expect(snapshot.cadence.applications.count).toBe(2);
    expect(snapshot.cadence.outreach.count).toBe(1);
    expect(snapshot.cadence.mockInterviews.count).toBe(1);

    // Scorecard is the MONTH's, not the week's — a different question.
    expect(snapshot.scorecard.countsByType.algorithm).toBe(1);
    expect(snapshot.scorecard.countsByType.mock_interview).toBe(1);

    // Checkpoint is cumulative toward December.
    expect(snapshot.checkpoint.checkpoint.throughDate).toBe("2026-12-31");
    expect(snapshot.checkpoint.algorithm.actual).toBe(1);
  });

  it("excludes activity outside the week from the cadence but keeps it in the month", () => {
    const snapshot = buildSnapshot(
      [],
      [],
      [
        // Same month, PREVIOUS week — counts toward the monthly scorecard but
        // not this week's cadence.
        prepEntry({
          id: "last-week",
          entryType: "mock_interview",
          date: "2026-07-01",
          outcome: "pass",
        }),
      ],
      today,
    );

    expect(snapshot.cadence.mockInterviews.count).toBe(0);
    expect(snapshot.scorecard.countsByType.mock_interview).toBe(1);
  });
});
