import type { FormEvent } from "react";
import type { TaskStats } from "@/src/modules/task/taskBoardUtils";

type BoardHeaderProps = {
  error: string | null;
  isBusy: boolean;
  newTaskTitle: string;
  searchTerm: string;
  stats: TaskStats[];
  onCreateTask: (event: FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onTitleChange: (value: string) => void;
};

export function BoardHeader({
  error,
  isBusy,
  newTaskTitle,
  searchTerm,
  stats,
  onCreateTask,
  onRefresh,
  onSearchChange,
  onTitleChange,
}: BoardHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Personal productivity
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-normal">
            Kanban board
          </h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="task-search">
            Search tasks
          </label>
          <input
            id="task-search"
            className="h-10 min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 sm:w-64"
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
              className="h-10 min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 sm:w-56"
              disabled={isBusy}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="New inbox task"
              value={newTaskTitle}
            />
            <button
              className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isBusy || !newTaskTitle.trim()}
            >
              Add
            </button>
          </form>
          <button
            className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
            disabled={isBusy}
            onClick={onRefresh}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-zinc-200 bg-stone-50 px-4 py-3"
          >
            <p className="text-xs font-medium uppercase text-zinc-500">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>
    </header>
  );
}
