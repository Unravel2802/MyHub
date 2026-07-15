import { beforeEach, describe, expect, it, vi } from "vitest";
import { register, searchCommands, unregister } from "@/src/lib/commandPalette";

function entry(id: string, label: string, keywords: string[] = []) {
  return { id, label, keywords, action: vi.fn() };
}

describe("commandPalette", () => {
  beforeEach(() => {
    unregister("task");
    unregister("dashboard");
  });

  it("namespaces ids per module", () => {
    register("task", [entry("new", "New task")]);
    register("dashboard", [entry("new", "New chart")]);

    const results = searchCommands("new");
    expect(results.map((r) => r.id)).toEqual(
      expect.arrayContaining(["task.new", "dashboard.new"]),
    );
  });

  it("rejects a duplicate id within the same module", () => {
    register("task", [entry("new", "New task")]);
    expect(() => register("task", [entry("new", "New task again")])).toThrow();
  });

  it("unregister removes only that module's entries", () => {
    register("task", [entry("new", "New task")]);
    register("dashboard", [entry("refresh", "Refresh")]);

    unregister("task");

    const results = searchCommands("");
    expect(results.map((r) => r.id)).toEqual(["dashboard.refresh"]);
  });

  it("ranks exact match, then label match, then keyword match", () => {
    register("task", [
      entry("new", "New task", ["create", "add"]),
      entry("board", "Task board", ["kanban"]),
      entry("filter", "Filter columns", ["task"]),
      entry("exact", "task", []),
    ]);

    const results = searchCommands("task");

    // "task.exact" has label === "task" exactly, so it ranks first even
    // though it was registered last; the label-substring matches ("New
    // task", "Task board") follow in registration order; the
    // keyword-only match ("Filter columns", via its "task" keyword) is last.
    expect(results.map((r) => r.id)).toEqual([
      "task.exact",
      "task.new",
      "task.board",
      "task.filter",
    ]);
  });

  it("returns every entry in registration order for an empty query", () => {
    register("task", [entry("a", "A"), entry("b", "B")]);
    expect(searchCommands("").map((r) => r.id)).toEqual(["task.a", "task.b"]);
  });
});
