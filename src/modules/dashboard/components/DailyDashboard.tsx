"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useEffect } from "react";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import type { TargetProgress } from "@/src/modules/prep/prepTargets";
import { useDashboardStore } from "@/src/modules/dashboard/useDashboardStore";

const targetLabels = [
  ["algorithm", "Algorithms"],
  ["systemDesign", "System design"],
  ["mlSystemDesign", "ML system design"],
  ["mockInterview", "Mock interviews"],
] as const;

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
      <div
        className="h-full rounded-full bg-accent transition-[width]"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

function TargetCard({
  label,
  target,
}: {
  label: string;
  target: TargetProgress;
}) {
  const met = target.actual >= target.target;
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p
          className={`text-sm font-semibold ${met ? "text-accent-strong" : "text-foreground"}`}
        >
          {target.actual}/{target.target}
        </p>
      </div>
      <ProgressBar value={target.progress} />
      <p className="mt-2 text-xs text-muted">
        {met
          ? `Target met (${Math.round(target.progress * 100)}%)`
          : `${Math.round(target.progress * 100)}% complete`}
      </p>
    </div>
  );
}

function CadenceCard({
  label,
  count,
  target,
}: {
  label: string;
  count: number;
  target: { min: number; max?: number };
}) {
  const targetText = target.max
    ? `${target.min}-${target.max}`
    : `${target.min}+`;
  const status =
    count >= target.min ? "On target" : `${target.min - count} to go`;
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{count}</p>
      <p className="mt-1 text-sm text-muted">Target {targetText} this week</p>
      <p
        className={`mt-3 text-xs font-medium ${count >= target.min ? "text-accent-strong" : "text-danger"}`}
      >
        {status}
      </p>
    </div>
  );
}

export function DailyDashboard() {
  const dashboard = useDashboardStore();
  const { fetchAll, subscribeToUpdates } = dashboard;

  useEffect(() => {
    void fetchAll();
    return subscribeToUpdates();
  }, [fetchAll, subscribeToUpdates]);

  return (
    <main className="min-h-screen bg-canvas text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-8 border-b border-border bg-surface px-6 py-6 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:border-b-0 lg:border-r">
          <div>
            <p className="text-sm font-semibold text-accent-strong">MyHub</p>
            <h1 className="mt-2 text-2xl font-semibold">Daily Dashboard</h1>
            <nav aria-label="MyHub modules" className="mt-6 grid gap-2 text-sm">
              <Link
                aria-current="page"
                className="rounded-md bg-surface-subtle px-3 py-2 font-medium"
                href="/dashboard"
              >
                Dashboard
              </Link>
              <Link
                className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                href="/"
              >
                Task Engine
              </Link>
              <Link
                className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                href="/prep"
              >
                Prep Tracker
              </Link>
              <Link
                className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                href="/applications"
              >
                Job CRM
              </Link>
              <Link
                className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                href="/outreach"
              >
                Outreach Log
              </Link>
            </nav>
          </div>
          <div className="lg:mt-auto">
            <ThemeToggle />
          </div>
        </aside>

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
            <p className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
              {dashboard.error}
            </p>
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
                <p className="mt-3 text-sm text-muted">
                  No recurring blocks scheduled this week.
                </p>
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
                    label="Applications"
                    count={dashboard.weeklyCadence.applications.count}
                    target={dashboard.weeklyCadence.applications.target}
                  />
                  <CadenceCard
                    label="Outreach"
                    count={dashboard.weeklyCadence.outreach.count}
                    target={dashboard.weeklyCadence.outreach.target}
                  />
                  <CadenceCard
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
                  {targetLabels.map(([key, label]) => (
                    <TargetCard
                      key={key}
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
                <p className="mt-3 text-sm text-muted">Nothing is overdue.</p>
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
                <p className="mt-3 text-sm text-muted">
                  No completed interviews need notes.
                </p>
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
                    value={
                      dashboard.gateChecklist.total === 0
                        ? 0
                        : dashboard.gateChecklist.completed /
                          dashboard.gateChecklist.total
                    }
                  />
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  No gate checklist found for this month.
                </p>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
