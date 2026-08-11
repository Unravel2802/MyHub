"use client";

import { format, parseISO } from "date-fns";
import { CalendarClock, WalletCards } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { StatCard } from "@/src/components/ui/StatCard";
import { formatCents } from "@/src/lib/money";
import type { BillDue, MonthSpend } from "@/src/modules/finance/types";

interface DashboardFinanceSectionsProps {
  billsDue: BillDue[];
  monthSpend: MonthSpend | null;
}

// The Personal Finance module's two summaries as they appear on the Daily
// Dashboard. Grouped because they share one source — Dashboard reads finance
// through FinanceRepository + its pure selectors, never the finance store
// (architecture rule 1) — and split out together rather than as two files,
// since neither is meaningful without the other on this page.
export function DashboardFinanceSections({
  billsDue,
  monthSpend,
}: DashboardFinanceSectionsProps) {
  return (
    <>
      <section
        aria-labelledby="bills-due-heading"
        className="fade-up rounded-lg border border-border bg-surface p-5"
        style={{ ["--i" as string]: 0 }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold" id="bills-due-heading">
            Bills due this month
          </h3>
          <Link
            className="text-sm text-hue-lime hover:underline"
            href="/finance"
          >
            Open ledger
          </Link>
        </div>
        {billsDue.length === 0 ? (
          <EmptyState
            compact
            className="mt-3"
            description="Recurring bills will appear here when their monthly ledger entries are due."
            icon={CalendarClock}
            title="No bills due"
          />
        ) : (
          <ul className="mt-3 grid gap-2">
            {billsDue.map((bill) => (
              <li
                className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-3 py-2"
                key={bill.transactionId}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {bill.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Due {format(parseISO(bill.occurredOn), "MMM d")}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-danger">
                  {formatCents(bill.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="month-spend-heading"
        className="fade-up rounded-lg border border-border bg-surface p-5"
        style={{ ["--i" as string]: 1 }}
      >
        <div className="flex items-center gap-2">
          <WalletCards aria-hidden="true" className="size-5 text-muted" />
          <h3 className="text-lg font-semibold" id="month-spend-heading">
            Month-to-date
          </h3>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatCard
            hint="Settled expenses"
            label="Spent"
            tone={
              monthSpend && monthSpend.spentCents > 0 ? "danger" : "default"
            }
            value={
              monthSpend && monthSpend.spentCents > 0
                ? formatCents(monthSpend.spentCents)
                : "—"
            }
          />
          <StatCard
            hint="Income minus settled expenses"
            hue={monthSpend && monthSpend.netCents > 0 ? "lime" : undefined}
            label="Net"
            tone={monthSpend && monthSpend.netCents < 0 ? "danger" : "default"}
            value={
              monthSpend && monthSpend.netCents !== 0
                ? formatCents(monthSpend.netCents)
                : "—"
            }
          />
        </div>
      </section>
    </>
  );
}
