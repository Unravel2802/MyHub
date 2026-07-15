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
import { hueFor } from "@/src/components/moduleHues";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { register, unregister } from "@/src/lib/commandPalette";

export function JobApplicationCrm() {
  const store = useApplicationStore();
  const { fetchAll } = store;
  const pending = useMemo(() => new Set(store.pendingIds), [store.pendingIds]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    register("job-crm", [
      {
        id: "new-application",
        label: "New application",
        keywords: ["application", "job", "company", "pipeline"],
        action: () => {
          document
            .getElementById("new-application-heading")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      },
    ]);
    return () => unregister("job-crm");
  }, []);

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
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm"
              disabled={store.isLoading}
              onClick={() => void store.fetchAll()}
              type="button"
            >
              Refresh
            </button>
          }
          eyebrow="Job search funnel"
          bleed
          hue={hueFor("/applications")}
          title="Applications and interviews"
          className="mb-6"
        />
        {store.error ? (
          <p
            aria-live="assertive"
            className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {store.error}
          </p>
        ) : null}

        <div className="grid gap-8">
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

        {/* `open` by default. Collapsing the form outright doesn't just fail the
              specs — it hides the primary action from anyone tabbing through, and
              a disclosure you must find before you can do anything is worse than a
              form you can scroll past. Data-first is achieved by putting the form
              BELOW the data, not by hiding it. */}
        <details
          className="mb-6 rounded-lg border border-border bg-surface"
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
