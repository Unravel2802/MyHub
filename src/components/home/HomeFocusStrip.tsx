"use client";

import { format } from "date-fns";
import { CheckSquare } from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { hueVar, type HueName } from "@/src/components/moduleHues";
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
    <div
      className="relative overflow-hidden rounded-xl px-4 py-3.5 transition-opacity duration-300"
      style={{
        ["--hue" as string]: hueVar(hue),
        background: "var(--surface)",
        boxShadow: checked
          ? "0 0 0 0.5px color-mix(in srgb, var(--border) 100%, transparent), inset 0 1px 0 color-mix(in srgb, white 6%, transparent)"
          : "0 0 0 0.5px color-mix(in srgb, var(--hue) 32%, transparent), inset 0 1px 0 color-mix(in srgb, white 6%, transparent), 0 0 0 3px color-mix(in srgb, var(--hue) 6%, transparent), 0 4px 16px color-mix(in srgb, black 22%, transparent)",
        opacity: isPending || checked ? 0.55 : 1,
      }}
    >
      {/* Hairline accent across the top edge, fading at both ends. Gone once
          checked — the accent is "this needs attention," which is no longer
          true. */}
      {checked ? null : (
        <span
          aria-hidden="true"
          className="absolute inset-x-[12%] top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--hue) 60%, transparent), transparent)",
          }}
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-md"
            style={{
              background: "color-mix(in srgb, var(--hue) 12%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--hue) 26%, transparent)",
            }}
          >
            <CheckSquare className="size-3" style={{ color: "var(--hue)" }} />
          </span>

          <div className="min-w-0">
            <p
              className={clsx(
                "truncate text-sm font-medium leading-snug text-foreground",
                checked && "line-through",
              )}
            >
              {task.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {isOverdue && !checked ? "Overdue · " : ""}
              {formatDueDate(task.dueDate)}
            </p>
          </div>
        </div>

        {/* A real control, not the prototype's decorative circle: completing
            from here goes through the store, so the cascade, completedAt and
            the Momentum streak all behave exactly as they do on the board.
            `-m-2 p-2` extends the actual click/tap target well past the
            visible 16px ring — that ring alone is too small a target to
            reliably hit with a mouse, let alone a finger. */}
        <button
          aria-label={`Mark "${task.title}" done`}
          className="-m-2 flex shrink-0 cursor-pointer items-center justify-center p-2 disabled:cursor-default"
          disabled={isPending || checked}
          onClick={handleCheck}
          type="button"
        >
          <span
            className="flex size-4 items-center justify-center rounded-full transition-colors"
            style={{
              background: checked ? "var(--hue)" : "transparent",
              border: checked
                ? "1px solid var(--hue)"
                : "1px solid color-mix(in srgb, var(--hue) 40%, transparent)",
              boxShadow: checked
                ? "0 0 8px color-mix(in srgb, var(--hue) 60%, transparent)"
                : "none",
            }}
          >
            {checked ? (
              <svg
                aria-hidden="true"
                fill="none"
                height="6"
                viewBox="0 0 8 6"
                width="8"
              >
                <path
                  d="M1 3l2 2 4-4"
                  stroke="white"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                />
              </svg>
            ) : null}
          </span>
        </button>
      </div>
    </div>
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
      <h2
        className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted"
        id="todays-focus-heading"
      >
        Today&apos;s focus
      </h2>
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
