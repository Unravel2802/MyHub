"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BoardColumn } from "@/src/modules/task/components/BoardColumn";
import { BoardHeader } from "@/src/modules/task/components/BoardHeader";
import { Sidebar } from "@/src/modules/task/components/Sidebar";
import { columns } from "@/src/modules/task/taskBoardConfig";
import {
  filterVisibleTasks,
  getTaskStats,
  groupTasksByStatus,
} from "@/src/modules/task/taskBoardUtils";
import type { TaskStatus } from "@/src/modules/task/types";
import { useTaskStore } from "@/src/modules/task/useTaskStore";

export function TaskBoard() {
  const {
    tasks,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    updateStatus,
    deleteTask,
  } = useTaskStore();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(
    () => new Set(),
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

  const stats = useMemo(
    () => getTaskStats(tasks, new Date().toISOString().slice(0, 10)),
    [tasks],
  );

  const isBusy = isLoading || isCreating;

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    setIsCreating(true);
    setNewTaskTitle("");

    try {
      await createTask({ title });
    } finally {
      setIsCreating(false);
    }
  }

  async function runTaskAction(id: string, action: () => Promise<void>) {
    setPendingTaskIds((current) => new Set(current).add(id));

    try {
      await action();
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function handleUpdateTitle(id: string, title: string) {
    void runTaskAction(id, () => updateTask(id, { title }));
  }

  function handleUpdateDueDate(id: string, dueDate: string | null) {
    void runTaskAction(id, () => updateTask(id, { dueDate }));
  }

  function handleUpdateStatus(id: string, status: TaskStatus) {
    void runTaskAction(id, () => updateStatus(id, status));
  }

  function handleDeleteTask(id: string) {
    void runTaskAction(id, () => deleteTask(id));
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
            <div className="grid min-w-[960px] gap-4 xl:grid-cols-4">
              {columns.map((column) => (
                <BoardColumn
                  key={column.status}
                  column={column}
                  disabledTaskIds={pendingTaskIds}
                  isLoading={isLoading}
                  onDeleteTask={handleDeleteTask}
                  onUpdateDueDate={handleUpdateDueDate}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdateTitle={handleUpdateTitle}
                  tasks={tasksByStatus[column.status]}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
