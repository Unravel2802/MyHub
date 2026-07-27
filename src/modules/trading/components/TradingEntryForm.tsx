"use client";

import { format } from "date-fns";
import { type FormEvent, useMemo, useState } from "react";
import { FormField } from "@/src/components/ui/FormField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { formatCents, parseAmount } from "@/src/lib/money";
import type {
  CreateEntryInput,
  CreateTradeInput,
} from "@/src/modules/trading/TradingRepository";
import { positionSize } from "@/src/modules/trading/positionSizing";
import type {
  TradingEmotion,
  TradingSignal,
  TradingTrade,
} from "@/src/modules/trading/types";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent disabled:bg-disabled";
const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent disabled:bg-disabled";

const signalOptions: { value: TradingSignal; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "hold", label: "Hold" },
];

const emotionOptions: { value: TradingEmotion; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "anxious", label: "Anxious" },
  { value: "frustrated", label: "Frustrated" },
  { value: "excited", label: "Excited" },
  { value: "confident", label: "Confident" },
  { value: "uncertain", label: "Uncertain" },
  { value: "fomo", label: "FOMO" },
];

interface TradingEntryFormProps {
  disabled: boolean;
  openTrades: TradingTrade[];
  onCreateEntry: (input: CreateEntryInput) => Promise<void>;
  onCreateTrade: (input: CreateTradeInput) => Promise<TradingTrade>;
}

export function TradingEntryForm({
  disabled,
  openTrades,
  onCreateEntry,
  onCreateTrade,
}: TradingEntryFormProps) {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [ticker, setTicker] = useState("");
  const [signal, setSignal] = useState<TradingSignal>("hold");
  const [price, setPrice] = useState("");
  const [emaFast, setEmaFast] = useState("");
  const [emaSlow, setEmaSlow] = useState("");
  const [rsi, setRsi] = useState("");
  const [emotion, setEmotion] = useState<TradingEmotion | "none">("none");
  const [rulesFollowed, setRulesFollowed] = useState<
    "unjudged" | "true" | "false"
  >("unjudged");
  const [ruleBreak, setRuleBreak] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedTradeId, setLinkedTradeId] = useState("none");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [shares, setShares] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suggestedSize = useMemo(() => {
    const accountCents = parseAmount(accountSize);
    const entryCents = parseAmount(entryPrice);
    const stopCents = parseAmount(stopPrice);
    if (accountCents === null || entryCents === null || stopCents === null) {
      return null;
    }
    return positionSize(accountCents, entryCents, stopCents);
  }, [accountSize, entryPrice, stopPrice]);

  function reset() {
    setTicker("");
    setSignal("hold");
    setPrice("");
    setEmaFast("");
    setEmaSlow("");
    setRsi("");
    setEmotion("none");
    setRulesFollowed("unjudged");
    setRuleBreak("");
    setNotes("");
    setLinkedTradeId("none");
    setEntryPrice("");
    setStopPrice("");
    setShares("");
    setAccountSize("");
    setErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const trimmedTicker = ticker.trim().toUpperCase();

    function money(raw: string, key: string, required = false): number | null {
      if (!raw.trim()) {
        if (required) nextErrors[key] = "Enter an amount";
        return null;
      }
      const cents = parseAmount(raw);
      if (cents === null || (required && cents <= 0)) {
        nextErrors[key] = "Enter a valid positive amount";
        return null;
      }
      return cents;
    }

    if (!trimmedTicker) nextErrors.ticker = "Enter a ticker";

    const priceCents = money(price, "price");
    const emaFastCents = money(emaFast, "emaFast");
    const emaSlowCents = money(emaSlow, "emaSlow");
    const parsedRsi = rsi.trim() ? Number(rsi) : null;
    if (
      parsedRsi !== null &&
      (!Number.isFinite(parsedRsi) || parsedRsi < 0 || parsedRsi > 100)
    ) {
      nextErrors.rsi = "RSI must be between 0 and 100";
    }

    let entryPriceCents: number | null = null;
    let stopPriceCents: number | null = null;
    const parsedShares = shares.trim() ? Number(shares) : null;
    if (signal === "buy") {
      entryPriceCents = money(entryPrice, "entryPrice", true);
      stopPriceCents = money(stopPrice, "stopPrice", true);
      if (
        parsedShares === null ||
        !Number.isFinite(parsedShares) ||
        parsedShares <= 0
      ) {
        nextErrors.shares = "Enter a positive share quantity";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    let tradeId: string | null = null;
    if (
      signal === "buy" &&
      entryPriceCents !== null &&
      stopPriceCents !== null &&
      parsedShares !== null
    ) {
      try {
        const trade = await onCreateTrade({
          ticker: trimmedTicker,
          entryDate: date,
          entryPriceCents,
          stopPriceCents,
          shares: parsedShares,
        });
        tradeId = trade.id;
      } catch {
        return;
      }
    } else if (signal === "sell" && linkedTradeId !== "none") {
      tradeId = linkedTradeId;
    }

    await onCreateEntry({
      date,
      ticker: trimmedTicker,
      signal,
      priceCents,
      emaFastCents,
      emaSlowCents,
      rsi: parsedRsi,
      emotion: emotion === "none" ? null : emotion,
      rulesFollowed:
        rulesFollowed === "unjudged" ? null : rulesFollowed === "true",
      ruleBreak: rulesFollowed === "false" ? ruleBreak.trim() || null : null,
      notes: notes.trim() || null,
      tradeId: signal === "hold" ? null : tradeId,
    });
    reset();
  }

  return (
    <form
      aria-label="Log journal entry"
      className="grid gap-5"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label="Date">
          {(props) => (
            <input
              {...props}
              className={inputClass}
              disabled={disabled}
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          )}
        </FormField>
        <FormField error={errors.ticker} label="Ticker">
          {(props) => (
            <input
              {...props}
              className={inputClass}
              disabled={disabled}
              onChange={(event) => setTicker(event.target.value)}
              placeholder="NVDA"
              required
              value={ticker}
            />
          )}
        </FormField>
        <FormField label="Signal">
          {(props) => (
            <Select
              disabled={disabled}
              onValueChange={(value) => {
                setSignal(value as TradingSignal);
                setLinkedTradeId("none");
              }}
              value={signal}
            >
              <SelectTrigger {...props} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {signalOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField error={errors.price} label="Observed price">
          {(props) => (
            <input
              {...props}
              className={inputClass}
              disabled={disabled}
              inputMode="decimal"
              onChange={(event) => setPrice(event.target.value)}
              placeholder="120.50"
              value={price}
            />
          )}
        </FormField>
        <FormField error={errors.emaFast} label="Fast EMA">
          {(props) => (
            <input
              {...props}
              className={inputClass}
              disabled={disabled}
              inputMode="decimal"
              onChange={(event) => setEmaFast(event.target.value)}
              placeholder="118.25"
              value={emaFast}
            />
          )}
        </FormField>
        <FormField error={errors.emaSlow} label="Slow EMA">
          {(props) => (
            <input
              {...props}
              className={inputClass}
              disabled={disabled}
              inputMode="decimal"
              onChange={(event) => setEmaSlow(event.target.value)}
              placeholder="115.80"
              value={emaSlow}
            />
          )}
        </FormField>
        <FormField error={errors.rsi} label="RSI">
          {(props) => (
            <input
              {...props}
              className={inputClass}
              disabled={disabled}
              max={100}
              min={0}
              onChange={(event) => setRsi(event.target.value)}
              step="0.01"
              type="number"
              value={rsi}
            />
          )}
        </FormField>
        <FormField label="Emotion">
          {(props) => (
            <Select
              disabled={disabled}
              onValueChange={(value) =>
                setEmotion(value as TradingEmotion | "none")
              }
              value={emotion}
            >
              <SelectTrigger {...props} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not recorded</SelectItem>
                {emotionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Rules followed">
          {(props) => (
            <Select
              disabled={disabled}
              onValueChange={(value) => {
                setRulesFollowed(value as typeof rulesFollowed);
                if (value !== "false") setRuleBreak("");
              }}
              value={rulesFollowed}
            >
              <SelectTrigger {...props} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unjudged">Not judged</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
        {rulesFollowed === "false" ? (
          <div className="sm:col-span-2 xl:col-span-3">
            <FormField label="Rule break">
              {(props) => (
                <input
                  {...props}
                  className={inputClass}
                  disabled={disabled}
                  onChange={(event) => setRuleBreak(event.target.value)}
                  placeholder="What rule did you break?"
                  value={ruleBreak}
                />
              )}
            </FormField>
          </div>
        ) : null}
      </div>

      {signal === "buy" ? (
        <fieldset className="grid gap-4 rounded-md border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-4">
          <legend className="px-2 text-sm font-semibold text-foreground">
            Open a position
          </legend>
          <FormField error={errors.entryPrice} label="Entry price">
            {(props) => (
              <input
                {...props}
                className={inputClass}
                disabled={disabled}
                inputMode="decimal"
                onChange={(event) => setEntryPrice(event.target.value)}
                placeholder="120.00"
                value={entryPrice}
              />
            )}
          </FormField>
          <FormField error={errors.stopPrice} label="Stop price">
            {(props) => (
              <input
                {...props}
                className={inputClass}
                disabled={disabled}
                inputMode="decimal"
                onChange={(event) => setStopPrice(event.target.value)}
                placeholder="115.00"
                value={stopPrice}
              />
            )}
          </FormField>
          <FormField
            error={errors.shares}
            hint={
              suggestedSize
                ? `Suggested: ${suggestedSize.shares.toFixed(4)} shares at ${formatCents(suggestedSize.riskCents)} risk`
                : "Uses a 2% account-risk budget"
            }
            label="Shares"
          >
            {(props) => (
              <input
                {...props}
                className={inputClass}
                disabled={disabled}
                min="0"
                onChange={(event) => setShares(event.target.value)}
                placeholder="2"
                step="any"
                type="number"
                value={shares}
              />
            )}
          </FormField>
          <FormField label="Account size" hint="Used only for suggested sizing">
            {(props) => (
              <input
                {...props}
                className={inputClass}
                disabled={disabled}
                inputMode="decimal"
                onChange={(event) => setAccountSize(event.target.value)}
                placeholder="10000"
                value={accountSize}
              />
            )}
          </FormField>
        </fieldset>
      ) : null}

      {signal === "sell" ? (
        <FormField label="Linked trade" hint="Optional open position">
          {(props) => (
            <Select
              disabled={disabled}
              onValueChange={setLinkedTradeId}
              value={linkedTradeId}
            >
              <SelectTrigger {...props} className="w-full sm:max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked trade</SelectItem>
                {openTrades.map((trade) => (
                  <SelectItem key={trade.id} value={trade.id}>
                    {trade.ticker} · {trade.entryDate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      ) : null}

      <FormField label="Notes">
        {(props) => (
          <textarea
            {...props}
            className={textareaClass}
            disabled={disabled}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Setup, context, and what you noticed"
            value={notes}
          />
        )}
      </FormField>

      <div>
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
          disabled={disabled}
          type="submit"
        >
          Log entry
        </button>
      </div>
    </form>
  );
}
