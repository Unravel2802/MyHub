import type { FormEvent } from "react";
import { StatCard } from "@/src/components/ui/StatCard";
import { columns } from "@/src/modules/task/taskBoardConfig";
import type { TaskStats } from "@/src/modules/task/taskBoardUtils";
import type { Task, TaskStatus, Weekday } from "@/src/modules/task/types";

const weekdays: { value: Weekday; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

type BoardHeaderProps = {
  columnFilters: TaskStatus[];
  error: string | null;
  isBusy: boolean;
  newTaskTitle: string;
  newTaskRecursWeekly: boolean;
  newTaskWeekday: Weekday;
  searchTerm: string;
  stats: TaskStats[];
  templates: Task[];
  disabledTemplateIds: ReadonlySet<string>;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteTemplate: (id: string, title: string) => void;
  onRefresh: () => void;
  onRecursWeeklyChange: (value: boolean) => void;
  onSearchChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onToggleColumn: (status: TaskStatus) => void;
  onWeekdayChange: (value: Weekday) => void;
};

export function BoardHeader({
  columnFilters,
  error,
  isBusy,
  newTaskTitle,
  newTaskRecursWeekly,
  newTaskWeekday,
  searchTerm,
  stats,
  templates,
  disabledTemplateIds,
  onCreateTask,
  onDeleteTemplate,
  onRefresh,
  onRecursWeeklyChange,
  onSearchChange,
  onTitleChange,
  onToggleColumn,
  onWeekdayChange,
}: BoardHeaderProps) {
  return (
    <header className="border-b border-border bg-surface px-6 py-5">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
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
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={onCreateTask}
          >
            <label className="sr-only" htmlFor="new-task-title">
              New task title
            </label>
            <input
              id="new-task-title"
              className="h-10 min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus:border-accent sm:w-56"
              disabled={isBusy}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={
                newTaskRecursWeekly ? "New weekly task" : "New inbox task"
              }
              value={newTaskTitle}
            />
            <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-surface px-3 text-xs font-medium text-body">
              <input
                checked={newTaskRecursWeekly}
                disabled={isBusy}
                onChange={(event) => onRecursWeeklyChange(event.target.checked)}
                type="checkbox"
              />
              Repeats weekly
            </label>
            {newTaskRecursWeekly ? (
              <label className="sr-only" htmlFor="new-task-weekday">
                Weekday
              </label>
            ) : null}
            {newTaskRecursWeekly ? (
              <select
                className="h-10 rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
                disabled={isBusy}
                id="new-task-weekday"
                onChange={(event) =>
                  onWeekdayChange(Number(event.target.value) as Weekday)
                }
                value={newTaskWeekday}
              >
                {weekdays.map((weekday) => (
                  <option key={weekday.value} value={weekday.value}>
                    {weekday.label}
                  </option>
                ))}
              </select>
            ) : null}
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
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div
        aria-label="Weekly tasks"
        aria-labelledby="recurring-rules-heading"
        className="mt-5 rounded-lg border border-border bg-surface-subtle p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3
              className="text-sm font-semibold text-foreground"
              id="recurring-rules-heading"
            >
              Weekly tasks
            </h3>
            <p className="mt-1 text-xs text-muted">
              Rules generate a fresh Todo task each week.
            </p>
          </div>
          <span className="text-xs font-medium text-muted">
            {templates.length} active
          </span>
        </div>

        {templates.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No weekly tasks yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <li
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
                key={template.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {template.title}
                  </p>
                  <p className="text-xs text-muted">
                    {weekdays.find(
                      (weekday) => weekday.value === template.weekday,
                    )?.label ?? "Unknown weekday"}
                  </p>
                </div>
                <button
                  className="shrink-0 rounded-md border border-danger-border px-2 py-1 text-xs font-medium text-danger hover:bg-danger-surface disabled:cursor-not-allowed disabled:text-danger-subtle"
                  disabled={disabledTemplateIds.has(template.id)}
                  onClick={() => onDeleteTemplate(template.id, template.title)}
                  type="button"
                >
                  Stop
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
