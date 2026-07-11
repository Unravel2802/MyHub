import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormEvent, useId, useState } from "react";
import { columns } from "@/src/modules/task/taskBoardConfig";
import { formatDueDate } from "@/src/modules/task/taskBoardUtils";
import type { Task, TaskStatus } from "@/src/modules/task/types";

type TaskCardProps = {
  canCreateSubtask: boolean;
  childCount: number;
  depth: number;
  disabled: boolean;
  task: Task;
  onCreateSubtask: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onUpdateDueDate: (id: string, dueDate: string | null) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
};

export function TaskCard({
  canCreateSubtask,
  childCount,
  depth,
  disabled,
  task,
  onCreateSubtask,
  onDelete,
  onUpdateDueDate,
  onUpdateStatus,
  onUpdateTitle,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled,
  });
  const titleInputId = useId();
  const dueDateInputId = useId();
  const statusInputId = useId();
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [dueDateDraft, setDueDateDraft] = useState(task.dueDate ?? "");
  const [subtaskTitle, setSubtaskTitle] = useState("");

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

  function handleSubtaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = subtaskTitle.trim();
    if (!title || !canCreateSubtask) return;

    setSubtaskTitle("");
    onCreateSubtask(task.id, title);
  }

  function handleDelete() {
    if (window.confirm(`Delete "${task.title}"?`)) {
      onDelete(task.id);
    }
  }

  return (
    <article
      className={`cursor-grab select-none rounded-md border border-zinc-200 bg-stone-50 p-4 shadow-sm transition-colors hover:border-zinc-300 ${
        isDragging ? "opacity-40" : ""
      }`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "manipulation",
      }}
      // Whole card drags with the pointer; interactive controls below stop
      // propagation so typing/clicking never starts a drag.
      onPointerDown={
        listeners?.onPointerDown as
          React.PointerEventHandler<HTMLElement> | undefined
      }
    >
      <div className="mb-3 flex justify-end">
        {/* Keyboard drag handle: pointer drags bubble to the card itself, so
            only the keydown listener lives here to avoid double activation. */}
        <button
          aria-label={`Move task: ${task.title}`}
          className="h-8 cursor-grab rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
          disabled={disabled}
          type="button"
          {...attributes}
          onKeyDown={
            listeners?.onKeyDown as
              React.KeyboardEventHandler<HTMLElement> | undefined
          }
          onPointerDown={(event) => event.stopPropagation()}
        >
          ⠿ Move
        </button>
      </div>

      <div
        className="contents"
        onPointerDown={(event) => event.stopPropagation()}
      >
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
          <div className="flex flex-col gap-1">
            <span>{formatDueDate(task.dueDate)}</span>
            <span>
              Level {depth}
              {childCount > 0 ? ` / ${childCount} subtasks` : ""}
            </span>
          </div>
          <button
            className="rounded-md border border-red-200 bg-white px-2 py-1 font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
            disabled={disabled}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>

        <form className="mt-4 flex gap-2" onSubmit={handleSubtaskSubmit}>
          <label className="sr-only" htmlFor={`${titleInputId}-subtask`}>
            New subtask title
          </label>
          <input
            className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 disabled:bg-zinc-100"
            disabled={disabled || !canCreateSubtask}
            id={`${titleInputId}-subtask`}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            placeholder={canCreateSubtask ? "New subtask" : "Max depth reached"}
            value={subtaskTitle}
          />
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
            disabled={disabled || !canCreateSubtask || !subtaskTitle.trim()}
          >
            Add
          </button>
        </form>
      </div>
    </article>
  );
}
