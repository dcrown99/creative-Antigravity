"""
Session Breakout Strategy Verification
=======================================
Asian Range → London Open Breakout

Alpha Source: Grade B - Market Mechanics
  - Institutional order flow concentration at London open
  - Gao et al. (2018) "Market Intraday Momentum" evidence
  - UK accounts for ~38% of global FX turnover → structural

Rules (extracted from research):
  - Asian Range: Track High/Low from 00:00-06:59 UTC
  - Entry Window: 07:00-09:59 UTC (London open zone)
  - Entry Signal: Price breaks above Asian High (Buy) or below Asian Low (Sell)
  - SL: Opposite side of Asian range + buffer
  - TP: Risk * RR_ratio
  - Max 1 trade per day

Dependencies: pip install backtesting yfinance pandas numpy
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy


class SessionBreakout(Strategy):
    """
    Asian Range → London Open Breakout Strategy

    Structural edge: Institutional flow at London session open creates
    momentum breakout from low-volatility Asian consolidation range.
    """
    # --- Parameters ---
    asian_start = 0       # Asian session start hour (UTC)
    asian_end = 6         # Asian session end hour (UTC), inclusive
    entry_start = 7       # London entry window start (UTC)
    entry_end = 9         # London entry window end (UTC), inclusive
    rr_ratio = 3.0        # Risk:Reward ratio (1:N)
    min_range_pips = 15   # Minimum Asian range to filter out tiny ranges
    max_range_pips = 80   # Maximum Asian range to filter out extreme ranges
    buffer_pips = 5       # Buffer above/below breakout level for SL
    atr_period = 20       # ATR period for volatility filter

    def init(self):
        # Track daily state
        self._asian_high = None
        self._asian_low = None
        self._current_day = None
        self._traded_today = False

    def next(self):
        # Need enough data
        if len(self.data) < self.atr_period + 1:
            return

        # Get current bar's datetime
        idx = self.data.index[-1]
        if hasattr(idx, 'hour'):
            current_hour = idx.hour
            current_date = idx.date()
        else:
            return

        # --- New day: reset tracking ---
        if current_date != self._current_day:
            self._current_day = current_date
            self._asian_high = None
            self._asian_low = None
            self._traded_today = False

        # --- Asian session: track range ---
        if self.asian_start <= current_hour <= self.asian_end:
            bar_high = self.data.High[-1]
            bar_low = self.data.Low[-1]
            if self._asian_high is None:
                self._asian_high = bar_high
                self._asian_low = bar_low
            else:
                if bar_high > self._asian_high:
                    self._asian_high = bar_high
                if bar_low < self._asian_low:
                    self._asian_low = bar_low
            return

        # --- London entry window ---
        if (self.entry_start <= current_hour <= self.entry_end
                and self._asian_high is not None
                and self._asian_low is not None
                and not self._traded_today
                and not self.position):

            asian_range = self._asian_high - self._asian_low

            # Convert to approximate pips (USDJPY ~ /100, others ~ /0.0001)
            price_level = self.data.Close[-1]
            if price_level > 10:
                pip_value = 0.01  # JPY pairs
            else:
                pip_value = 0.0001  # EUR/GBP etc.

            range_pips = asian_range / pip_value

            # Range filter: avoid too narrow or too wide ranges
            if range_pips < self.min_range_pips or range_pips > self.max_range_pips:
                return

            buffer = self.buffer_pips * pip_value
            close = self.data.Close[-1]

            # --- Breakout detection ---
            # Long: close above Asian High
            if close > self._asian_high:
                sl = self._asian_low - buffer
                risk = close - sl
                tp = close + risk * self.rr_ratio
                self.buy(sl=sl, tp=tp)
                self._traded_today = True

            # Short: close below Asian Low
            elif close < self._asian_low:
                sl = self._asian_high + buffer
                risk = sl - close
                tp = close - risk * self.rr_ratio
                self.sell(sl=sl, tp=tp)
                self._traded_today = True


# ==========================================
# Execution & Judgment
# ==========================================
if __name__ == "__main__":
    # --- Configuration ---
    SYMBOL = "USDJPY=X"
    PERIOD = "60d"
    INTERVAL = "1h"
    CASH = 100_000
    COMMISSION = 0.0001  # 1 pip spread approximation

    print(f"[Mining] Fetching {SYMBOL} ({INTERVAL}, {PERIOD})...")
    data = yf.download(SYMBOL, period=PERIOD, interval=INTERVAL, progress=False)

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.droplevel(1)
    data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()

    print(f"[Mining] Data: {len(data)} bars, {data.index[0]} to {data.index[-1]}")

    # --- Single run with default params first ---
    bt = Backtest(data, SessionBreakout, cash=CASH, commission=COMMISSION)
    stats = bt.run()

    pf = stats["Profit Factor"]
    wr = stats["Win Rate [%]"]
    trades = stats["# Trades"]
    dd = stats["Max. Drawdown [%]"]
    ret = stats["Return [%]"]

    print(f"\n=== Default Params Results ===")
    print(f"PF: {pf:.2f} | WR: {wr:.1f}% | Trades: {trades} | DD: {dd:.1f}% | Return: {ret:.1f}%")

    # --- Optimization ---
    print(f"\n[Mining] Optimizing...")
    try:
        opt_stats, heatmap = bt.optimize(
            rr_ratio=[2.0, 2.5, 3.0, 4.0],
            min_range_pips=[10, 15, 20, 25],
            max_range_pips=[60, 80, 100],
            maximize="Profit Factor",
            return_heatmap=True,
        )

        opt_pf = opt_stats["Profit Factor"]
        opt_wr = opt_stats["Win Rate [%]"]
        opt_trades = opt_stats["# Trades"]
        opt_dd = opt_stats["Max. Drawdown [%]"]
        opt_ret = opt_stats["Return [%]"]

        print(f"\n=== Optimized Results ===")
        print(f"Best Params: {opt_stats._strategy}")
        print(f"PF: {opt_pf:.2f} | WR: {opt_wr:.1f}% | Trades: {opt_trades} | DD: {opt_dd:.1f}% | Return: {opt_ret:.1f}%")

        final_pf = opt_pf
    except Exception as e:
        print(f"[Mining] Optimization failed: {e}")
        print("[Mining] Using default params results.")
        final_pf = pf

    # --- Judgment Gate ---
    print(f"\n{'='*40}")
    if final_pf >= 1.5:
        print(f"✅ 有望 (PF {final_pf:.2f}) → mt5-full-cycle Phase 2 で本格検証を推奨")
    elif final_pf >= 1.0:
        print(f"🟡 改善余地 (PF {final_pf:.2f}) → フィルター追加で改善可能か検討 (最大2回)")
    else:
        print(f"❌ 不採用 (PF {final_pf:.2f}) → strategy_post_mortem.txt に記録して終了")

    # --- Also test on GBPJPY for cross-validation ---
    print(f"\n{'='*40}")
    print(f"[Mining] Cross-validation on GBPJPY=X...")
    try:
        data2 = yf.download("GBPJPY=X", period=PERIOD, interval=INTERVAL, progress=False)
        if isinstance(data2.columns, pd.MultiIndex):
            data2.columns = data2.columns.droplevel(1)
        data2 = data2[["Open", "High", "Low", "Close", "Volume"]].dropna()

        bt2 = Backtest(data2, SessionBreakout, cash=CASH, commission=COMMISSION)
        stats2 = bt2.run()
        print(f"GBPJPY: PF={stats2['Profit Factor']:.2f} | WR={stats2['Win Rate [%]']:.1f}% | Trades={stats2['# Trades']} | Return={stats2['Return [%]']:.1f}%")
    except Exception as e:
        print(f"GBPJPY cross-validation failed: {e}")

    # --- Also test on EURUSD for cross-validation ---
    print(f"\n[Mining] Cross-validation on EURUSD=X...")
    try:
        data3 = yf.download("EURUSD=X", period=PERIOD, interval=INTERVAL, progress=False)
        if isinstance(data3.columns, pd.MultiIndex):
            data3.columns = data3.columns.droplevel(1)
        data3 = data3[["Open", "High", "Low", "Close", "Volume"]].dropna()

        bt3 = Backtest(data3, SessionBreakout, cash=CASH, commission=COMMISSION)
        stats3 = bt3.run()
        print(f"EURUSD: PF={stats3['Profit Factor']:.2f} | WR={stats3['Win Rate [%]']:.1f}% | Trades={stats3['# Trades']} | Return={stats3['Return [%]']:.1f}%")
    except Exception as e:
        print(f"EURUSD cross-validation failed: {e}")
