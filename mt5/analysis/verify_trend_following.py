"""
Time-Series Momentum (Trend Following) Strategy
=================================================
Alpha Source: Grade B - Academic (Moskowitz, Ooi, Pedersen 2012)
Hypothesis: Assets that have been trending up continue upward,
            and vice versa. Behavioral biases (anchoring, herding)
            and slow information diffusion create structural momentum.

Logic:
  - Calculate N-period return (lookback)
  - If return > 0 → LONG (trend is up)
  - If return < 0 → SHORT (trend is down)
  - Volatility-targeted position sizing (ATR-based SL)
  - Hold until trend reverses or trailing stop hit

Key Design Decisions:
  - Lookback: 20-60 bars (1h data ≈ 1-3 trading days)
  - ATR for volatility normalization (CTA best practice)
  - Trailing stop instead of fixed TP (let winners run)
"""

import numpy as np
import pandas as pd
import yfinance as yf
from backtesting import Backtest, Strategy


class TrendFollowMomentum(Strategy):
    # --- Parameters (optimizable) ---
    lookback = 20           # Momentum lookback period (bars)
    atr_period = 14         # ATR period for volatility
    atr_sl_mult = 2.0       # Stop loss = ATR * this multiplier
    atr_tp_mult = 3.0       # Take profit = ATR * this multiplier (asymmetric R:R)
    trend_filter = 50       # SMA period for regime filter (0 = disabled)

    def init(self):
        """Initialize indicators."""
        close = pd.Series(self.data.Close)
        high = pd.Series(self.data.High)
        low = pd.Series(self.data.Low)

        # Momentum: N-period return
        self.momentum = self.I(
            lambda c: pd.Series(c).pct_change(self.lookback),
            self.data.Close,
            name=f"Mom({self.lookback})"
        )

        # ATR for volatility-based stops
        tr = np.maximum(
            high - low,
            np.maximum(
                abs(high - close.shift(1)),
                abs(low - close.shift(1))
            )
        )
        self.atr = self.I(
            lambda: tr.rolling(self.atr_period).mean(),
            name=f"ATR({self.atr_period})"
        )

        # Trend regime filter (SMA)
        if self.trend_filter > 0:
            self.sma = self.I(
                lambda c: pd.Series(c).rolling(self.trend_filter).mean(),
                self.data.Close,
                name=f"SMA({self.trend_filter})"
            )

    def next(self):
        """
        Main logic.

        ⚠️ Logic Parity Notes:
          - self.data.Close[-1] = current bar (MQL: iClose(0))
          - self.data.Close[-2] = confirmed bar (MQL: iClose(1)) ← safe
          - self.momentum[-2]  = confirmed momentum
        """
        # --- Warmup ---
        if len(self.data) < max(self.lookback, self.atr_period, self.trend_filter) + 5:
            return

        # --- Skip if in position ---
        if self.position:
            return

        # --- Confirmed values only ---
        mom = self.momentum[-2]
        atr = self.atr[-2]

        if pd.isna(mom) or pd.isna(atr) or atr <= 0:
            return

        # --- Calculate SL/TP based on ATR ---
        sl_distance = atr * self.atr_sl_mult
        tp_distance = atr * self.atr_tp_mult

        price = self.data.Close[-1]

        # --- Trend regime filter ---
        if self.trend_filter > 0:
            sma_val = self.sma[-2]
            if pd.isna(sma_val):
                return

            # Only long if price > SMA, only short if price < SMA
            if mom > 0 and price < sma_val:
                return  # Momentum up but below SMA → skip
            if mom < 0 and price > sma_val:
                return  # Momentum down but above SMA → skip

        # --- Entry ---
        if mom > 0:
            # Positive momentum → LONG
            self.buy(
                sl=price - sl_distance,
                tp=price + tp_distance,
            )
        elif mom < 0:
            # Negative momentum → SHORT
            self.sell(
                sl=price + sl_distance,
                tp=price - tp_distance,
            )


# ==========================================
# Execution & Judgment
# ==========================================
if __name__ == "__main__":
    SYMBOL = "USDJPY=X"
    PERIOD = "60d"
    INTERVAL = "1h"

    print(f"[Mining] Fetching {SYMBOL} ({INTERVAL}, {PERIOD})...")
    data = yf.download(SYMBOL, period=PERIOD, interval=INTERVAL, progress=False)

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    if data.empty:
        print("[ERROR] No data fetched.")
        exit(1)

    print(f"[Mining] Data: {len(data)} bars, {data.index[0]} to {data.index[-1]}")

    bt = Backtest(
        data,
        TrendFollowMomentum,
        cash=1_000_000,
        commission=0.0002,
        exclusive_orders=True,
    )

    print("[Mining] Running optimization...")
    stats = bt.optimize(
        lookback=[10, 20, 40, 60],
        atr_period=[10, 14, 20],
        atr_sl_mult=[1.5, 2.0, 2.5],
        atr_tp_mult=[2.0, 3.0, 4.0],
        trend_filter=[0, 30, 50],
        maximize="Equity Final [$]",
        max_tries=300,
    )

    # --- Results ---
    pf = stats.get("Profit Factor", 0)
    if pf is None or (isinstance(pf, float) and np.isnan(pf)):
        pf = 0.0

    wr = stats.get("Win Rate [%]", 0)
    if wr is None or (isinstance(wr, float) and np.isnan(wr)):
        wr = 0.0

    trades = stats.get("# Trades", 0)
    dd = stats.get("Max. Drawdown [%]", 0)
    ret = stats.get("Return [%]", 0)

    print("\n" + "=" * 50)
    print("TREND FOLLOWING MOMENTUM - Mining Results")
    print("=" * 50)
    print(f"  Profit Factor:  {pf:.2f}")
    print(f"  Win Rate:       {wr:.1f}%")
    print(f"  Total Trades:   {trades}")
    print(f"  Max Drawdown:   {dd:.1f}%")
    print(f"  Return:         {ret:.1f}%")

    best_params = {
        "lookback": stats._strategy.lookback,
        "atr_period": stats._strategy.atr_period,
        "atr_sl_mult": stats._strategy.atr_sl_mult,
        "atr_tp_mult": stats._strategy.atr_tp_mult,
        "trend_filter": stats._strategy.trend_filter,
    }
    print(f"\n  Best Params: {best_params}")

    print("\n" + "-" * 50)
    if pf >= 1.5:
        print(f"  ✅ PROMISING (PF={pf:.2f} >= 1.5)")
        print("  → Proceed to mt5-full-cycle Phase 2")
    elif pf >= 1.0:
        print(f"  🟡 MARGINAL (PF={pf:.2f}, 1.0-1.5)")
        print("  → Consider filter improvements (max 2 iterations)")
    else:
        print(f"  ❌ UNPROFITABLE (PF={pf:.2f} < 1.0)")
        print("  → Record post-mortem")
    print("-" * 50)
