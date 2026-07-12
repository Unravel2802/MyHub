import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    prep_entries: [],
    behavioral_stories: [],
  };

  class FakeQuery {
    private operation: "select" | "insert" | "update" = "select";
    private payload: Row | null = null;
    private filters: { column: string; value: unknown }[] = [];

    constructor(private table: string) {}

    select() {
      return this;
    }

    insert(payload: Row) {
      this.operation = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: Row) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    order() {
      return this;
    }

    private run() {
      if (this.operation === "insert") {
        const now = "2026-07-12T00:00:00.000Z";
        const row = {
          id: crypto.randomUUID(),
          deleted_at: null,
          created_at: now,
          updated_at: now,
          ...this.payload,
        };
        tables[this.table].push(row);
        return [row];
      }

      const matches = tables[this.table].filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      );
      if (this.operation === "update") {
        for (const row of matches) Object.assign(row, this.payload);
      }
      return matches;
    }

    single() {
      return Promise.resolve({ data: this.run()[0] ?? null, error: null });
    }

    then(
      resolve: (result: { data: Row[]; error: null }) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve({ data: this.run(), error: null }).then(
        resolve,
        reject,
      );
    }
  }

  return {
    from: (table: string) => new FakeQuery(table),
    seed: (table: string, rows: Row[]) =>
      tables[table].push(...rows.map((row) => ({ ...row }))),
    rows: (table: string) => tables[table],
    reset: () => {
      tables.prep_entries = [];
      tables.behavioral_stories = [];
    },
  };
});

vi.mock("@/src/lib/supabaseClient", () => ({ supabase: { from: h.from } }));

import * as PrepRepository from "@/src/modules/prep/PrepRepository";

const timestamp = "2026-07-12T00:00:00.000Z";

function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    entry_type: "algorithm",
    topic: "graphs",
    date: "2026-07-12",
    duration_min: 45,
    time_to_solve_min: 30,
    outcome: "solved",
    notes: "Used BFS",
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function storyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "story-1",
    title: "Led a migration",
    theme: "Leadership",
    concise_version: "Short",
    extended_version: "Long",
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

beforeEach(() => h.reset());

describe("PrepRepository entries", () => {
  it("loads and maps active entries", async () => {
    h.seed("prep_entries", [
      entryRow(),
      entryRow({ id: "deleted", deleted_at: timestamp }),
    ]);

    await expect(PrepRepository.getEntries()).resolves.toEqual([
      expect.objectContaining({
        id: "entry-1",
        entryType: "algorithm",
        durationMin: 45,
        timeToSolveMin: 30,
      }),
    ]);
  });

  it("creates and updates an entry using database column names", async () => {
    const created = await PrepRepository.createEntry({
      entryType: "algorithm",
      topic: "dp",
      date: "2026-07-11",
      timeToSolveMin: 25,
      outcome: "partial",
    });

    expect(created).toMatchObject({ topic: "dp", timeToSolveMin: 25 });

    const updated = await PrepRepository.updateEntry(created.id, {
      outcome: "solved",
      notes: "Found the recurrence",
    });
    expect(updated).toMatchObject({
      outcome: "solved",
      notes: "Found the recurrence",
    });
  });

  it("soft-deletes entries", async () => {
    h.seed("prep_entries", [entryRow()]);

    await PrepRepository.deleteEntry("entry-1");

    expect(h.rows("prep_entries")[0].deleted_at).toEqual(expect.any(String));
  });
});

describe("PrepRepository stories", () => {
  it("creates and updates behavioral stories", async () => {
    const created = await PrepRepository.createStory({
      title: "Resolved a conflict",
      theme: "Collaboration",
      conciseVersion: "Short answer",
    });
    const updated = await PrepRepository.updateStory(created.id, {
      extendedVersion: "Full STAR answer",
    });

    expect(updated).toMatchObject({
      title: "Resolved a conflict",
      extendedVersion: "Full STAR answer",
    });
  });

  it("loads active stories and soft-deletes them", async () => {
    h.seed("behavioral_stories", [storyRow()]);

    await expect(PrepRepository.getStories()).resolves.toHaveLength(1);
    await PrepRepository.deleteStory("story-1");

    expect(h.rows("behavioral_stories")[0].deleted_at).toEqual(
      expect.any(String),
    );
  });
});
