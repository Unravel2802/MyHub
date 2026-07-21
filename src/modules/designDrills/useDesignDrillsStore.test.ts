import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DesignDrill,
  DesignDrillAttempt,
} from "@/src/modules/designDrills/types";

vi.mock("@/src/modules/designDrills/DesignDrillsRepository", () => ({
  getDrills: vi.fn(),
  getAttempts: vi.fn(),
  startAttempt: vi.fn(),
  submitAttempt: vi.fn(),
  saveAttemptNotes: vi.fn(),
  deleteAttempt: vi.fn(),
}));

vi.mock("@/src/lib/events", () => ({ emit: vi.fn() }));

import * as DesignDrillsRepository from "@/src/modules/designDrills/DesignDrillsRepository";
import { emit } from "@/src/lib/events";
import { useDesignDrillsStore } from "@/src/modules/designDrills/useDesignDrillsStore";

const repository = vi.mocked(DesignDrillsRepository);
const emitMock = vi.mocked(emit);

function drill(overrides: Partial<DesignDrill> & { id: string }): DesignDrill {
  return {
    slug: "url-shortener",
    category: "system_design",
    difficulty: "warmup",
    title: "URL Shortener",
    prompt: "Design a URL shortener.",
    rubric: ["Covers key generation"],
    solution: "",
    solutionDetail: null,
    estimatedMinutes: 30,
    tags: [],
    deletedAt: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

function attempt(
  overrides: Partial<DesignDrillAttempt> & { id: string; drillId: string },
): DesignDrillAttempt {
  return {
    startedAt: "2026-07-12T00:00:00.000Z",
    completedAt: null,
    durationSec: null,
    notes: null,
    rubricHits: [],
    selfRating: null,
    deletedAt: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

function reset(
  drills: DesignDrill[] = [],
  attempts: DesignDrillAttempt[] = [],
) {
  useDesignDrillsStore.setState({
    drills,
    attempts,
    isLoading: false,
    error: null,
    isStarting: false,
    pendingIds: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  reset();
});

describe("useDesignDrillsStore", () => {
  it("loads drills and attempts", async () => {
    const drills = [drill({ id: "drill-1" })];
    repository.getDrills.mockResolvedValue(drills);

    await useDesignDrillsStore.getState().fetchDrills();

    expect(useDesignDrillsStore.getState()).toMatchObject({
      drills,
      isLoading: false,
      error: null,
    });
  });

  it("replaces an optimistic attempt with the created one and returns it", async () => {
    const created = attempt({ id: "created", drillId: "drill-1" });
    repository.startAttempt.mockResolvedValue(created);

    const returned = await useDesignDrillsStore
      .getState()
      .startAttempt("drill-1");

    expect(returned).toEqual(created);
    expect(useDesignDrillsStore.getState().attempts).toEqual([created]);
  });

  it("rolls back a failed start and rethrows", async () => {
    repository.startAttempt.mockRejectedValue(new Error("offline"));

    await expect(
      useDesignDrillsStore.getState().startAttempt("drill-1"),
    ).rejects.toThrow("offline");

    expect(useDesignDrillsStore.getState().attempts).toEqual([]);
    expect(useDesignDrillsStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });

  it("submits an attempt and emits drill.completed with the drill's category", async () => {
    reset(
      [drill({ id: "drill-1", category: "ml_system_design" })],
      [attempt({ id: "attempt-1", drillId: "drill-1" })],
    );
    const submitted = attempt({
      id: "attempt-1",
      drillId: "drill-1",
      completedAt: "2026-07-12T00:30:00.000Z",
      durationSec: 1800,
      selfRating: "strong",
      rubricHits: [0],
    });
    repository.submitAttempt.mockResolvedValue(submitted);

    await useDesignDrillsStore.getState().submitAttempt("attempt-1", {
      durationSec: 1800,
      notes: null,
      rubricHits: [0],
      selfRating: "strong",
    });

    expect(useDesignDrillsStore.getState().attempts).toEqual([submitted]);
    expect(emitMock).toHaveBeenCalledWith({
      type: "drill.completed",
      payload: {
        attemptId: "attempt-1",
        drillId: "drill-1",
        category: "ml_system_design",
      },
      timestamp: expect.any(Number),
    });
  });

  it("rolls back a failed submit and does not emit", async () => {
    const existing = attempt({ id: "attempt-1", drillId: "drill-1" });
    reset([drill({ id: "drill-1" })], [existing]);
    repository.submitAttempt.mockRejectedValue(new Error("offline"));

    await useDesignDrillsStore.getState().submitAttempt("attempt-1", {
      durationSec: 900,
      notes: null,
      rubricHits: [],
      selfRating: "weak",
    });

    expect(useDesignDrillsStore.getState().attempts).toEqual([existing]);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("saves notes without rolling back on failure", async () => {
    reset([], [attempt({ id: "attempt-1", drillId: "drill-1" })]);
    repository.saveAttemptNotes.mockRejectedValue(new Error("offline"));

    await useDesignDrillsStore
      .getState()
      .saveAttemptNotes("attempt-1", "in progress notes");

    expect(useDesignDrillsStore.getState().attempts[0].notes).toBe(
      "in progress notes",
    );
    expect(useDesignDrillsStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });

  it("derives attempts for a given drill", () => {
    reset(
      [],
      [
        attempt({ id: "a", drillId: "drill-1" }),
        attempt({ id: "b", drillId: "drill-2" }),
      ],
    );

    expect(useDesignDrillsStore.getState().attemptsForDrill("drill-1")).toEqual(
      [attempt({ id: "a", drillId: "drill-1" })],
    );
  });
});
