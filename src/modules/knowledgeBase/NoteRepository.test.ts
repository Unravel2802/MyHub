import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    notes: [],
    note_links: [],
  };

  class Query {
    private operation: "select" | "insert" | "update" = "select";
    private payload: Row = {};
    private filters: { column: string; value: unknown }[] = [];
    private orFilter: { column: string; value: string }[] | null = null;

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

    // Mimics Supabase's `.or("a.eq.1,b.eq.2")` string shape closely enough for
    // NoteRepository's one use site (source_note_id.eq.X,target_note_id.eq.X).
    or(expr: string) {
      this.orFilter = expr.split(",").map((clause) => {
        const [column, , value] = clause.split(".");
        return { column, value };
      });
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
        const now = "2026-07-15T00:00:00Z";
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

      let matched = tables[this.table].filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      );

      if (this.orFilter) {
        matched = matched.filter((row) =>
          this.orFilter!.some((clause) => row[clause.column] === clause.value),
        );
      }

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
      tables.notes = [];
      tables.note_links = [];
    },
  };
});

vi.mock("@/src/lib/supabaseClient", () => ({ supabase: { from: h.from } }));

import * as NoteRepository from "@/src/modules/knowledgeBase/NoteRepository";

const stamp = "2026-07-15T00:00:00Z";

function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    title: "Untitled",
    body: "",
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  };
}

beforeEach(() => h.reset());

describe("NoteRepository", () => {
  it("loads active notes", async () => {
    h.seed("notes", [noteRow(), noteRow({ id: "deleted", deleted_at: stamp })]);

    await expect(NoteRepository.getNotes()).resolves.toEqual([
      expect.objectContaining({ id: "note-1", title: "Untitled" }),
    ]);
  });

  it("creates, updates, and soft-deletes notes", async () => {
    const created = await NoteRepository.createNote({ title: "Recursion" });
    const updated = await NoteRepository.updateNote(created.id, {
      body: "Base case + inductive step.",
    });

    expect(updated).toMatchObject({
      title: "Recursion",
      body: "Base case + inductive step.",
    });

    await NoteRepository.deleteNote(created.id);
    expect(h.rows("notes")[0].deleted_at).toEqual(expect.any(String));
  });

  it("rejects a self-link before any Supabase call", async () => {
    await expect(NoteRepository.createLink("note-1", "note-1")).rejects.toThrow(
      NoteRepository.SelfLinkError,
    );
    expect(h.rows("note_links")).toHaveLength(0);
  });

  it("resolves links for a note regardless of which side it's on", async () => {
    h.seed("note_links", [
      {
        id: "link-a",
        source_note_id: "note-1",
        target_note_id: "note-2",
        deleted_at: null,
      },
      {
        id: "link-b",
        source_note_id: "note-3",
        target_note_id: "note-1",
        deleted_at: null,
      },
      {
        id: "link-c",
        source_note_id: "note-2",
        target_note_id: "note-3",
        deleted_at: null,
      },
    ]);

    const links = await NoteRepository.getLinksForNote("note-1");

    expect(links).toHaveLength(2);
    expect(links).toEqual(
      expect.arrayContaining([
        { linkId: "link-a", noteId: "note-2" },
        { linkId: "link-b", noteId: "note-3" },
      ]),
    );
  });
});
