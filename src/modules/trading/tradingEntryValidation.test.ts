import { describe, expect, it } from "vitest";
import {
  validateTradingEntry,
  type TradingEntryDraft,
} from "@/src/modules/trading/tradingEntryValidation";

// These rules previously lived inside an async submit handler and were
// unreachable without rendering the form and filling sixteen fields.

function draft(overrides: Partial<TradingEntryDraft> = {}): TradingEntryDraft {
  return {
    ticker: "aapl",
    signal: "hold",
    price: "",
    emaFast: "",
    emaSlow: "",
    rsi: "",
    entryPrice: "",
    stopPrice: "",
    shares: "",
    ...overrides,
  };
}

describe("validateTradingEntry", () => {
  it("canonicalises the ticker to trimmed uppercase", () => {
    expect(validateTradingEntry(draft({ ticker: "  msft " })).ticker).toBe(
      "MSFT",
    );
  });

  it("requires a ticker", () => {
    expect(validateTradingEntry(draft({ ticker: "   " })).errors.ticker).toBe(
      "Enter a ticker",
    );
  });

  it("accepts an observation with no indicators at all", () => {
    // The common case: logging that you looked and did nothing.
    expect(validateTradingEntry(draft()).errors).toEqual({});
  });

  it("rejects an unparseable optional amount but allows an empty one", () => {
    expect(
      validateTradingEntry(draft({ price: "" })).errors.price,
    ).toBeUndefined();
    expect(validateTradingEntry(draft({ price: "abc" })).errors.price).toBe(
      "Enter a valid positive amount",
    );
  });

  describe("RSI", () => {
    it.each(["0", "50", "100"])("accepts %s", (rsi) => {
      expect(validateTradingEntry(draft({ rsi })).errors.rsi).toBeUndefined();
    });

    it.each(["-1", "101", "abc"])("rejects %s", (rsi) => {
      expect(validateTradingEntry(draft({ rsi })).errors.rsi).toBe(
        "RSI must be between 0 and 100",
      );
    });
  });

  describe("buy — the only signal that opens a position", () => {
    it("requires entry price, stop price, and shares", () => {
      const { errors } = validateTradingEntry(draft({ signal: "buy" }));
      expect(errors.entryPrice).toBe("Enter an amount");
      expect(errors.stopPrice).toBe("Enter an amount");
      expect(errors.shares).toBe("Enter a positive share quantity");
    });

    it("rejects a zero entry price — that is not a real order", () => {
      const { errors } = validateTradingEntry(
        draft({ signal: "buy", entryPrice: "0", stopPrice: "9", shares: "1" }),
      );
      expect(errors.entryPrice).toBe("Enter a valid positive amount");
    });

    it.each(["0", "-5", "abc"])("rejects %s shares", (shares) => {
      const { errors } = validateTradingEntry(
        draft({ signal: "buy", entryPrice: "10", stopPrice: "9", shares }),
      );
      expect(errors.shares).toBe("Enter a positive share quantity");
    });

    it("passes with a complete position and parses to cents", () => {
      const result = validateTradingEntry(
        draft({
          signal: "buy",
          entryPrice: "10.50",
          stopPrice: "9.25",
          shares: "3",
        }),
      );
      expect(result.errors).toEqual({});
      expect(result.entryPriceCents).toBe(1050);
      expect(result.stopPriceCents).toBe(925);
      expect(result.shares).toBe(3);
    });
  });

  // Requiring position fields on a hold or a sell would block logging an
  // observation, which is most of what this journal is for.
  it.each(["hold", "sell"] as const)(
    "does not demand position fields for %s",
    (signal) => {
      expect(validateTradingEntry(draft({ signal })).errors).toEqual({});
    },
  );
});
