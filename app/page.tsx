"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTaskStore } from "@/src/modules/task/useTaskStore";
import type { Task, TaskStatus } from "@/src/modules/task/types";

type ColumnConfig = {
  status: TaskStatus;
  title: string;
  description: string;
  accent: string;
  emptyCopy: string;
};

const columns: ColumnConfig[] = [
  {
    status: "inbox",
    title: "Inbox",
    description: "New captures waiting for triage",
    accent: "bg-sky-500",
    emptyCopy: "New quick captures will show up here.",
  },
  {
    status: "todo",
    title: "Todo",
    description: "Ready to start next",
    accent: "bg-amber-500",
    emptyCopy: "Prioritized tasks will show up here.",
  },
  {
    status: "in_progress",
    title: "In Progress",
    description: "Current focus",
    accent: "bg-teal-600",
    emptyCopy: "Move a task here when work starts.",
  },
  {
    status: "done",
    title: "Done",
    description: "Completed this week",
    accent: "bg-zinc-500",
    emptyCopy: "Completed tasks will show up here.",
  },
];

const navItems = ["Board", "Inbox", "Calendar", "Archive"];

function formatStatus(status: TaskStatus) {
  return columns.find((column) => column.status === status)?.title ?? status;
}

function formatDueDate(dueDate: string | null) {
  if (!dueDate) return "No due date";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dueDate}T00:00:00`));
}

function getNextStatus(status: TaskStatus): TaskStatus | null {
  if (status === "inbox") return "todo";
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "done";
  return null;
}

export default function Home() {
  const {
    tasks,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateStatus,
  } = useTaskStore();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const visibleTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const activeTasks = tasks.filter((task) => !task.deletedAt);

    if (!normalizedSearch) return activeTasks;

    return activeTasks.filter((task) =>
      task.title.toLowerCase().includes(normalizedSearch),
    );
  }, [searchTerm, tasks]);

  const tasksByStatus = useMemo(
    () =>
      columns.reduce<Record<TaskStatus, Task[]>>(
        (acc, column) => {
          acc[column.status] = visibleTasks
            .filter((task) => task.status === column.status)
            .sort((a, b) => a.position - b.position);
          return acc;
        },
        {
          inbox: [],
          todo: [],
          in_progress: [],
          done: [],
        },
      ),
    [visibleTasks],
  );

  const stats = useMemo(
    () => [
      {
        label: "Open tasks",
        value: tasks.filter((task) => task.status !== "done" && !task.deletedAt)
          .length,
      },
      {
        label: "Due today",
        value: tasks.filter(
          (task) =>
            task.dueDate === new Date().toISOString().slice(0, 10) &&
            !task.deletedAt,
        ).length,
      },
      {
        label: "Completed",
        value: tasks.filter((task) => task.status === "done" && !task.deletedAt)
          .length,
      },
    ],
    [tasks],
  );

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    setNewTaskTitle("");
    await createTask({ title });
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-zinc-200 bg-white px-6 py-6 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-sm font-semibold text-teal-700">MyHub</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">
              Task Engine
            </h1>
          </div>

          <nav className="mt-8 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {navItems.map((item) => (
              <button
                key={item}
                className={`h-10 rounded-md px-3 text-left text-sm font-medium transition-colors ${
                  item === "Board"
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="border-b border-zinc-200 bg-white px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">
                  Personal productivity
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-normal">
                  Kanban board
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="task-search">
                  Search tasks
                </label>
                <input
                  id="task-search"
                  className="h-10 min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 sm:w-64"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search tasks"
                  type="search"
                  value={searchTerm}
                />
                <form className="flex gap-2" onSubmit={handleCreateTask}>
                  <label className="sr-only" htmlFor="new-task-title">
                    New task title
                  </label>
                  <input
                    id="new-task-title"
                    className="h-10 min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 sm:w-56"
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="New inbox task"
                    value={newTaskTitle}
                  />
                  <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
                    Add
                  </button>
                </form>
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-zinc-200 bg-stone-50 px-4 py-3"
                >
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-x-auto p-4 sm:p-6">
            <div className="grid min-w-[960px] gap-4 xl:grid-cols-4">
              {columns.map((column) => {
                const columnTasks = tasksByStatus[column.status];

                return (
                  <section
                    key={column.status}
                    className="flex min-h-[520px] flex-col rounded-lg border border-zinc-200 bg-white"
                  >
                    <div className="border-b border-zinc-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${column.accent}`}
                          />
                          <h3 className="truncate text-sm font-semibold">
                            {column.title}
                          </h3>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          {columnTasks.length}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        {column.description}
                      </p>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-3">
                      {isLoading ? (
                        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-stone-50 p-6 text-center">
                          <p className="text-sm leading-6 text-zinc-500">
                            Loading tasks...
                          </p>
                        </div>
                      ) : columnTasks.length > 0 ? (
                        columnTasks.map((task) => {
                          const nextStatus = getNextStatus(task.status);

                          return (
                            <article
                              key={task.id}
                              className="rounded-md border border-zinc-200 bg-stone-50 p-4 shadow-sm transition-colors hover:border-zinc-300"
                            >
                              <h4 className="text-sm font-semibold leading-6">
                                {task.title}
                              </h4>
                              <p className="mt-1 text-sm leading-5 text-zinc-600">
                                {formatStatus(task.status)}
                              </p>
                              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
                                <span>{formatDueDate(task.dueDate)}</span>
                                {nextStatus ? (
                                  <button
                                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950"
                                    onClick={() =>
                                      void updateStatus(task.id, nextStatus)
                                    }
                                  >
                                    Move to {formatStatus(nextStatus)}
                                  </button>
                                ) : (
                                  <span>Complete</span>
                                )}
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-stone-50 p-6 text-center">
                          <p className="max-w-40 text-sm leading-6 text-zinc-500">
                            {column.emptyCopy}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
