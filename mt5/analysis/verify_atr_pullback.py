"""
ATR Pullback Trend Following — Full Universe Backtest
======================================================
CTA-style approach: Run the same strategy across ALL instruments
and evaluate portfolio-level performance.

Alpha Source: Grade B - Time-Series Momentum (Moskowitz et al. 2012)
Entry: ATR-normalized pullback within confirmed ADX trend
Exit: Trailing stop (let winners run)
"""

import sys
from datetime import datetime

import numpy as np
import pandas as pd
import pytz
import MetaTrader5 as mt5
from backtesting import Backtest, Strategy

# Import universe from shared scanner
sys.path.insert(0, "mt5/analysis")
from trend_scanner import UNIVERSE
from mt5_utils import initialize_mt5, ensure_symbol_data_sync


class ATRPullbackTrend(Strategy):
    # --- Parameters ---
    adx_period = 14
    adx_threshold = 25          # Minimum ADX for trend
    atr_period = 14
    pullback_atr_min = 0.5      # Widened from 1.0 → more entries
    pullback_atr_max = 2.5      # Widened from 2.0 → more entries
    swing_lookback = 10         # Bars to find recent swing high/low
    sl_atr_mult = 2.0           # Stop loss in ATR multiples
    trail_atr_mult = 2.5        # Trailing stop in ATR multiples

    def init(self):
        close = pd.Series(self.data.Close)
        high = pd.Series(self.data.High)
        low = pd.Series(self.data.Low)

        # ATR
        tr = np.maximum(
            high - low,
            np.maximum(abs(high - close.shift(1)), abs(low - close.shift(1)))
        )
        self.atr = self.I(lambda: tr.rolling(self.atr_period).mean(), name="ATR")

        # ADX, +DI, -DI
        alpha = 1 / self.adx_period
        up_move = high - high.shift(1)
        down_move = low.shift(1) - low
        plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0.0), index=high.index)
        minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0.0), index=high.index)
        atr_smooth = tr.ewm(alpha=alpha, adjust=False).mean()
        plus_dm_s = plus_dm.ewm(alpha=alpha, adjust=False).mean()
        minus_dm_s = minus_dm.ewm(alpha=alpha, adjust=False).mean()

        self.plus_di = self.I(lambda: 100 * plus_dm_s / atr_smooth, name="+DI")
        self.minus_di = self.I(lambda: 100 * minus_dm_s / atr_smooth, name="-DI")
        dx = 100 * abs(plus_dm_s / atr_smooth - minus_dm_s / atr_smooth) / \
             (plus_dm_s / atr_smooth + minus_dm_s / atr_smooth + 1e-10)
        self.adx = self.I(lambda: dx.ewm(alpha=alpha, adjust=False).mean(), name="ADX")

        # Swing High/Low
        self.swing_high = self.I(lambda h: pd.Series(h).rolling(self.swing_lookback).max(), self.data.High, name="SwH")
        self.swing_low = self.I(lambda l: pd.Series(l).rolling(self.swing_lookback).min(), self.data.Low, name="SwL")

        self._trail_price = 0.0
        self._is_long = False

    def next(self):
        warmup = max(self.adx_period, self.atr_period, self.swing_lookback) + 5
        if len(self.data) < warmup:
            return

        # Trailing stop management
        if self.position:
            atr = self.atr[-2]
            if pd.isna(atr) or atr <= 0:
                return
            trail_dist = atr * self.trail_atr_mult
            if self._is_long:
                new_trail = self.data.Close[-1] - trail_dist
                if new_trail > self._trail_price:
                    self._trail_price = new_trail
                if self.data.Close[-1] <= self._trail_price:
                    self.position.close()
            else:
                new_trail = self.data.Close[-1] + trail_dist
                if self._trail_price == 0 or new_trail < self._trail_price:
                    self._trail_price = new_trail
                if self.data.Close[-1] >= self._trail_price:
                    self.position.close()
            return

        # Entry logic
        adx_val = self.adx[-2]
        plus_di = self.plus_di[-2]
        minus_di = self.minus_di[-2]
        atr = self.atr[-2]
        swing_h = self.swing_high[-2]
        swing_l = self.swing_low[-2]
        price = self.data.Close[-1]

        if any(pd.isna(v) for v in [adx_val, plus_di, minus_di, atr, swing_h, swing_l]):
            return
        if atr <= 0 or adx_val < self.adx_threshold:
            return

        is_uptrend = plus_di > minus_di

        if is_uptrend:
            pullback_atr = (swing_h - price) / atr
            if self.pullback_atr_min <= pullback_atr <= self.pullback_atr_max:
                self.buy(sl=price - atr * self.sl_atr_mult)
                self._trail_price = price - atr * self.trail_atr_mult
                self._is_long = True
        else:
            pullback_atr = (price - swing_l) / atr
            if self.pullback_atr_min <= pullback_atr <= self.pullback_atr_max:
                self.sell(sl=price + atr * self.sl_atr_mult)
                self._trail_price = price + atr * self.trail_atr_mult
                self._is_long = False


def run_single(name: str, info: dict, count: int = 1500, interval: str = "1d") -> dict | None:
    try:
        mt5_sym = info["mt5"]
        mt5_timeframes = {
            "1m": mt5.TIMEFRAME_M1,
            "5m": mt5.TIMEFRAME_M5,
            "15m": mt5.TIMEFRAME_M15,
            "30m": mt5.TIMEFRAME_M30,
            "1h": mt5.TIMEFRAME_H1,
            "4h": mt5.TIMEFRAME_H4,
            "1d": mt5.TIMEFRAME_D1,
            "1w": mt5.TIMEFRAME_W1,
            "1mo": mt5.TIMEFRAME_MN1
        }
        tf = mt5_timeframes.get(interval, mt5.TIMEFRAME_D1)

        symbol_info = mt5.symbol_info(mt5_sym)
        if symbol_info is None:
            # Fallback for suffix
            for suffix in ["#", "Cash#", "s", "Ws"]:
                fallback_sym = f"{mt5_sym}{suffix}"
                symbol_info = mt5.symbol_info(fallback_sym)
                if symbol_info is not None:
                    mt5_sym = fallback_sym
                    break
                    
        if not ensure_symbol_data_sync(mt5_sym):
            print(f"  [SKIP] {name}: Symbol {mt5_sym} not found or failed to sync.")
            return None

        # Fetch data
        rates = mt5.copy_rates_from_pos(mt5_sym, tf, 0, count)
        if rates is None or len(rates) < 60:
            return None

        # Convert to DataFrame
        data = pd.DataFrame(rates)
        data['time'] = pd.to_datetime(data['time'], unit='s', utc=True)
        data.set_index('time', inplace=True)
        data.rename(columns={"open": "Open", "high": "High", "low": "Low", "close": "Close", "tick_volume": "Volume"}, inplace=True)
        
        if data.empty or len(data) < 60:
            return None

        bt = Backtest(data, ATRPullbackTrend, cash=100_000, commission=0.0003,
                      exclusive_orders=True)
        stats = bt.run()

        pf = stats.get("Profit Factor", 0)
        if pf is None or (isinstance(pf, float) and np.isnan(pf)):
            pf = 0.0
        wr = stats.get("Win Rate [%]", 0)
        if wr is None or (isinstance(wr, float) and np.isnan(wr)):
            wr = 0.0

        return {
            "Symbol": name, "Category": info["cat"],
            "PF": round(pf, 2), "WR%": round(wr, 1),
            "Trades": stats.get("# Trades", 0),
            "DD%": round(stats.get("Max. Drawdown [%]", 0), 1),
            "Return%": round(stats.get("Return [%]", 0), 1),
        }
    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return None


def main():
    if not initialize_mt5():
        print("[ERROR] MetaTrader5 connection logic failed. Exiting.")
        sys.exit(1)

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"\n{'='*70}")
    print(f"  ATR PULLBACK TREND FOLLOWING — Full Universe ({len(UNIVERSE)} instruments)")
    print(f"  {now} | Count: 500 (approx 2y daily) | Interval: 1d")
    print(f"{'='*70}")

    results = []
    for i, (name, info) in enumerate(UNIVERSE.items()):
        sys.stdout.write(f"\r  Backtesting... {i+1}/{len(UNIVERSE)} ({name})     ")
        sys.stdout.flush()
        result = run_single(name, info, count=500, interval="1d")
        if result:
            results.append(result)

    print(f"\r  Backtesting... done.{' '*30}")
    mt5.shutdown()

    if not results:
        print("[ERROR] No results.")
        sys.exit(1)

    df = pd.DataFrame(results)
    passing = df[df["PF"] >= 1.3]
    profitable = df[df["PF"] >= 1.0]

    # Sort by PF descending
    df = df.sort_values("PF", ascending=False)

    # Per-category summary
    print(f"\n  {'='*66}")
    print(f"  {'Symbol':<10} {'Cat':<10} {'PF':>6} {'WR%':>6} {'Trades':>7} {'DD%':>7} {'Ret%':>7}")
    print(f"  {'-'*66}")

    for cat in ["fx", "index", "commodity", "futures", "crypto"]:
        cat_df = df[df["Category"] == cat]
        if cat_df.empty:
            continue
        cat_pass = len(cat_df[cat_df["PF"] >= 1.3])
        print(f"  --- {cat.upper()} ({cat_pass}/{len(cat_df)} passing) ---")
        for _, row in cat_df.iterrows():
            marker = "✅" if row["PF"] >= 1.3 else "🟡" if row["PF"] >= 1.0 else "❌"
            print(f"  {row['Symbol']:<10} {row['Category']:<10} {row['PF']:>6.2f} "
                  f"{row['WR%']:>5.1f}% {row['Trades']:>6} {row['DD%']:>6.1f}% "
                  f"{row['Return%']:>6.1f}% {marker}")

    # Portfolio summary
    total_trades = df["Trades"].sum()
    avg_pf = df[df["PF"] > 0]["PF"].mean() if len(df[df["PF"] > 0]) > 0 else 0

    print(f"\n  {'='*66}")
    print(f"  PORTFOLIO SUMMARY")
    print(f"  {'='*66}")
    print(f"  Instruments tested:  {len(df)}")
    print(f"  PF >= 1.3 (pass):    {len(passing)} ({len(passing)/len(df)*100:.0f}%)")
    print(f"  PF >= 1.0 (profit):  {len(profitable)} ({len(profitable)/len(df)*100:.0f}%)")
    print(f"  Total trades:        {total_trades}")
    print(f"  Avg PF (profitable): {avg_pf:.2f}")
    print(f"  {'='*66}")

    if len(passing) >= 5:
        print("  ✅ PHASE 1 PASS — 5+ instruments with PF >= 1.3")
        print("  → Proceed to Phase 2: MQL5 EA implementation")
    elif len(profitable) >= len(df) * 0.5:
        print("  🟡 MARGINAL — Majority profitable but few strong performers")
        print("  → Consider parameter tuning (iteration 1/2)")
    else:
        print("  ❌ PHASE 1 FAIL")
        print("  → Strategy revision needed")
    print(f"  {'='*66}")


if __name__ == "__main__":
    main()
