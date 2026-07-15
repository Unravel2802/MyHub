"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import * as CompanyRepository from "@/src/modules/jobApplications/CompanyRepository";
import type { Company } from "@/src/modules/jobApplications/types";
import { OutreachEntryForm } from "@/src/modules/outreach/components/OutreachEntryForm";
import { OutreachEntryList } from "@/src/modules/outreach/components/OutreachEntryList";
import { useOutreachStore } from "@/src/modules/outreach/useOutreachStore";
import { useDashboardStore } from "@/src/modules/dashboard/useDashboardStore";
import { hueFor, hueVar } from "@/src/components/moduleHues";

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
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <header
          className="hue-wash mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border bg-surface px-1 py-2"
          style={{ ["--hue" as string]: hueVar(hueFor("/outreach")) }}
        >
          <div>
            <p className="text-sm font-medium text-hue-rose">
              Referral and outreach tracking
            </p>
            <h2 className="mt-1 text-3xl font-semibold text-foreground">
              Keep conversations countable
            </h2>
          </div>
          <button
            className="h-10 rounded-md border border-input bg-surface px-4 text-sm text-body hover:border-input-hover"
            disabled={isLoading}
            onClick={() => void fetchEntries()}
            type="button"
          >
            Refresh
          </button>
        </header>

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
