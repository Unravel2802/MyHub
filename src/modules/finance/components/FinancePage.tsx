"use client";

import { addMonths, format, parseISO } from "date-fns";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Pencil,
  ReceiptText,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { Panel } from "@/src/components/ui/Panel";
import { StatCard } from "@/src/components/ui/StatCard";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";
import {
  categoriesForKind,
  CATEGORY_LABELS,
} from "@/src/modules/finance/financeCategories";
import {
  FINANCE_CATEGORY_HUES,
  type FinanceCategoryKey,
} from "@/src/modules/finance/financeCategoryHues";
import { isInMonth } from "@/src/modules/finance/financePeriods";
import { formatCents } from "@/src/lib/money";
import { BudgetsPanel } from "@/src/modules/finance/components/BudgetsPanel";
import { RecurringBillsPanel } from "@/src/modules/finance/components/RecurringBillsPanel";
import { RunwayPanel } from "@/src/modules/finance/components/RunwayPanel";
import { FinanceTransactionDialog } from "@/src/modules/finance/components/FinanceTransactionDialog";
import { FinanceTransactionTable } from "@/src/modules/finance/components/FinanceTransactionTable";
import {
  getFinanceLedgerView,
  getServerFinanceLedgerView,
  setFinanceLedgerView,
  subscribeFinanceLedgerView,
} from "@/src/modules/finance/components/financeLedgerView";
import { BudgetDialog } from "@/src/modules/finance/components/BudgetDialog";
import { RecurringBillDialog } from "@/src/modules/finance/components/RecurringBillDialog";
import { ReceivablesPanel } from "@/src/modules/finance/components/ReceivablesPanel";
import type { CreateTransactionInput } from "@/src/modules/finance/FinanceRepository";
import type {
  Budget,
  FinanceTransaction,
  RecurringBill,
} from "@/src/modules/finance/types";
import type { CreateBillInput } from "@/src/modules/finance/FinanceRepository";
import { useFinanceStore } from "@/src/modules/finance/useFinanceStore";

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
  const ledgerView = useSyncExternalStore(
    subscribeFinanceLedgerView,
    getFinanceLedgerView,
    getServerFinanceLedgerView,
  );
  const {
    fetchBills,
    fetchBudgets,
    fetchReceivables,
    fetchSettings,
    fetchTransactions,
  } = store;

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    void Promise.all([
      fetchTransactions(),
      fetchBills(),
      fetchBudgets(),
      fetchReceivables(),
      fetchSettings(),
    ]);
  }, [
    fetchBills,
    fetchBudgets,
    fetchReceivables,
    fetchSettings,
    fetchTransactions,
  ]);

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
    <PageTemplate
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
      description="Track income and expenses in exact cents, one month at a time."
      error={store.error}
      eyebrow="Personal ledger"
      hero={
        <StatCard
          absent={!hasCashActivity}
          hint="Income minus expenses for the selected month"
          hue={summary.netCents > 0 ? "lime" : undefined}
          label="Net this month"
          size="hero"
          tone={summary.netCents < 0 ? "danger" : "default"}
          value={formatCents(summary.netCents)}
          whenAbsent="Add this month's first transaction"
        />
      }
      href="/finance"
      icon={Wallet}
      navTitle="Finances"
      title="Know where the month went"
    >
      <div className="grid min-w-0 max-w-full gap-6 overflow-x-hidden">
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
          description="Every figure and row below is scoped to this month."
          overline="Ledger month"
          title={format(selectedMonth, "MMMM yyyy")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </Panel>

        <RecurringBillsPanel
          bills={store.bills}
          onAdd={() => setDialogBill("new")}
          onDeactivate={confirmDeactivate}
          onEdit={setDialogBill}
        />

        <ReceivablesPanel />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
          <BudgetsPanel
            budgetProgress={budgetProgress}
            budgets={store.budgets}
            onAdd={() => setDialogBudget("new")}
            onEdit={setDialogBudget}
            onRemove={confirmRemoveBudget}
            selectedMonth={selectedMonth}
          />

          <RunwayPanel
            currentSavingsCents={store.settings?.currentSavingsCents ?? null}
            onSaveSavings={store.updateSavings}
            runway={runway}
          />
        </div>

        <div className="min-w-0 max-w-full" id="finance-ledger">
          <Panel
            aside={
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{monthTransactions.length}</Badge>
                <div
                  aria-label="Ledger view"
                  className="inline-flex rounded-md border border-input bg-surface p-0.5"
                  role="group"
                >
                  {(["cards", "table"] as const).map((view) => (
                    <button
                      aria-pressed={ledgerView === view}
                      className={`rounded px-2.5 py-1 text-xs font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${ledgerView === view ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface-subtle hover:text-foreground"}`}
                      key={view}
                      onClick={() => setFinanceLedgerView(view)}
                      type="button"
                    >
                      {view}
                    </button>
                  ))}
                </div>
              </div>
            }
            description="Newest transactions appear first."
            className="min-w-0 max-w-full overflow-x-hidden"
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
            ) : ledgerView === "cards" ? (
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
            ) : (
              <FinanceTransactionTable
                billNames={billNames}
                onDelete={confirmDelete}
                onPayBill={(transactionId) => void store.payBill(transactionId)}
                onUpdate={(id, input) =>
                  void store.updateTransaction(id, input)
                }
                pendingIds={store.pendingIds}
                transactions={monthTransactions}
              />
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
      </div>
    </PageTemplate>
  );
}
