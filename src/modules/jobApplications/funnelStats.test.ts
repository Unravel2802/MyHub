import { describe, expect, it } from "vitest";
import { funnelStats } from "@/src/modules/jobApplications/funnelStats";
import type {
  Application,
  Interview,
} from "@/src/modules/jobApplications/types";

function application(
  overrides: Partial<Application> & { id: string },
): Application {
  return {
    companyId: "company-1",
    roleTitle: "Role",
    resumeVariant: "swe_backend",
    stage: "applied",
    appliedDate: "2026-07-01",
    lastUpdateDate: "2026-07-01",
    referralSource: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function interview(overrides: Partial<Interview> & { id: string }): Interview {
  return {
    applicationId: "app-1",
    roundType: "coding",
    scheduledAt: "2026-07-08T15:00:00.000Z",
    completed: false,
    outcome: null,
    postMortemNotes: null,
    completedAt: null,
    postMortemLoggedAt: null,
    deletedAt: null,
    createdAt: "2026-07-08T15:00:00.000Z",
    updatedAt: "2026-07-08T15:00:00.000Z",
    ...overrides,
  };
}

describe("funnelStats rates", () => {
  it("returns null rates, not zero, when nothing has been sent yet", () => {
    const stats = funnelStats(
      [application({ id: "a", stage: "researching" })],
      [],
    );

    expect(stats.pastApplied).toBe(0);
    expect(stats.responseRate).toBeNull();
    expect(stats.interviewRate).toBeNull();
    expect(stats.offerRate).toBeNull();
  });

  it("distinguishes zero responses from no data", () => {
    const stats = funnelStats(
      [
        application({ id: "a", stage: "applied" }),
        application({ id: "b", stage: "applied" }),
      ],
      [],
    );

    expect(stats.pastApplied).toBe(2);
    // Applied to two places, heard nothing: a real, meaningful 0 — not null.
    expect(stats.responseRate).toBe(0);
  });

  it("excludes researching applications from the denominator", () => {
    const stats = funnelStats(
      [
        application({ id: "sent", stage: "oa" }),
        application({ id: "not-sent", stage: "researching" }),
      ],
      [],
    );

    expect(stats.pastApplied).toBe(1);
    expect(stats.responseRate).toBe(1);
  });
});

describe("funnelStats response definition", () => {
  it("counts an application rejected AFTER an interview as a response", () => {
    // The whole point of the two-signal rule: this application's current stage
    // is `rejected`, identical to a cold-ghosted one, but it clearly got a
    // response — someone interviewed you.
    const stats = funnelStats(
      [
        application({ id: "interviewed-then-rejected", stage: "rejected" }),
        application({ id: "ghosted", stage: "applied" }),
      ],
      [interview({ id: "i1", applicationId: "interviewed-then-rejected" })],
    );

    expect(stats.pastApplied).toBe(2);
    expect(stats.responseRate).toBe(0.5);
    expect(stats.interviewRate).toBe(0.5);
  });

  it("counts a current OA/phone_screen/onsite/offer stage as a response", () => {
    const stats = funnelStats(
      [
        application({ id: "oa", stage: "oa" }),
        application({ id: "phone", stage: "phone_screen" }),
        application({ id: "onsite", stage: "onsite" }),
        application({ id: "offer", stage: "offer" }),
      ],
      [],
    );

    expect(stats.responseRate).toBe(1);
  });

  it("does not count an OA alone as having reached an interview", () => {
    const stats = funnelStats([application({ id: "oa", stage: "oa" })], []);

    expect(stats.responseRate).toBe(1);
    expect(stats.interviewRate).toBe(0);
  });

  it("does not count a rejection with no interview as a response", () => {
    const stats = funnelStats(
      [application({ id: "cold-reject", stage: "rejected" })],
      [],
    );

    expect(stats.responseRate).toBe(0);
  });
});

describe("funnelStats counts and soft deletes", () => {
  it("counts applications by stage", () => {
    const stats = funnelStats(
      [
        application({ id: "r", stage: "researching" }),
        application({ id: "a1", stage: "applied" }),
        application({ id: "a2", stage: "applied" }),
        application({ id: "o", stage: "offer" }),
      ],
      [],
    );

    expect(stats.byStage.researching).toBe(1);
    expect(stats.byStage.applied).toBe(2);
    expect(stats.byStage.offer).toBe(1);
    expect(stats.byStage.withdrawn).toBe(0);
    expect(stats.offerRate).toBe(1 / 3);
  });

  it("ignores soft-deleted applications and interviews", () => {
    const stats = funnelStats(
      [
        application({ id: "live", stage: "applied" }),
        application({
          id: "deleted",
          stage: "offer",
          deletedAt: "2026-07-10T00:00:00.000Z",
        }),
      ],
      [
        interview({
          id: "deleted-interview",
          applicationId: "live",
          deletedAt: "2026-07-10T00:00:00.000Z",
        }),
      ],
    );

    expect(stats.pastApplied).toBe(1);
    expect(stats.byStage.offer).toBe(0);
    // The only interview was soft-deleted, so `live` has no response signal.
    expect(stats.interviewRate).toBe(0);
    expect(stats.responseRate).toBe(0);
  });
});
