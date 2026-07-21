import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    design_drills: [],
    design_drill_attempts: [],
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
          started_at: now,
          completed_at: null,
          duration_sec: null,
          notes: null,
          rubric_hits: [],
          self_rating: null,
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
      tables.design_drills = [];
      tables.design_drill_attempts = [];
    },
  };
});

vi.mock("@/src/lib/supabaseClient", () => ({ supabase: { from: h.from } }));

import * as DesignDrillsRepository from "@/src/modules/designDrills/DesignDrillsRepository";

const timestamp = "2026-07-12T00:00:00.000Z";

function drillRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "drill-1",
    slug: "url-shortener",
    category: "system_design",
    difficulty: "warmup",
    title: "URL Shortener",
    prompt: "Design a URL shortener.",
    rubric: ["Covers key generation", "Covers caching"],
    solution: "Use Base62 IDs and cache hot redirects.",
    estimated_minutes: 30,
    tags: ["hashing"],
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function attemptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt-1",
    drill_id: "drill-1",
    started_at: timestamp,
    completed_at: null,
    duration_sec: null,
    notes: null,
    rubric_hits: [],
    self_rating: null,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

beforeEach(() => h.reset());

describe("DesignDrillsRepository drills", () => {
  it("loads active drills", async () => {
    h.seed("design_drills", [
      drillRow(),
      drillRow({ id: "deleted", deleted_at: timestamp }),
    ]);

    await expect(DesignDrillsRepository.getDrills()).resolves.toEqual([
      expect.objectContaining({
        id: "drill-1",
        category: "system_design",
        rubric: ["Covers key generation", "Covers caching"],
        solution: "Use Base62 IDs and cache hot redirects.",
      }),
    ]);
  });
});

describe("DesignDrillsRepository attempts", () => {
  it("starts an in-progress attempt", async () => {
    const attempt = await DesignDrillsRepository.startAttempt("drill-1");

    expect(attempt).toMatchObject({
      drillId: "drill-1",
      completedAt: null,
      durationSec: null,
      selfRating: null,
    });
  });

  it("submits an attempt with duration, notes, rubric hits, and rating", async () => {
    h.seed("design_drill_attempts", [attemptRow()]);

    const submitted = await DesignDrillsRepository.submitAttempt("attempt-1", {
      durationSec: 1800,
      notes: "Used a hybrid fan-out.",
      rubricHits: [0, 1],
      selfRating: "solid",
    });

    expect(submitted).toMatchObject({
      durationSec: 1800,
      notes: "Used a hybrid fan-out.",
      rubricHits: [0, 1],
      selfRating: "solid",
    });
    expect(submitted.completedAt).toEqual(expect.any(String));
  });

  it("saves scratchpad notes on an in-progress attempt", async () => {
    h.seed("design_drill_attempts", [attemptRow()]);

    const updated = await DesignDrillsRepository.saveAttemptNotes(
      "attempt-1",
      "Requirements gathered.",
    );

    expect(updated.notes).toBe("Requirements gathered.");
    expect(updated.completedAt).toBeNull();
  });

  it("loads active attempts and soft-deletes them", async () => {
    h.seed("design_drill_attempts", [attemptRow()]);

    await expect(DesignDrillsRepository.getAttempts()).resolves.toHaveLength(1);
    await DesignDrillsRepository.deleteAttempt("attempt-1");

    expect(h.rows("design_drill_attempts")[0].deleted_at).toEqual(
      expect.any(String),
    );
  });
});
