"use client";

import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import * as CompanyRepository from "@/src/modules/jobApplications/CompanyRepository";
import type { Company } from "@/src/modules/jobApplications/types";
import { OutreachEntryForm } from "@/src/modules/outreach/components/OutreachEntryForm";
import { OutreachEntryList } from "@/src/modules/outreach/components/OutreachEntryList";
import { useOutreachStore } from "@/src/modules/outreach/useOutreachStore";
import { useDashboardStore } from "@/src/modules/dashboard/useDashboardStore";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";

export function OutreachLog() {
  const {
    entries,
    isLoading,
    isCreating,
    pendingIds,
    error,
    fetchEntries,
    createEntry,
    deleteEntry,
  } = useOutreachStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const {
    weeklyCadence,
    fetchAll: fetchDashboard,
    subscribeToUpdates,
  } = useDashboardStore();
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    register("outreach", [
      {
        id: "new-entry",
        label: "Log outreach",
        keywords: ["outreach", "contact", "conversation", "referral"],
        action: () => {
          document
            .getElementById("log-outreach-heading")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      },
      {
        id: "refresh",
        label: "Refresh outreach log",
        keywords: ["outreach", "refresh", "reload"],
        action: () => document.getElementById("outreach-refresh")?.click(),
      },
    ]);
    registerShortcuts("outreach", [
      {
        combo: "n o",
        commandId: "outreach.new-entry",
        description: "Log outreach",
      },
      {
        combo: "r o",
        commandId: "outreach.refresh",
        description: "Refresh outreach data",
      },
    ]);
    return () => {
      unregisterShortcuts("outreach");
      unregister("outreach");
    };
  }, []);

  useEffect(() => {
    void fetchDashboard();
    return subscribeToUpdates();
  }, [fetchDashboard, subscribeToUpdates]);

  useEffect(() => {
    let cancelled = false;
    async function loadCompanies() {
      try {
        const nextCompanies = await CompanyRepository.getCompanies();
        if (!cancelled) {
          setCompanies(nextCompanies);
          setCompanyError(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setCompanies([]);
          setCompanyError("Something went wrong, please try again later.");
        }
      }
    }

    void loadCompanies();
    return () => {
      cancelled = true;
    };
  }, []);

  function confirmDelete(id: string, label: string) {
    if (window.confirm(`Delete outreach conversation "${label}"?`)) {
      void deleteEntry(id);
    }
  }

  return (
    <AppShell activeHref="/outreach" title="Outreach Log">
      <section className="page-fade min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm text-body hover:border-input-hover"
              disabled={isLoading}
              id="outreach-refresh"
              onClick={() => void fetchEntries()}
              type="button"
            >
              Refresh
            </button>
          }
          bleed
          className="mb-6"
          eyebrow="Referral and outreach tracking"
          hue={hueFor("/outreach")}
          icon={Send}
          title="Keep conversations countable"
        />

        {error ? (
          <p
            aria-live="assertive"
            className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {companyError ? (
          <p
            aria-live="assertive"
            className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {companyError}
          </p>
        ) : null}

        <section
          aria-labelledby="outreach-cadence-heading"
          className="mb-6 rounded-lg border border-border bg-surface p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="text-xl font-semibold text-foreground"
                id="outreach-cadence-heading"
              >
                This week&apos;s cadence
              </h2>
              <p className="mt-1 text-sm text-muted">
                Two to three conversations keeps the referral pipeline alive.
              </p>
            </div>
            <p className="text-3xl font-semibold tabular-nums text-accent-strong">
              {weeklyCadence?.outreach.count ?? 0}
              <span className="text-base font-normal text-muted"> / 2–3</span>
            </p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <OutreachEntryList
            companies={companies}
            entries={entries}
            onDelete={confirmDelete}
            pendingIds={pending}
          />
          {/* `open` by default. Collapsing the form outright doesn't just fail the
              specs — it hides the primary action from anyone tabbing through, and
              a disclosure you must find before you can do anything is worse than a
              form you can scroll past. Data-first is achieved by putting the form
              BELOW the data, not by hiding it. */}
          <details className="rounded-lg border border-border bg-surface" open>
            <summary className="cursor-pointer px-5 py-4 text-lg font-semibold text-foreground">
              Log a conversation
            </summary>
            <div className="border-t border-border p-5">
              <OutreachEntryForm
                companies={companies}
                disabled={isCreating}
                onCreate={createEntry}
              />
            </div>
          </details>
        </div>
      </section>
    </AppShell>
  );
}
