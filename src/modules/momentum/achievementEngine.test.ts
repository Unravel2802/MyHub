import { describe, expect, it } from "vitest";
import {
  evaluateAchievements,
  newUnlocks,
} from "@/src/modules/momentum/achievementEngine";
import type { AchievementSnapshot } from "@/src/modules/momentum/achievementEngine";
import { ACHIEVEMENTS } from "@/src/modules/momentum/achievementCatalog";
import type { Task } from "@/src/modules/task/types";
import type {
  Application,
  Interview,
} from "@/src/modules/jobApplications/types";
import type { BehavioralStory, PrepEntry } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";

// A Monday. Weeks run Monday-Sunday, so "last week" is 2026-07-06..2026-07-12.
const TODAY = new Date("2026-07-13T09:00:00");

function snapshot(
  overrides: Partial<AchievementSnapshot> = {},
): AchievementSnapshot {
  return {
    tasks: [],
    prepEntries: [],
    behavioralStories: [],
    applications: [],
    interviews: [],
    outreachEntries: [],
    today: TODAY,
    ...overrides,
  };
}

function prepEntries(
  entryType: PrepEntry["entryType"],
  count: number,
  date = "2026-07-10",
): PrepEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${entryType}-${i}`,
    entryType,
    topic: null,
    date,
    durationMin: null,
    timeToSolveMin: null,
    outcome: null,
    mockSubtype: null,
    notes: null,
    deletedAt: null,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  }));
}

function applications(count: number, createdAt = "2026-07-08"): Application[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `app-${i}`,
    companyId: "company-1",
    roleTitle: "Role",
    resumeVariant: "swe_backend" as const,
    stage: "applied" as const,
    appliedDate: null,
    lastUpdateDate: createdAt,
    referralSource: null,
    followUpDate: null,
    notes: null,
    deletedAt: null,
    createdAt: `${createdAt}T12:00:00.000Z`,
    updatedAt: `${createdAt}T12:00:00.000Z`,
  }));
}

function outreachEntries(count: number, date = "2026-07-08"): OutreachEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `outreach-${i}`,
    contactName: null,
    companyId: null,
    channel: "linkedin" as const,
    date,
    notes: null,
    deletedAt: null,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  }));
}

function story(overrides: Partial<BehavioralStory> & { id: string }) {
  return {
    title: overrides.id,
    theme: null,
    conciseVersion: "concise",
    extendedVersion: "extended",
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } satisfies BehavioralStory;
}

function interview(overrides: Partial<Interview> & { id: string }): Interview {
  return {
    applicationId: "app-1",
    roundType: "coding",
    scheduledAt: "2026-07-08T15:00:00.000Z",
    completed: true,
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

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    description: null,
    status: "todo",
    position: 0,
    dueDate: null,
    parentTaskId: null,
    recursWeekly: false,
    weekday: null,
    recurrenceTemplateId: null,
    occurrenceDate: null,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("achievement catalog integrity", () => {
  it("has no duplicate keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("cites a roadmap source for every achievement — no invented numbers", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.source.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("threshold boundaries", () => {
  it("does not award at N-1 and does award at N", () => {
    const at49 = evaluateAchievements(
      snapshot({ prepEntries: prepEntries("algorithm", 49) }),
    );
    expect(at49).toContain("algorithms_10");
    expect(at49).not.toContain("algorithms_50");

    const at50 = evaluateAchievements(
      snapshot({ prepEntries: prepEntries("algorithm", 50) }),
    );
    expect(at50).toContain("algorithms_50");
    expect(at50).not.toContain("algorithms_75");
  });

  it("awards every algorithm tier once the top threshold is passed", () => {
    const earned = evaluateAchievements(
      snapshot({ prepEntries: prepEntries("algorithm", 150) }),
    );

    expect(earned).toEqual(
      expect.arrayContaining([
        "algorithms_10",
        "algorithms_50",
        "algorithms_75",
        "algorithms_100",
        "algorithms_150",
      ]),
    );
  });

  it("counts mocks with no subtype toward mocks_14", () => {
    // Legacy rows predating migration 0008 have mockSubtype null. They were
    // still mocks — dropping them would silently move the goalposts.
    const mocks = prepEntries("mock_interview", 14).map((entry) => ({
      ...entry,
      mockSubtype: null,
    }));

    const earned = evaluateAchievements(snapshot({ prepEntries: mocks }));

    expect(earned).toContain("first_mock");
    expect(earned).toContain("mocks_14");
  });

  it("only counts behavioral stories that have both versions written", () => {
    const stories = [
      ...Array.from({ length: 7 }, (_, i) => story({ id: `full-${i}` })),
      story({ id: "stub", conciseVersion: null, extendedVersion: null }),
    ];

    expect(
      evaluateAchievements(snapshot({ behavioralStories: stories })),
    ).not.toContain("behavioral_stories_8");

    expect(
      evaluateAchievements(
        snapshot({
          behavioralStories: [...stories, story({ id: "eighth" })],
        }),
      ),
    ).toContain("behavioral_stories_8");
  });
});

describe("post_mortem_24h", () => {
  it("awards a post-mortem logged within 24h of the interview", () => {
    const earned = evaluateAchievements(
      snapshot({
        interviews: [
          interview({
            id: "i1",
            scheduledAt: "2026-07-08T15:00:00.000Z",
            postMortemLoggedAt: "2026-07-09T10:00:00.000Z", // 19h later
          }),
        ],
      }),
    );

    expect(earned).toContain("post_mortem_24h");
  });

  it("does not award one logged more than 24h later", () => {
    const earned = evaluateAchievements(
      snapshot({
        interviews: [
          interview({
            id: "i1",
            scheduledAt: "2026-07-08T15:00:00.000Z",
            postMortemLoggedAt: "2026-07-10T15:00:00.000Z", // 48h later
          }),
        ],
      }),
    );

    expect(earned).toContain("first_interview");
    expect(earned).not.toContain("post_mortem_24h");
  });

  it("measures from the interview, not from when it was marked complete", () => {
    // completedAt is deliberately days late — the clock still starts at
    // scheduledAt, so this post-mortem is 1h after the interview and qualifies.
    const earned = evaluateAchievements(
      snapshot({
        interviews: [
          interview({
            id: "i1",
            scheduledAt: "2026-07-08T15:00:00.000Z",
            completedAt: "2026-07-12T09:00:00.000Z",
            postMortemLoggedAt: "2026-07-08T16:00:00.000Z",
          }),
        ],
      }),
    );

    expect(earned).toContain("post_mortem_24h");
  });
});

describe("perfect_cadence_week", () => {
  // Last week: Mon 2026-07-06 .. Sun 2026-07-12. Today is Mon 2026-07-13.
  const lastWeek = {
    applications: applications(5, "2026-07-08"),
    outreachEntries: outreachEntries(2, "2026-07-08"),
    prepEntries: prepEntries("mock_interview", 1, "2026-07-08"),
  };

  it("awards a completed week that hit all three targets", () => {
    expect(evaluateAchievements(snapshot(lastWeek))).toContain(
      "perfect_cadence_week",
    );
  });

  it("does not award a week that missed any one target", () => {
    expect(
      evaluateAchievements(
        snapshot({ ...lastWeek, outreachEntries: outreachEntries(1, "2026-07-08") }),
      ),
    ).not.toContain("perfect_cadence_week");

    expect(
      evaluateAchievements(
        snapshot({ ...lastWeek, applications: applications(4, "2026-07-08") }),
      ),
    ).not.toContain("perfect_cadence_week");

    expect(
      evaluateAchievements(
        snapshot({
          ...lastWeek,
          prepEntries: prepEntries("mock_interview", 0, "2026-07-08"),
        }),
      ),
    ).not.toContain("perfect_cadence_week");
  });

  it("ignores the current, still-accumulating week", () => {
    // Same qualifying numbers, but dated TODAY (in the current week). The week
    // isn't over, so it can't be perfect yet — awarding it now would mean
    // awarding a result that isn't final.
    const thisWeek = {
      applications: applications(5, "2026-07-13"),
      outreachEntries: outreachEntries(2, "2026-07-13"),
      prepEntries: prepEntries("mock_interview", 1, "2026-07-13"),
    };

    expect(evaluateAchievements(snapshot(thisWeek))).not.toContain(
      "perfect_cadence_week",
    );
  });
});

describe("gate_complete", () => {
  it("awards a gate whose subtasks are all done", () => {
    const earned = evaluateAchievements(
      snapshot({
        tasks: [
          task({ id: "gate", title: "Gate: July 2026", status: "done" }),
          task({ id: "s1", parentTaskId: "gate", status: "done" }),
          task({ id: "s2", parentTaskId: "gate", status: "done" }),
        ],
      }),
    );

    expect(earned).toContain("gate_complete");
  });

  it("does not award a gate with an outstanding subtask", () => {
    const earned = evaluateAchievements(
      snapshot({
        tasks: [
          task({ id: "gate", title: "Gate: July 2026" }),
          task({ id: "s1", parentTaskId: "gate", status: "done" }),
          task({ id: "s2", parentTaskId: "gate", status: "todo" }),
        ],
      }),
    );

    expect(earned).not.toContain("gate_complete");
  });

  it("does not award an empty gate task, even if it is marked done", () => {
    // An empty checklist isn't an achievement.
    const earned = evaluateAchievements(
      snapshot({
        tasks: [task({ id: "gate", title: "Gate: July 2026", status: "done" })],
      }),
    );

    expect(earned).not.toContain("gate_complete");
  });

  it("ignores an ordinary task that merely mentions a gate", () => {
    const earned = evaluateAchievements(
      snapshot({
        tasks: [
          task({ id: "t", title: "Think about the gate", status: "done" }),
          task({ id: "s", parentTaskId: "t", status: "done" }),
        ],
      }),
    );

    expect(earned).not.toContain("gate_complete");
  });
});

describe("newUnlocks", () => {
  it("returns only achievements not already persisted", () => {
    const earned = ["first_prep_entry", "algorithms_10"] as const;

    expect(newUnlocks([...earned], new Set(["first_prep_entry"]))).toEqual([
      "algorithms_10",
    ]);
  });

  it("returns nothing when everything earned is already persisted — no re-emission", () => {
    const earned = ["first_prep_entry", "algorithms_10"] as const;

    expect(
      newUnlocks([...earned], new Set(["first_prep_entry", "algorithms_10"])),
    ).toEqual([]);
  });
});
