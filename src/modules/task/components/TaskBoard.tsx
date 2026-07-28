"use client";

import {
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckSquare } from "lucide-react";
import { hueFor } from "@/src/components/moduleHues";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { StatCard } from "@/src/components/ui/StatCard";
import {
  filterVisibleTasks,
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
import { archivedTasks, boardTasks } from "@/src/modules/task/taskArchive";
import {
  BoardActions,
  BoardHeader,
} from "@/src/modules/task/components/BoardHeader";
import { TaskBoardCanvas } from "@/src/modules/task/components/TaskBoardCanvas";
import { format } from "date-fns";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";

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
    archiveTask,
    reopenTask,
    setColumnFilters,
  } = useTaskStore();
  // One `today` for the whole render, so the board can't disagree with itself
  // if a render happens to straddle midnight.
  const [today] = useState(() => new Date());
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
    register("task-engine", [
      {
        id: "new-task",
        label: "New task",
        keywords: ["task", "create", "inbox"],
        action: () => document.getElementById("new-task-title")?.focus(),
      },
      {
        id: "focus-search",
        label: "Focus search",
        keywords: ["task", "search", "filter"],
        action: () => document.getElementById("task-search")?.focus(),
      },
    ]);
    registerShortcuts("task-engine", [
      {
        combo: "n t",
        commandId: "task-engine.new-task",
        description: "Create a task",
      },
      {
        combo: "s t",
        commandId: "task-engine.focus-search",
        description: "Search tasks",
      },
    ]);
    return () => {
      unregisterShortcuts("task-engine");
      unregister("task-engine");
    };
  }, [fetchTasks, fetchTemplates]);

  // Archived tasks stay in `tasks` (Momentum needs their completedAt) but leave
  // the board. Done tasks age out automatically once their week passes, which is
  // what finally makes the Done column's "Completed this week" label honest.
  const onBoard = useMemo(() => boardTasks(tasks, today), [tasks, today]);
  const archived = useMemo(() => archivedTasks(tasks, today), [tasks, today]);

  const visibleTasks = useMemo(
    () => filterVisibleTasks(onBoard, searchTerm),
    [onBoard, searchTerm],
  );

  const tasksByStatus = useMemo(
    () => groupTasksByStatus(visibleTasks),
    [visibleTasks],
  );

  const allTasksByStatus = useMemo(
    () => groupTasksByStatus(filterVisibleTasks(onBoard, "")),
    [onBoard],
  );

  // format(), not .toISOString().slice(0, 10) — the latter reads the UTC date,
  // so "due today" was wrong for anyone not at UTC+0 (in UTC+7, everything
  // before 07:00 local counted against yesterday).
  const stats = useMemo(
    () => getTaskStats(onBoard, format(today, "yyyy-MM-dd")),
    [onBoard, today],
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

  function handleArchiveTask(id: string) {
    void archiveTask(id);
  }

  function handleReopenTask(id: string) {
    void reopenTask(id);
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

  const [openTasksStat, ...secondaryStats] = stats;

  return (
    <PageTemplate
      actions={
        <BoardActions
          isBusy={isBusy}
          newTaskRecursWeekly={newTaskRecursWeekly}
          newTaskTitle={newTaskTitle}
          newTaskWeekday={newTaskWeekday}
          onCreateTask={handleCreateTask}
          onRecursWeeklyChange={setNewTaskRecursWeekly}
          onRefresh={() => void fetchTasks()}
          onSearchChange={setSearchTerm}
          onTitleChange={setNewTaskTitle}
          onWeekdayChange={setNewTaskWeekday}
          searchTerm={searchTerm}
        />
      }
      error={error}
      eyebrow="Personal productivity"
      hero={
        openTasksStat ? (
          <StatCard
            hue={openTasksStat.value > 0 ? hueFor("/tasks") : undefined}
            label={openTasksStat.label}
            size="hero"
            value={openTasksStat.value}
            whenAbsent="Add your first task"
          />
        ) : null
      }
      href="/tasks"
      icon={CheckSquare}
      navTitle="Task Engine"
      stats={secondaryStats.map((stat) => (
        <StatCard key={stat.label} label={stat.label} value={stat.value} />
      ))}
      title="Kanban board"
    >
      <BoardHeader
        columnFilters={columnFilters}
        disabledTemplateIds={pendingTaskIds}
        onDeleteTemplate={handleDeleteTemplate}
        onToggleColumn={handleToggleColumn}
        templates={templates}
      />
      <TaskBoardCanvas
        activeTask={activeTask}
        archived={archived}
        canAddSubtaskIds={canAddSubtaskIds}
        childCounts={childCounts}
        depths={depths}
        isCreating={isCreating}
        isLoading={isLoading}
        pendingTaskIds={pendingTaskIds}
        sensors={sensors}
        tasksByStatus={tasksByStatus}
        visibleColumns={visibleColumns}
        onCreateSubtask={handleCreateSubtask}
        onDeleteTask={handleDeleteTask}
        onDragCancel={() => setActiveTask(null)}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragStart={handleDragStart}
        onArchiveTask={handleArchiveTask}
        onReopenTask={handleReopenTask}
        onUpdateDueDate={handleUpdateDueDate}
        onUpdateStatus={handleUpdateStatus}
        onUpdateTitle={handleUpdateTitle}
      />
    </PageTemplate>
  );
}
