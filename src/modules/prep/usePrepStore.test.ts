import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BehavioralStory, PrepEntry } from "@/src/modules/prep/types";

vi.mock("@/src/modules/prep/PrepRepository", () => ({
  getEntries: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  getStories: vi.fn(),
  createStory: vi.fn(),
  updateStory: vi.fn(),
  deleteStory: vi.fn(),
}));

vi.mock("@/src/lib/events", () => ({ emit: vi.fn() }));

import * as PrepRepository from "@/src/modules/prep/PrepRepository";
import { emit } from "@/src/lib/events";
import { usePrepStore } from "@/src/modules/prep/usePrepStore";

const repository = vi.mocked(PrepRepository);
const emitMock = vi.mocked(emit);

function entry(overrides: Partial<PrepEntry> & { id: string }): PrepEntry {
  return {
    entryType: "algorithm",
    topic: "graphs",
    date: "2026-07-12",
    durationMin: null,
    timeToSolveMin: null,
    outcome: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

function story(
  overrides: Partial<BehavioralStory> & { id: string },
): BehavioralStory {
  return {
    title: "Story",
    theme: null,
    conciseVersion: null,
    extendedVersion: null,
    deletedAt: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

function reset(entries: PrepEntry[] = [], stories: BehavioralStory[] = []) {
  usePrepStore.setState({
    entries,
    stories,
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  reset();
});

describe("usePrepStore entries", () => {
  it("loads entries", async () => {
    const entries = [entry({ id: "entry" })];
    repository.getEntries.mockResolvedValue(entries);

    await usePrepStore.getState().fetchEntries();

    expect(usePrepStore.getState()).toMatchObject({
      entries,
      isLoading: false,
      error: null,
    });
  });

  it("replaces an optimistic entry and emits prep.logged", async () => {
    const created = entry({ id: "created", outcome: "solved" });
    repository.createEntry.mockResolvedValue(created);

    await usePrepStore.getState().createEntry({
      entryType: "algorithm",
      topic: "graphs",
      outcome: "solved",
    });

    expect(usePrepStore.getState().entries).toEqual([created]);
    expect(emitMock).toHaveBeenCalledWith({
      type: "prep.logged",
      payload: { entryId: "created", prepType: "algorithm" },
      timestamp: expect.any(Number),
    });
  });

  it("rolls back a failed create", async () => {
    const existing = entry({ id: "existing" });
    reset([existing]);
    repository.createEntry.mockRejectedValue(new Error("offline"));

    await usePrepStore.getState().createEntry({ entryType: "algorithm" });

    expect(usePrepStore.getState().entries).toEqual([existing]);
    expect(usePrepStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rolls back a failed delete", async () => {
    const existing = entry({ id: "existing" });
    reset([existing]);
    repository.deleteEntry.mockRejectedValue(new Error("offline"));

    await usePrepStore.getState().deleteEntry("existing");

    expect(usePrepStore.getState().entries).toEqual([existing]);
    expect(usePrepStore.getState().pendingIds).toEqual([]);
  });

  it("derives scorecards and weakest topics from entries", () => {
    reset([
      entry({ id: "failed", topic: "graphs", outcome: "failed" }),
      entry({ id: "solved", topic: "arrays", outcome: "solved" }),
    ]);

    expect(usePrepStore.getState().scorecard("2026-07")).toMatchObject({
      attempted: 2,
      solved: 1,
      solveRate: 0.5,
    });
    expect(usePrepStore.getState().weakestTopics(1, "2026-07")[0].topic).toBe(
      "graphs",
    );
  });
});

describe("usePrepStore stories", () => {
  it("creates and updates stories", async () => {
    const created = story({ id: "created", title: "Leadership" });
    const updated = { ...created, conciseVersion: "Concise" };
    repository.createStory.mockResolvedValue(created);
    repository.updateStory.mockResolvedValue(updated);

    await usePrepStore.getState().createStory({ title: "Leadership" });
    await usePrepStore
      .getState()
      .updateStory("created", { conciseVersion: "Concise" });

    expect(usePrepStore.getState().stories).toEqual([updated]);
  });
});
