"use client";

import { useEffect, useMemo } from "react";
import { Briefcase } from "lucide-react";
import { RefreshButton } from "@/src/components/ui/RefreshButton";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
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
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";

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
      {
        id: "refresh",
        label: "Refresh job pipeline",
        keywords: ["jobs", "applications", "refresh", "reload"],
        action: () => document.getElementById("job-crm-refresh")?.click(),
      },
    ]);
    registerShortcuts("job-crm", [
      {
        combo: "n a",
        commandId: "job-crm.new-application",
        description: "Create an application",
      },
      {
        combo: "r a",
        commandId: "job-crm.refresh",
        description: "Refresh the job pipeline",
      },
    ]);
    return () => {
      unregisterShortcuts("job-crm");
      unregister("job-crm");
    };
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
    <PageTemplate
      actions={
        <RefreshButton
          id="job-crm-refresh"
          isRefreshing={store.isLoading}
          onClick={() => void store.fetchAll()}
        />
      }
      error={store.error}
      eyebrow="Job search funnel"
      hero={null}
      href="/applications"
      icon={Briefcase}
      navTitle="Job CRM"
      title="Applications and interviews"
      compose={
        /* `open` by default. Collapsing the form outright doesn't just fail the
           specs — it hides the primary action from anyone tabbing through, and
           a disclosure you must find before you can do anything is worse than a
           form you can scroll past. The template keeps this composer after the
           pipeline data without hiding it. */
        <details className="rounded-lg border border-border bg-surface" open>
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
      }
    >
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
    </PageTemplate>
  );
}
