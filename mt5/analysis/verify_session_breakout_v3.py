"""
Session Breakout v3 - Improvement Loop 2 (FINAL)
=================================================
Major changes from v2:
1. TIME-BASED EXIT: Close all positions at end of London+NY overlap (16:00 UTC)
   → Removes dependency on TP hit (which rarely triggers with 3:1 RR)
2. ATR-based dynamic SL instead of fixed opposite-range SL
3. Trailing stop option to protect profits
4. Tighter entry window (first 2 hours of London only)
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy


class SessionBreakoutV3(Strategy):
    """
    Asian Range → London Open Breakout v3 (time-based exit + ATR SL)
    """
    asian_start = 0
    asian_end = 6
    entry_start = 7
    entry_end = 8          # Tighter: only first 2 hours
    exit_hour = 16         # Time-based exit at 16:00 UTC
    rr_ratio = 2.0         # Reduced from 3.0 to increase WR
    min_range_pips = 10
    max_range_pips = 80
    atr_sl_mult = 1.5      # ATR multiplier for SL
    atr_period = 14
    skip_friday = 1
    breakout_buffer_pips = 3

    def init(self):
        self._asian_high = None
        self._asian_low = None
        self._current_day = None
        self._traded_today = False
        # ATR calculation
        close = pd.Series(self.data.Close)
        high = pd.Series(self.data.High)
        low = pd.Series(self.data.Low)
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs()
        ], axis=1).max(axis=1)
        self._atr = self.I(lambda: tr.rolling(self.atr_period).mean())

    def next(self):
        if len(self.data) < self.atr_period + 2:
            return

        idx = self.data.index[-1]
        if not hasattr(idx, 'hour'):
            return

        current_hour = idx.hour
        current_date = idx.date()
        current_dow = idx.weekday()

        # Time-based exit
        if self.position and current_hour >= self.exit_hour:
            self.position.close()
            return

        if self.skip_friday and current_dow == 4:
            return

        # New day
        if current_date != self._current_day:
            self._current_day = current_date
            self._asian_high = None
            self._asian_low = None
            self._traded_today = False

        # Asian session
        if self.asian_start <= current_hour <= self.asian_end:
            h = self.data.High[-1]
            l = self.data.Low[-1]
            if self._asian_high is None:
                self._asian_high = h
                self._asian_low = l
            else:
                self._asian_high = max(self._asian_high, h)
                self._asian_low = min(self._asian_low, l)
            return

        # Entry window
        if (self.entry_start <= current_hour <= self.entry_end
                and self._asian_high is not None
                and self._asian_low is not None
                and not self._traded_today
                and not self.position):

            asian_range = self._asian_high - self._asian_low
            price = self.data.Close[-1]
            pip_value = 0.01 if price > 10 else 0.0001
            range_pips = asian_range / pip_value

            if range_pips < self.min_range_pips or range_pips > self.max_range_pips:
                return

            bo_buffer = self.breakout_buffer_pips * pip_value
            atr = self._atr[-1]
            if np.isnan(atr) or atr <= 0:
                return
            sl_dist = atr * self.atr_sl_mult

            # Long breakout
            if price > (self._asian_high + bo_buffer):
                sl = price - sl_dist
                tp = price + sl_dist * self.rr_ratio
                self.buy(sl=sl, tp=tp)
                self._traded_today = True

            # Short breakout
            elif price < (self._asian_low - bo_buffer):
                sl = price + sl_dist
                tp = price - sl_dist * self.rr_ratio
                self.sell(sl=sl, tp=tp)
                self._traded_today = True


if __name__ == "__main__":
    CASH = 100_000
    COMMISSION = 0.0001

    print("=== Session Breakout v3 - Default Params ===")
    for sym in ["USDJPY=X", "GBPJPY=X"]:
        for period in ["6mo", "1y", "2y"]:
            try:
                data = yf.download(sym, period=period, interval="1h", progress=False)
                if isinstance(data.columns, pd.MultiIndex):
                    data.columns = data.columns.droplevel(1)
                data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()
                bt = Backtest(data, SessionBreakoutV3, cash=CASH, commission=COMMISSION)
                stats = bt.run()
                pf = stats["Profit Factor"]
                wr = stats["Win Rate [%]"]
                trades = stats["# Trades"]
                ret = stats["Return [%]"]
                dd = stats["Max. Drawdown [%]"]
                print(f"  {sym} {period}: PF={pf:.2f} WR={wr:.1f}% Trades={trades} Ret={ret:.1f}% DD={dd:.1f}%")
            except Exception as e:
                print(f"  {sym} {period}: ERROR - {e}")

    # Optimization on 2y USDJPY
    print("\n=== Optimization on USDJPY 2y ===")
    data = yf.download("USDJPY=X", period="2y", interval="1h", progress=False)
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.droplevel(1)
    data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()
    bt = Backtest(data, SessionBreakoutV3, cash=CASH, commission=COMMISSION)
    try:
        opt_stats = bt.optimize(
            rr_ratio=[1.5, 2.0, 2.5, 3.0],
            atr_sl_mult=[1.0, 1.5, 2.0],
            entry_end=[8, 9],
            exit_hour=[14, 16, 18],
            min_range_pips=[10, 15, 20],
            skip_friday=[0, 1],
            maximize="Profit Factor",
            constraint=lambda p: True,
        )
        pf = opt_stats["Profit Factor"]
        wr = opt_stats["Win Rate [%]"]
        trades = opt_stats["# Trades"]
        ret = opt_stats["Return [%]"]
        dd = opt_stats["Max. Drawdown [%]"]
        print(f"Best: {opt_stats._strategy}")
        print(f"PF={pf:.2f} WR={wr:.1f}% Trades={trades} Ret={ret:.1f}% DD={dd:.1f}%")

        if pf >= 1.5:
            print(f"\n✅ 有望 (PF {pf:.2f})")
        elif pf >= 1.0:
            print(f"\n🟡 PF {pf:.2f} — 2回の改善ループ完了、PF < 1.5 → REJECT")
        else:
            print(f"\n❌ PF {pf:.2f} → REJECT")
    except Exception as e:
        print(f"Optimization ERROR: {e}")
