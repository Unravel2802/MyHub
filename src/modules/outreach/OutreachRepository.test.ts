import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    outreach_log: [],
  };

  class Query {
    private operation: "select" | "insert" | "update" = "select";
    private payload: Row = {};
    private filters: { column: string; value: unknown }[] = [];

    constructor(private table: string) {}

    select() {
      return this;
    }

    order() {
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

    private run() {
      if (this.operation === "insert") {
        const now = "2026-07-13T00:00:00Z";
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

      const matched = tables[this.table].filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      );

      if (this.operation === "update") {
        matched.forEach((row) => Object.assign(row, this.payload));
      }

      return matched;
    }

    single() {
      return Promise.resolve({ data: this.run()[0] ?? null, error: null });
    }

    then(
      resolve: (value: { data: Row[]; error: null }) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve({ data: this.run(), error: null }).then(
        resolve,
        reject,
      );
    }
  }

  return {
    from: (table: string) => new Query(table),
    seed: (table: string, rows: Row[]) =>
      tables[table].push(...rows.map((row) => ({ ...row }))),
    rows: (table: string) => tables[table],
    reset: () => {
      tables.outreach_log = [];
    },
  };
});

vi.mock("@/src/lib/supabaseClient", () => ({ supabase: { from: h.from } }));

import * as OutreachRepository from "@/src/modules/outreach/OutreachRepository";

const stamp = "2026-07-13T00:00:00Z";

function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "outreach-1",
    contact_name: "Alex",
    company_id: "company-1",
    channel: "linkedin",
    date: "2026-07-13",
    notes: "Reached out on LinkedIn",
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  };
}

beforeEach(() => h.reset());

describe("OutreachRepository", () => {
  it("loads active entries", async () => {
    h.seed("outreach_log", [
      entryRow(),
      entryRow({ id: "deleted", deleted_at: stamp }),
    ]);

    await expect(OutreachRepository.getEntries()).resolves.toEqual([
      expect.objectContaining({
        id: "outreach-1",
        contactName: "Alex",
        companyId: "company-1",
      }),
    ]);
  });

  it("creates, updates, and soft-deletes entries", async () => {
    const created = await OutreachRepository.createEntry({
      contactName: "Jamie",
      companyId: null,
      channel: "email",
      notes: "Sent a follow-up",
    });
    const updated = await OutreachRepository.updateEntry(created.id, {
      channel: "alumni_network",
      notes: "Connected through alumni",
    });

    expect(updated).toMatchObject({
      contactName: "Jamie",
      channel: "alumni_network",
      notes: "Connected through alumni",
    });

    await OutreachRepository.deleteEntry(created.id);
    expect(h.rows("outreach_log")[0].deleted_at).toEqual(expect.any(String));
  });
});
