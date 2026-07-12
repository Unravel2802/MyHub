"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/src/components/ThemeToggle";
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
    <main className="min-h-screen bg-canvas text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-8 overflow-y-auto border-b border-border bg-surface px-6 py-6 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:border-b-0 lg:border-r">
          <div>
            <p className="text-sm font-semibold text-accent-strong">MyHub</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              Outreach Log
            </h1>
            <nav aria-label="MyHub modules" className="mt-6 grid gap-2 text-sm">
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
                aria-current="page"
                className="rounded-md bg-surface-subtle px-3 py-2 font-medium text-foreground"
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
      </div>
    </main>
  );
}
