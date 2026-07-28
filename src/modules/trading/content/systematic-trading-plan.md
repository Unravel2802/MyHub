> A complete, rules-based plan built for US stocks and ETFs, swing trading,
> Python automation, and a $100 starting account. No guesswork and no emotion:
> just a system.

## Your Strategy: EMA Crossover + RSI Filter

This is a classic, battle-tested systematic strategy. It works on daily charts of liquid ETFs (SPY, QQQ, IWM), is fully codeable in Python, generates clear buy/sell signals, and requires only 10–15 minutes a day to run. Perfect for your profile.

The authoritative R1–R8 system rules, Iron Rules, and daily checklist live in MyHub's Pre-trade tab. They are intentionally not duplicated here.

### Why This Strategy

**Fully Objective**

Every entry and exit is defined by a number. No "feels like" decisions. The algorithm tells you what to do.

**Daily Timeframe**

Signals fire once per day after market close. Check once, place order, done. No screen-watching required.

**Backtestable**

100% codeable means you can test it on 10+ years of history before risking a single dollar.

**Risk-Controlled**

Position sizing is calculated by formula, not gut. Your max loss per trade is fixed and known in advance.

### Signal Logic Explained

| Condition                | Meaning                              | Signal  |
| ------------------------ | ------------------------------------ | ------- |
| EMA9 crosses above EMA21 | Short-term momentum turning bullish  | BUY     |
| EMA9 crosses below EMA21 | Short-term momentum turning bearish  | SELL    |
| RSI 40–65 on entry       | Not overbought, room to run          | CONFIRM |
| RSI > 75                 | Overbought — exit regardless of EMA  | EXIT    |
| Price hits stop-loss     | Trade invalidated — exit immediately | STOP    |

> **Important** With $100, fractional shares are your friend. Many brokers (Fidelity, Schwab, Interactive Brokers) now support fractional shares, so you can buy $50 of SPY even though one full share is ~$530.

## Python Signal Generator

Run this script each evening after market close. It fetches the latest price data, calculates your indicators, and prints a clear BUY / SELL / HOLD signal with exact position sizing for your account.

### Install Dependencies

**Terminal**

```bash
pip install yfinance pandas numpy
```

### Main Signal Script — save as `signal_check.py`

**Python · signal_check.py**

```python
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

# ── CONFIG ─────────────────────────────────────────────
ACCOUNT_SIZE  = 100.0   # Update this as your account grows
RISK_PER_TRADE = 0.02   # 2% of account
TICKERS       = ["SPY", "QQQ", "IWM"]
EMA_SHORT     = 9
EMA_LONG      = 21
RSI_PERIOD    = 14
ATR_PERIOD    = 14
ATR_MULT      = 2.0     # Stop = entry - 2×ATR

# ── INDICATORS ─────────────────────────────────────────
def calc_rsi(series, period=14):
    delta = series.diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    rs    = gain / loss
    return 100 - (100 / (1 + rs))

def calc_atr(df, period=14):
    hl  = df["High"]  - df["Low"]
    hc  = (df["High"]  - df["Close"].shift()).abs()
    lc  = (df["Low"]   - df["Close"].shift()).abs()
    tr  = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    return tr.rolling(period).mean()

def analyze(ticker):
    df = yf.download(ticker, period="6mo", interval="1d", progress=False)
    if df.empty or len(df) < 30:
        return

    df["EMA_S"] = df["Close"].ewm(span=EMA_SHORT, adjust=False).mean()
    df["EMA_L"] = df["Close"].ewm(span=EMA_LONG,  adjust=False).mean()
    df["RSI"]   = calc_rsi(df["Close"], RSI_PERIOD)
    df["ATR"]   = calc_atr(df, ATR_PERIOD)

    # Latest values
    last      = df.iloc[-1]
    prev      = df.iloc[-2]
    price     = float(last["Close"])
    ema_s     = float(last["EMA_S"])
    ema_l     = float(last["EMA_L"])
    rsi       = float(last["RSI"])
    atr       = float(last["ATR"])

    # Crossover detection
    bullish_cross = (prev["EMA_S"] <= prev["EMA_L"]) and (ema_s > ema_l)
    bearish_cross = (prev["EMA_S"] >= prev["EMA_L"]) and (ema_s < ema_l)

    # Signal logic
    stop_loss = price - (ATR_MULT * atr)
    risk_amt  = ACCOUNT_SIZE * RISK_PER_TRADE
    shares    = risk_amt / (price - stop_loss)

    if bullish_cross and 40 <= rsi <= 65:
        signal = "🟢 BUY"
    elif bearish_cross or rsi > 75:
        signal = "🔴 SELL / EXIT"
    else:
        signal = "⚪ HOLD / WAIT"

    # Print report
    print(f"\n{'═'*44}")
    print(f"  {ticker}  ·  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'═'*44}")
    print(f"  Price    : ${price:.2f}")
    print(f"  EMA 9/21 : {ema_s:.2f} / {ema_l:.2f}")
    print(f"  RSI(14)  : {rsi:.1f}")
    print(f"  ATR(14)  : {atr:.2f}")
    print(f"{'─'*44}")
    print(f"  SIGNAL   : {signal}")
    print(f"{'─'*44}")
    if "BUY" in signal:
        print(f"  Stop-Loss: ${stop_loss:.2f}  (-{ATR_MULT}×ATR)")
        print(f"  Risk $   : ${risk_amt:.2f}  (2% of account)")
        print(f"  Shares   : {shares:.4f}  (use fractional)")
    print(f"{'═'*44}\n")

# ── RUN ────────────────────────────────────────────────
print("\n  SYSTEMATIC SIGNAL CHECK")
print(f"  Account: ${ACCOUNT_SIZE:.2f}  |  Risk/trade: {RISK_PER_TRADE*100:.0f}%\n")
for t in TICKERS:
    analyze(t)
```

### Sample Output

**Output**

```text
SYSTEMATIC SIGNAL CHECK
  Account: $100.00  |  Risk/trade: 2%

════════════════════════════════════════════
  SPY  ·  2026-05-20 16:32
════════════════════════════════════════════
  Price    : $531.14
  EMA 9/21 : 528.42 / 524.10
  RSI(14)  : 54.3
  ATR(14)  : 6.82
────────────────────────────────────────────
  SIGNAL   : 🟢 BUY
────────────────────────────────────────────
  Stop-Loss: $517.50  (-2×ATR)
  Risk $   : $2.00  (2% of account)
  Shares   : 0.1468  (use fractional)
════════════════════════════════════════════
```

### Next Step — Backtesting

Before trading live, backtest this strategy. Install `backtrader` or use the free **QuantConnect** platform (cloud-based, no setup). Run the strategy on SPY from 2015–2025 and look for: win rate >45%, Sharpe ratio >1.0, max drawdown <20%.

> **Pro Tip** After backtesting, paper trade for 4–6 weeks on a simulated account before touching real money. Alpaca Markets offers a free paper trading API that works perfectly with Python.

## Broker & Account Setup

With $100, your broker choice matters more than usual. You need $0 commissions, fractional shares, and ideally an API for future automation. Here are the best options for your profile.

### Recommended Brokers

- **Fidelity — Best Overall:** $0 commission · Fractional shares · No account minimum
- **Alpaca Markets — Best for Automation:** $0 commission · Full Python API · Paper trading · Fractional shares
- **Interactive Brokers (IBKR Lite) — Best Long-term:** $0 commission · Fractional shares · Professional-grade platform
- **Schwab — Solid Choice:** $0 commission · Fractional shares (Schwab Stock Slices) · Excellent tools

> **Avoid for now** Robinhood — order flow practices and gamification elements work against systematic discipline. Webull — limited fractional share support on ETFs. Any broker charging per-trade commissions — at $100, a $5 commission is a 5% tax on your trade.

### Recommended Path

- **Week 1–2 — Open Alpaca paper trading account:** Free, instant, Python API included. Run your signal script against the paper account. Get comfortable with the workflow.
- **Week 3–6 — Paper trade your strategy:** Follow every signal the script generates. Log every trade. Track P&L. Don't skip trades — discipline in paper trading = discipline in real trading.
- **Week 7+ — Open Fidelity or Alpaca live account with $100:** Fund with exactly $100. Follow the same rules you followed in paper trading. The system doesn't change — only the money is real.

### Alpaca Python API (Bonus)

**Terminal**

```bash
pip install alpaca-trade-api
```

**Python · place_order.py (paper trading)**

```python
import alpaca_trade_api as tradeapi

api = tradeapi.REST(
    "YOUR_API_KEY",
    "YOUR_SECRET_KEY",
    base_url="https://paper-api.alpaca.markets"
)

# Place a fractional buy order
api.submit_order(
    symbol="SPY",
    notional=50,          # $50 worth of SPY
    side="buy",
    type="market",
    time_in_force="day"
)
print("Order placed ✓")
```

## The Scaling Roadmap

How and when to add money. This is milestone-based, not time-based. You only scale when your results prove the system works — not because you feel confident.

| Phase       | Account Size   | Unlock Condition                                             | What Changes                                                                    |
| ----------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 0 · Paper   | $0 (simulated) | 4–6 weeks of paper trading with positive expectancy          | Nothing — just learning the workflow                                            |
| 1 · Seed    | $100           | Paper trading complete. Emotions tested.                     | Real money. Same rules. Same position sizes.                                    |
| 2 · Sprout  | $250–500       | 10+ live trades, win rate >45%, no rule breaks               | Can now trade 2 positions. Consider adding individual sector ETFs.              |
| 3 · Growth  | $1,000–2,500   | 3 months profitable, Sharpe >1, max drawdown <15%            | Start testing individual large-cap stocks. Keep 60% in ETFs.                    |
| 4 · Scale   | $5,000+        | 6 months consistently profitable. Strategy fully documented. | Consider automating full execution via Alpaca API. Refine strategy.             |
| 5 · Serious | $10,000+       | 12 months profitable track record                            | Pattern Day Trader status unlocks (if day trading). Explore options strategies. |

> **The Compounding Math** If your system makes a modest 2% per month on average (after losses), $100 becomes $127 in a year. That's not exciting. But $10,000 with the same rate becomes $12,682 — and $50,000 becomes $63,000. The system's value isn't the returns at $100. It's that you're building a proven, audited track record you can scale with confidence.

### What to Track Each Month

**Win Rate**

Winning trades ÷ total trades. Target: >45%. Even 40% is fine with a good R:R ratio.

**Avg Win vs Avg Loss**

Your average winner should be at least 1.5–2× your average loser. This is your edge.

**Max Drawdown**

Largest peak-to-trough drop. If this exceeds 15%, review and tighten rules before scaling.

**Expectancy**

(Win% × Avg Win) − (Loss% × Avg Loss). Must be positive. This is your edge per dollar risked.
