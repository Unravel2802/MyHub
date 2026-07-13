import { describe, expect, it } from "vitest";
import { postMortemLoggedAtFor } from "@/src/modules/jobApplications/interviewTimestamps";
import type { Interview } from "@/src/modules/jobApplications/types";

const NOW = "2026-07-13T10:00:00.000Z";

function interview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: "interview",
    applicationId: "app-1",
    roundType: "coding",
    scheduledAt: "2026-07-08T15:00:00.000Z",
    completed: true,
    outcome: null,
    postMortemNotes: null,
    completedAt: "2026-07-08T16:00:00.000Z",
    postMortemLoggedAt: null,
    deletedAt: null,
    createdAt: "2026-07-08T15:00:00.000Z",
    updatedAt: "2026-07-08T15:00:00.000Z",
    ...overrides,
  };
}

describe("postMortemLoggedAtFor", () => {
  it("stamps the first time notes go empty -> non-empty", () => {
    expect(postMortemLoggedAtFor(interview(), "Bombed the DP question", NOW))
      .toBe(NOW);
  });

  it("never overwrites an existing timestamp on a later edit", () => {
    const current = interview({
      postMortemNotes: "First draft",
      postMortemLoggedAt: "2026-07-08T17:00:00.000Z",
    });

    // A typo fix days later must not move the timestamp — the 24h achievement
    // measures when you FIRST wrote the post-mortem.
    expect(postMortemLoggedAtFor(current, "First draft, fixed", NOW)).toBeUndefined();
  });

  it("does not re-stamp when notes are cleared and rewritten", () => {
    const current = interview({
      postMortemNotes: null,
      postMortemLoggedAt: "2026-07-08T17:00:00.000Z",
    });

    expect(postMortemLoggedAtFor(current, "Rewritten", NOW)).toBeUndefined();
  });

  it("leaves the column alone when the update does not touch notes", () => {
    expect(postMortemLoggedAtFor(interview(), undefined, NOW)).toBeUndefined();
  });

  it("does not stamp for empty or whitespace-only notes", () => {
    expect(postMortemLoggedAtFor(interview(), "", NOW)).toBeUndefined();
    expect(postMortemLoggedAtFor(interview(), "   ", NOW)).toBeUndefined();
    expect(postMortemLoggedAtFor(interview(), null, NOW)).toBeUndefined();
  });
});
