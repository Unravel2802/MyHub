import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type FormEvent, type SyntheticEvent, useId, useState } from "react";
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

function stopDragActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

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
  const subtaskInputId = useId();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [dueDateDraft, setDueDateDraft] = useState(task.dueDate ?? "");
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const titleChanged = titleDraft.trim() !== task.title;
  const dueDateChanged = dueDateDraft !== (task.dueDate ?? "");
  const currentColumn = columns.find((column) => column.status === task.status);

  function handleTitleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === task.title) {
      setTitleDraft(task.title);
      setIsEditingTitle(false);
      return;
    }

    onUpdateTitle(task.id, nextTitle);
    setIsEditingTitle(false);
  }

  function handleDueDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dueDateChanged) {
      onUpdateDueDate(task.id, dueDateDraft || null);
    }
    setIsEditingDueDate(false);
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

  function toggleTitleEdit() {
    setTitleDraft(task.title);
    setIsEditingTitle((value) => !value);
  }

  function toggleDueDateEdit() {
    setDueDateDraft(task.dueDate ?? "");
    setIsEditingDueDate((value) => !value);
  }

  return (
    <article
      aria-label={`Task: ${task.title}`}
      className={`min-w-0 overflow-hidden rounded-md border border-border bg-surface p-3 shadow-sm transition-colors hover:border-input-hover ${
        disabled ? "opacity-70" : "hover:border-input-hover"
      } ${isDragging ? "opacity-40" : ""}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "none",
      }}
    >
      <div
        className={`flex items-start justify-between gap-3 ${
          disabled
            ? "cursor-not-allowed"
            : "cursor-grab select-none active:cursor-grabbing"
        }`}
        {...attributes}
        {...listeners}
      >
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
            {task.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted">
            <span>{formatDueDate(task.dueDate)}</span>
            <span>Level {depth}</span>
            {childCount > 0 ? <span>{childCount} subtasks</span> : null}
            {task.recurrenceTemplateId ? (
              <span className="rounded-full border border-accent px-2 py-0.5 text-accent-strong">
                Weekly instance
              </span>
            ) : null}
          </div>
        </div>
        <span
          className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            currentColumn?.accent ?? "bg-input"
          }`}
        />
      </div>

      <div
        className="mt-3 grid gap-2"
        onKeyDown={stopDragActivation}
        onPointerDown={stopDragActivation}
      >
        <div className="grid min-w-0 gap-2">
          <label className="sr-only" htmlFor={statusInputId}>
            Status
          </label>
          <select
            className="h-8 min-w-0 rounded-md border border-input bg-surface px-2 text-xs font-medium text-body outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-subtle"
            disabled={disabled}
            id={statusInputId}
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

        <div className="grid grid-cols-3 gap-2">
          <button
            className="h-8 min-w-0 rounded-md border border-input bg-surface px-2 text-xs font-medium text-body transition-colors hover:border-input-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-subtle"
            disabled={disabled}
            onClick={toggleTitleEdit}
            type="button"
          >
            Edit
          </button>
          <button
            className="h-8 rounded-md border border-input bg-surface px-2 text-xs font-medium text-body transition-colors hover:border-input-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-subtle"
            disabled={disabled}
            onClick={toggleDueDateEdit}
            type="button"
          >
            Date
          </button>
          <button
            className="h-8 min-w-0 rounded-md border border-danger-border bg-surface px-2 text-xs font-medium text-danger transition-colors hover:border-danger-border-hover hover:bg-danger-surface disabled:cursor-not-allowed disabled:text-danger-subtle"
            disabled={disabled}
            onClick={handleDelete}
            type="button"
          >
            Delete
          </button>
        </div>

        {isEditingTitle ? (
          <form
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
            onSubmit={handleTitleSubmit}
          >
            <label className="sr-only" htmlFor={titleInputId}>
              Task title
            </label>
            <input
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-surface px-2 text-sm outline-none transition-colors focus:border-accent"
              disabled={disabled}
              id={titleInputId}
              onChange={(event) => setTitleDraft(event.target.value)}
              value={titleDraft}
            />
            <button
              className="h-8 rounded-md border border-input bg-surface px-2 text-xs font-medium text-body transition-colors hover:border-input-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-subtle"
              disabled={disabled || !titleChanged || !titleDraft.trim()}
            >
              Save
            </button>
          </form>
        ) : null}

        {isEditingDueDate ? (
          <form
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
            onSubmit={handleDueDateSubmit}
          >
            <label className="sr-only" htmlFor={dueDateInputId}>
              Due date
            </label>
            <input
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-surface px-2 text-sm outline-none transition-colors focus:border-accent"
              disabled={disabled}
              id={dueDateInputId}
              onChange={(event) => setDueDateDraft(event.target.value)}
              type="date"
              value={dueDateDraft}
            />
            <button
              className="h-8 rounded-md border border-input bg-surface px-2 text-xs font-medium text-body transition-colors hover:border-input-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-subtle"
              disabled={disabled || !dueDateChanged}
            >
              Save
            </button>
          </form>
        ) : null}

        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
          onSubmit={handleSubtaskSubmit}
        >
          <label className="sr-only" htmlFor={subtaskInputId}>
            New subtask title
          </label>
          <input
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-surface px-2 text-xs outline-none transition-colors placeholder:text-subtle focus:border-accent disabled:bg-surface-subtle"
            disabled={disabled || !canCreateSubtask}
            id={subtaskInputId}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            placeholder={canCreateSubtask ? "New subtask" : "Max depth"}
            value={subtaskTitle}
          />
          <button
            className="h-8 rounded-md border border-input bg-surface px-2 text-xs font-medium text-body transition-colors hover:border-input-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-subtle"
            disabled={disabled || !canCreateSubtask || !subtaskTitle.trim()}
          >
            Add
          </button>
        </form>
      </div>
    </article>
  );
}
