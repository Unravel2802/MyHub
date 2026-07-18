"use client";

import { format } from "date-fns";
import {
  CalendarDays,
  Clock3,
  LayoutDashboard,
  Map as MapIcon,
  MessageSquareText,
} from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { StatCard } from "@/src/components/ui/StatCard";
import { EmptyState } from "@/src/components/ui/EmptyState";
import Link from "next/link";
import {
  CadenceCard,
  TargetCard,
} from "@/src/modules/dashboard/components/DashboardCards";
import { useDashboardStore } from "@/src/modules/dashboard/useDashboardStore";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";
import { ActivityHeatmap } from "@/src/modules/momentum/components/ActivityHeatmap";
import { useRoadmapStore } from "@/src/modules/roadmap/useRoadmapStore";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";

const targetLabels = [
  ["algorithm", "Algorithms"],
  ["systemDesign", "System design"],
  ["mlSystemDesign", "ML system design"],
  ["mockInterview", "Mock interviews"],
] as const;

export function DailyDashboard() {
  const dashboard = useDashboardStore();
  const streak = useMomentumStore((state) => state.streak);
  const activityGrid = useMomentumStore((state) => state.activityGrid);
  const roadmap = useRoadmapStore();
  const fetchRoadmap = useRoadmapStore((state) => state.fetchRoadmap);
  const { fetchAll, subscribeToUpdates } = dashboard;

  useEffect(() => {
    void fetchAll();
    return subscribeToUpdates();
  }, [fetchAll, subscribeToUpdates]);

  useEffect(() => {
    register("dashboard", [
      {
        id: "refresh",
        label: "Refresh dashboard",
        keywords: ["dashboard", "refresh", "reload"],
        action: () => document.getElementById("dashboard-refresh")?.click(),
      },
      {
        id: "focus-cadence",
        label: "View weekly cadence",
        keywords: ["dashboard", "weekly", "cadence", "targets"],
        action: () =>
          document
            .getElementById("cadence-heading")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      },
    ]);
    registerShortcuts("dashboard", [
      {
        combo: "r d",
        commandId: "dashboard.refresh",
        description: "Refresh the dashboard",
      },
      {
        combo: "c d",
        commandId: "dashboard.focus-cadence",
        description: "View weekly cadence",
      },
    ]);
    return () => {
      unregisterShortcuts("dashboard");
      unregister("dashboard");
    };
  }, []);

  useEffect(() => {
    void fetchRoadmap();
  }, [fetchRoadmap]);

  const currentGate = roadmap.months.find(
    (month) => month.month.key === roadmap.currentMonth,
  );

  return (
    <AppShell activeHref="/dashboard" title="Daily Dashboard">
      <section className="page-fade min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm text-body hover:border-input-hover disabled:opacity-60"
              disabled={dashboard.isLoading}
              id="dashboard-refresh"
              onClick={() => void fetchAll()}
              type="button"
            >
              Refresh
            </button>
          }
          bleed
          className="mb-6"
          eyebrow={format(new Date(), "EEEE, MMMM d")}
          hue={hueFor("/dashboard")}
          icon={LayoutDashboard}
          title="Keep the week honest"
        />

        {dashboard.error ? (
          <p
            aria-live="assertive"
            className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {dashboard.error}
          </p>
        ) : null}

        {dashboard.weeklyCadence ? (
          <div className="mb-6">
            <StatCard
              label="Streak + this week's cadence"
              hue={streak.current > 0 ? hueFor("/dashboard") : undefined}
              size="hero"
              tone={streak.current > 0 ? "accent" : "default"}
              value={`${streak.current} days · ${dashboard.weeklyCadence.applications.count} applications · ${dashboard.weeklyCadence.outreach.count} outreach`}
              hint={`${dashboard.weeklyCadence.mockInterviews.count} mock interviews logged${streak.activeToday ? " · Streak fed today" : " · Feed the streak today"}`}
            />
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <section
            aria-labelledby="schedule-heading"
            className="fade-up rounded-lg border border-border bg-surface p-5"
            style={{ ["--i" as string]: 0 }}
          >
            <h3 className="text-lg font-semibold" id="schedule-heading">
              This week&apos;s schedule
            </h3>
            {dashboard.scheduleBlocks.length === 0 ? (
              <EmptyState
                description="Give the week a reliable shape by turning a recurring task into a scheduled block."
                action={<Link href="/tasks">Create a recurring task</Link>}
                icon={CalendarDays}
                title="No recurring blocks yet"
              />
            ) : (
              <ul className="mt-3 grid gap-2">
                {dashboard.scheduleBlocks.map((task) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-3 py-2"
                    key={task.id}
                  >
                    <span className="text-sm font-medium">{task.title}</span>
                    <span className="text-xs text-muted">
                      {task.occurrenceDate}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="cadence-heading"
            className="fade-up rounded-lg border border-border bg-surface p-5"
            style={{ ["--i" as string]: 1 }}
          >
            <h3 className="text-lg font-semibold" id="cadence-heading">
              Weekly cadence
            </h3>
            {dashboard.weeklyCadence ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <CadenceCard
                  style={{ ["--i" as string]: 0 }}
                  label="Applications"
                  count={dashboard.weeklyCadence.applications.count}
                  target={dashboard.weeklyCadence.applications.target}
                />
                <CadenceCard
                  style={{ ["--i" as string]: 1 }}
                  label="Outreach"
                  count={dashboard.weeklyCadence.outreach.count}
                  target={dashboard.weeklyCadence.outreach.target}
                />
                <CadenceCard
                  style={{ ["--i" as string]: 2 }}
                  label="Mock interviews"
                  count={dashboard.weeklyCadence.mockInterviews.count}
                  target={dashboard.weeklyCadence.mockInterviews.target}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Loading cadence...</p>
            )}
          </section>

          <section
            aria-labelledby="prep-heading"
            className="fade-up rounded-lg border border-border bg-surface p-5 xl:col-span-2"
            style={{ ["--i" as string]: 2 }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold" id="prep-heading">
                  Prep checkpoint
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {dashboard.checkpointProgress?.checkpoint.label ??
                    "Loading targets..."}
                </p>
              </div>
              <div className="text-sm text-muted">
                Behavioral stories:{" "}
                {dashboard.behavioralStoryProgress
                  ? `${dashboard.behavioralStoryProgress.actual}/${dashboard.behavioralStoryProgress.target}`
                  : "..."}
              </div>
            </div>
            {dashboard.checkpointProgress ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {targetLabels.map(([key, label], index) => (
                  <TargetCard
                    key={key}
                    style={{ ["--i" as string]: index }}
                    label={label}
                    target={dashboard.checkpointProgress![key]}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section
            aria-labelledby="followups-heading"
            className="fade-up rounded-lg border border-border bg-surface p-5"
            style={{ ["--i" as string]: 3 }}
          >
            <h3 className="text-lg font-semibold" id="followups-heading">
              Applications needing follow-up
            </h3>
            {dashboard.followUps.length === 0 ? (
              <EmptyState
                description="Your pipeline is clear. Keep it that way by logging the next follow-up when a conversation happens."
                action={<Link href="/applications">Review applications</Link>}
                icon={Clock3}
                title="No follow-ups due"
              />
            ) : (
              <ul className="mt-3 grid gap-2">
                {dashboard.followUps.map((application) => (
                  <li
                    className="rounded-md bg-surface-subtle px-3 py-2"
                    key={application.id}
                  >
                    <p className="text-sm font-medium">
                      {application.roleTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {application.stage.replaceAll("_", " ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="postmortem-heading"
            className="fade-up rounded-lg border border-border bg-surface p-5"
            style={{ ["--i" as string]: 4 }}
          >
            <h3 className="text-lg font-semibold" id="postmortem-heading">
              Interview post-mortems
            </h3>
            {dashboard.postMortemReminders.length === 0 ? (
              <EmptyState
                description="Complete an interview and capture what you learned while the details are still fresh."
                action={<Link href="/applications">Open interview log</Link>}
                icon={MessageSquareText}
                title="No post-mortems due"
              />
            ) : (
              <ul className="mt-3 grid gap-2">
                {dashboard.postMortemReminders.map(
                  ({ interview, isOverdue }) => (
                    <li
                      className="rounded-md bg-surface-subtle px-3 py-2"
                      key={interview.id}
                    >
                      <p className="text-sm font-medium">
                        {interview.roundType.replaceAll("_", " ")}
                      </p>
                      <p
                        className={`mt-1 text-xs ${isOverdue ? "text-danger" : "text-muted"}`}
                      >
                        {isOverdue ? "Overdue" : "Due within 24 hours"}
                      </p>
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>

          <section
            aria-label="Recent activity"
            className="fade-up rounded-lg border border-border bg-surface p-5 xl:col-span-2"
            style={{ ["--i" as string]: 5 }}
          >
            <ActivityHeatmap grid={activityGrid} />
          </section>

          <section
            aria-labelledby="gate-heading"
            className="fade-up rounded-lg border border-border bg-surface p-5 xl:col-span-2"
            style={{ ["--i" as string]: 6 }}
          >
            <h3 className="text-lg font-semibold" id="gate-heading">
              Current gate checklist
            </h3>
            {currentGate ? (
              <>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>
                    {currentGate.metCount}/{currentGate.totalCount} complete
                  </span>
                  <span className="text-muted">{currentGate.month.label}</span>
                </div>
                <ProgressBar
                  progress={
                    currentGate.totalCount === 0
                      ? 0
                      : currentGate.metCount / currentGate.totalCount
                  }
                />
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {currentGate.month.gate ||
                    "No gate text is defined for this month."}
                </p>
              </>
            ) : (
              <EmptyState
                description="The roadmap gate will appear once the current month is loaded."
                action={<Link href="/roadmap">Open Roadmap</Link>}
                icon={MapIcon}
                title="Loading the current gate"
              />
            )}
          </section>
        </div>
      </section>
    </AppShell>
  );
}
