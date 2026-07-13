import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory fake of the Supabase query builder. Only implements the chain
// methods TaskRepository actually uses, executed against a shared row store so
// the recursive cascade logic runs for real.
const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: { rows: Row[]; uniqueViolationOnce: boolean } = {
    rows: [],
    uniqueViolationOnce: false,
  };

  const matches = (
    row: Row,
    filters: { type: string; col: string; val: unknown }[],
  ) =>
    filters.every((f) => {
      if (f.type === "in") return (f.val as unknown[]).includes(row[f.col]);
      if (f.type === "neq") return row[f.col] !== f.val;
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
    neq(col: string, val: unknown) {
      this.filters.push({ type: "neq", col, val });
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
          description: p.description ?? null,
          status: p.status ?? "inbox",
          position: p.position ?? 0,
          due_date: p.due_date ?? null,
          parent_task_id: p.parent_task_id ?? null,
          recurs_weekly: p.recurs_weekly ?? false,
          weekday: p.weekday ?? null,
          recurrence_template_id: p.recurrence_template_id ?? null,
          occurrence_date: p.occurrence_date ?? null,
          completed_at: p.completed_at ?? null,
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
      if (this.op === "insert" && store.uniqueViolationOnce) {
        store.uniqueViolationOnce = false;
        return Promise.resolve({
          data: null,
          error: { code: "23505", message: "duplicate key" },
        });
      }
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

  // Mirrors migration 0005's task_descendant_ids recursive CTE: walks the tree
  // from root_id, level by level, honoring the same deleted_at is null filter
  // the SQL function applies at every level. Excludes root_id itself.
  function taskDescendantIds(rootId: string): { id: unknown }[] {
    const result: Row[] = [];
    let frontier = [rootId];

    while (frontier.length > 0) {
      const children = store.rows.filter(
        (r) => frontier.includes(r.parent_task_id as string) && !r.deleted_at,
      );
      if (children.length === 0) break;
      result.push(...children);
      frontier = children.map((r) => r.id as string);
    }

    return result.map((r) => ({ id: r.id }));
  }

  return {
    store,
    from: () => new FakeQuery(),
    rpc: (fn: string, args: { root_id: string }) => {
      if (fn !== "task_descendant_ids") {
        return Promise.resolve({
          data: null,
          error: { message: `unmocked rpc: ${fn}` },
        });
      }
      return Promise.resolve({
        data: taskDescendantIds(args.root_id),
        error: null,
      });
    },
    seed: (rows: Row[]) => store.rows.push(...rows.map((r) => ({ ...r }))),
    reset: () => {
      store.rows = [];
      store.uniqueViolationOnce = false;
    },
    failNextInsertWithUniqueViolation: () => {
      store.uniqueViolationOnce = true;
    },
  };
});

vi.mock("@/src/lib/supabaseClient", () => ({
  supabase: { from: h.from, rpc: h.rpc },
}));

import * as TaskRepository from "@/src/modules/task/TaskRepository";
import { MaxDepthError } from "@/src/modules/task/TaskRepository";
import type { TaskStatus, Weekday } from "@/src/modules/task/types";

type SeedTask = {
  id: string;
  status?: TaskStatus;
  parent_task_id?: string | null;
  deleted_at?: string | null;
  position?: number;
  title?: string;
  description?: string | null;
  recurs_weekly?: boolean;
  weekday?: Weekday | null;
  recurrence_template_id?: string | null;
  occurrence_date?: string | null;
  completed_at?: string | null;
};

function task(o: SeedTask) {
  return {
    id: o.id,
    title: o.title ?? o.id,
    description: o.description ?? null,
    status: o.status ?? "inbox",
    position: o.position ?? 0,
    due_date: null,
    parent_task_id: o.parent_task_id ?? null,
    recurs_weekly: o.recurs_weekly ?? false,
    weekday: o.weekday ?? null,
    recurrence_template_id: o.recurrence_template_id ?? null,
    occurrence_date: o.occurrence_date ?? null,
    completed_at: o.completed_at ?? null,
    deleted_at: o.deleted_at ?? null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const statusOf = (id: string) => h.store.rows.find((r) => r.id === id)?.status;
const deletedAtOf = (id: string) =>
  h.store.rows.find((r) => r.id === id)?.deleted_at;
const completedAtOf = (id: string) =>
  h.store.rows.find((r) => r.id === id)?.completed_at;

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

  it("stamps completed_at on descendants and ancestors when a task is completed", async () => {
    h.seed([
      task({ id: "root" }),
      task({ id: "parent", parent_task_id: "root" }),
      task({ id: "child", parent_task_id: "parent" }),
    ]);

    await TaskRepository.updateTaskStatus("parent", "done");

    expect(completedAtOf("parent")).not.toBeNull();
    expect(completedAtOf("child")).not.toBeNull();
    expect(completedAtOf("root")).not.toBeNull();
  });

  it("keeps an already-done descendant's original completed_at untouched", async () => {
    h.seed([
      task({ id: "root" }),
      task({
        id: "already-done",
        parent_task_id: "root",
        status: "done",
        completed_at: "2026-01-01T00:00:00.000Z",
      }),
      task({ id: "sibling", parent_task_id: "root" }),
    ]);

    await TaskRepository.updateTaskStatus("sibling", "done");

    expect(completedAtOf("already-done")).toBe("2026-01-01T00:00:00.000Z");
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

  it("clears completed_at on the task and its reverted ancestors", async () => {
    h.seed([
      task({
        id: "parent",
        status: "done",
        completed_at: "2026-01-01T00:00:00.000Z",
      }),
      task({
        id: "child",
        parent_task_id: "parent",
        status: "done",
        completed_at: "2026-01-01T00:00:00.000Z",
      }),
    ]);

    await TaskRepository.updateTaskStatus("child", "todo");

    expect(completedAtOf("child")).toBeNull();
    expect(completedAtOf("parent")).toBeNull();
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

describe("weekly recurrence", () => {
  it("loads only active recurrence templates", async () => {
    h.seed([
      task({ id: "ordinary" }),
      task({ id: "active", recurs_weekly: true, weekday: 2 }),
      task({
        id: "deleted",
        recurs_weekly: true,
        weekday: 4,
        deleted_at: "2026-07-01T00:00:00.000Z",
      }),
    ]);

    const templates = await TaskRepository.getTemplates();

    expect(templates.map((template) => template.id)).toEqual(["active"]);
  });

  it("generates a todo instance for each missing occurrence", async () => {
    h.seed([
      task({
        id: "template",
        title: "System design practice",
        description: "One case",
        recurs_weekly: true,
        weekday: 2,
      }),
      task({ id: "existing-todo", status: "todo", position: 3 }),
    ]);

    const created = await TaskRepository.regenerateWeeklyInstances(
      new Date("2026-07-15T12:00:00.000Z"),
    );

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      title: "System design practice",
      description: "One case",
      status: "todo",
      position: 4,
      dueDate: "2026-07-14",
      recursWeekly: false,
      weekday: null,
      recurrenceTemplateId: "template",
      occurrenceDate: "2026-07-14",
    });
  });

  it("does not regenerate an existing soft-deleted occurrence", async () => {
    h.seed([
      task({ id: "template", recurs_weekly: true, weekday: 2 }),
      task({
        id: "dismissed",
        recurrence_template_id: "template",
        occurrence_date: "2026-07-14",
        deleted_at: "2026-07-14T08:00:00.000Z",
      }),
    ]);

    const created = await TaskRepository.regenerateWeeklyInstances(
      new Date("2026-07-15T12:00:00.000Z"),
    );

    expect(created).toEqual([]);
    expect(h.store.rows).toHaveLength(2);
  });

  it("treats a concurrent unique violation as successful regeneration", async () => {
    h.seed([task({ id: "template", recurs_weekly: true, weekday: 2 })]);
    h.failNextInsertWithUniqueViolation();

    await expect(
      TaskRepository.regenerateWeeklyInstances(
        new Date("2026-07-15T12:00:00.000Z"),
      ),
    ).resolves.toEqual([]);
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
