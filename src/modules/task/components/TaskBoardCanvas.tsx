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
import { BoardColumn } from "@/src/modules/task/components/BoardColumn";
import { BoardHeader } from "@/src/modules/task/components/BoardHeader";
import { TaskArchive } from "@/src/modules/task/components/TaskArchive";
import { formatDueDate } from "@/src/modules/task/taskBoardUtils";
import type { Task, TaskStatus, Weekday } from "@/src/modules/task/types";
import type { TaskStats } from "@/src/modules/task/taskBoardUtils";
import type { ColumnConfig } from "@/src/modules/task/taskBoardConfig";
import type { FormEvent } from "react";

const boardCollisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  return withinPointer.length > 0 ? withinPointer : closestCorners(args);
};

type TaskBoardCanvasProps = {
  activeTask: Task | null;
  archived: Task[];
  canAddSubtaskIds: Set<string>;
  childCounts: Map<string, number>;
  columnFilters: TaskStatus[];
  depths: Map<string, number>;
  error: string | null;
  isBusy: boolean;
  isCreating: boolean;
  isLoading: boolean;
  newTaskRecursWeekly: boolean;
  newTaskTitle: string;
  newTaskWeekday: Weekday;
  pendingTaskIds: Set<string>;
  searchTerm: string;
  sensors: ReturnType<typeof useSensors>;
  stats: TaskStats[];
  tasksByStatus: Record<TaskStatus, Task[]>;
  templates: Task[];
  visibleColumns: ColumnConfig[];
  onCreateSubtask: (id: string, title: string) => void;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteTask: (id: string) => void;
  onDeleteTemplate: (id: string, title: string) => void;
  onDragCancel: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart: (event: DragStartEvent) => void;
  onArchiveTask: (id: string) => void;
  onRefresh: () => void;
  onRecursWeeklyChange: (value: boolean) => void;
  onReopenTask: (id: string) => void;
  onSearchChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onToggleColumn: (status: TaskStatus) => void;
  onUpdateDueDate: (id: string, dueDate: string | null) => void;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onWeekdayChange: (value: Weekday) => void;
};

export function TaskBoardCanvas({
  activeTask,
  archived,
  canAddSubtaskIds,
  childCounts,
  columnFilters,
  depths,
  error,
  isBusy,
  isCreating,
  isLoading,
  newTaskRecursWeekly,
  newTaskTitle,
  newTaskWeekday,
  pendingTaskIds,
  searchTerm,
  sensors,
  stats,
  tasksByStatus,
  templates,
  visibleColumns,
  onCreateSubtask,
  onCreateTask,
  onDeleteTask,
  onDeleteTemplate,
  onDragCancel,
  onDragEnd,
  onDragStart,
  onArchiveTask,
  onRefresh,
  onRecursWeeklyChange,
  onReopenTask,
  onSearchChange,
  onTitleChange,
  onToggleColumn,
  onUpdateDueDate,
  onUpdateStatus,
  onUpdateTitle,
  onWeekdayChange,
}: TaskBoardCanvasProps) {
  return (
    <section className="flex min-w-0 flex-col">
      <BoardHeader
        columnFilters={columnFilters}
        error={error}
        isBusy={isBusy}
        newTaskTitle={newTaskTitle}
        newTaskRecursWeekly={newTaskRecursWeekly}
        newTaskWeekday={newTaskWeekday}
        disabledTemplateIds={pendingTaskIds}
        onCreateTask={onCreateTask}
        onDeleteTemplate={onDeleteTemplate}
        onRefresh={onRefresh}
        onRecursWeeklyChange={onRecursWeeklyChange}
        onSearchChange={onSearchChange}
        onTitleChange={onTitleChange}
        onToggleColumn={onToggleColumn}
        onWeekdayChange={onWeekdayChange}
        searchTerm={searchTerm}
        stats={stats}
        templates={templates}
      />

      <div className="flex-1 overflow-x-auto p-4 sm:p-6">
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
            {visibleColumns.map((column) => (
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
                onArchiveTask={onArchiveTask}
                onDeleteTask={onDeleteTask}
                onUpdateDueDate={onUpdateDueDate}
                onUpdateStatus={onUpdateStatus}
                onUpdateTitle={onUpdateTitle}
                tasks={tasksByStatus[column.status]}
              />
            ))}
          </div>

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
