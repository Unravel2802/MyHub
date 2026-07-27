import { describe, expect, it } from "vitest";
import {
  parseComparisonCsv,
  parseCsvLine,
  parseExitReason,
  parseTradesCsv,
} from "@/src/modules/trading/backtestCsv";
import { strategyByLabel } from "@/src/modules/trading/backtestCatalog";

const TRADE_HEADER =
  "ticker,entry_date,exit_date,entry_price,stop_price,exit_price,shares,exit_reason,commission,pnl_dollars,r_multiple,holding_days";

const COMPARISON_HEADER =
  "strategy,trades,win_rate,avg_r,profit_factor,sharpe,sharpe_before_costs,cagr_pct,max_dd_pct,end_value";

describe("parseCsvLine", () => {
  it("splits a plain line", () => {
    expect(parseCsvLine("SPY,1994-05-03,STOP")).toEqual([
      "SPY",
      "1994-05-03",
      "STOP",
    ]);
  });

  // The entire reason this parser exists rather than String.split(",").
  it("keeps commas inside a quoted field", () => {
    expect(parseCsvLine('"MACD(12,26,9) Momentum",1576,38.0')).toEqual([
      "MACD(12,26,9) Momentum",
      "1576",
      "38.0",
    ]);
  });

  it("unescapes a doubled quote inside a quoted field", () => {
    expect(parseCsvLine('"say ""hi""",2')).toEqual(['say "hi"', "2"]);
  });

  it("preserves empty fields rather than dropping them", () => {
    // Dropping one would shift every later column silently.
    expect(parseCsvLine("a,,c")).toEqual(["a", "", "c"]);
    expect(parseCsvLine("a,b,")).toEqual(["a", "b", ""]);
  });
});

describe("parseExitReason", () => {
  it("lowercases the engine's codes", () => {
    expect(parseExitReason("STOP")).toBe("stop");
    expect(parseExitReason("SIGNAL")).toBe("signal");
    expect(parseExitReason("END_OF_DATA")).toBe("end_of_data");
  });

  it("throws on an unknown code rather than bucketing it", () => {
    // Defaulting here would quietly mislabel every row if the engine changed.
    expect(() => parseExitReason("TRAILING")).toThrow(/Unrecognised/);
  });
});

describe("parseTradesCsv", () => {
  const row =
    "SPY,1994-05-03,1994-05-09,25.6966176085191,24.88804560893436,25.220239404860155,2.473496486431805,STOP,0.0,-1.178319812963098,-0.589159906481549,6";

  it("maps a row to typed fields at full precision", () => {
    const [trade] = parseTradesCsv(`${TRADE_HEADER}\n${row}`);

    expect(trade.ticker).toBe("SPY");
    expect(trade.entryDate).toBe("1994-05-03");
    expect(trade.exitDate).toBe("1994-05-09");
    // Not rounded — the reason these columns are double precision.
    expect(trade.entryPrice).toBe(25.6966176085191);
    expect(trade.shares).toBe(2.473496486431805);
    expect(trade.exitReason).toBe("stop");
    expect(trade.pnlDollars).toBe(-1.178319812963098);
    expect(trade.rMultiple).toBe(-0.589159906481549);
    expect(trade.holdingDays).toBe(6);
  });

  it("handles CRLF and a trailing newline", () => {
    const trades = parseTradesCsv(`${TRADE_HEADER}\r\n${row}\r\n`);
    expect(trades).toHaveLength(1);
  });

  it("returns nothing for a header-only file", () => {
    expect(parseTradesCsv(TRADE_HEADER)).toEqual([]);
  });

  // Positional parsing is only safe if the header is verified. These two are
  // the difference between failing at row 0 and importing 1,576 shifted rows.
  it("throws when a column is renamed", () => {
    const header = TRADE_HEADER.replace("pnl_dollars", "pnl");
    expect(() => parseTradesCsv(`${header}\n${row}`)).toThrow(
      /Unexpected CSV header/,
    );
  });

  it("throws when columns are reordered", () => {
    const header =
      "entry_date,ticker,exit_date,entry_price,stop_price,exit_price,shares,exit_reason,commission,pnl_dollars,r_multiple,holding_days";
    expect(() => parseTradesCsv(`${header}\n${row}`)).toThrow(
      /Unexpected CSV header/,
    );
  });

  it("throws on a short row rather than filling undefined", () => {
    expect(() => parseTradesCsv(`${TRADE_HEADER}\nSPY,1994-05-03`)).toThrow(
      /Expected 12 columns/,
    );
  });

  it("throws on a non-numeric value rather than storing 0", () => {
    // A blank landing as 0 would drag every aggregate toward zero invisibly.
    const bad = row.replace("-1.178319812963098", "");
    expect(() => parseTradesCsv(`${TRADE_HEADER}\n${bad}`)).toThrow(
      /Expected a number in "pnl_dollars"/,
    );
  });
});

describe("parseComparisonCsv", () => {
  const rows = [
    "Donchian 20/10 Breakout,791,44.879898862199745,0.13636244046402102,1.587690528378505,0.6439756275611636,0.739615858650829,3.639123435565672,-20.633940892779883,315.72538081408123",
    '"MACD(12,26,9) Momentum",1576,38.00761421319797,0.09830153546212234,1.2590475949387185,0.4638326842779796,0.6101210990694117,4.4642099380374445,-47.519832747892224,409.8464397766096',
  ].join("\n");

  it("parses summaries, including the quoted label", () => {
    const summaries = parseComparisonCsv(`${COMPARISON_HEADER}\n${rows}`);

    expect(summaries).toHaveLength(2);
    expect(summaries[0].label).toBe("Donchian 20/10 Breakout");
    expect(summaries[0].trades).toBe(791);
    expect(summaries[1].label).toBe("MACD(12,26,9) Momentum");
    expect(summaries[1].trades).toBe(1576);
  });

  it("keeps win rate as a PERCENT, not a fraction", () => {
    const [donchian] = parseComparisonCsv(`${COMPARISON_HEADER}\n${rows}`);
    // 44.88, never 0.4488 — the _pct suffix runs to the database for this.
    expect(donchian.winRatePct).toBeCloseTo(44.8799);
  });

  it("keeps max drawdown negative rather than as a magnitude", () => {
    const [donchian] = parseComparisonCsv(`${COMPARISON_HEADER}\n${rows}`);
    expect(donchian.maxDdPct).toBeLessThan(0);
  });
});

describe("catalog ↔ comparison CSV labels", () => {
  // The label is the ONLY join key between the two files, so a drift here
  // would orphan a strategy's summary at seed time.
  it("resolves every real comparison label to a registry key", () => {
    const labels = [
      "Donchian 20/10 Breakout",
      "MACD(12,26,9) Momentum",
      "EMA9/21 Pullback + Filters (original)",
      "SMA 50/200 Golden Cross",
      "RSI(14) Mean-Reversion",
    ];

    for (const label of labels) {
      expect(strategyByLabel(label)?.key).toBeDefined();
    }
  });

  it("returns undefined for a label the catalog does not know", () => {
    expect(strategyByLabel("Bollinger Squeeze")).toBeUndefined();
  });
});
