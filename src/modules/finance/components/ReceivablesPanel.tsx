"use client";

import { format, parseISO } from "date-fns";
import { HandCoins, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Panel } from "@/src/components/ui/Panel";
import { formatCents } from "@/src/modules/finance/money";
import { ReceivableDialog } from "@/src/modules/finance/components/ReceivableDialog";
import type { CreateReceivableInput } from "@/src/modules/finance/FinanceRepository";
import type { Receivable } from "@/src/modules/finance/types";
import { useFinanceStore } from "@/src/modules/finance/useFinanceStore";

function ReceivableStatusBadge({ status }: Pick<Receivable, "status">) {
  if (status === "not_requested") {
    return <Badge hue="amber">Not requested</Badge>;
  }
  if (status === "requested") {
    return <Badge hue="blue">Requested</Badge>;
  }
  return <Badge tone="success">Paid</Badge>;
}

export function ReceivablesPanel() {
  const store = useFinanceStore();
  const [dialogReceivable, setDialogReceivable] = useState<
    Receivable | null | "new"
  >(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const editing =
    dialogReceivable && dialogReceivable !== "new" ? dialogReceivable : null;
  const outstanding = store.outstandingReceivables();
  const totalOwedCents = store.totalOwedCents();
  const notRequestedCount = outstanding.filter(
    (receivable) => receivable.status === "not_requested",
  ).length;
  const recentlyPaid = store.receivables
    .filter(
      (receivable) =>
        receivable.deletedAt === null && receivable.status === "paid",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  async function submit(input: CreateReceivableInput) {
    if (editing) {
      await store.updateReceivable(editing.id, input);
    } else {
      await store.createReceivable(input);
    }
  }

  async function runAction(id: string, action: () => Promise<void>) {
    setPendingId(id);
    await action();
    setPendingId(null);
  }

  function confirmDelete(receivable: Receivable) {
    if (window.confirm(`Remove the money owed by ${receivable.person}?`)) {
      void runAction(receivable.id, () =>
        store.deleteReceivable(receivable.id),
      );
    }
  }

  return (
    <>
      <Panel
        aside={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge hue={notRequestedCount > 0 ? "amber" : undefined}>
              {notRequestedCount} not requested
            </Badge>
            <button
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              onClick={() => setDialogReceivable("new")}
              type="button"
            >
              Add money owed
            </button>
          </div>
        }
        description="Track repayments before they arrive, then convert them to income when paid."
        overline="Receivables"
        title="Owed to me"
      >
        <p className="mb-4 text-sm text-muted">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {totalOwedCents > 0 ? formatCents(totalOwedCents) : "—"}
          </span>{" "}
          owed to you
        </p>

        {outstanding.length === 0 ? (
          <EmptyState
            action={
              <button
                className="text-hue-lime hover:underline"
                onClick={() => setDialogReceivable("new")}
                type="button"
              >
                Add money someone owes you
              </button>
            }
            description="Add a repayment here before it arrives so you remember to request it."
            icon={HandCoins}
            title="Nobody owes you money"
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {outstanding.map((receivable, index) => {
              const pending = pendingId === receivable.id;
              const needsRequest = receivable.status === "not_requested";
              return (
                <li
                  aria-busy={pending}
                  className={`fade-up rounded-lg border p-4 transition-opacity ${needsRequest ? "border-hue-amber-border bg-hue-amber-surface" : "border-border bg-surface-subtle"} ${pending ? "pointer-events-none opacity-50" : ""}`}
                  key={receivable.id}
                  style={{ ["--i" as string]: index }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground">
                          {receivable.person}
                        </p>
                        <ReceivableStatusBadge status={receivable.status} />
                      </div>
                      <p className="mt-2 text-sm text-body">
                        {receivable.reason || "No reason added"}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {receivable.dueOn ? (
                          <>
                            Due{" "}
                            <time dateTime={receivable.dueOn}>
                              {format(
                                parseISO(receivable.dueOn),
                                "MMM d, yyyy",
                              )}
                            </time>
                          </>
                        ) : (
                          "No due date"
                        )}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums text-foreground">
                      {formatCents(receivable.amountCents)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {needsRequest ? (
                      <button
                        className="rounded-md border border-hue-amber-border bg-surface px-3 py-1.5 text-sm font-medium text-hue-amber hover:bg-surface-subtle"
                        disabled={pending}
                        onClick={() =>
                          void runAction(receivable.id, () =>
                            store.updateReceivable(receivable.id, {
                              status: "requested",
                            }),
                          )
                        }
                        type="button"
                      >
                        Mark requested
                      </button>
                    ) : null}
                    <button
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                      disabled={pending}
                      onClick={() =>
                        void runAction(receivable.id, () =>
                          store.markReceivablePaid(receivable.id),
                        )
                      }
                      type="button"
                    >
                      Mark paid
                    </button>
                    <button
                      aria-label={`Edit money owed by ${receivable.person}`}
                      className="rounded-md p-2 text-muted hover:bg-surface hover:text-foreground"
                      disabled={pending}
                      onClick={() => setDialogReceivable(receivable)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label={`Delete money owed by ${receivable.person}`}
                      className="rounded-md p-2 text-muted hover:bg-danger-surface hover:text-danger"
                      disabled={pending}
                      onClick={() => confirmDelete(receivable)}
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

        {recentlyPaid.length > 0 ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
              Recently paid
            </p>
            <ul className="grid gap-2">
              {recentlyPaid.map((receivable) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-subtle px-4 py-3"
                  key={receivable.id}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {receivable.person}
                    </p>
                    <ReceivableStatusBadge status={receivable.status} />
                    {receivable.reason ? (
                      <span className="truncate text-sm text-muted">
                        {receivable.reason}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-semibold tabular-nums text-foreground">
                    {formatCents(receivable.amountCents)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      {dialogReceivable ? (
        <ReceivableDialog
          key={editing?.id ?? "new"}
          onClose={() => setDialogReceivable(null)}
          onSubmit={submit}
          receivable={editing}
        />
      ) : null}
    </>
  );
}
