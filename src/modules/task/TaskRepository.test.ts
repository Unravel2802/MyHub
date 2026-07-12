import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory fake of the Supabase query builder. Only implements the chain
// methods TaskRepository actually uses, executed against a shared row store so
// the recursive cascade logic runs for real.
const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: { rows: Row[] } = { rows: [] };

  const matches = (
    row: Row,
    filters: { type: string; col: string; val: unknown }[],
  ) =>
    filters.every((f) => {
      if (f.type === "in") return (f.val as unknown[]).includes(row[f.col]);
      return row[f.col] === f.val; // eq + is(null)
    });

  class FakeQuery {
    private op: "select" | "insert" | "update" = "select";
    private payload: Row | Row[] | null = null;
    private filters: { type: string; col: string; val: unknown }[] = [];

    select() {
      return this;
    }
    order() {
      return this;
    }
    insert(payload: Row | Row[]) {
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    update(payload: Row) {
      this.op = "update";
      this.payload = payload;
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push({ type: "eq", col, val });
      return this;
    }
    in(col: string, val: unknown) {
      this.filters.push({ type: "in", col, val });
      return this;
    }
    is(col: string, val: unknown) {
      this.filters.push({ type: "is", col, val });
      return this;
    }

    private run(): Row[] {
      if (this.op === "insert") {
        const now = new Date().toISOString();
        const payloads = Array.isArray(this.payload)
          ? this.payload
          : [this.payload!];
        const inserted = payloads.map((p) => ({
          id: p.id ?? crypto.randomUUID(),
          title: p.title ?? null,
          status: p.status ?? "inbox",
          position: p.position ?? 0,
          due_date: p.due_date ?? null,
          parent_task_id: p.parent_task_id ?? null,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        }));
        store.rows.push(...inserted);
        return inserted;
      }

      const matched = store.rows.filter((r) => matches(r, this.filters));
      if (this.op === "update") {
        const patch = this.payload as Row;
        matched.forEach((r) =>
          Object.assign(r, patch, { updated_at: new Date().toISOString() }),
        );
      }
      return matched;
    }

    single() {
      const rows = this.run();
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }
    then(
      resolve: (v: { data: Row[]; error: null }) => unknown,
      reject?: (e: unknown) => unknown,
    ) {
      return Promise.resolve({ data: this.run(), error: null }).then(
        resolve,
        reject,
      );
    }
  }

  return {
    store,
    from: () => new FakeQuery(),
    seed: (rows: Row[]) => store.rows.push(...rows.map((r) => ({ ...r }))),
    reset: () => {
      store.rows = [];
    },
  };
});

vi.mock("@/src/lib/supabaseClient", () => ({ supabase: { from: h.from } }));

import * as TaskRepository from "@/src/modules/task/TaskRepository";
import { MaxDepthError } from "@/src/modules/task/TaskRepository";
import type { TaskStatus } from "@/src/modules/task/types";

type SeedTask = {
  id: string;
  status?: TaskStatus;
  parent_task_id?: string | null;
  deleted_at?: string | null;
  position?: number;
};

function task(o: SeedTask) {
  return {
    id: o.id,
    title: o.id,
    status: o.status ?? "inbox",
    position: o.position ?? 0,
    due_date: null,
    parent_task_id: o.parent_task_id ?? null,
    deleted_at: o.deleted_at ?? null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const statusOf = (id: string) => h.store.rows.find((r) => r.id === id)?.status;
const deletedAtOf = (id: string) =>
  h.store.rows.find((r) => r.id === id)?.deleted_at;

beforeEach(() => h.reset());

describe("deleteTask soft-delete cascade", () => {
  it("recursively soft-deletes the whole descendant chain", async () => {
    h.seed([
      task({ id: "root" }),
      task({ id: "child", parent_task_id: "root" }),
      task({ id: "grandchild", parent_task_id: "child" }),
    ]);

    await TaskRepository.deleteTask("root");

    expect(deletedAtOf("root")).not.toBeNull();
    expect(deletedAtOf("child")).not.toBeNull();
    expect(deletedAtOf("grandchild")).not.toBeNull();
  });

  it("does not touch tasks outside the deleted subtree", async () => {
    h.seed([
      task({ id: "root" }),
      task({ id: "child", parent_task_id: "root" }),
      task({ id: "unrelated" }),
    ]);

    await TaskRepository.deleteTask("root");

    expect(deletedAtOf("unrelated")).toBeNull();
  });
});

describe("updateTaskStatus auto-complete", () => {
  it("auto-completes a parent once all its children are done", async () => {
    h.seed([
      task({ id: "root" }),
      task({ id: "a", parent_task_id: "root", status: "done" }),
      task({ id: "b", parent_task_id: "root" }),
    ]);

    await TaskRepository.updateTaskStatus("b", "done");

    expect(statusOf("root")).toBe("done");
  });

  it("cascades completion up multiple levels", async () => {
    h.seed([
      task({ id: "grandparent" }),
      task({ id: "parent", parent_task_id: "grandparent" }),
      task({ id: "child", parent_task_id: "parent" }),
    ]);

    await TaskRepository.updateTaskStatus("child", "done");

    expect(statusOf("parent")).toBe("done");
    expect(statusOf("grandparent")).toBe("done");
  });

  it("recursively completes descendants when a level 2 task is completed", async () => {
    h.seed([
      task({ id: "root" }),
      task({ id: "parent", parent_task_id: "root" }),
      task({ id: "child", parent_task_id: "parent" }),
    ]);

    await TaskRepository.updateTaskStatus("parent", "done");

    expect(statusOf("parent")).toBe("done");
    expect(statusOf("child")).toBe("done");
    expect(statusOf("root")).toBe("done");
  });

  it("does not complete a parent while a sibling is unfinished", async () => {
    h.seed([
      task({ id: "root" }),
      task({ id: "a", parent_task_id: "root", status: "todo" }),
      task({ id: "b", parent_task_id: "root" }),
    ]);

    await TaskRepository.updateTaskStatus("b", "done");

    expect(statusOf("root")).toBe("inbox");
  });
});

describe("updateTaskStatus revert-to-incomplete", () => {
  it("reverts done ancestors but stops at the first non-done ancestor", async () => {
    h.seed([
      task({ id: "grandparent", status: "in_progress" }),
      task({ id: "parent", parent_task_id: "grandparent", status: "done" }),
      task({ id: "child", parent_task_id: "parent", status: "done" }),
    ]);

    await TaskRepository.updateTaskStatus("child", "todo");

    expect(statusOf("parent")).toBe("todo");
    expect(statusOf("grandparent")).toBe("in_progress");
  });
});

describe("createTask", () => {
  it("reverts a completed parent to incomplete when a new subtask is added", async () => {
    h.seed([task({ id: "parent", status: "done" })]);

    await TaskRepository.createTask({
      title: "new subtask",
      parentTaskId: "parent",
    });

    expect(statusOf("parent")).toBe("todo");
  });

  it("allows a subtask at the deepest permitted level (level 3)", async () => {
    // root(1) -> child(2); adding under child creates level 3, which is allowed.
    h.seed([
      task({ id: "root" }),
      task({ id: "child", parent_task_id: "root" }),
    ]);

    await expect(
      TaskRepository.createTask({ title: "grandchild", parentTaskId: "child" }),
    ).resolves.toBeDefined();

    expect(h.store.rows.some((r) => r.parent_task_id === "child")).toBe(true);
  });

  it("rejects a subtask that would exceed the max depth (level 4)", async () => {
    // root(1) -> child(2) -> grandchild(3); adding under grandchild is level 4.
    h.seed([
      task({ id: "root" }),
      task({ id: "child", parent_task_id: "root" }),
      task({ id: "grandchild", parent_task_id: "child" }),
    ]);

    const before = h.store.rows.length;
    await expect(
      TaskRepository.createTask({
        title: "too deep",
        parentTaskId: "grandchild",
      }),
    ).rejects.toBeInstanceOf(MaxDepthError);

    // Nothing was inserted.
    expect(h.store.rows.length).toBe(before);
  });

  it("appends new tasks to the end of the inbox column", async () => {
    h.seed([task({ id: "a", position: 0 }), task({ id: "b", position: 1 })]);

    const created = await TaskRepository.createTask({ title: "c" });

    expect(created.position).toBe(2);
  });
});

const positionOf = (id: string) =>
  h.store.rows.find((r) => r.id === id)?.position;

describe("moveTask", () => {
  it("repositions within a column without changing status", async () => {
    h.seed([
      task({ id: "a", status: "todo", position: 0 }),
      task({ id: "b", status: "todo", position: 1 }),
    ]);

    await TaskRepository.moveTask("a", { position: 1.5 });

    expect(positionOf("a")).toBe(1.5);
    expect(statusOf("a")).toBe("todo");
  });

  it("auto-completes the parent when a cross-column move finishes the last child", async () => {
    h.seed([
      task({ id: "root" }),
      task({ id: "child", parent_task_id: "root" }),
    ]);

    await TaskRepository.moveTask("child", { status: "done", position: 0 });

    expect(statusOf("child")).toBe("done");
    expect(statusOf("root")).toBe("done");
  });

  it("recursively completes descendants when a level 2 task is moved to done", async () => {
    h.seed([
      task({ id: "root" }),
      task({ id: "parent", parent_task_id: "root" }),
      task({ id: "child", parent_task_id: "parent" }),
    ]);

    await TaskRepository.moveTask("parent", { status: "done", position: 0 });

    expect(statusOf("parent")).toBe("done");
    expect(statusOf("child")).toBe("done");
    expect(statusOf("root")).toBe("done");
  });

  it("reverts a done parent when a child is moved out of done", async () => {
    h.seed([
      task({ id: "root", status: "done" }),
      task({ id: "child", parent_task_id: "root", status: "done" }),
    ]);

    await TaskRepository.moveTask("child", { status: "todo", position: 0 });

    expect(statusOf("child")).toBe("todo");
    expect(statusOf("root")).toBe("todo");
  });
});
