"use client";

import { addMonths, format, parseISO } from "date-fns";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  Pencil,
  PiggyBank,
  ReceiptText,
  Trash2,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import { hueFor } from "@/src/components/moduleHues";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Panel } from "@/src/components/ui/Panel";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { StatCard } from "@/src/components/ui/StatCard";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";
import {
  categoriesForKind,
  FINANCE_CATEGORIES,
} from "@/src/modules/finance/financeCategories";
import {
  FINANCE_CATEGORY_HUES,
  type FinanceCategoryKey,
} from "@/src/modules/finance/financeCategoryHues";
import { isInMonth } from "@/src/modules/finance/financePeriods";
import { formatCents } from "@/src/modules/finance/money";
import { FinanceTransactionDialog } from "@/src/modules/finance/components/FinanceTransactionDialog";
import { BudgetDialog } from "@/src/modules/finance/components/BudgetDialog";
import { RecurringBillDialog } from "@/src/modules/finance/components/RecurringBillDialog";
import { SavingsEditor } from "@/src/modules/finance/components/SavingsEditor";
import type { CreateTransactionInput } from "@/src/modules/finance/FinanceRepository";
import type {
  Budget,
  FinanceTransaction,
  RecurringBill,
} from "@/src/modules/finance/types";
import type { CreateBillInput } from "@/src/modules/finance/FinanceRepository";
import { useFinanceStore } from "@/src/modules/finance/useFinanceStore";

const CATEGORY_LABELS = new Map(
  FINANCE_CATEGORIES.map((category) => [category.key, category.label]),
);

export function FinancePage() {
  const store = useFinanceStore();
  const fetched = useRef(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [dialogTransaction, setDialogTransaction] = useState<
    FinanceTransaction | null | "new"
  >(null);
  const [dialogBill, setDialogBill] = useState<RecurringBill | null | "new">(
    null,
  );
  const [dialogBudget, setDialogBudget] = useState<Budget | null | "new">(null);
  const { fetchBills, fetchBudgets, fetchSettings, fetchTransactions } = store;

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    void Promise.all([
      fetchTransactions(),
      fetchBills(),
      fetchBudgets(),
      fetchSettings(),
    ]);
  }, [fetchBills, fetchBudgets, fetchSettings, fetchTransactions]);

  useEffect(() => {
    register("finance", [
      {
        id: "new-transaction",
        label: "Add finance transaction",
        keywords: ["finance", "money", "income", "expense", "ledger"],
        action: () =>
          document.getElementById("add-transaction-button")?.click(),
      },
      {
        id: "view-ledger",
        label: "View finance ledger",
        keywords: ["finance", "transactions", "ledger"],
        action: () =>
          document
            .getElementById("finance-ledger")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      },
    ]);
    registerShortcuts("finance", [
      {
        combo: "n f",
        commandId: "finance.new-transaction",
        description: "Add a finance transaction",
      },
      {
        combo: "l f",
        commandId: "finance.view-ledger",
        description: "View the finance ledger",
      },
    ]);
    return () => {
      unregisterShortcuts("finance");
      unregister("finance");
    };
  }, []);

  const monthTransactions = useMemo(
    () =>
      store.transactions
        .filter(
          (transaction) =>
            transaction.deletedAt === null &&
            isInMonth(transaction.occurredOn, selectedMonth),
        )
        .sort(
          (a, b) =>
            b.occurredOn.localeCompare(a.occurredOn) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [selectedMonth, store.transactions],
  );
  const summary = store.summaryForMonth(selectedMonth);
  const hasCashActivity =
    summary.incomeCents !== 0 || summary.expenseCents !== 0;
  const editing =
    dialogTransaction && dialogTransaction !== "new" ? dialogTransaction : null;
  const editingBill = dialogBill && dialogBill !== "new" ? dialogBill : null;
  const editingBudget =
    dialogBudget && dialogBudget !== "new" ? dialogBudget : null;
  const billNames = useMemo(
    () => new Map(store.bills.map((bill) => [bill.id, bill.name])),
    [store.bills],
  );
  const budgetProgress = store.budgetProgressForMonth(selectedMonth);
  const runway = store.runwayFor(selectedMonth);
  const expenseCategories = categoriesForKind("expense");
  const firstUnbudgetedCategory = expenseCategories.find(
    (category) =>
      !store.budgets.some((budget) => budget.category === category.key),
  )?.key;

  async function submitTransaction(input: CreateTransactionInput) {
    if (editing) {
      await store.updateTransaction(editing.id, input);
    } else {
      await store.createTransaction(input);
    }
  }

  async function submitBill(input: CreateBillInput) {
    if (editingBill) {
      await store.updateBill(editingBill.id, input);
    } else {
      await store.createBill(input);
    }
    await store.fetchTransactions();
  }

  function confirmDelete(transaction: FinanceTransaction) {
    const label = CATEGORY_LABELS.get(transaction.category) ?? "transaction";
    if (window.confirm(`Delete this ${label.toLowerCase()} transaction?`)) {
      void store.deleteTransaction(transaction.id);
    }
  }

  function confirmDeactivate(bill: RecurringBill) {
    if (
      window.confirm(
        `Deactivate ${bill.name}? Existing ledger entries will stay intact.`,
      )
    ) {
      void store.deleteBill(bill.id);
    }
  }

  function confirmRemoveBudget(budget: Budget) {
    const label = CATEGORY_LABELS.get(budget.category) ?? budget.category;
    if (window.confirm(`Remove the monthly ${label} budget?`)) {
      void store.deleteBudget(budget.id);
    }
  }

  return (
    <AppShell activeHref="/finance" title="Finances">
      <section className="page-fade min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                className="h-10 rounded-md border border-input bg-surface px-4 text-sm font-medium text-body hover:bg-surface-subtle"
                onClick={() => setDialogBill("new")}
                type="button"
              >
                Add recurring bill
              </button>
              <button
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                id="add-transaction-button"
                onClick={() => setDialogTransaction("new")}
                type="button"
              >
                Add transaction
              </button>
            </div>
          }
          bleed
          className="mb-6"
          description="Track income and expenses in exact cents, one month at a time."
          eyebrow="Personal ledger"
          hue={hueFor("/finance")}
          icon={Wallet}
          title="Know where the month went"
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

        <Panel
          aside={
            <div
              aria-label="Choose ledger month"
              className="flex gap-2"
              role="group"
            >
              <button
                aria-label="Previous month"
                className="inline-flex size-9 items-center justify-center rounded-md border border-input bg-surface hover:bg-surface-subtle"
                onClick={() =>
                  setSelectedMonth((month) => addMonths(month, -1))
                }
                type="button"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
              </button>
              <button
                className="h-9 rounded-md border border-input bg-surface px-3 text-sm font-medium hover:bg-surface-subtle"
                onClick={() => setSelectedMonth(new Date())}
                type="button"
              >
                Current month
              </button>
              <button
                aria-label="Next month"
                className="inline-flex size-9 items-center justify-center rounded-md border border-input bg-surface hover:bg-surface-subtle"
                onClick={() => setSelectedMonth((month) => addMonths(month, 1))}
                type="button"
              >
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          }
          className="mb-6"
          description="Every figure and row below is scoped to this month."
          overline="Ledger month"
          title={format(selectedMonth, "MMMM yyyy")}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              hint="Settled income"
              hue={summary.incomeCents > 0 ? "lime" : undefined}
              label="Income in"
              value={
                summary.incomeCents > 0 ? formatCents(summary.incomeCents) : "—"
              }
            />
            <StatCard
              hint="Settled expenses"
              label="Expenses out"
              tone={summary.expenseCents > 0 ? "danger" : "default"}
              value={
                summary.expenseCents > 0
                  ? formatCents(summary.expenseCents)
                  : "—"
              }
            />
            <StatCard
              hint="Income minus expenses"
              hue={summary.netCents > 0 ? "lime" : undefined}
              label="Net"
              tone={summary.netCents < 0 ? "danger" : "default"}
              value={hasCashActivity ? formatCents(summary.netCents) : "—"}
            />
          </div>
        </Panel>

        <Panel
          aside={<Badge tone="neutral">{store.bills.length}</Badge>}
          className="mb-6"
          description="Templates create one due ledger entry each month. Paused bills remain available to edit."
          overline="Monthly obligations"
          title="Recurring bills"
        >
          {store.bills.length === 0 ? (
            <EmptyState
              action={
                <button
                  className="text-hue-lime hover:underline"
                  onClick={() => setDialogBill("new")}
                  type="button"
                >
                  Add a recurring bill
                </button>
              }
              description="Add rent, utilities, or another repeating expense to generate its monthly due entry."
              icon={CalendarClock}
              title="No recurring bills yet"
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {[...store.bills]
                .sort(
                  (a, b) =>
                    a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name),
                )
                .map((bill, index) => (
                  <li
                    className="fade-up rounded-lg border border-border bg-surface-subtle p-4"
                    key={bill.id}
                    style={{ ["--i" as string]: index }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground">
                            {bill.name}
                          </p>
                          <Badge tone={bill.active ? "success" : "neutral"}>
                            {bill.active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <Badge
                            hue={
                              FINANCE_CATEGORY_HUES[
                                bill.category as FinanceCategoryKey
                              ]
                            }
                          >
                            {CATEGORY_LABELS.get(bill.category) ??
                              bill.category}
                          </Badge>
                          <span>Due day {bill.dayOfMonth}</span>
                        </div>
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums text-foreground">
                        {formatCents(bill.amountCents)}
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        className="rounded-md border border-input bg-surface px-3 py-1.5 text-sm text-body hover:bg-surface-subtle"
                        onClick={() => setDialogBill(bill)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-danger-border bg-danger-surface px-3 py-1.5 text-sm text-danger hover:border-danger"
                        onClick={() => confirmDeactivate(bill)}
                        type="button"
                      >
                        Deactivate
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
          <Panel
            aside={
              <button
                className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                onClick={() => setDialogBudget("new")}
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
                    onClick={() => setDialogBudget("new")}
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
                  const budget = store.budgets.find(
                    (item) => item.category === progress.category,
                  );
                  if (!budget) return null;
                  const overageCents = Math.max(
                    0,
                    progress.spentCents - progress.limitCents,
                  );
                  const ratio =
                    progress.limitCents > 0
                      ? progress.spentCents / progress.limitCents
                      : progress.spentCents > 0
                        ? Number.POSITIVE_INFINITY
                        : 0;
                  const hue =
                    FINANCE_CATEGORY_HUES[
                      progress.category as FinanceCategoryKey
                    ];
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
                            onClick={() => setDialogBudget(budget)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-danger-surface hover:text-danger"
                            onClick={() => confirmRemoveBudget(budget)}
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

          <Panel
            description="A projection from current savings and completed-month net burn."
            overline="Cash cushion"
            title="Runway"
          >
            <StatCard
              hint={
                runway
                  ? `${formatCents(runway.avgMonthlyBurnCents)} average monthly burn`
                  : "No completed-month burn to project."
              }
              hue={runway && runway.months > 0 ? "lime" : undefined}
              label="Estimated runway"
              value={runway ? `${runway.months.toFixed(1)} months` : "—"}
            />
            <div className="mt-4 rounded-lg border border-border bg-surface-subtle p-4">
              <div className="mb-3 flex items-center gap-2">
                <PiggyBank aria-hidden="true" className="size-5 text-muted" />
                <p className="font-medium text-foreground">Savings balance</p>
              </div>
              <SavingsEditor
                currentSavingsCents={
                  store.settings?.currentSavingsCents ?? null
                }
                key={store.settings?.currentSavingsCents ?? "loading"}
                onSubmit={store.updateSavings}
              />
            </div>
          </Panel>
        </div>

        <div id="finance-ledger">
          <Panel
            aside={<Badge tone="neutral">{monthTransactions.length}</Badge>}
            description="Newest transactions appear first."
            overline={format(selectedMonth, "MMMM yyyy")}
            title="Transactions"
          >
            {store.isLoading ? (
              <p
                aria-live="polite"
                className="py-10 text-center text-sm text-muted"
              >
                Loading transactions...
              </p>
            ) : monthTransactions.length === 0 ? (
              <EmptyState
                action={
                  <button
                    className="text-hue-lime hover:underline"
                    onClick={() => setDialogTransaction("new")}
                    type="button"
                  >
                    Add the first transaction
                  </button>
                }
                description="Record income or an expense to make this month's cash flow visible."
                icon={ReceiptText}
                title="No transactions this month"
              />
            ) : (
              <ul className="grid gap-2">
                {monthTransactions.map((transaction, index) => {
                  const pending = store.pendingIds.has(transaction.id);
                  const categoryHue =
                    FINANCE_CATEGORY_HUES[
                      transaction.category as FinanceCategoryKey
                    ];
                  const isExpense = transaction.kind === "expense";
                  const isDue =
                    transaction.billId !== null && transaction.paidAt === null;
                  const recurringName = transaction.billId
                    ? billNames.get(transaction.billId)
                    : null;
                  const DirectionIcon = isExpense
                    ? ArrowUpRight
                    : ArrowDownLeft;
                  return (
                    <li
                      aria-busy={pending}
                      className={`fade-up grid gap-3 rounded-lg border border-border bg-surface-subtle p-4 transition-opacity sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center ${pending ? "pointer-events-none opacity-50" : ""}`}
                      key={transaction.id}
                      style={{ ["--i" as string]: index }}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-flex size-9 items-center justify-center rounded-full ${isExpense ? "bg-danger-surface text-danger" : "bg-hue-lime-surface text-hue-lime"}`}
                      >
                        <DirectionIcon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge hue={categoryHue}>
                            {CATEGORY_LABELS.get(transaction.category) ??
                              transaction.category}
                          </Badge>
                          {isDue ? <Badge tone="danger">Due</Badge> : null}
                          <time
                            className="text-xs text-muted"
                            dateTime={transaction.occurredOn}
                          >
                            {format(
                              parseISO(transaction.occurredOn),
                              "MMM d, yyyy",
                            )}
                          </time>
                        </div>
                        <p className="mt-2 truncate text-sm text-body">
                          {transaction.note || recurringName || "No note"}
                        </p>
                      </div>
                      <p
                        className={`text-lg font-semibold tabular-nums ${isExpense ? "text-danger" : "text-hue-lime"}`}
                      >
                        {formatCents(
                          isExpense
                            ? -transaction.amountCents
                            : transaction.amountCents,
                        )}
                      </p>
                      <div className="flex justify-end gap-1">
                        {isDue ? (
                          <button
                            className="mr-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                            disabled={pending}
                            onClick={() => void store.payBill(transaction.id)}
                            type="button"
                          >
                            Mark paid
                          </button>
                        ) : null}
                        <button
                          aria-label={`Edit ${CATEGORY_LABELS.get(transaction.category) ?? "transaction"}`}
                          className="rounded-md p-2 text-muted hover:bg-surface hover:text-foreground"
                          disabled={pending}
                          onClick={() => setDialogTransaction(transaction)}
                          type="button"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          aria-label={`Delete ${CATEGORY_LABELS.get(transaction.category) ?? "transaction"}`}
                          className="rounded-md p-2 text-muted hover:bg-danger-surface hover:text-danger"
                          disabled={pending}
                          onClick={() => confirmDelete(transaction)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {dialogTransaction ? (
          <FinanceTransactionDialog
            disabled={
              store.isCreating ||
              Boolean(editing && store.pendingIds.has(editing.id))
            }
            key={editing?.id ?? "new"}
            onClose={() => setDialogTransaction(null)}
            onSubmit={submitTransaction}
            transaction={editing}
          />
        ) : null}
        {dialogBill ? (
          <RecurringBillDialog
            bill={editingBill}
            key={editingBill?.id ?? "new"}
            onClose={() => setDialogBill(null)}
            onSubmit={submitBill}
          />
        ) : null}
        {dialogBudget ? (
          <BudgetDialog
            budget={editingBudget}
            initialCategory={firstUnbudgetedCategory}
            key={editingBudget?.id ?? "new"}
            onClose={() => setDialogBudget(null)}
            onSubmit={store.upsertBudget}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
