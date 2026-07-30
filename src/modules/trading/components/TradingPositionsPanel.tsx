"use client";

import { format } from "date-fns";
import { BriefcaseBusiness } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { FormField } from "@/src/components/ui/FormField";
import { Panel } from "@/src/components/ui/Panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { formatCents, parseAmount, parseSignedAmount } from "@/src/lib/money";
import type { CloseTradeInput } from "@/src/modules/trading/TradingRepository";
import type {
  TradingExitReason,
  TradingTrade,
} from "@/src/modules/trading/types";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent disabled:bg-disabled";

const exitReasons: { value: TradingExitReason; label: string }[] = [
  { value: "ema_crossover_bearish", label: "Bearish EMA crossover" },
  { value: "rsi_overbought", label: "RSI overbought" },
  { value: "stop_loss", label: "Stop loss" },
  { value: "manual", label: "Manual" },
];

interface CloseTradeDialogProps {
  disabled: boolean;
  onCloseTrade: (id: string, input: CloseTradeInput) => Promise<void>;
  trade: TradingTrade;
}

function CloseTradeDialog({
  disabled,
  onCloseTrade,
  trade,
}: CloseTradeDialogProps) {
  const [open, setOpen] = useState(false);
  const [exitDate, setExitDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [exitPrice, setExitPrice] = useState("");
  const [exitReason, setExitReason] = useState<TradingExitReason>("manual");
  const [pnl, setPnl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const exitPriceCents = parseAmount(exitPrice);
    const pnlCents = parseSignedAmount(pnl);
    const nextErrors: Record<string, string> = {};
    if (exitPriceCents === null || exitPriceCents <= 0) {
      nextErrors.exitPrice = "Enter a valid positive amount";
    }
    if (pnlCents === null) {
      nextErrors.pnl = "Enter a signed gain or loss";
    }
    setErrors(nextErrors);
    if (
      Object.keys(nextErrors).length > 0 ||
      exitPriceCents === null ||
      pnlCents === null
    ) {
      return;
    }

    await onCloseTrade(trade.id, {
      exitDate,
      exitPriceCents,
      exitReason,
      pnlCents,
    });
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
          disabled={disabled}
          type="button"
        >
          Close position
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close {trade.ticker}</DialogTitle>
          <DialogDescription>
            Record the realised result once on this trade.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <FormField label="Exit date">
            {(props) => (
              <input
                {...props}
                className={inputClass}
                disabled={disabled}
                onChange={(event) => setExitDate(event.target.value)}
                required
                type="date"
                value={exitDate}
              />
            )}
          </FormField>
          <FormField error={errors.exitPrice} label="Exit price">
            {(props) => (
              <input
                {...props}
                className={inputClass}
                disabled={disabled}
                inputMode="decimal"
                onChange={(event) => setExitPrice(event.target.value)}
                placeholder="130.00"
                required
                value={exitPrice}
              />
            )}
          </FormField>
          <FormField label="Exit reason">
            {(props) => (
              <Select
                disabled={disabled}
                onValueChange={(value) =>
                  setExitReason(value as TradingExitReason)
                }
                value={exitReason}
              >
                <SelectTrigger {...props} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exitReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField
            error={errors.pnl}
            hint="Use a leading minus sign for a loss"
            label="Realised P&L"
          >
            {(props) => (
              <input
                {...props}
                className={inputClass}
                disabled={disabled}
                inputMode="decimal"
                onChange={(event) => setPnl(event.target.value)}
                placeholder="20.00 or -12.50"
                required
                value={pnl}
              />
            )}
          </FormField>
          <DialogFooter>
            <button
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
              disabled={disabled}
              type="submit"
            >
              Save close
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface TradingPositionsPanelProps {
  onCloseTrade: (id: string, input: CloseTradeInput) => Promise<void>;
  onReopenTrade: (id: string) => Promise<void>;
  pendingIds: Set<string>;
  stats: ReactNode;
  trades: TradingTrade[];
}

export function TradingPositionsPanel({
  onCloseTrade,
  onReopenTrade,
  pendingIds,
  stats,
  trades,
}: TradingPositionsPanelProps) {
  return (
    <Panel
      aside={<Badge tone="neutral">{trades.length}</Badge>}
      title="Positions"
    >
      <div className="grid gap-4">
        {stats}
        {trades.length === 0 ? (
          <EmptyState
            compact
            description="Log a buy signal to create the first position."
            icon={BriefcaseBusiness}
            title="No positions yet"
          />
        ) : (
          <ul className="grid max-h-[32rem] gap-3 overflow-y-auto overscroll-contain pr-1">
            {trades.map((trade) => {
              const closed = trade.exitDate !== null;
              const pending = pendingIds.has(trade.id);
              return (
                <li
                  className="rounded-md border border-border bg-surface-subtle p-3"
                  id={`trade-${trade.id}`}
                  key={trade.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {trade.ticker}
                        </span>
                        <Badge tone={closed ? "neutral" : "success"}>
                          {closed ? "Closed" : "Open"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {trade.entryDate} · {trade.shares.toFixed(4)} shares at{" "}
                        {formatCents(trade.entryPriceCents)}
                      </p>
                      {closed && trade.pnlCents !== null ? (
                        <p
                          className={`mt-1 text-sm font-medium ${
                            trade.pnlCents > 0
                              ? "text-success"
                              : trade.pnlCents < 0
                                ? "text-danger"
                                : "text-body"
                          }`}
                        >
                          {formatCents(trade.pnlCents)} · {trade.exitDate}
                        </p>
                      ) : null}
                    </div>
                    {closed ? (
                      <button
                        className="h-9 rounded-md border border-input px-3 text-sm font-medium text-body hover:border-input-hover hover:text-foreground disabled:opacity-60"
                        disabled={pending}
                        onClick={() => void onReopenTrade(trade.id)}
                        type="button"
                      >
                        Reopen
                      </button>
                    ) : (
                      <CloseTradeDialog
                        disabled={pending}
                        onCloseTrade={onCloseTrade}
                        trade={trade}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
