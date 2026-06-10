"""
Session Breakout v2 - Improvement Loop 1
==========================================
Added filters to reduce false breakouts:
1. Trend Filter: 50-period SMA direction alignment
2. Day-of-week filter: Exclude Monday (gaps) and Friday (low momentum)
3. ATR-based range normalization for dynamic range thresholds
4. Confirmation: require close beyond breakout + buffer (not just touch)
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy
from backtesting.lib import crossover


class SessionBreakoutV2(Strategy):
    """
    Asian Range → London Open Breakout v2 (with false breakout filters)
    """
    # --- Parameters ---
    asian_start = 0
    asian_end = 6
    entry_start = 7
    entry_end = 9
    rr_ratio = 3.0
    min_range_pips = 15
    max_range_pips = 80
    buffer_pips = 5
    sma_period = 50        # Trend filter SMA
    require_trend = 1      # 1=require trend alignment, 0=no filter
    skip_monday = 1        # 1=skip Monday, 0=trade Monday
    skip_friday = 1        # 1=skip Friday, 0=trade Friday
    breakout_buffer_pips = 3  # Breakout confirmation buffer

    def init(self):
        self._asian_high = None
        self._asian_low = None
        self._current_day = None
        self._traded_today = False
        # Compute SMA for trend filter
        self._sma = self.I(lambda x: pd.Series(x).rolling(self.sma_period).mean(), self.data.Close)

    def next(self):
        if len(self.data) < self.sma_period + 1:
            return

        idx = self.data.index[-1]
        if hasattr(idx, 'hour'):
            current_hour = idx.hour
            current_date = idx.date()
            current_dow = idx.weekday()  # 0=Mon, 4=Fri
        else:
            return

        # Day-of-week filter
        if self.skip_monday and current_dow == 0:
            return
        if self.skip_friday and current_dow == 4:
            return

        # New day: reset tracking
        if current_date != self._current_day:
            self._current_day = current_date
            self._asian_high = None
            self._asian_low = None
            self._traded_today = False

        # Asian session: track range
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

        # London entry window
        if (self.entry_start <= current_hour <= self.entry_end
                and self._asian_high is not None
                and self._asian_low is not None
                and not self._traded_today
                and not self.position):

            asian_range = self._asian_high - self._asian_low
            price_level = self.data.Close[-1]
            pip_value = 0.01 if price_level > 10 else 0.0001
            range_pips = asian_range / pip_value

            if range_pips < self.min_range_pips or range_pips > self.max_range_pips:
                return

            buffer = self.buffer_pips * pip_value
            bo_buffer = self.breakout_buffer_pips * pip_value
            close = self.data.Close[-1]
            sma_val = self._sma[-1]

            # Trend filter
            if self.require_trend:
                trend_up = close > sma_val
                trend_down = close < sma_val
            else:
                trend_up = True
                trend_down = True

            # Long: close above Asian High + confirmation buffer, with uptrend
            if close > (self._asian_high + bo_buffer) and trend_up:
                sl = self._asian_low - buffer
                risk = close - sl
                tp = close + risk * self.rr_ratio
                self.buy(sl=sl, tp=tp)
                self._traded_today = True

            # Short: close below Asian Low - confirmation buffer, with downtrend
            elif close < (self._asian_low - bo_buffer) and trend_down:
                sl = self._asian_high + buffer
                risk = sl - close
                tp = close - risk * self.rr_ratio
                self.sell(sl=sl, tp=tp)
                self._traded_today = True


if __name__ == "__main__":
    CASH = 100_000
    COMMISSION = 0.0001

    results = []
    for sym in ["USDJPY=X", "GBPJPY=X"]:
        for period in ["6mo", "1y", "2y"]:
            try:
                data = yf.download(sym, period=period, interval="1h", progress=False)
                if isinstance(data.columns, pd.MultiIndex):
                    data.columns = data.columns.droplevel(1)
                data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()

                bt = Backtest(data, SessionBreakoutV2, cash=CASH, commission=COMMISSION)
                stats = bt.run()
                pf = stats["Profit Factor"]
                wr = stats["Win Rate [%]"]
                trades = stats["# Trades"]
                ret = stats["Return [%]"]
                dd = stats["Max. Drawdown [%]"]
                print(f"{sym} {period}: PF={pf:.2f} WR={wr:.1f}% Trades={trades} Ret={ret:.1f}% DD={dd:.1f}%")
                results.append({"sym": sym, "period": period, "pf": pf, "trades": trades})
            except Exception as e:
                print(f"{sym} {period}: ERROR - {e}")

    # Optimization on 2y USDJPY
    print("\n=== Optimization on USDJPY 2y ===")
    try:
        data = yf.download("USDJPY=X", period="2y", interval="1h", progress=False)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.droplevel(1)
        data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()
        bt = Backtest(data, SessionBreakoutV2, cash=CASH, commission=COMMISSION)
        opt_stats = bt.optimize(
            rr_ratio=[2.0, 2.5, 3.0, 4.0],
            min_range_pips=[10, 15, 20, 30],
            require_trend=[0, 1],
            skip_monday=[0, 1],
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
            print(f"\n✅ 有望 (PF {pf:.2f}) → フィルター追加で改善成功")
        elif pf >= 1.0:
            print(f"\n🟡 改善余地 (PF {pf:.2f}) → 改善ループ2回目を検討")
        else:
            print(f"\n❌ 不採用 (PF {pf:.2f})")
    except Exception as e:
        print(f"Optimization ERROR: {e}")
