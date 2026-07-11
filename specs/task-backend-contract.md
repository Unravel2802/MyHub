# Task Backend Contract

This documents the current backend/store surface for Claude Code's Task Engine UI work. It does
not introduce new architecture beyond `specs/task-module-spec.md`.

## Store

Import `useTaskStore` from `@/src/modules/task/useTaskStore`.

State:

- `tasks: Task[]` — active, non-deleted tasks.
- `isLoading: boolean` — true while `fetchTasks` is loading.
- `error: string | null` — user-facing error banner text.
- `columnFilters: TaskStatus[]` — selected board filters.
- `isCreating: boolean` — true while a create request is in flight.
- `pendingIds: string[]` — task ids with update/delete/move requests in flight.

Actions:

- `fetchTasks(): Promise<void>` — loads non-deleted tasks from Supabase.
- `setColumnFilters(statuses: TaskStatus[]): void` — stores board filter state.
- `createTask(input): Promise<void>` — creates an inbox task; subtasks use `parentTaskId`.
- `updateTask(id, updates): Promise<void>` — updates `title` and/or `dueDate`.
- `updateStatus(id, status): Promise<void>` — updates status and refetches after cascades.
- `reorderTask(id, position): Promise<void>` — updates position only.
- `moveTask(id, { status?, position }): Promise<void>` — drag/drop move; status is optional for
  same-column reorders.
- `deleteTask(id): Promise<void>` — recursively soft-deletes a task and descendants.

## Task Shape

`TaskStatus = "inbox" | "todo" | "in_progress" | "done"`.

`Task` fields: `id`, `title`, `status`, `position`, `dueDate`, `parentTaskId`, `deletedAt`,
`createdAt`, `updatedAt`.

## Domain Rules Exposed To UI

- `MAX_TASK_DEPTH` is `3`.
- Use `canAddSubtask(tasks, id)` to disable creating level-4 subtasks.
- Use `descendantIds(tasks, id)` when a UI needs the subtree for display/animation.
- Use `positionBetween(before, after)` to calculate fractional drag/drop positions.
- On repository failure, store actions roll back optimistic changes and set `error`.
- Known max-depth failures return `Subtasks can only nest 3 levels deep`.

## Events

The store emits these typed events through `src/lib/events.ts` after successful mutations:

- `task.created`
- `task.updated`
- `task.completed`
- `task.deleted`

Each payload is `{ taskId: string }`.
