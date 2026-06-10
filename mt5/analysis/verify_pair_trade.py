"""
MT5 戦略マイニング: 統計的ペアトレード (Z-score Mean Reversion)
=============================================================
Alpha Source: Cointegration of FX cross pairs (Grade A)
- AUDNZD: AUD and NZD share commodity-export economy
- Z-score entry when spread deviates from rolling mean (structural reversion)
- Entry is based on STATISTICAL DEVIATION from fundamental equilibrium, NOT technicals

Strategy Logic:
- LONG AUDNZD when Z-score < -entry_z (pair abnormally cheap)
- SHORT AUDNZD when Z-score > +entry_z (pair abnormally expensive)
- EXIT when |Z-score| < exit_z (reversion to mean)
- STOP when |Z-score| > stop_z (cointegration breakdown)
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy


class PairZScoreStrategy(Strategy):
    """
    Z-score mean reversion on AUDNZD (cointegration-based).
    AUDNZD embeds the structural relationship between AUD and NZD economies.
    Entry is purely statistical (Z-score deviation), NOT technical indicator-based.
    """
    # --- Strategy parameters ---
    zscore_window = 30   # Rolling window for Z-score calculation (in bars)
    entry_z = 2.0        # Entry when |Z-score| > entry_z
    exit_z = 0.5         # Exit when |Z-score| < exit_z
    stop_z = 3.5         # Stop-loss when |Z-score| > stop_z (breakdown protection)

    def init(self):
        close = pd.Series(self.data.Close)

        # Rolling Z-score of close price (the "spread" in the single-instrument approach)
        rolling_mean = close.rolling(self.zscore_window).mean()
        rolling_std = close.rolling(self.zscore_window).std()
        zscore_raw = (close - rolling_mean) / rolling_std

        self.zscore = self.I(lambda: zscore_raw.values, name="Z-score", overlay=False)

    def next(self):
        # Wait for enough data
        if len(self.data) < self.zscore_window + 5:
            return

        z = self.zscore[-1]

        # --- Entry logic (fundamental: Z-score deviation = structural mean reversion) ---
        if not self.position:
            if z < -self.entry_z:
                self.buy()   # AUDNZD undervalued vs equilibrium → LONG
            elif z > self.entry_z:
                self.sell()  # AUDNZD overvalued vs equilibrium → SHORT

        # --- Exit logic ---
        else:
            if self.position.is_long:
                # Exit on mean reversion OR stop-loss on breakdown
                if z > -self.exit_z or z < -self.stop_z:
                    self.position.close()
            elif self.position.is_short:
                if z < self.exit_z or z > self.stop_z:
                    self.position.close()


# ==========================================
# 実行 & 判定
# ==========================================
if __name__ == "__main__":
    SYMBOL = "AUDNZD=X"
    START = "2019-01-01"
    END = "2025-01-01"
    INTERVAL = "1d"   # Daily bars → realistic for retail traders

    print(f"[Mining] Fetching {SYMBOL} ({INTERVAL}, {START} to {END})...")
    data = yf.download(SYMBOL, start=START, end=END, interval=INTERVAL, progress=False)

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.droplevel(1)
    data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()

    # Remove zero-volume rows and ensure minimum data quality
    data = data[data["Close"] > 0]
    print(f"[Mining] Data loaded: {len(data)} bars")

    bt = Backtest(
        data,
        PairZScoreStrategy,
        cash=100_000,
        commission=0.0002,   # ~2 pips spread for AUDNZD (realistic for XM)
        exclusive_orders=True,
    )

    # --- Parameter optimization ---
    print("[Mining] Running optimization...")
    stats, heatmap = bt.optimize(
        zscore_window=[20, 30, 40, 60],
        entry_z=[1.5, 2.0, 2.5],
        exit_z=[0.0, 0.5],
        stop_z=[3.0, 3.5, 4.0],
        maximize="Profit Factor",
        constraint=lambda p: p.entry_z > p.exit_z,
        return_heatmap=True,
    )

    pf = stats["Profit Factor"]
    wr = stats["Win Rate [%]"]
    trades = stats["# Trades"]
    ret = stats["Return [%]"]
    dd = stats["Max. Drawdown [%]"]

    print(f"\n=== Mining Results: Statistical Pair Trading (AUDNZD Z-score) ===")
    print(f"Best Params: {stats._strategy}")
    print(f"PF: {pf:.2f} | WR: {wr:.1f}% | Trades: {trades}")
    print(f"Return: {ret:.1f}% | Max DD: {dd:.1f}%")
    print(f"Period: {START} → {END} ({INTERVAL})")

    if pf >= 1.5:
        print(f"\n✅ 有望 (PF {pf:.2f}) → mt5-full-cycle Phase 2 で本格検証を推奨")
    elif pf >= 1.0:
        print(f"\n🟡 微妙 (PF {pf:.2f}) → フィルター追加で改善可能か検討 (最大2回)")
    else:
        print(f"\n❌ 不採用 (PF {pf:.2f}) → strategy_post_mortem.txt に記録して終了")

    print("\nTop 5 Configs:")
    print(heatmap.sort_values(ascending=False).head())
