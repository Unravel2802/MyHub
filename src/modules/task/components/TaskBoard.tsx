"use client";

import {
  closestCorners,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BoardColumn } from "@/src/modules/task/components/BoardColumn";
import { BoardHeader } from "@/src/modules/task/components/BoardHeader";
import { Sidebar } from "@/src/modules/task/components/Sidebar";
import { columns } from "@/src/modules/task/taskBoardConfig";
import {
  filterVisibleTasks,
  getDropPosition,
  getTaskStats,
  getTaskStatus,
  groupTasksByStatus,
  isTaskStatus,
} from "@/src/modules/task/taskBoardUtils";
import { canAddSubtask, taskDepth } from "@/src/modules/task/taskTree";
import type { TaskStatus } from "@/src/modules/task/types";
import { useTaskStore } from "@/src/modules/task/useTaskStore";

export function TaskBoard() {
  const {
    tasks,
    isLoading,
    isCreating,
    pendingIds,
    error,
    fetchTasks,
    createTask,
    updateTask,
    updateStatus,
    moveTask,
    deleteTask,
  } = useTaskStore();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

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
    await createTask({ title });
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

  async function handleDragEnd(event: DragEndEvent) {
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
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <Sidebar />

        <section className="flex min-w-0 flex-col">
          <BoardHeader
            error={error}
            isBusy={isBusy}
            newTaskTitle={newTaskTitle}
            onCreateTask={handleCreateTask}
            onRefresh={() => void fetchTasks()}
            onSearchChange={setSearchTerm}
            onTitleChange={setNewTaskTitle}
            searchTerm={searchTerm}
            stats={stats}
          />

          <div className="flex-1 overflow-x-auto p-4 sm:p-6">
            <DndContext
              collisionDetection={closestCorners}
              onDragEnd={(event) => void handleDragEnd(event)}
              sensors={sensors}
            >
              <div className="grid min-w-[960px] gap-4 xl:grid-cols-4">
                {columns.map((column) => (
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
            </DndContext>
          </div>
        </section>
      </div>
    </main>
  );
}
