"use client";

import { useEffect, useMemo } from "react";
import { AppShell } from "@/src/components/AppShell";
import { ApplicationForm } from "@/src/modules/jobApplications/components/ApplicationForm";
import {
  ApplicationPipeline,
  REJECTION_TAKEAWAY_PREFIX,
} from "@/src/modules/jobApplications/components/ApplicationPipeline";
import { FunnelPanel } from "@/src/modules/jobApplications/components/FunnelPanel";
import { CompanyPanel } from "@/src/modules/jobApplications/components/CompanyPanel";
import { InterviewPanel } from "@/src/modules/jobApplications/components/InterviewPanel";
import type { ApplicationStage } from "@/src/modules/jobApplications/types";
import { useApplicationStore } from "@/src/modules/jobApplications/useApplicationStore";

export function JobApplicationCrm() {
  const store = useApplicationStore();
  const { fetchAll } = store;
  const pending = useMemo(() => new Set(store.pendingIds), [store.pendingIds]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  function deleteCompany(id: string, name: string, hasApplications: boolean) {
    const warning = hasApplications
      ? " Existing applications will remain as historical records."
      : "";
    if (window.confirm(`Delete company "${name}"?${warning}`))
      void store.deleteCompany(id);
  }
  function deleteApplication(id: string, role: string) {
    if (window.confirm(`Delete application "${role}"?`))
      void store.deleteApplication(id);
  }
  function deleteInterview(id: string) {
    if (window.confirm("Delete this interview?"))
      void store.deleteInterview(id);
  }
  function changeStage(id: string, stage: ApplicationStage) {
    void store.updateApplicationStage(id, stage);
  }
  function saveRejectionTakeaway(id: string, takeaway: string) {
    const application = store.applications.find((item) => item.id === id);
    if (!application) return;
    const notes = application.notes?.trim();
    void store.updateApplication(id, {
      notes: notes
        ? `${notes}\n${REJECTION_TAKEAWAY_PREFIX} ${takeaway}`
        : `${REJECTION_TAKEAWAY_PREFIX} ${takeaway}`,
    });
  }

  return (
    <AppShell activeHref="/applications" title="Job CRM">
      <section className="min-w-0 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-medium text-muted">Job search funnel</p>
            <h2 className="mt-1 text-3xl font-semibold">
              Applications and interviews
            </h2>
          </div>
          <button
            className="h-10 rounded-md border border-input bg-surface px-4 text-sm"
            disabled={store.isLoading}
            onClick={() => void store.fetchAll()}
            type="button"
          >
            Refresh
          </button>
        </header>
        {store.error ? (
          <p className="mx-4 mt-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger sm:mx-6 lg:mx-8">
            {store.error}
          </p>
        ) : null}

        <div className="mt-8 grid gap-8 px-4 pb-6 sm:px-6 lg:px-8">
          <FunnelPanel funnel={store.funnel()} />
          <div className="overflow-x-auto">
            <ApplicationPipeline
              applications={store.applications}
              companies={store.companies}
              onDelete={deleteApplication}
              onStageChange={changeStage}
              pendingIds={pending}
              onSaveRejectionTakeaway={saveRejectionTakeaway}
            />
          </div>
        </div>

        <details
          className="mx-4 mb-6 rounded-lg border border-border bg-surface sm:mx-6 lg:mx-8"
          open
        >
          <summary className="cursor-pointer px-5 py-4 text-lg font-semibold text-foreground">
            Add to your pipeline
          </summary>
          <div className="grid gap-6 border-t border-border p-5 lg:grid-cols-2 xl:grid-cols-3">
            <CompanyPanel
              applications={store.applications}
              companies={store.companies}
              disabled={store.isCreating}
              onCreate={store.createCompany}
              onDelete={deleteCompany}
              pendingIds={pending}
            />
            <ApplicationForm
              companies={store.companies}
              disabled={store.isCreating}
              onCreate={store.createApplication}
            />
            <InterviewPanel
              applications={store.applications}
              companies={store.companies}
              disabled={store.isCreating}
              interviews={store.interviews}
              onComplete={store.markInterviewCompleted}
              onCreate={store.createInterview}
              onDelete={deleteInterview}
              onSavePostMortem={(id, notes) =>
                store.updateInterview(id, { postMortemNotes: notes })
              }
              pendingIds={pending}
            />
          </div>
        </details>
      </section>
    </AppShell>
  );
}
