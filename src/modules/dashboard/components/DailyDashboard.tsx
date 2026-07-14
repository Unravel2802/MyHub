"use client";

import { format } from "date-fns";
import { useEffect } from "react";
import { AppShell } from "@/src/components/AppShell";
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

const targetLabels = [
  ["algorithm", "Algorithms"],
  ["systemDesign", "System design"],
  ["mlSystemDesign", "ML system design"],
  ["mockInterview", "Mock interviews"],
] as const;

export function DailyDashboard() {
  const dashboard = useDashboardStore();
  const streak = useMomentumStore((state) => state.streak);
  const { fetchAll, subscribeToUpdates } = dashboard;

  useEffect(() => {
    void fetchAll();
    return subscribeToUpdates();
  }, [fetchAll, subscribeToUpdates]);

  return (
    <AppShell activeHref="/dashboard" title="Daily Dashboard">
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
            <h2 className="mt-1 text-3xl font-semibold">
              Keep the week honest
            </h2>
          </div>
          <button
            className="h-10 rounded-md border border-input bg-surface px-4 text-sm text-body hover:border-input-hover disabled:opacity-60"
            disabled={dashboard.isLoading}
            onClick={() => void fetchAll()}
            type="button"
          >
            Refresh
          </button>
        </header>

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
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h3 className="text-lg font-semibold" id="schedule-heading">
              This week&apos;s schedule
            </h3>
            {dashboard.scheduleBlocks.length === 0 ? (
              <EmptyState
                description="Give the week a reliable shape by turning a recurring task into a scheduled block."
                action={<Link href="/tasks">Create a recurring task</Link>}
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
            className="rounded-lg border border-border bg-surface p-5"
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
            className="rounded-lg border border-border bg-surface p-5 xl:col-span-2"
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
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h3 className="text-lg font-semibold" id="followups-heading">
              Applications needing follow-up
            </h3>
            {dashboard.followUps.length === 0 ? (
              <EmptyState
                description="Your pipeline is clear. Keep it that way by logging the next follow-up when a conversation happens."
                action={<Link href="/applications">Review applications</Link>}
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
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h3 className="text-lg font-semibold" id="postmortem-heading">
              Interview post-mortems
            </h3>
            {dashboard.postMortemReminders.length === 0 ? (
              <EmptyState
                description="Complete an interview and capture what you learned while the details are still fresh."
                action={<Link href="/applications">Open interview log</Link>}
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
            aria-labelledby="gate-heading"
            className="rounded-lg border border-border bg-surface p-5 xl:col-span-2"
          >
            <h3 className="text-lg font-semibold" id="gate-heading">
              Current gate checklist
            </h3>
            {dashboard.gateChecklist ? (
              <>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>
                    {dashboard.gateChecklist.completed}/
                    {dashboard.gateChecklist.total} complete
                  </span>
                  <span className="text-muted">
                    {dashboard.gateChecklist.task.title}
                  </span>
                </div>
                <ProgressBar
                  progress={
                    dashboard.gateChecklist.total === 0
                      ? 0
                      : dashboard.gateChecklist.completed /
                        dashboard.gateChecklist.total
                  }
                />
              </>
            ) : (
              <EmptyState
                description="The monthly gate appears when its checklist task is created in Task Engine."
                action={<Link href="/tasks">Open Task Engine</Link>}
                title="No gate checklist yet"
              />
            )}
          </section>
        </div>
      </section>
    </AppShell>
  );
}
