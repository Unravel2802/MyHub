"use client";

import { useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { formatDueDate } from "@/src/modules/task/taskBoardUtils";
import type { Task } from "@/src/modules/task/types";

type TaskArchiveProps = {
  tasks: Task[];
  pendingIds: ReadonlySet<string>;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
};

function completedOn(task: Task) {
  if (!task.completedAt) return "Completed earlier";
  return `Completed ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(task.completedAt))}`;
}

// Everything that has left the board: completed in a past week, or archived by
// hand. Collapsed by default — the point of archiving is to get this out of your
// face, so it shouldn't reassert itself as a wall of finished work.
export function TaskArchive({
  tasks,
  pendingIds,
  onReopen,
  onDelete,
}: TaskArchiveProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section
      aria-labelledby="archive-heading"
      className="mt-6 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold text-foreground"
            id="archive-heading"
          >
            Archive
          </h2>
          <p className="mt-1 text-sm text-muted">
            Finished work from past weeks. Still counts toward your streak.
          </p>
        </div>
        <button
          aria-expanded={isOpen}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-body hover:bg-surface-subtle"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          {isOpen ? "Hide" : `Show ${tasks.length}`}
        </button>
      </div>

      {isOpen ? (
        tasks.length === 0 ? (
          <EmptyState
            description="Completed work stays visible here for streak history once it leaves the active board."
            title="Your archive is clear"
          />
        ) : (
          <ul className="mt-4 grid gap-2">
            {tasks.map((task) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                key={task.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-body">{task.title}</p>
                    {task.archivedAt ? (
                      <Badge tone="neutral">Archived</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {completedOn(task)}
                    {task.dueDate
                      ? ` · Due ${formatDueDate(task.dueDate)}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-body hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-muted"
                    disabled={pendingIds.has(task.id)}
                    onClick={() => onReopen(task.id)}
                    type="button"
                  >
                    Reopen
                  </button>
                  <button
                    className="rounded-md border border-danger-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-surface disabled:cursor-not-allowed disabled:text-danger-subtle"
                    disabled={pendingIds.has(task.id)}
                    onClick={() => onDelete(task.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
