"use client";

import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Panel } from "@/src/components/ui/Panel";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { formatCents } from "@/src/lib/money";
import { CATEGORY_LABELS } from "@/src/modules/finance/financeCategories";
import {
  FINANCE_CATEGORY_HUES,
  type FinanceCategoryKey,
} from "@/src/modules/finance/financeCategoryHues";
import type { Budget } from "@/src/modules/finance/types";

export interface BudgetProgress {
  category: string;
  spentCents: number;
  limitCents: number;
}

interface BudgetsPanelProps {
  budgetProgress: BudgetProgress[];
  budgets: Budget[];
  selectedMonth: Date;
  onAdd: () => void;
  onEdit: (budget: Budget) => void;
  onRemove: (budget: Budget) => void;
}

export function BudgetsPanel({
  budgetProgress,
  budgets,
  selectedMonth,
  onAdd,
  onEdit,
  onRemove,
}: BudgetsPanelProps) {
  return (
    <Panel
      aside={
        <button
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          onClick={onAdd}
          type="button"
        >
          Set budget
        </button>
      }
      description={`Settled spending against standing limits for ${format(selectedMonth, "MMMM yyyy")}.`}
      overline="Spending guardrails"
      title="Monthly budgets"
    >
      {budgetProgress.length === 0 ? (
        <EmptyState
          action={
            <button
              className="text-hue-lime hover:underline"
              onClick={onAdd}
              type="button"
            >
              Set the first budget
            </button>
          }
          description="Choose an expense category and a monthly limit to start tracking progress."
          icon={ChartNoAxesColumnIncreasing}
          title="No budgets set"
        />
      ) : (
        <ul className="grid gap-3">
          {budgetProgress.map((progress, index) => {
            const budget = budgets.find(
              (item) => item.category === progress.category,
            );
            if (!budget) return null;
            const overageCents = Math.max(
              0,
              progress.spentCents - progress.limitCents,
            );
            // A limit of 0 with spending against it is infinitely over, not
            // 0% used — ProgressBar clamps the bar, and the label below
            // reports the overage rather than a meaningless percentage.
            const ratio =
              progress.limitCents > 0
                ? progress.spentCents / progress.limitCents
                : progress.spentCents > 0
                  ? Number.POSITIVE_INFINITY
                  : 0;
            const hue =
              FINANCE_CATEGORY_HUES[progress.category as FinanceCategoryKey];
            return (
              <li
                className="fade-up rounded-lg border border-border bg-surface-subtle p-4"
                key={progress.category}
                style={{ ["--i" as string]: index }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge hue={hue}>
                      {CATEGORY_LABELS.get(progress.category) ??
                        progress.category}
                    </Badge>
                    <p className="mt-2 text-sm tabular-nums text-body">
                      {formatCents(progress.spentCents)} spent of{" "}
                      {formatCents(progress.limitCents)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface hover:text-foreground"
                      onClick={() => onEdit(budget)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-md px-2 py-1 text-sm text-muted hover:bg-danger-surface hover:text-danger"
                      onClick={() => onRemove(budget)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar hue={hue} progress={ratio} />
                </div>
                <p
                  className={`mt-2 text-xs font-medium ${overageCents > 0 ? "text-danger" : "text-muted"}`}
                >
                  {overageCents > 0
                    ? `Over by ${formatCents(overageCents)}`
                    : `${Math.round(ratio * 100)}% used`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
