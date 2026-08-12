"use client";

import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import type { HueName } from "@/src/components/moduleHues";
import { HUE_DOT } from "@/src/components/ui/hueClasses";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { TaskCard } from "@/src/components/ui/TaskCard";
import { focusTasks, formatDueDate } from "@/src/modules/task/taskBoardUtils";
import { useTaskStore } from "@/src/modules/task/useTaskStore";
import type { Task } from "@/src/modules/task/types";

const FOCUS_LIMIT = 3;

// Real tasks aren't tagged to a source module (Task Engine is one flat list,
// unlike the mockup's fake "Career · Prep Tracker" sub-labels), so there's no
// actual data to color these by. Rotating a fixed hue per POSITION is
// decorative variety only, not a claim about what a card belongs to — see
// HomeWorkspace's hues for what a real per-module color looks like. Amber
// first (Task Engine's own hue everywhere else in the app), then two more
// for visual distinction across the row.
const FOCUS_HUE_ROTATION: readonly HueName[] = ["amber", "violet", "emerald"];

// How long the card shows its checked state before HomeFocusStrip actually
// drops it from the list. Without this, clicking flips the task's status in
// the store and the very next render's `focusTasks()` filter excludes it
// immediately — the card just vanishes with no confirmation, which reads as
// "did that even register?" rather than "done."
const CHECK_ANIMATION_MS = 550;

function FocusCard({
  checked,
  index,
  onCheck,
  task,
  today,
}: {
  checked: boolean;
  index: number;
  onCheck: (id: string) => void;
  task: Task;
  today: string;
}) {
  const updateStatus = useTaskStore((state) => state.updateStatus);
  const pendingIds = useTaskStore((state) => state.pendingIds);
  const isPending = pendingIds.includes(task.id);
  const isOverdue = task.dueDate !== null && task.dueDate < today;
  const hue = FOCUS_HUE_ROTATION[index % FOCUS_HUE_ROTATION.length];

  const handleCheck = () => {
    onCheck(task.id);
    void updateStatus(task.id, "done");
  };

  return (
    <TaskCard
      accentClassName={HUE_DOT[hue]}
      checked={checked}
      completeLabel={`Mark "${task.title}" done`}
      disabled={isPending}
      label={task.title}
      meta={
        <>
          {isOverdue && !checked ? (
            <span className="font-medium text-danger">Overdue</span>
          ) : null}
          {isOverdue && !checked ? " · " : null}
          <span className="font-mono tabular-nums">
            {formatDueDate(task.dueDate)}
          </span>
        </>
      }
      onComplete={handleCheck}
    />
  );
}

// Overdue-or-due-today open tasks, surfaced outside the board itself. Hidden
// entirely once there's nothing urgent — an empty "focus" strip on a caught-up
// board is not information worth a permanent slot on the hub (see StatCard's
// "never headline absence" rule, applied here at the section level).
//
// Deliberately NOT wrapped in a Panel: these three cards ARE the section, and
// nesting cards inside a card gives the hub two competing container edges.
export function HomeFocusStrip() {
  const tasks = useTaskStore((state) => state.tasks);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const handleCheck = (id: string) => {
    setCheckedIds((prev) => new Set(prev).add(id));
    timersRef.current[id] = setTimeout(() => {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      delete timersRef.current[id];
    }, CHECK_ANIMATION_MS);
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const freshItems = focusTasks(tasks, today, FOCUS_LIMIT);
  // A task just marked done drops out of focusTasks() on the very next
  // render (it's no longer open) — without this, the card would vanish the
  // instant you click instead of showing its checked state first. Keep it
  // rendered, by its real row from `tasks`, until its check animation's
  // timer above clears the id.
  const lingering = tasks.filter(
    (task) =>
      checkedIds.has(task.id) && !freshItems.some((t) => t.id === task.id),
  );
  const items = [...freshItems, ...lingering];

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="todays-focus-heading">
      <SectionHeader className="mb-3" id="todays-focus-heading">
        Today&apos;s focus
      </SectionHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((task, index) => (
          <FocusCard
            checked={checkedIds.has(task.id)}
            index={index}
            key={task.id}
            onCheck={handleCheck}
            task={task}
            today={today}
          />
        ))}
      </div>
    </section>
  );
}
