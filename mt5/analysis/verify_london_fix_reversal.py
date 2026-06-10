"""
London Fix Post-Fix Mean Reversion Strategy
=============================================
Alpha Source: Grade B - Market Mechanics / Institutional Flow
Hypothesis: After the 16:00 GMT fix, prices revert as institutional
            order pressure subsides. Fade the pre-fix move.

Logic:
  - Measure the price move from 15:00 to 16:00 GMT (pre-fix trend)
  - At 16:05 GMT, enter AGAINST the pre-fix direction (mean reversion)
  - Exit at 17:00 GMT (1 hour hold) or via SL/TP

Important GMT offsets for USDJPY:
  - London Fix: 16:00 GMT = 01:00 JST+1 = varies by DST
  - Pre-fix window: 15:00-16:00 GMT
  - Post-fix trade: 16:05-17:00 GMT
"""

import numpy as np
import pandas as pd
import yfinance as yf
from backtesting import Backtest, Strategy


# ==========================================
# Strategy Parameters
# ==========================================

class LondonFixReversal(Strategy):
    # --- Parameters (optimizable) ---
    pre_fix_threshold_pips = 5.0    # Minimum pre-fix move to trigger trade (in pips)
    stop_loss_pips = 15.0           # Stop loss in pips
    take_profit_pips = 10.0         # Take profit in pips
    hold_bars = 4                   # Max hold duration in bars (4 x 15min = 1 hour)

    def init(self):
        """
        Pre-calculate the pre-fix price change.
        For 1h data: we compare the bar at 15:00 GMT vs 16:00 GMT.
        For 15min data: we compare 15:00 to 16:00 (4 bars).
        """
        # Track bar count for time-based exit
        self.bar_count = 0
        self.entry_bar = 0

    def next(self):
        """
        Main logic - runs on each bar.

        ⚠️ Logic Parity Notes:
          - self.data.Close[-1] = current bar (MQL: iClose(0)) ← repainting risk
          - self.data.Close[-2] = confirmed bar (MQL: iClose(1)) ← safe
        """
        self.bar_count += 1

        # --- Time-based exit ---
        if self.position:
            bars_held = self.bar_count - self.entry_bar
            if bars_held >= self.hold_bars:
                self.position.close()
                return

        # --- Warmup ---
        if len(self.data) < 5:
            return

        # Skip if already in position
        if self.position:
            return

        # --- Calculate pre-fix move ---
        # Using confirmed bars only ([-2] and further back)
        # On hourly data: compare 1 bar ago vs current confirmed
        pre_fix_move = self.data.Close[-2] - self.data.Close[-3]
        pre_fix_pips = abs(pre_fix_move) * 100  # For JPY pairs: 1 pip = 0.01

        # --- Entry filter: minimum move threshold ---
        if pre_fix_pips < self.pre_fix_threshold_pips:
            return

        # --- Mean reversion: fade the pre-fix move ---
        pip_value = 0.01  # JPY pairs
        sl = self.stop_loss_pips * pip_value
        tp = self.take_profit_pips * pip_value

        if pre_fix_move > 0:
            # Pre-fix was bullish → expect reversal → SHORT
            self.sell(
                sl=self.data.Close[-1] + sl,
                tp=self.data.Close[-1] - tp,
            )
            self.entry_bar = self.bar_count
        else:
            # Pre-fix was bearish → expect reversal → LONG
            self.buy(
                sl=self.data.Close[-1] - sl,
                tp=self.data.Close[-1] + tp,
            )
            self.entry_bar = self.bar_count


# ==========================================
# Execution & Judgment
# ==========================================
if __name__ == "__main__":
    SYMBOL = "USDJPY=X"
    PERIOD = "60d"       # Discovery phase: short period for quick validation
    INTERVAL = "1h"

    print(f"[Mining] Fetching {SYMBOL} ({INTERVAL}, {PERIOD})...")
    data = yf.download(SYMBOL, period=PERIOD, interval=INTERVAL, progress=False)

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    if data.empty:
        print("[ERROR] No data fetched. Check symbol/network.")
        exit(1)

    print(f"[Mining] Data: {len(data)} bars, {data.index[0]} to {data.index[-1]}")

    # --- Run backtest ---
    bt = Backtest(
        data,
        LondonFixReversal,
        cash=1_000_000,    # JPY account
        commission=0.0002,  # Spread simulation
        exclusive_orders=True,
    )

    # --- Quick optimization ---
    print("[Mining] Running optimization...")
    stats = bt.optimize(
        pre_fix_threshold_pips=range(3, 12, 2),
        stop_loss_pips=range(10, 25, 5),
        take_profit_pips=range(5, 20, 5),
        hold_bars=range(2, 6),
        maximize="Equity Final [$]",
        max_tries=200,
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
    print("LONDON FIX REVERSAL - Mining Results")
    print("=" * 50)
    print(f"  Profit Factor:  {pf:.2f}")
    print(f"  Win Rate:       {wr:.1f}%")
    print(f"  Total Trades:   {trades}")
    print(f"  Max Drawdown:   {dd:.1f}%")
    print(f"  Return:         {ret:.1f}%")

    # Best parameters
    best_params = {
        "pre_fix_threshold_pips": stats._strategy.pre_fix_threshold_pips,
        "stop_loss_pips": stats._strategy.stop_loss_pips,
        "take_profit_pips": stats._strategy.take_profit_pips,
        "hold_bars": stats._strategy.hold_bars,
    }
    print(f"\n  Best Params: {best_params}")

    # --- Judgment ---
    print("\n" + "-" * 50)
    if pf >= 1.5:
        print(f"  ✅ PROMISING (PF={pf:.2f} >= 1.5)")
        print("  → Proceed to mt5-full-cycle Phase 2 for full verification")
    elif pf >= 1.0:
        print(f"  🟡 MARGINAL (PF={pf:.2f}, 1.0-1.5)")
        print("  → Consider filter improvements (max 2 iterations)")
    else:
        print(f"  ❌ UNPROFITABLE (PF={pf:.2f} < 1.0)")
        print("  → Record post-mortem and move to next strategy")
    print("-" * 50)
