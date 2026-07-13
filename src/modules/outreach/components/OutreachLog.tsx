"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import * as CompanyRepository from "@/src/modules/jobApplications/CompanyRepository";
import type { Company } from "@/src/modules/jobApplications/types";
import { OutreachEntryForm } from "@/src/modules/outreach/components/OutreachEntryForm";
import { OutreachEntryList } from "@/src/modules/outreach/components/OutreachEntryList";
import { useOutreachStore } from "@/src/modules/outreach/useOutreachStore";

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
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

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
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">
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
          <p className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {companyError ? (
          <p className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
            {companyError}
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <OutreachEntryForm
            companies={companies}
            disabled={isCreating}
            onCreate={createEntry}
          />
          <OutreachEntryList
            companies={companies}
            entries={entries}
            onDelete={confirmDelete}
            pendingIds={pending}
          />
        </div>
      </section>
    </AppShell>
  );
}
