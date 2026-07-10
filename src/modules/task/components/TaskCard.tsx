import { FormEvent, useId, useState } from "react";
import { columns } from "@/src/modules/task/taskBoardConfig";
import { formatDueDate } from "@/src/modules/task/taskBoardUtils";
import type { Task, TaskStatus } from "@/src/modules/task/types";

type TaskCardProps = {
  disabled: boolean;
  task: Task;
  onDelete: (id: string) => void;
  onUpdateDueDate: (id: string, dueDate: string | null) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
};

export function TaskCard({
  disabled,
  task,
  onDelete,
  onUpdateDueDate,
  onUpdateStatus,
  onUpdateTitle,
}: TaskCardProps) {
  const titleInputId = useId();
  const dueDateInputId = useId();
  const statusInputId = useId();
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [dueDateDraft, setDueDateDraft] = useState(task.dueDate ?? "");

  const titleChanged = titleDraft.trim() !== task.title;
  const dueDateChanged = dueDateDraft !== (task.dueDate ?? "");

  function handleTitleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === task.title) return;

    onUpdateTitle(task.id, nextTitle);
  }

  function handleDueDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dueDateChanged) return;

    onUpdateDueDate(task.id, dueDateDraft || null);
  }

  function handleDelete() {
    if (window.confirm(`Delete "${task.title}"?`)) {
      onDelete(task.id);
    }
  }

  return (
    <article className="rounded-md border border-zinc-200 bg-stone-50 p-4 shadow-sm transition-colors hover:border-zinc-300">
      <form className="flex gap-2" onSubmit={handleTitleSubmit}>
        <label className="sr-only" htmlFor={titleInputId}>
          Task title
        </label>
        <input
          id={titleInputId}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold leading-5 outline-none transition-colors focus:border-teal-600"
          disabled={disabled}
          onChange={(event) => setTitleDraft(event.target.value)}
          value={titleDraft}
        />
        <button
          className="rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
          disabled={disabled || !titleChanged || !titleDraft.trim()}
        >
          Save
        </button>
      </form>

      <div className="mt-3 grid gap-3">
        <div>
          <label
            className="mb-1 block text-xs font-medium text-zinc-500"
            htmlFor={statusInputId}
          >
            Status
          </label>
          <select
            id={statusInputId}
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none transition-colors focus:border-teal-600"
            disabled={disabled}
            onChange={(event) =>
              onUpdateStatus(task.id, event.target.value as TaskStatus)
            }
            value={task.status}
          >
            {columns.map((column) => (
              <option key={column.status} value={column.status}>
                {column.title}
              </option>
            ))}
          </select>
        </div>

        <form className="grid gap-2" onSubmit={handleDueDateSubmit}>
          <label
            className="text-xs font-medium text-zinc-500"
            htmlFor={dueDateInputId}
          >
            Due date
          </label>
          <div className="flex gap-2">
            <input
              id={dueDateInputId}
              className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none transition-colors focus:border-teal-600"
              disabled={disabled}
              onChange={(event) => setDueDateDraft(event.target.value)}
              type="date"
              value={dueDateDraft}
            />
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
              disabled={disabled || !dueDateChanged}
            >
              Save
            </button>
          </div>
        </form>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>{formatDueDate(task.dueDate)}</span>
        <button
          className="rounded-md border border-red-200 bg-white px-2 py-1 font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
          disabled={disabled}
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
