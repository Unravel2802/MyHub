"use client";

import {
  closestCorners,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BoardColumn } from "@/src/modules/task/components/BoardColumn";
import { BoardHeader } from "@/src/modules/task/components/BoardHeader";
import { Sidebar } from "@/src/modules/task/components/Sidebar";
import {
  filterVisibleTasks,
  formatDueDate,
  getDropPosition,
  getTaskStats,
  getTaskStatus,
  getVisibleColumns,
  groupTasksByStatus,
  isTaskStatus,
  toggleColumnFilter,
} from "@/src/modules/task/taskBoardUtils";
import { canAddSubtask, taskDepth } from "@/src/modules/task/taskTree";
import type { Task, TaskStatus, Weekday } from "@/src/modules/task/types";
import { useTaskStore } from "@/src/modules/task/useTaskStore";

// Prefer whatever droppable the pointer is actually inside (so empty columns
// receive drops reliably); fall back to closest-corners for keyboard drags,
// where there is no pointer position.
const boardCollisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  return withinPointer.length > 0 ? withinPointer : closestCorners(args);
};

export function TaskBoard() {
  const {
    tasks,
    templates,
    isLoading,
    isCreating,
    pendingIds,
    error,
    columnFilters,
    fetchTasks,
    fetchTemplates,
    createTask,
    deleteTemplate,
    updateTask,
    updateStatus,
    moveTask,
    deleteTask,
    setColumnFilters,
  } = useTaskStore();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskRecursWeekly, setNewTaskRecursWeekly] = useState(false);
  const [newTaskWeekday, setNewTaskWeekday] = useState<Weekday>(
    () => new Date().getDay() as Weekday,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    // Distance constraint keeps plain clicks (expand, buttons, inputs) from
    // starting a drag now that the whole card is a drag handle.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    void Promise.all([fetchTasks(), fetchTemplates()]);
  }, [fetchTasks, fetchTemplates]);

  const visibleTasks = useMemo(
    () => filterVisibleTasks(tasks, searchTerm),
    [searchTerm, tasks],
  );

  const tasksByStatus = useMemo(
    () => groupTasksByStatus(visibleTasks),
    [visibleTasks],
  );

  const allTasksByStatus = useMemo(
    () => groupTasksByStatus(filterVisibleTasks(tasks, "")),
    [tasks],
  );

  const stats = useMemo(
    () => getTaskStats(tasks, new Date().toISOString().slice(0, 10)),
    [tasks],
  );

  const visibleColumns = useMemo(
    () => getVisibleColumns(columnFilters),
    [columnFilters],
  );

  const childCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (task.parentTaskId) {
        counts.set(task.parentTaskId, (counts.get(task.parentTaskId) ?? 0) + 1);
      }
    }
    return counts;
  }, [tasks]);

  const depths = useMemo(() => {
    const values = new Map<string, number>();
    for (const task of tasks) {
      values.set(task.id, taskDepth(tasks, task.id));
    }
    return values;
  }, [tasks]);

  const canAddSubtaskIds = useMemo(
    () =>
      new Set(
        tasks
          .filter((task) => canAddSubtask(tasks, task.id))
          .map((task) => task.id),
      ),
    [tasks],
  );

  const isBusy = isLoading || isCreating;
  const pendingTaskIds = useMemo(() => new Set(pendingIds), [pendingIds]);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    setNewTaskTitle("");
    setNewTaskRecursWeekly(false);
    await createTask({
      title,
      ...(newTaskRecursWeekly && {
        recursWeekly: true,
        weekday: newTaskWeekday,
      }),
    });
  }

  function handleUpdateTitle(id: string, title: string) {
    void updateTask(id, { title });
  }

  function handleCreateSubtask(id: string, title: string) {
    void createTask({ title, parentTaskId: id });
  }

  function handleUpdateDueDate(id: string, dueDate: string | null) {
    void updateTask(id, { dueDate });
  }

  function handleUpdateStatus(id: string, status: TaskStatus) {
    void updateStatus(id, status);
  }

  function handleDeleteTask(id: string) {
    void deleteTask(id);
  }

  function handleDeleteTemplate(id: string, title: string) {
    if (window.confirm(`Stop repeating "${title}" every week?`)) {
      void deleteTemplate(id);
    }
  }

  function handleToggleColumn(status: TaskStatus) {
    setColumnFilters(toggleColumnFilter(columnFilters, status));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((task) => task.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    const activeTask = tasks.find((task) => task.id === activeId);
    if (!activeTask) return;

    const targetStatus = isTaskStatus(overId)
      ? overId
      : getTaskStatus(tasks, overId);
    if (!targetStatus) return;

    const overTaskId = isTaskStatus(overId) ? null : overId;
    const targetPosition = getDropPosition(
      allTasksByStatus[targetStatus],
      activeId,
      overTaskId,
    );

    const statusChanged = activeTask.status !== targetStatus;
    const positionChanged = activeTask.position !== targetPosition;
    if (!statusChanged && !positionChanged) return;

    await moveTask(activeId, {
      position: targetPosition,
      ...(statusChanged && { status: targetStatus }),
    });
  }

  return (
    <main className="min-h-screen bg-canvas text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <Sidebar />

        <section className="flex min-w-0 flex-col">
          <BoardHeader
            columnFilters={columnFilters}
            error={error}
            isBusy={isBusy}
            newTaskTitle={newTaskTitle}
            newTaskRecursWeekly={newTaskRecursWeekly}
            newTaskWeekday={newTaskWeekday}
            disabledTemplateIds={pendingTaskIds}
            onCreateTask={handleCreateTask}
            onDeleteTemplate={handleDeleteTemplate}
            onRefresh={() => void fetchTasks()}
            onRecursWeeklyChange={setNewTaskRecursWeekly}
            onSearchChange={setSearchTerm}
            onTitleChange={setNewTaskTitle}
            onToggleColumn={handleToggleColumn}
            onWeekdayChange={setNewTaskWeekday}
            searchTerm={searchTerm}
            stats={stats}
            templates={templates}
          />

          <div className="flex-1 overflow-x-auto p-4 sm:p-6">
            <DndContext
              collisionDetection={boardCollisionDetection}
              onDragCancel={() => setActiveTask(null)}
              onDragEnd={(event) => void handleDragEnd(event)}
              onDragStart={handleDragStart}
              sensors={sensors}
            >
              <div
                className="grid gap-4"
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
                    onCreateSubtask={handleCreateSubtask}
                    onDeleteTask={handleDeleteTask}
                    onUpdateDueDate={handleUpdateDueDate}
                    onUpdateStatus={handleUpdateStatus}
                    onUpdateTitle={handleUpdateTitle}
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
          </div>
        </section>
      </div>
    </main>
  );
}
