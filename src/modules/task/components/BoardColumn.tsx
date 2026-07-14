import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskCard } from "@/src/modules/task/components/TaskCard";
import type { ColumnConfig } from "@/src/modules/task/taskBoardConfig";
import type { Task, TaskStatus } from "@/src/modules/task/types";

type BoardColumnProps = {
  canAddSubtaskIds: Set<string>;
  childCounts: Map<string, number>;
  column: ColumnConfig;
  depths: Map<string, number>;
  disabledTaskIds: Set<string>;
  isCreating: boolean;
  isLoading: boolean;
  tasks: Task[];
  onCreateSubtask: (id: string, title: string) => void;
  onDeleteTask: (id: string) => void;
  onArchiveTask: (id: string) => void;
  onUpdateDueDate: (id: string, dueDate: string | null) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
};

export function BoardColumn({
  canAddSubtaskIds,
  childCounts,
  column,
  depths,
  disabledTaskIds,
  isCreating,
  isLoading,
  tasks,
  onCreateSubtask,
  onDeleteTask,
  onArchiveTask,
  onUpdateDueDate,
  onUpdateStatus,
  onUpdateTitle,
}: BoardColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.status });

  return (
    <section
      aria-label={column.title}
      className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface"
      ref={setNodeRef}
    >
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
            <h3 className="truncate text-sm font-semibold text-foreground">
              {column.title}
            </h3>
          </div>
          <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-medium text-muted">
            {tasks.length}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          {column.description}
        </p>
      </div>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-input bg-surface-subtle p-6 text-center">
              <p className="text-sm leading-6 text-muted">Loading tasks...</p>
            </div>
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                canCreateSubtask={canAddSubtaskIds.has(task.id)}
                childCount={childCounts.get(task.id) ?? 0}
                depth={depths.get(task.id) ?? 1}
                disabled={isCreating || disabledTaskIds.has(task.id)}
                onCreateSubtask={onCreateSubtask}
                onDelete={onDeleteTask}
          onArchive={onArchiveTask}
                onUpdateDueDate={onUpdateDueDate}
                onUpdateStatus={onUpdateStatus}
                onUpdateTitle={onUpdateTitle}
                task={task}
              />
            ))
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-input bg-surface-subtle p-6 text-center">
              <p className="max-w-40 text-sm leading-6 text-muted">
                {column.emptyCopy}
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
