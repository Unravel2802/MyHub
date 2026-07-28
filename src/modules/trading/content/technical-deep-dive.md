> The math, logic, and Python behind every indicator, rule, and metric in the
> trading system—so the system can be understood, trusted, tested, and improved.

## 01 · Moving Averages

_The backbone of your entry signal. Understanding the math tells you exactly why the crossover works — and when it fails._

### What a Moving Average Actually Is

A moving average is a _smoothing function_. Raw price data is noisy — it jumps up and down every bar with no clear structure. A moving average filters out that noise by averaging prices over N periods, revealing the underlying directional trend.

Think of it this way: today's closing price is a single data point containing both signal and noise. The 20-day average of closing prices is mostly signal.

### Simple Moving Average (SMA)

The SMA treats every period equally. The 9-day SMA is just the arithmetic mean of the last 9 closing prices.

> **Formula**
> `SMA(n) = (P₁ + P₂ + P₃ + ... + Pₙ) / n`
> Where P = closing price, n = number of periods

The SMA's weakness: it reacts slowly to price changes because old data has equal weight to recent data. A big move 8 days ago still pulls the average just as much as today's price.

### Exponential Moving Average (EMA) — What Your Strategy Uses

The EMA solves the SMA's lag problem by weighting recent prices more heavily. The most recent price gets the highest weight, and older prices decay exponentially.

> **EMA Formula (recursive)**
> `EMA_today = Price_today × k + EMA_yesterday × (1 − k)`
> where k = 2 / (n + 1) → for n=9: k = 2/10 = 0.20

For EMA(9): today's price gets a 20% weight. Yesterday's EMA (which already includes all prior history) gets 80%. This means if price spikes up sharply, the EMA(9) responds meaningfully within 1–2 bars — much faster than an SMA(9) would.

**Python · Manual EMA calculation**

```python
# pandas does this in one line, but let's build it manually
def ema(prices, period):
    k = 2 / (period + 1)
    result = [prices[0]]  # seed with first price
    for price in prices[1:]:
        result.append(price * k + result[-1] * (1 - k))
    return result

# In practice, use pandas:
df["EMA9"]  = df["Close"].ewm(span=9,  adjust=False).mean()
df["EMA21"] = df["Close"].ewm(span=21, adjust=False).mean()
```

### The Crossover — Why It Works

When EMA(9) crosses above EMA(21), it means short-term momentum is now stronger than medium-term momentum. The fast average has "caught up and overtaken" the slow average — which only happens after a sustained directional move.

> **The Physics Analogy** Think of the EMA(9) as a sports car and EMA(21) as a truck. When the car overtakes the truck, it means the car has been accelerating for a while. When price momentum accelerates enough, the fast EMA overtakes the slow EMA — that's your entry signal.

### EMA(9) vs EMA(21) — Why These Numbers?

These aren't magic. 9 ≈ two trading weeks, 21 ≈ one trading month. They capture short-term vs medium-term momentum. Other popular combinations: 8/21, 12/26 (used in MACD), 50/200 (long-term institutional). Your job eventually is to backtest to find the best fit for your specific asset.

> **The Lag Problem** All moving averages are lagging indicators — they confirm moves that have already started. You will never buy the exact bottom or sell the exact top. That's intentional. You're not trying to be first — you're confirming momentum is real before entering.

## 02 · RSI — The Math

_Your filter indicator. Understanding RSI tells you exactly when NOT to take a crossover signal — which is just as valuable as knowing when to take one._

### What RSI Measures

RSI — Relative Strength Index — measures the _speed and magnitude of price changes_. Specifically, it compares average gains to average losses over N periods and normalizes the result to a 0–100 scale.

It answers: "Has price been going up more than it's been going down recently?" A high RSI = overwhelmingly yes. Low RSI = overwhelmingly no.

### The Formula, Step by Step

> **Step 1 — Calculate daily changes**
> `Change = Close_today − Close_yesterday`
> If positive → it's a gain. If negative → it's a loss.

> **Step 2 — Separate gains and losses**
> `Avg_Gain = mean of all positive changes over 14 periods Avg_Loss = mean of all negative changes over 14 periods (use absolute value)`

> **Step 3 — Calculate RS and RSI**
> `RS = Avg_Gain / Avg_Loss RSI = 100 − (100 / (1 + RS))`
> If Avg_Loss = 0, RSI = 100 (price only went up for 14 days)

**Python · RSI from scratch**

```python
def calc_rsi(closes, period=14):
    delta  = closes.diff()                       # daily changes
    gains  = delta.clip(lower=0)              # keep positives
    losses = (-delta).clip(lower=0)           # keep positives from negatives

    # Wilder's smoothing (not a simple average)
    avg_gain = gains.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = losses.ewm(alpha=1/period, adjust=False).mean()

    rs  = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi
```

### Reading RSI — The Zones

- **70–100:** Overbought — potential exhaustion, consider exit
- **40–65:** Your entry zone — momentum with room to run
- **30–40:** Neutral — no strong conviction
- **0–30:** Oversold — potential bounce, but not your signal

### Why Your Strategy Filters RSI to 40–65

The EMA crossover alone fires in all conditions — including when an asset is already extremely overbought (RSI 75+). In that case, you'd be chasing a move that's almost over. By requiring RSI between 40–65, you ensure:

- **RSI > 40:** Momentum is genuinely bullish, not just bouncing from oversold
- **RSI < 65:** Price hasn't already run too far — there's still room for the trade to work

### RSI Divergence — An Advanced Signal

Divergence occurs when price and RSI disagree. This is one of the most powerful reversal signals in technical analysis:

- **Bearish Divergence:** Price makes a new HIGH, but RSI makes a lower high. Momentum is weakening even as price rises. Strong warning to exit longs or tighten stops.
- **Bullish Divergence:** Price makes a new LOW, but RSI makes a higher low. Selling pressure is exhausting. Often precedes sharp reversals upward.

> **Improvement Idea** Once you're comfortable with the base strategy, add a divergence check to your script. If a BUY signal fires but you detect bearish divergence on the daily chart, skip that trade. This filter alone can meaningfully improve win rate.

## 03 · ATR & Volatility

_ATR is the engine behind your stop-loss. It's how your system adapts to different market conditions automatically — wider stops in volatile markets, tighter stops in calm ones._

### The Problem ATR Solves

Fixed stop-losses (e.g., always stop $5 below entry) are naive. SPY might move $8 in a single normal day during a volatile period, stopping you out of perfectly valid trades. In a calm market, $5 might be ridiculously wide. You need a stop that _scales with current volatility_.

ATR — Average True Range — measures how much an asset typically moves per day. Your stop-loss at `entry − 2×ATR` means: "I exit only if price moves 2× the normal daily range against me." This filters out noise while catching real trend failures.

### True Range — The Foundation

The True Range (TR) is the largest of three possible price ranges on any given day:

> **True Range Formula**
> `TR = max( High − Low, ← intraday range |High − Close_prev|, ← gap up scenario |Low − Close_prev| ← gap down scenario )`
> ATR(14) = 14-period smoothed average of daily True Range values

> **Concrete Example** SPY ATR(14) is typically $6–8 in normal markets. If SPY closes at $531 and ATR = $7, your stop-loss goes at $531 − (2 × $7) = $517. That's $14 of room — enough to survive normal volatility, but not a genuine trend reversal.

**Python · ATR calculation**

```python
def calc_atr(df, period=14):
    high, low, close = df["High"], df["Low"], df["Close"]
    prev_close = close.shift(1)

    # Three candidate ranges
    tr1 = high - low                      # normal day
    tr2 = (high - prev_close).abs()      # gap up
    tr3 = (low  - prev_close).abs()      # gap down

    # True Range = largest of the three
    tr  = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    # Wilder's smoothing (same as RSI uses)
    atr = tr.ewm(alpha=1/period, adjust=False).mean()
    return atr

# Using it for stop-loss:
atr_mult  = 2.0
entry     = 531.14
stop_loss = entry - (atr_mult * df["ATR"].iloc[-1])
```

### ATR as a Market Thermometer

Beyond stop-losses, ATR tells you about the market's current state:

| ATR Level         | Market State         | Implication for You                                         |
| ----------------- | -------------------- | ----------------------------------------------------------- |
| Low ATR (falling) | Calm, consolidating  | Caution Often precedes big move — which direction unknown   |
| Rising ATR        | Volatility expanding | Opportunity Trends are starting — crossovers more reliable  |
| Very High ATR     | Panic / news-driven  | Danger Whipsaws. Signals unreliable. Consider staying flat. |

> **Improvement: ATR Filter** Add a rule: only take trades when ATR is between the 30th and 70th percentile of its 6-month range. Skip trades during extremely calm or extremely chaotic periods. This alone can significantly improve your signal quality.

## 04 · Trend & Momentum

_Your strategy is a trend-following strategy. Understanding how trends form, persist, and end is the foundation of knowing when your system will excel and when it will struggle._

### What a Trend Actually Is

A trend is not just "price going up." A true uptrend is structurally defined by **higher highs and higher lows** — each bounce reaches a new peak, and each pullback holds above the previous pullback low. This structure reflects buyers consistently willing to pay more, and sellers consistently capitulating at higher levels.

- **Higher High (HH):** Each price peak exceeds the previous peak. Shows buyers are increasingly aggressive.
- **Higher Low (HL):** Each pullback holds above the previous pullback. Shows sellers are losing conviction.
- **Lower High (LH):** Each rally fails below the previous high. Buyers are losing steam — trend may be ending.
- **Lower Low (LL):** Each drop reaches a new low. Sellers in control — confirmed downtrend.

### Momentum vs Price

Momentum is the rate of change of price — how fast it's moving, not just in which direction. A stock can be in an uptrend while momentum is decelerating, which often precedes a reversal. This is exactly what RSI divergence captures.

> **Rate of Change (ROC) — Simple Momentum Measure**
> `ROC(n) = (Close_today − Close_n_days_ago) / Close_n_days_ago × 100`
> A 10-day ROC of +5% means price is 5% higher than 10 days ago

### The Three Phases of a Trend

Dow Theory (still relevant 130 years later) identifies three phases in every major trend:

1. **Accumulation Phase:** Smart money quietly buys while the public is bearish. Volume is low. Price range is tight. Your EMA crossover won't fire yet — it's too early.
2. **Public Participation Phase:** The trend becomes obvious. News is positive. The public starts buying. This is when your crossover fires and you want to be in the trade.
3. **Distribution Phase:** Smart money sells to the late-arriving public. Price may still rise but on declining momentum. RSI divergence often appears here. This is when your system starts generating exit signals.

> **Your Sweet Spot** Your EMA crossover strategy captures Phase 2 — the participation phase. You won't catch the very beginning (accumulation) or the very end (distribution). That's fine. The middle of a trend is where the cleanest, most reliable money is made.

### When Trend-Following Fails

Trend-following strategies underperform in ranging/choppy markets. When price oscillates within a range without directional conviction, you'll get false crossover signals — buy, get stopped out, buy again, get stopped out. This is called "whipsaw." The RSI filter reduces this, but it doesn't eliminate it. This is why regime detection (Chapter 10) is important.

## 05 · Support & Resistance

_S&R levels are where supply and demand have historically balanced. They're not in your automated script — but knowing them makes you a better judge of when your signals are high-quality vs borderline._

### Why Price "Remembers" Levels

Support and resistance exist because of _market memory_. If thousands of traders bought SPY at $520 and it dropped to $500, those traders are now sitting at a loss. When price eventually returns to $520, many of them sell to break even — creating resistance at exactly that level. Psychology creates the levels; levels create more psychology.

### Types of Support & Resistance

- **Horizontal S/R:** Specific price levels where price has reversed multiple times. The more touches, the stronger the level. Most reliable type.
- **Trendline S/R:** Diagonal lines connecting swing highs or lows. Price often bounces off these in strong trends. Less precise than horizontal levels.
- **Moving Average S/R:** In trending markets, the EMA(21) or EMA(50) often acts as dynamic support. Price pulls back to it, then bounces. This is a strong entry trigger.
- **Round Numbers:** $500, $530, $550 on SPY — round numbers act as psychological S/R because traders cluster orders around them. Always note nearby round numbers.
- **Previous Highs/Lows:** All-time highs, 52-week highs/lows, prior month's high/low — these are watched by institutional traders and often create reliable reactions.

### The Flip Principle

One of the most reliable concepts in all of technical analysis: when a support level is convincingly broken, it becomes new resistance. When resistance is convincingly broken, it becomes new support. This "flip" happens because the traders who were wrong (bulls who bought at support, now stopped out) become the sellers when price returns to that level.

> **Practical Application** When your EMA crossover fires a BUY signal, check: is price just below a major resistance level? If so, the trade may get immediately rejected. If price just broke through resistance and is pulling back to retest it (now support), that's a much higher-quality entry. Same signal, very different context.

## 06 · Volume Analysis

_Price tells you what happened. Volume tells you how much conviction was behind it. A move on high volume is real. A move on low volume is suspicious._

### Volume Is Conviction

Every price move is a transaction between a buyer and a seller. When volume is high, many participants agreed to transact at that price — strong conviction. When volume is low, few agreed — weak conviction, and the move may reverse.

- **High volume breakout:** Price breaks resistance with 2×+ average volume. Strong confirmation — institutions are participating. Trust the breakout.
- **Low volume breakout:** Price breaks resistance on thin volume. Suspect — could be a false break. Wait for volume confirmation before entering.
- **High volume reversal:** Price drops sharply on very high volume (a "climactic" selloff). Often marks short-term bottoms — exhaustion of sellers.
- **Declining volume in trend:** Price continues up but volume is shrinking. Fewer participants supporting the move. Warning sign — trend may be weakening.

**Python · Adding volume filter**

```python
# Calculate average volume over 20 days
df["Vol_MA20"] = df["Volume"].rolling(20).mean()
df["Vol_Ratio"] = df["Volume"] / df["Vol_MA20"]

# Add to your signal logic:
vol_ratio = float(last["Vol_Ratio"])
high_volume = vol_ratio > 1.2   # 20% above average

# Only take BUY signals with above-average volume
if bullish_cross and 40 <= rsi <= 65 and high_volume:
    signal = "🟢 HIGH CONVICTION BUY"
elif bullish_cross and 40 <= rsi <= 65:
    signal = "🟡 LOW CONVICTION BUY — Use caution"
```

> **Key Volume Principle** Volume should expand in the direction of the trend. In an uptrend: up days should have higher volume than down days. When down days start having higher volume than up days, distribution is happening — smart money is selling. This is a powerful early exit signal.

## 07 · Position Sizing Math

_This is where most traders lose money — not from bad entries, but from bad sizing. Position sizing is the exact science of how much to buy. Get this right and you survive. Get it wrong and even a winning strategy can bankrupt you._

### The Core Formula

Your position size should always be determined by how much you're willing to lose — not by how much you want to make. Start with your risk, work backward to your size.

> **Position Sizing Formula**
> `Risk Amount = Account Size × Risk % Risk Per Share = Entry Price − Stop Loss Price Shares to Buy = Risk Amount ÷ Risk Per Share`
> Example: $100 account, 2% risk, entry $531, stop $517 → $2 ÷ $14 = 0.143 shares

**Python · Position sizing calculator**

```python
def position_size(account, risk_pct, entry, stop_loss):
    """
    Returns number of shares to buy.
    Works with fractional shares.
    """
    risk_dollars   = account * risk_pct          # e.g. $100 × 0.02 = $2
    risk_per_share = entry - stop_loss           # e.g. $531 - $517 = $14

    if risk_per_share <= 0:
        raise ValueError("Stop must be BELOW entry for long trades")

    shares = risk_dollars / risk_per_share       # e.g. $2 / $14 = 0.143
    capital_deployed = shares * entry            # e.g. 0.143 × $531 = $75.93

    print(f"Risk: ${risk_dollars:.2f}")
    print(f"Shares: {shares:.4f}")
    print(f"Capital used: ${capital_deployed:.2f} ({capital_deployed/account*100:.1f}%)")
    return shares

# Usage:
position_size(
    account=100,
    risk_pct=0.02,
    entry=531.14,
    stop_loss=517.50
)
```

### Kelly Criterion — The Math of Optimal Sizing

The Kelly Criterion is a mathematical formula for the theoretically optimal bet size, given your edge. It's used by professional gamblers and quant traders. You don't use it directly yet, but understanding it shapes your thinking:

> **Kelly Formula**
> `f* = W − (L / R)`
> f* = fraction of capital to risk | W = win rate | L = loss rate (1−W) | R = avg win / avg loss ratio

> **Never Use Full Kelly** Full Kelly is mathematically optimal in the long run but causes brutal drawdowns along the way. Professional traders use "half Kelly" or "quarter Kelly." Your 2% rule is roughly equivalent to 1/10th Kelly — extremely conservative, which is exactly right when starting out.

### The Ruin Math

This is why position sizing is survival-critical. Even with a great strategy, bad sizing leads to ruin:

| Risk Per Trade | After 10 Consecutive Losses | Recovery Needed           |
| -------------- | --------------------------- | ------------------------- |
| 2% (your rule) | Account = $81.71            | +22% Manageable           |
| 5%             | Account = $59.87            | +67% Tough                |
| 10%            | Account = $34.87            | +187% Very hard           |
| 25%            | Account = $5.63             | +1676% Effectively ruined |

## 08 · Expectancy & Edge

_Expectancy is the single number that tells you whether your strategy makes money over time. It's the north star metric for every systematic trader._

### What Is Expectancy?

Expectancy is the average amount you expect to make (or lose) per dollar risked, across many trades. A positive expectancy means you have an edge. Negative means you're a long-term loser regardless of short-term luck.

> **Expectancy Formula**
> `E = (Win Rate × Avg Win) − (Loss Rate × Avg Loss)`
> Win Rate + Loss Rate = 1.0 (100%)

> **The Crucial Insight** You do NOT need a high win rate to be profitable. A strategy that wins 35% of the time but has 3:1 average R:R has an expectancy of (0.35×3) − (0.65×1) = 1.05 − 0.65 = $0.40 per dollar risked. Profitable. Many great systems win less than half the time.

**Python · Calculate your edge from your trade log**

```python
import pandas as pd

def calculate_edge(trades_df):
    """
    trades_df must have a 'pnl' column (profit/loss per trade in $).
    Assumes all trades risk the same dollar amount.
    """
    wins   = trades_df[trades_df['pnl'] > 0]['pnl']
    losses = trades_df[trades_df['pnl'] <= 0]['pnl'].abs()

    win_rate   = len(wins) / len(trades_df)
    loss_rate  = 1 - win_rate
    avg_win    = wins.mean()   if len(wins)   > 0 else 0
    avg_loss   = losses.mean() if len(losses) > 0 else 0
    expectancy = (win_rate * avg_win) - (loss_rate * avg_loss)
    rr_ratio   = avg_win / avg_loss if avg_loss > 0 else 0
    sharpe     = trades_df['pnl'].mean() / trades_df['pnl'].std() * (252**0.5)

    print(f"Total Trades  : {len(trades_df)}")
    print(f"Win Rate      : {win_rate:.1%}")
    print(f"Avg Win       : ${avg_win:.2f}")
    print(f"Avg Loss      : ${avg_loss:.2f}")
    print(f"R:R Ratio     : {rr_ratio:.2f}")
    print(f"Expectancy    : ${expectancy:.2f} per trade")
    print(f"Sharpe Ratio  : {sharpe:.2f}")
    return expectancy
```

### The Sharpe Ratio

Sharpe ratio measures return per unit of risk — how much you make relative to the volatility of your returns. It's the standard metric for comparing strategies.

> **Sharpe Ratio**
> `Sharpe = (Mean Return − Risk Free Rate) / Std Dev of Returns × √252`
> √252 annualizes daily figures (252 trading days/year)

## 09 · Backtesting Properly

_Backtesting is how you prove your strategy has an edge before risking real money. But it's full of traps that make bad strategies look great on paper. Learn to backtest honestly._

### What Backtesting Is

A backtest simulates running your strategy on historical data, treating each past bar as if it were live. You start with a fixed capital, follow your rules exactly, and measure the results. A good backtest answers: "If I had traded this system over the past N years, what would have happened?"

### The Lethal Errors in Backtesting

- **Look-Ahead Bias:** Using future data to make past decisions. Example: calculating today's indicator using tomorrow's close. Makes any strategy look perfect — and is completely wrong. Always use only data available at signal time.
- **Survivorship Bias:** Testing only on stocks that exist today, ignoring companies that went bankrupt or were delisted. Systematically overstates performance. For ETFs like SPY, this is less of an issue.
- **Overfitting:** Tuning parameters (EMA lengths, RSI thresholds) until they look great on historical data. The strategy then fails on new data. If EMA(9,21) works but EMA(9,22) "works even better," you're overfitting.
- **Ignoring Costs:** Not accounting for spreads, commissions, and slippage. A strategy that looks great before costs may be unprofitable after them.

**Python · Simple backtest framework**

```python
import yfinance as yf
import pandas as pd

def backtest(ticker="SPY", start="2015-01-01", capital=10000):
    df = yf.download(ticker, start=start, progress=False)
    df["EMA9"]  = df["Close"].ewm(span=9,  adjust=False).mean()
    df["EMA21"] = df["Close"].ewm(span=21, adjust=False).mean()

    # RSI
    delta = df["Close"].diff()
    gain  = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    loss  = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False).mean()
    df["RSI"] = 100 - (100 / (1 + gain/loss))

    trades, position, entry = [], False, 0

    for i in range(1, len(df)):
        row, prev = df.iloc[i], df.iloc[i-1]
        cross_up   = prev["EMA9"] <= prev["EMA21"] and row["EMA9"] > row["EMA21"]
        cross_down = prev["EMA9"] >= prev["EMA21"] and row["EMA9"] < row["EMA21"]

        if cross_up and 40 <= row["RSI"] <= 65 and not position:
            entry    = row["Close"]
            position = True

        elif cross_down and position:
            trades.append(row["Close"] - entry)   # P&L per share
            position = False

    t = pd.Series(trades)
    wins = t[t > 0]
    print(f"Trades: {len(t)} | Win: {len(wins)/len(t):.1%} | "
          f"Avg Win: ${wins.mean():.2f} | Avg Loss: ${t[t<=0].mean():.2f}")
    return t

backtest("SPY", start="2015-01-01")
```

### What Good Backtest Results Look Like

| Metric             | Minimum | Good  | Excellent |
| ------------------ | ------- | ----- | --------- |
| Win Rate           | >40%    | >50%  | >60%      |
| Avg Win / Avg Loss | >1.2×   | >1.5× | >2.0×     |
| Sharpe Ratio       | >0.5    | >1.0  | >1.5      |
| Max Drawdown       | <25%    | <15%  | <10%      |
| Number of Trades   | >30     | >50   | >100      |

> **Walk-Forward Testing** Don't just test on all available history. Split your data: optimize on 70% (the "in-sample" period) then validate on the remaining 30% (the "out-of-sample" period) that you never touched. If results collapse out-of-sample, you've overfit. Only an out-of-sample test is a real test.

## 10 · Signal Filtering

_More signals is not better. Fewer, higher-quality signals is the goal. Filters eliminate the bad trades that drag down your expectancy — the ones that look like entries but aren't._

### The Filtering Philosophy

Your base strategy fires a signal whenever two conditions are met (EMA cross + RSI range). Filters add additional conditions that must also be true before you take the trade. Each filter reduces trade frequency but should improve the win rate and expectancy of the trades you do take.

> **The Tradeoff** Every filter reduces the number of trades. Fewer trades = fewer opportunities to compound gains. The goal is not to filter until you have 2 trades per year — it's to find the optimal balance. Always backtest before adding a new filter to confirm it actually improves expectancy.

### Practical Filters to Implement

#### 1. Trend Confirmation Filter (EMA 200)

Only take BUY signals when price is above the 200-day EMA. This ensures you're trading with the long-term trend, not against it. In bear markets, this filter keeps you out of dangerous counter-trend longs.

**Python · 200 EMA trend filter**

```python
df["EMA200"] = df["Close"].ewm(span=200, adjust=False).mean()
above_200  = float(last["Close"]) > float(last["EMA200"])

# Only trade longs when above 200 EMA
if bullish_cross and 40 <= rsi <= 65 and above_200:
    signal = "🟢 BUY (trend confirmed)"
```

#### 2. Volume Confirmation Filter

Already covered in Chapter 5. Only enter when crossover bar has volume ≥ 120% of 20-day average.

#### 3. ATR Range Filter

Skip trades when ATR is in the bottom 20th percentile (too calm — likely to whipsaw) or top 10th percentile (too chaotic — stops get blown through).

#### 4. No-Trade Zones

Automatically skip signals on these days regardless of the signal:

- Day before and after a Federal Reserve rate decision (check FOMC calendar)
- Major macro data releases: CPI, NFP (jobs report), GDP
- First and last day of each month (institutional rebalancing creates noise)
- Low-liquidity days: day after Thanksgiving, December 24th

**Python · Economic calendar no-trade filter**

```python
# Manually maintain a list of high-impact dates
# Source: investing.com/economic-calendar (free)
NO_TRADE_DATES = {
    "2026-05-07",   # FOMC meeting
    "2026-06-10",   # CPI release
    "2026-06-05",   # NFP release
    # Add as you go
}

today_str = datetime.now().strftime("%Y-%m-%d")
if today_str in NO_TRADE_DATES:
    print("⛔ NO-TRADE DAY — High impact economic event")
    exit()
```

## 11 · Regime Detection

_The single biggest improvement you can make to a trend-following system. A "regime" is the market's current personality — trending or ranging. Your strategy only works well in one of them._

### The Problem: One Strategy, Two Markets

Markets alternate between two states: **trending** (directional, persistent moves) and **ranging** (sideways, oscillating within a band). Your EMA crossover system is profitable in trending markets and loses money in ranging markets. If you can detect which regime you're in, you can turn the system on and off accordingly.

### ADX — Average Directional Index

ADX measures the _strength_ of a trend, not its direction. It ranges from 0 to 100. Above 25 means a trend is present. Below 20 means the market is ranging. Crucially, ADX doesn't tell you if the trend is up or down — only that one exists.

> **ADX Interpretation**
> `ADX < 20 → Ranging market. No clear trend. Avoid trend-following signals. ADX 20–25 → Weak trend developing. Take signals cautiously. ADX 25–50 → Strong trend. Your system's sweet spot. Take all signals. ADX > 50 → Extremely strong trend. May be near exhaustion. Tighten stops.`

**Python · ADX calculation**

```python
def calc_adx(df, period=14):
    high, low, close = df["High"], df["Low"], df["Close"]

    # Directional movement
    up   = high.diff()
    down = -low.diff()
    dm_plus  = ((up > down) & (up > 0)) * up
    dm_minus = ((down > up) & (down > 0)) * down

    # ATR for normalization
    tr   = pd.concat([(high-low), (high-close.shift()).abs(),
                      (low-close.shift()).abs()], axis=1).max(axis=1)
    atr  = tr.ewm(alpha=1/period, adjust=False).mean()

    # Smoothed DI lines
    di_plus  = 100 * dm_plus.ewm(alpha=1/period, adjust=False).mean() / atr
    di_minus = 100 * dm_minus.ewm(alpha=1/period, adjust=False).mean() / atr

    dx  = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus)
    adx = dx.ewm(alpha=1/period, adjust=False).mean()
    return adx

# Add to your signal check:
df["ADX"] = calc_adx(df)
adx_value = float(df["ADX"].iloc[-1])
trending  = adx_value > 25

if not trending:
    print(f"⛔ ADX = {adx_value:.1f} — Ranging market. System OFF.")
else:
    print(f"✅ ADX = {adx_value:.1f} — Trending market. System ON.")
```

> **Expected Impact** Adding an ADX regime filter typically improves win rate by 8–15% by eliminating the whipsaw trades that occur in ranging markets. It reduces trade frequency by 20–30%, but the trades you do take are significantly higher quality. Backtest this on SPY going back to 2015 and see for yourself.

## 12 · Parameter Optimization

_How to scientifically find better parameters — and how to avoid the trap of making your strategy "perfect" on paper but broken in reality._

### What Parameters Can You Optimize?

- EMA periods (currently 9 and 21)
- RSI period (currently 14) and entry/exit thresholds (40–65, exit at 75)
- ATR period (14) and stop-loss multiplier (2.0×)
- ADX threshold (25) for regime filter
- Volume ratio requirement (1.2×)

### Grid Search — The Brute Force Approach

Test every combination of parameters over your historical data and record the results. Then pick the combination that maximizes your chosen metric (Sharpe ratio, not just returns).

**Python · Grid search over EMA parameters**

```python
import itertools

def run_backtest(df, ema_short, ema_long, rsi_lo, rsi_hi):
    """Returns Sharpe ratio for given parameters."""
    df = df.copy()
    df["EMA_S"] = df["Close"].ewm(span=ema_short, adjust=False).mean()
    df["EMA_L"] = df["Close"].ewm(span=ema_long,  adjust=False).mean()
    # ... RSI + signal + trade simulation ...
    # ... return sharpe_ratio ...
    pass

# Parameter grid
ema_shorts = [5, 8, 9, 12]
ema_longs  = [18, 21, 26, 30]
rsi_los    = [35, 40, 45]
rsi_his    = [60, 65, 70]

results = []
for es, el, rl, rh in itertools.product(ema_shorts, ema_longs, rsi_los, rsi_his):
    if es >= el: continue  # short must be less than long
    sharpe = run_backtest(df, es, el, rl, rh)
    results.append((sharpe, es, el, rl, rh))

results.sort(reverse=True)
print("Top 5 parameter sets:")
for r in results[:5]:
    print(f"Sharpe {r[0]:.2f} | EMA {r[1]}/{r[2]} | RSI {r[3]}-{r[4]}")
```

> **The Overfitting Trap** If you run a grid search with 100 parameter combinations, some will look great purely by chance — like flipping a coin 100 times and seeing a run of 10 heads. Always validate on out-of-sample data. If EMA(9,21) works well in-sample but EMA(9,22) is 30% better, be very suspicious of that improvement.

### Robustness Over Optimality

The best parameters aren't the ones with the highest backtest Sharpe. They're the ones that perform _consistently across a range of nearby values_. If EMA(9,21) works well and so do (8,20), (9,22), and (10,21) — that's a robust result. If only (9,21) works and everything nearby fails — that's overfitting.

## 13 · The Full Python Stack

_Every library, tool, and resource you need — organized by what it does and when you'll need it._

### The Complete Toolkit

| Library            | What It Does                                     | When You Need It                 |
| ------------------ | ------------------------------------------------ | -------------------------------- |
| `yfinance`         | Free stock/ETF price data from Yahoo Finance     | Day 1 — all your data            |
| `pandas`           | DataFrames, time series, rolling calculations    | Day 1 — everything               |
| `numpy`            | Fast numerical math                              | Day 1 — inside indicators        |
| `matplotlib`       | Plotting price charts, equity curves             | Week 1 — visualizing backtests   |
| `ta`               | 150+ pre-built technical indicators              | Week 2 — faster indicator coding |
| `backtrader`       | Full backtest framework with portfolio tracking  | Month 1 — proper backtesting     |
| `alpaca-trade-api` | Paper and live trading via Alpaca broker         | Month 1 — paper trading          |
| `scipy`            | Statistics: t-tests for signal significance      | Month 2 — validating edge        |
| `quantstats`       | Tearsheet reports: Sharpe, drawdown, all metrics | Month 2 — analyzing backtests    |
| `optuna`           | Smarter parameter optimization (Bayesian)        | Month 3+ — optimization          |

**Terminal · Install everything**

```bash
pip install yfinance pandas numpy matplotlib ta backtrader \
            alpaca-trade-api scipy quantstats optuna
```

### Your Learning Path — In Order

1. **Week 1–2:** Master `yfinance` + `pandas`. Be able to fetch data, calculate EMA/RSI/ATR manually, and plot them with `matplotlib`.
2. **Week 3–4:** Build a complete backtest loop from scratch (like Chapter 8's code). Understand every line. Run it on SPY from 2015.
3. **Month 2:** Upgrade to `backtrader` for proper portfolio-level backtesting. Add slippage and commission models. Use `quantstats` to generate tearsheet reports.
4. **Month 3:** Add filters one at a time (ADX, Volume, EMA200). Backtest before and after each filter to confirm improvement. Keep a log of what helped and what didn't.
5. **Month 4+:** Connect to Alpaca API. Paper trade your system automatically. Compare paper results to backtest — if they diverge significantly, find out why.

### Free Resources Worth Bookmarking

- **QuantConnect:** Free cloud-based backtesting platform. No local setup. Python-based. Large community of strategies to study.
- **Investopedia:** Best free reference for any indicator you don't understand. Every indicator has its own detailed article.
- **FRED (Fed Reserve):** Free macro economic data — interest rates, CPI, unemployment. Useful for regime/macro context.
- **TradingView:** Free charting platform. Use it to visually verify your Python signals match what you see on the chart.
- **"Quantitative Trading" — Chan:** The best beginner book on systematic trading. Practical, Python-compatible, no PhD required.
- **"Evidence-Based Technical Analysis" — Aronson:** Teaches you to evaluate TA claims rigorously. Changes how you think about what "works."

> **You Now Know** The math behind every indicator in your system, how markets are structured, how to size positions correctly, how to measure your edge, how to backtest without lying to yourself, and how to improve your system scientifically. This is the foundation that separates a serious systematic trader from someone who guesses. The next step is to build it, run it, and let the data show you what works.
