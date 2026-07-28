"use client";

import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import * as CompanyRepository from "@/src/modules/jobApplications/CompanyRepository";
import type { Company } from "@/src/modules/jobApplications/types";
import { OutreachEntryForm } from "@/src/modules/outreach/components/OutreachEntryForm";
import { OutreachEntryList } from "@/src/modules/outreach/components/OutreachEntryList";
import { useOutreachStore } from "@/src/modules/outreach/useOutreachStore";
import { useDashboardStore } from "@/src/modules/dashboard/useDashboardStore";
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
    <PageTemplate
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
      // Both failures are page-level and mutually exclusive in practice; the
      // template owns the one banner so it can't drift from the other twelve.
      error={error ?? companyError}
      eyebrow="Referral and outreach tracking"
      hero={
        <section
          aria-labelledby="outreach-cadence-heading"
          className="rounded-lg border border-border bg-surface p-5"
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
      }
      href="/outreach"
      icon={Send}
      navTitle="Outreach Log"
      title="Keep conversations countable"
      // `open` by default. Collapsing the form outright doesn't just fail the
      // specs — it hides the primary action from anyone tabbing through, and a
      // disclosure you must find before you can do anything is worse than a form
      // you can scroll past. Data-first is the template's slot order, not a
      // hidden form: `compose` renders after `children`, so the list is above it
      // by construction rather than by everyone remembering to put it there.
      compose={
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
      }
    >
      <OutreachEntryList
        companies={companies}
        entries={entries}
        onDelete={confirmDelete}
        pendingIds={pending}
      />
    </PageTemplate>
  );
}
