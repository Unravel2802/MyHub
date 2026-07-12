import type { FormEvent } from "react";
import { columns } from "@/src/modules/task/taskBoardConfig";
import type { TaskStats } from "@/src/modules/task/taskBoardUtils";
import type { TaskStatus } from "@/src/modules/task/types";

type BoardHeaderProps = {
  columnFilters: TaskStatus[];
  error: string | null;
  isBusy: boolean;
  newTaskTitle: string;
  searchTerm: string;
  stats: TaskStats[];
  onCreateTask: (event: FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onToggleColumn: (status: TaskStatus) => void;
};

export function BoardHeader({
  columnFilters,
  error,
  isBusy,
  newTaskTitle,
  searchTerm,
  stats,
  onCreateTask,
  onRefresh,
  onSearchChange,
  onTitleChange,
  onToggleColumn,
}: BoardHeaderProps) {
  return (
    <header className="border-b border-border bg-surface px-6 py-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">
            Personal productivity
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
            Kanban board
          </h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="task-search">
            Search tasks
          </label>
          <input
            id="task-search"
            className="h-10 min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus:border-accent sm:w-64"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tasks"
            type="search"
            value={searchTerm}
          />
          <form className="flex gap-2" onSubmit={onCreateTask}>
            <label className="sr-only" htmlFor="new-task-title">
              New task title
            </label>
            <input
              id="new-task-title"
              className="h-10 min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus:border-accent sm:w-56"
              disabled={isBusy}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="New inbox task"
              value={newTaskTitle}
            />
            <button
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-disabled"
              disabled={isBusy || !newTaskTitle.trim()}
            >
              Add
            </button>
          </form>
          <button
            className="h-10 rounded-md border border-input bg-surface px-4 text-sm font-medium text-body transition-colors hover:border-input-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-subtle"
            disabled={isBusy}
            onClick={onRefresh}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div
        aria-label="Filter columns"
        className="mt-4 flex flex-wrap gap-2"
        role="group"
      >
        {columns.map((column) => {
          const isActive = columnFilters.includes(column.status);
          return (
            <button
              key={column.status}
              aria-pressed={isActive}
              className={`flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-surface text-muted hover:border-input-hover hover:text-foreground"
              }`}
              onClick={() => onToggleColumn(column.status)}
              type="button"
            >
              <span className={`h-2 w-2 rounded-full ${column.accent}`} />
              {column.title}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-surface-subtle px-4 py-3"
          >
            <p className="text-xs font-medium uppercase text-muted">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </header>
  );
}
