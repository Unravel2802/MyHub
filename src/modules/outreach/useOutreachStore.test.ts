import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutreachEntry } from "@/src/modules/outreach/types";

vi.mock("@/src/modules/outreach/OutreachRepository", () => ({
  getEntries: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));

import * as OutreachRepository from "@/src/modules/outreach/OutreachRepository";
import { useOutreachStore } from "@/src/modules/outreach/useOutreachStore";

const repository = vi.mocked(OutreachRepository);

function entry(
  overrides: Partial<OutreachEntry> & { id: string },
): OutreachEntry {
  return {
    id: overrides.id,
    contactName: overrides.contactName ?? "Alex",
    companyId: overrides.companyId ?? "company-1",
    channel: overrides.channel ?? "linkedin",
    date: overrides.date ?? "2026-07-13",
    notes: overrides.notes ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-13T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-13T00:00:00.000Z",
  };
}

function reset(entries: OutreachEntry[] = []) {
  useOutreachStore.setState({
    entries,
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

describe("useOutreachStore", () => {
  it("fetches entries", async () => {
    const entries = [entry({ id: "one" })];
    repository.getEntries.mockResolvedValue(entries);

    await useOutreachStore.getState().fetchEntries();

    expect(useOutreachStore.getState()).toMatchObject({
      entries,
      isLoading: false,
      error: null,
    });
  });

  it("optimistically creates and rolls back on failure", async () => {
    const existing = entry({ id: "existing" });
    reset([existing]);
    repository.createEntry.mockRejectedValue(new Error("offline"));

    await useOutreachStore.getState().createEntry({
      channel: "email",
      contactName: "Taylor",
    });

    expect(useOutreachStore.getState().entries).toEqual([existing]);
    expect(useOutreachStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
    expect(useOutreachStore.getState().isCreating).toBe(false);
  });

  it("updates and deletes without refetching", async () => {
    const existing = entry({ id: "entry" });
    reset([existing]);
    repository.updateEntry.mockResolvedValue({
      ...existing,
      notes: "Updated note",
    });
    repository.deleteEntry.mockResolvedValue();

    await useOutreachStore.getState().updateEntry("entry", {
      notes: "Updated note",
    });
    await useOutreachStore.getState().deleteEntry("entry");

    expect(repository.getEntries).not.toHaveBeenCalled();
    expect(useOutreachStore.getState().entries).toEqual([]);
  });
});
