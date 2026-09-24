"use client";

import {
  closestCorners,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  useSensors,
} from "@dnd-kit/core";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BoardColumn } from "@/src/modules/task/components/BoardColumn";
import { TaskArchive } from "@/src/modules/task/components/TaskArchive";
import { formatDueDate } from "@/src/modules/task/taskBoardUtils";
import type { Task, TaskStatus } from "@/src/modules/task/types";
import type { ColumnConfig } from "@/src/modules/task/taskBoardConfig";

const boardCollisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  return withinPointer.length > 0 ? withinPointer : closestCorners(args);
};

const subscribeNever = () => () => {};

type TaskBoardCanvasProps = {
  activeTask: Task | null;
  archived: Task[];
  canAddSubtaskIds: Set<string>;
  childCounts: Map<string, number>;
  depths: Map<string, number>;
  isCreating: boolean;
  isLoading: boolean;
  pendingTaskIds: Set<string>;
  sensors: ReturnType<typeof useSensors>;
  tasksByStatus: Record<TaskStatus, Task[]>;
  visibleColumns: ColumnConfig[];
  onCreateSubtask: (id: string, title: string) => void;
  onDeleteTask: (id: string) => void;
  onDragCancel: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart: (event: DragStartEvent) => void;
  onArchiveAllDone: () => void;
  onArchiveTask: (id: string) => void;
  onReopenTask: (id: string) => void;
  onUpdateDueDate: (id: string, dueDate: string | null) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
};

export function TaskBoardCanvas({
  activeTask,
  archived,
  canAddSubtaskIds,
  childCounts,
  depths,
  isCreating,
  isLoading,
  pendingTaskIds,
  sensors,
  tasksByStatus,
  visibleColumns,
  onCreateSubtask,
  onDeleteTask,
  onDragCancel,
  onDragEnd,
  onDragStart,
  onArchiveAllDone,
  onArchiveTask,
  onReopenTask,
  onUpdateDueDate,
  onUpdateStatus,
  onUpdateTitle,
}: TaskBoardCanvasProps) {
  // DragOverlay is position: fixed, so it must not sit under an ancestor with a
  // transform — PageTemplateBody's page-fade animation fills with one, which
  // makes that section the containing block and offsets the overlay from the
  // pointer by the scroll distance. Portal it to <body> — null on the server,
  // where document doesn't exist.
  const portalTarget = useSyncExternalStore(
    subscribeNever,
    () => document.body,
    () => null,
  );

  const dragOverlay = (
    <DragOverlay>
      {activeTask ? (
        <div className="rounded-md border border-accent bg-surface p-4 shadow-lg">
          <p className="text-sm font-semibold text-foreground">
            {activeTask.title}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatDueDate(activeTask.dueDate)}
          </p>
        </div>
      ) : null}
    </DragOverlay>
  );

  return (
    <section className="flex min-w-0 flex-col">
      <div className="flex-1 overflow-x-auto">
        <DndContext
          collisionDetection={boardCollisionDetection}
          onDragCancel={onDragCancel}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          sensors={sensors}
        >
          <div
            aria-label="Board columns"
            className="grid gap-4"
            role="group"
            style={{
              gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))`,
              minWidth: `${visibleColumns.length * 280}px`,
            }}
          >
            {visibleColumns.map((column, index) => (
              <BoardColumn
                key={column.status}
                canAddSubtaskIds={canAddSubtaskIds}
                childCounts={childCounts}
                column={column}
                depths={depths}
                disabledTaskIds={pendingTaskIds}
                isCreating={isCreating}
                isLoading={isLoading}
                onCreateSubtask={onCreateSubtask}
                onArchiveAll={
                  column.status === "done" ? onArchiveAllDone : undefined
                }
                onArchiveTask={onArchiveTask}
                onDeleteTask={onDeleteTask}
                onUpdateDueDate={onUpdateDueDate}
                onUpdateStatus={onUpdateStatus}
                onUpdateTitle={onUpdateTitle}
                tasks={tasksByStatus[column.status]}
                style={{ ["--i" as string]: index }}
              />
            ))}
          </div>

          {portalTarget && createPortal(dragOverlay, portalTarget)}
        </DndContext>

        <TaskArchive
          onDelete={onDeleteTask}
          onReopen={onReopenTask}
          pendingIds={pendingTaskIds}
          tasks={archived}
        />
      </div>
    </section>
  );
}
