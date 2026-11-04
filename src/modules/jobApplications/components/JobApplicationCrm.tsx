"use client";

import { useEffect, useMemo } from "react";
import { Briefcase } from "lucide-react";
import { RefreshButton } from "@/src/components/ui/RefreshButton";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { QuickAddApplication } from "@/src/modules/jobApplications/components/QuickAddApplication";
import { ApplicationTable } from "@/src/modules/jobApplications/components/ApplicationTable";
import { FunnelPanel } from "@/src/modules/jobApplications/components/FunnelPanel";
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
          document.getElementById("new-application-company")?.focus();
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
  async function quickCreate(companyName: string, roleTitle: string) {
    let company = useApplicationStore
      .getState()
      .companies.find(
        (item) =>
          item.name.toLocaleLowerCase() === companyName.toLocaleLowerCase(),
      );
    if (!company) {
      await store.createCompany({ name: companyName, tier: "match" });
      const state = useApplicationStore.getState();
      if (state.error) return false;
      company = state.companies.find(
        (item) =>
          item.name.toLocaleLowerCase() === companyName.toLocaleLowerCase(),
      );
    }
    if (!company || company.id.startsWith("optimistic-")) return false;
    await store.createApplication({
      companyId: company.id,
      roleTitle,
      resumeVariant: "swe_backend",
      stage: "researching",
    });
    return !useApplicationStore.getState().error;
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
      eyebrow="Job search"
      hero={null}
      href="/applications"
      icon={Briefcase}
      navTitle="Job CRM"
      title="Applications"
      description="A simple place to keep your job search moving."
    >
      <div className="grid min-w-0 gap-4">
        <ApplicationTable
          applications={store.applications}
          companies={store.companies}
          isLoading={store.isLoading}
          onDelete={deleteApplication}
          onStageChange={changeStage}
          onUpdate={store.updateApplication}
          pendingIds={pending}
        />
        <QuickAddApplication
          disabled={store.isCreating || store.isLoading}
          onCreate={quickCreate}
        />
      </div>
      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-body">
          Interviews · {store.interviews.length}
        </summary>
        <div className="border-t border-border p-4">
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
      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-body">
          Funnel statistics
        </summary>
        <div className="border-t border-border p-4">
          <FunnelPanel funnel={store.funnel()} />
        </div>
      </details>
    </PageTemplate>
  );
}
