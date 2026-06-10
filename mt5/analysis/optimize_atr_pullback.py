"""
ATR Pullback — Fast Parameter Optimization
============================================
Optimizes only the 2 most impactful parameters:
  - trail_atr_mult (exit timing)
  - adx_threshold (trend filter strictness)

Other params are fixed at Phase 1 defaults.
Search space: 6 × 4 = 24 per instrument × 11 = 264 total (< 3 min)
"""

import sys
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import yfinance as yf
from backtesting import Backtest

sys.path.insert(0, "mt5/analysis")
from verify_atr_pullback import ATRPullbackTrend

warnings.filterwarnings("ignore")

PASSING = {
    "EURJPY": {"yf": "EURJPY=X", "cat": "FX"},
    "USDCHF": {"yf": "USDCHF=X", "cat": "FX"},
    "NZDJPY": {"yf": "NZDJPY=X", "cat": "FX"},
    "US100":  {"yf": "^IXIC",    "cat": "Index"},
    "JP225":  {"yf": "^N225",    "cat": "Index"},
    "AUS200": {"yf": "^AXJO",    "cat": "Index"},
    "UK100":  {"yf": "^FTSE",    "cat": "Index"},
    "GOLD":   {"yf": "GC=F",     "cat": "Commodity"},
    "SILVER": {"yf": "SI=F",     "cat": "Commodity"},
    "BTCUSD": {"yf": "BTC-USD",  "cat": "Crypto"},
    "ETHUSD": {"yf": "ETH-USD",  "cat": "Crypto"},
}


def optimize_single(name: str, info: dict) -> dict | None:
    try:
        data = yf.download(info["yf"], period="1y", interval="1d", progress=False)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        if data.empty or len(data) < 60:
            return None

        bt = Backtest(data, ATRPullbackTrend, cash=100_000, commission=0.0003,
                      exclusive_orders=True)

        # Only optimize 2 key params (6 × 4 = 24 combos)
        stats = bt.optimize(
            trail_atr_mult=[1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
            adx_threshold=[20, 25, 30, 35],
            maximize="Equity Final [$]",
        )

        pf = stats.get("Profit Factor", 0)
        if pf is None or (isinstance(pf, float) and np.isnan(pf)):
            pf = 0.0

        return {
            "Symbol": name, "Cat": info["cat"],
            "Trail": stats._strategy.trail_atr_mult,
            "ADX_Th": stats._strategy.adx_threshold,
            "PF": round(pf, 2),
            "WR%": round(stats.get("Win Rate [%]", 0) or 0, 1),
            "Trades": stats.get("# Trades", 0),
            "DD%": round(stats.get("Max. Drawdown [%]", 0), 1),
            "Return%": round(stats.get("Return [%]", 0), 1),
        }
    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return None


def main():
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"\n{'='*70}")
    print(f"  ATR PULLBACK — Fast Optimization (11 instruments, 24 combos each)")
    print(f"  {now}")
    print(f"{'='*70}")

    results = []
    for i, (name, info) in enumerate(PASSING.items()):
        sys.stdout.write(f"\r  Optimizing... {i+1}/{len(PASSING)} ({name})          ")
        sys.stdout.flush()
        result = optimize_single(name, info)
        if result:
            results.append(result)

    print(f"\r  Optimizing... done.{' '*40}\n")

    if not results:
        print("[ERROR] No results.")
        sys.exit(1)

    df = pd.DataFrame(results)

    # Per-instrument
    print(f"  {'Symbol':<8} {'Cat':<10} {'PF':>5} {'WR%':>5} {'Tr':>4} {'DD%':>6} {'Ret%':>6} | {'Trail':>5} {'ADX':>4}")
    print(f"  {'-'*62}")
    for _, r in df.iterrows():
        marker = "✅" if r["PF"] >= 1.3 else "❌"
        print(f"  {r['Symbol']:<8} {r['Cat']:<10} {r['PF']:>5.2f} {r['WR%']:>4.1f}% {r['Trades']:>4} "
              f"{r['DD%']:>5.1f}% {r['Return%']:>5.1f}% | {r['Trail']:>5.1f} {r['ADX_Th']:>4} {marker}")

    # Consensus
    trail_mode = df["Trail"].mode().iloc[0]
    adx_mode = int(df["ADX_Th"].mode().iloc[0])
    trail_dist = df["Trail"].value_counts().to_dict()
    adx_dist = df["ADX_Th"].value_counts().to_dict()

    passing = df[df["PF"] >= 1.3]

    print(f"\n  {'='*70}")
    print(f"  CONSENSUS ({len(passing)}/{len(df)} passing with PF >= 1.3)")
    print(f"  {'='*70}")
    print(f"  trail_atr_mult = {trail_mode}  (votes: {trail_dist})")
    print(f"  adx_threshold  = {adx_mode}  (votes: {adx_dist})")
    print(f"\n  RECOMMENDED EA PARAMETERS:")
    print(f"  +--------------------------------+")
    print(f"  | adx_period        = 14         |")
    print(f"  | adx_threshold     = {adx_mode:<10} |")
    print(f"  | atr_period        = 14         |")
    print(f"  | pullback_atr_min  = 0.5        |")
    print(f"  | pullback_atr_max  = 2.5        |")
    print(f"  | sl_atr_mult       = 2.0        |")
    print(f"  | trail_atr_mult    = {trail_mode:<10} |")
    print(f"  | swing_lookback    = 10         |")
    print(f"  +--------------------------------+")
    print(f"  {'='*70}")


if __name__ == "__main__":
    main()
