"use client";

import { format } from "date-fns";
import { CheckSquare } from "lucide-react";
import { useEffect } from "react";
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

function FocusCard({
  index,
  task,
  today,
}: {
  index: number;
  task: Task;
  today: string;
}) {
  const updateStatus = useTaskStore((state) => state.updateStatus);
  const pendingIds = useTaskStore((state) => state.pendingIds);
  const isPending = pendingIds.includes(task.id);
  const isOverdue = task.dueDate !== null && task.dueDate < today;
  const hue = FOCUS_HUE_ROTATION[index % FOCUS_HUE_ROTATION.length];

  return (
    <div
      className="relative overflow-hidden rounded-xl px-4 py-3.5 transition-opacity"
      style={{
        ["--hue" as string]: hueVar(hue),
        background: "var(--surface)",
        boxShadow:
          "0 0 0 0.5px color-mix(in srgb, var(--hue) 32%, transparent), inset 0 1px 0 color-mix(in srgb, white 6%, transparent), 0 0 0 3px color-mix(in srgb, var(--hue) 6%, transparent), 0 4px 16px color-mix(in srgb, black 22%, transparent)",
        opacity: isPending ? 0.55 : 1,
      }}
    >
      {/* Hairline accent across the top edge, fading at both ends. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-[12%] top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--hue) 60%, transparent), transparent)",
        }}
      />

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
            <p className="truncate text-sm font-medium leading-snug text-foreground">
              {task.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {isOverdue ? "Overdue · " : ""}
              {formatDueDate(task.dueDate)}
            </p>
          </div>
        </div>

        {/* A real control, not the prototype's decorative circle: completing
            from here goes through the store, so the cascade, completedAt and
            the Momentum streak all behave exactly as they do on the board. */}
        <button
          aria-label={`Mark "${task.title}" done`}
          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full transition-colors hover:border-[color-mix(in_srgb,var(--hue)_70%,transparent)] disabled:opacity-50"
          disabled={isPending}
          onClick={() => void updateStatus(task.id, "done")}
          style={{
            border: "1px solid color-mix(in srgb, var(--hue) 40%, transparent)",
          }}
          type="button"
        />
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

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const today = format(new Date(), "yyyy-MM-dd");
  const items = focusTasks(tasks, today, FOCUS_LIMIT);

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
          <FocusCard index={index} key={task.id} task={task} today={today} />
        ))}
      </div>
    </section>
  );
}
