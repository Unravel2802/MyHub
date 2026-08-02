"use client";

import { Flame } from "lucide-react";
import { useEffect } from "react";
import { Panel } from "@/src/components/ui/Panel";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useCountUp } from "@/src/components/home/useCountUp";
import { useDashboardStore } from "@/src/modules/dashboard/useDashboardStore";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";

function CadenceStat({
  label,
  value,
  target,
}: {
  label: string;
  value: number | null;
  target?: number;
}) {
  const count = useCountUp(value ?? 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {value === null ? "—" : count}
        </span>
        {target ? (
          <span className="text-xs tabular-nums text-subtle">/ {target}</span>
        ) : null}
      </div>
      {target ? <ProgressBar progress={(value ?? 0) / target} /> : null}
    </div>
  );
}

// The hub's idle-state panel (shown when no orbit node is hovered/focused).
// Reuses two already-published stores rather than fetching anything new:
// useMomentumStore's streak (mounted globally by AppShell, already fresh by
// the time this renders) and useDashboardStore's weeklyCadence (the same
// applications/outreach/mock-interview counts the Daily Dashboard shows,
// myhub_plan.md Part A §A.2). No new selector, no new repository call.
export function HomeMomentumPanel() {
  const streak = useMomentumStore((state) => state.streak);
  const weeklyCadence = useDashboardStore((state) => state.weeklyCadence);
  const fetchDashboard = useDashboardStore((state) => state.fetchAll);
  const streakCount = useCountUp(streak.current, 1200);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return (
    <Panel>
      <div className="mb-5 flex items-center gap-2">
        <Flame aria-hidden="true" className="size-3.5 text-accent-strong" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Momentum
        </span>
      </div>

      <div className="mb-5 flex items-end gap-4">
        <div className="relative">
          {/* Only lit when the streak is actually alive — a dead streak must
              never look celebratory (the rule StreakIndicator already follows). */}
          {/* A RADIAL gradient, not a filled shape. `-inset-4` on a solid
              rounded-full box renders as a hard purple pill behind the digits,
              because the number's box is tall and narrow — the blur never gets
              rid of the edge. This fades to transparent on its own. */}
          {streak.activeToday ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 size-32 -translate-x-1/2 -translate-y-1/2 blur-2xl"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent) 0%, transparent 70%)",
              }}
            />
          ) : null}
          <span className="relative text-6xl font-bold leading-none tabular-nums tracking-tight text-foreground">
            {streakCount}
          </span>
        </div>
        <p className="mb-1 text-sm leading-tight text-muted">
          day{streak.current === 1 ? "" : "s"}
          <br />
          streak
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5 border-t border-border pt-5">
        <CadenceStat
          label="Applications"
          target={weeklyCadence?.applications.target.max}
          value={weeklyCadence?.applications.count ?? null}
        />
        <CadenceStat
          label="Outreach"
          target={weeklyCadence?.outreach.target.max}
          value={weeklyCadence?.outreach.count ?? null}
        />
        <CadenceStat
          label="Mock interviews"
          target={weeklyCadence?.mockInterviews.target.min}
          value={weeklyCadence?.mockInterviews.count ?? null}
        />
      </div>
    </Panel>
  );
}
