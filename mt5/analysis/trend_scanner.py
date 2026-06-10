"""
Trend Scanner — XM Trading Full Universe
==========================================
XM で取り扱い可能な金融商品全体をスキャンし、
トレンドが発生している銘柄を検出する。
オプションで裁量エントリーシグナルも表示可能。

Usage:
  python mt5/analysis/trend_scanner.py
  python mt5/analysis/trend_scanner.py --category fx
  python mt5/analysis/trend_scanner.py --signals
"""

import argparse
import sys
from datetime import datetime

import numpy as np
import pandas as pd
import pytz
import MetaTrader5 as mt5

from mt5_utils import initialize_mt5, ensure_symbol_data_sync

# ==========================================
# XM Trading Universe → yfinance Mapping
# ==========================================
UNIVERSE = {
    # --- FX Majors ---
    "USDJPY": {"mt5": "USDJPY#", "cat": "fx", "name": "USD/JPY"},
    "EURUSD": {"mt5": "EURUSD#", "cat": "fx", "name": "EUR/USD"},
    "GBPUSD": {"mt5": "GBPUSD#", "cat": "fx", "name": "GBP/USD"},
    "AUDUSD": {"mt5": "AUDUSD#", "cat": "fx", "name": "AUD/USD"},
    "USDCHF": {"mt5": "USDCHF#", "cat": "fx", "name": "USD/CHF"},
    "USDCAD": {"mt5": "USDCAD#", "cat": "fx", "name": "USD/CAD"},
    "NZDUSD": {"mt5": "NZDUSD#", "cat": "fx", "name": "NZD/USD"},
    # --- FX Crosses ---
    "EURJPY": {"mt5": "EURJPY#", "cat": "fx", "name": "EUR/JPY"},
    "GBPJPY": {"mt5": "GBPJPY#", "cat": "fx", "name": "GBP/JPY"},
    "AUDJPY": {"mt5": "AUDJPY#", "cat": "fx", "name": "AUD/JPY"},
    "EURGBP": {"mt5": "EURGBP#", "cat": "fx", "name": "EUR/GBP"},
    "EURAUD": {"mt5": "EURAUD#", "cat": "fx", "name": "EUR/AUD"},
    "GBPAUD": {"mt5": "GBPAUD#", "cat": "fx", "name": "GBP/AUD"},
    "CADJPY": {"mt5": "CADJPY#", "cat": "fx", "name": "CAD/JPY"},
    "CHFJPY": {"mt5": "CHFJPY#", "cat": "fx", "name": "CHF/JPY"},
    "NZDJPY": {"mt5": "NZDJPY#", "cat": "fx", "name": "NZD/JPY"},
    # --- Stock Indices ---
    "US500":  {"mt5": "US500Cash#", "cat": "index", "name": "S&P 500"},
    "US30":   {"mt5": "US30Cash#",  "cat": "index", "name": "Dow Jones 30"},
    "US100":  {"mt5": "US100Cash#", "cat": "index", "name": "Nasdaq 100"},
    "JP225":  {"mt5": "JP225Cash#", "cat": "index", "name": "Nikkei 225"},
    "GER40":  {"mt5": "GER40Cash#", "cat": "index", "name": "DAX 40"},
    "UK100":  {"mt5": "UK100Cash#", "cat": "index", "name": "FTSE 100"},
    "EU50":   {"mt5": "EU50Cash#",  "cat": "index", "name": "Euro Stoxx 50"},
    "AUS200": {"mt5": "AUS200Cash#","cat": "index", "name": "ASX 200"},
    "HK50":   {"mt5": "HK50Cash#",  "cat": "index", "name": "Hang Seng 50"},
    # --- Commodities ---
    "GOLD":   {"mt5": "GOLD#",    "cat": "commodity", "name": "Gold"},
    "SILVER": {"mt5": "SILVER#",  "cat": "commodity", "name": "Silver"},
    "OIL":    {"mt5": "OILWs#",   "cat": "commodity", "name": "WTI Crude Oil"},
    "NGAS":   {"mt5": "NGASCash#", "cat": "commodity", "name": "Natural Gas"},
    "COPPER": {"mt5": "COPPER#",  "cat": "commodity", "name": "Copper"},
    "PLAT":   {"mt5": "PLAT#",    "cat": "commodity", "name": "Platinum"},
    "WHEAT":  {"mt5": "WHEAT#",   "cat": "commodity", "name": "Wheat"},
    "SOYBN":  {"mt5": "SOYBN#",   "cat": "commodity", "name": "Soybeans"},
    # --- Crypto ---
    "BTCUSD": {"mt5": "BTCUSD#", "cat": "crypto", "name": "Bitcoin"},
    "ETHUSD": {"mt5": "ETHUSD#", "cat": "crypto", "name": "Ethereum"},
    "SOLUSD": {"mt5": "SOLUSD#", "cat": "crypto", "name": "Solana"},
    "XRPUSD": {"mt5": "XRPUSD#", "cat": "crypto", "name": "XRP"},
    "DOGEUSD":{"mt5": "DOGEUSD#","cat": "crypto", "name": "Dogecoin"},
}

CATEGORY_EMOJI = {
    "fx": "💱",
    "index": "📊",
    "commodity": "🪙",
    "futures": "📈",
    "crypto": "₿",
}

# ==========================================
# Optimized Parameters
# ==========================================
PARAMS = {
    "adx_threshold": 20,
    "pullback_atr_min": 0.5,
    "pullback_atr_max": 2.5,
    "sl_atr_mult": 2.0,
    "trail_atr_mult": 4.0,
    "swing_lookback": 10,
}


# ==========================================
# Indicator Calculations
# ==========================================
def calc_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Calculate ATR using Wilder's smoothing."""
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    alpha = 1 / period
    return tr.ewm(alpha=alpha, adjust=False).mean()


def calc_adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> tuple:
    """
    Calculate ADX, +DI, -DI using Wilder's smoothing.
    """
    tr = pd.concat([
        high - low,
        abs(high - close.shift(1)),
        abs(low - close.shift(1))
    ], axis=1).max(axis=1)

    up_move = high - high.shift(1)
    down_move = low.shift(1) - low

    plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0.0), index=high.index)
    minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0.0), index=high.index)

    alpha = 1 / period
    atr = tr.ewm(alpha=alpha, adjust=False).mean()
    plus_dm_smooth = plus_dm.ewm(alpha=alpha, adjust=False).mean()
    minus_dm_smooth = minus_dm.ewm(alpha=alpha, adjust=False).mean()

    plus_di = 100 * plus_dm_smooth / atr
    minus_di = 100 * minus_dm_smooth / atr

    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
    adx = dx.ewm(alpha=alpha, adjust=False).mean()

    return adx, plus_di, minus_di


def calc_momentum(close: pd.Series, lookback: int = 10) -> float:
    """Calculate N-period percentage return."""
    if len(close) < lookback + 1:
        return 0.0
    return (close.iloc[-1] / close.iloc[-1 - lookback] - 1) * 100


# ==========================================
# Scanner
# ==========================================
def scan(category: str | None = None, min_adx: float = 20.0, count: int = 150, interval: str = "1d",
         enable_signals: bool = False) -> list:
    """
    Scan instruments and optionally generate signals using MT5 API.
    """
    if not initialize_mt5():
        return []

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

    targets = UNIVERSE
    if category:
        targets = {k: v for k, v in UNIVERSE.items() if v["cat"] == category}

    symbols = [v["mt5"] for v in targets.values()]
    print(f"[Scanner] Fetching {len(symbols)} instruments (MT5 {interval} / count={count})...")

    results = []
    
    # Set timezone for correct datetime conversion
    tz = pytz.timezone("EET")

    for xm_name, info in targets.items():
        mt5_sym = info["mt5"]
        try:
            # Check if symbol exists and is visible
            symbol_info = mt5.symbol_info(mt5_sym)
            if symbol_info is None:
                # Fallback to suffix versions if raw symbol is not found
                for suffix in ["#", "Cash#", "s", "Ws"]:
                    fallback_sym = f"{mt5_sym}{suffix}"
                    symbol_info = mt5.symbol_info(fallback_sym)
                    if symbol_info is not None:
                        mt5_sym = fallback_sym
                        break
            
            if symbol_info is None:
                print(f"  [SKIP] {xm_name}: Symbol {mt5_sym} not found in MT5.")
                continue
                
            if not ensure_symbol_data_sync(mt5_sym):
                print(f"  [SKIP] {xm_name}: Failed to select or sync symbol {mt5_sym}.")
                continue

            # Request rates
            rates = mt5.copy_rates_from_pos(mt5_sym, tf, 0, count)
            if rates is None or len(rates) < 50:
                print(f"  [SKIP] {xm_name}: Insufficient data ({len(rates) if rates is not None else 0} bars).")
                continue

            # Create DataFrame
            df = pd.DataFrame(rates)
            df['time'] = pd.to_datetime(df['time'], unit='s', utc=True)
            df.set_index('time', inplace=True)
            
            # Rename columns to match expected formatting
            df.rename(columns={"open": "Open", "high": "High", "low": "Low", "close": "Close", "tick_volume": "Volume"}, inplace=True)

            # Indicators
            adx_s, plus_di_s, minus_di_s = calc_adx(df["High"], df["Low"], df["Close"])
            atr_s = calc_atr(df["High"], df["Low"], df["Close"])
            
            # Current values
            adx_val = adx_s.iloc[-1]
            plus_di_val = plus_di_s.iloc[-1]
            minus_di_val = minus_di_s.iloc[-1]
            atr_val = atr_s.iloc[-1]
            price = df["Close"].iloc[-1]
            mom = calc_momentum(df["Close"], lookback=10)

            # Trend Check
            is_trend = adx_val >= min_adx
            if plus_di_val > minus_di_val:
                direction = "LONG"
                is_uptrend = True
            elif minus_di_val > plus_di_val:
                direction = "SHORT"
                is_uptrend = False
            else:
                direction = "FLAT"
                is_uptrend = None

            strength = min(int(adx_val / 10), 6)
            bar = "█" * strength + "░" * (6 - strength)

            res = {
                "Symbol": xm_name,
                "Name": info["name"],
                "Category": info["cat"],
                "ADX": round(adx_val, 1),
                "+DI": round(plus_di_val, 1),
                "-DI": round(minus_di_val, 1),
                "Direction": direction,
                "Mom%": round(mom, 2),
                "Strength": bar,
                "Trending": is_trend,
                "Price": price,
                "ATR": atr_val,
                "Signal": None, # setup details
                "Status": "RANGE" if not is_trend else "TREND",
            }

            # Optional: Signal Logic
            if enable_signals and is_trend:
                # Use previous bar for swing detection to avoid repainting
                # verify_atr_pullback used rolling max on High (uptrend) or min on Low (downtrend)
                lookback = PARAMS["swing_lookback"]
                
                # Calculate swings on confirmed bars (up to T-1)
                # But to know "current" distance we compare current price (T) to swing of T-1
                # Actually, verify_atr_pullback uses [-2] for swing and [-1] for price check. 
                # Let's align: swing is established over past N bars.
                
                highs = df["High"]
                lows = df["Low"]
                
                # Rolling max/min shifted by 1 to represent "past N bars excluding current" if we looked at [-1]
                # But here we want the "recent swing high" including current developing bar? 
                # No, "Swing High" is usually a completed point. 
                # For simplicity and scan-time check: rolling max of last 10 bars (inclusive).
                swing_h_val = highs.rolling(lookback).max().iloc[-1]
                swing_l_val = lows.rolling(lookback).min().iloc[-1]
                
                pb_min = PARAMS["pullback_atr_min"]
                pb_max = PARAMS["pullback_atr_max"]
                
                dist_atr = 0.0
                
                if is_uptrend:
                    pullback = swing_h_val - price
                    dist_atr = pullback / atr_val
                    
                    entry_zone_top = swing_h_val - (atr_val * pb_min)
                    entry_zone_bot = swing_h_val - (atr_val * pb_max)
                    sl_price = price - (atr_val * PARAMS["sl_atr_mult"])
                    trail_dist = atr_val * PARAMS["trail_atr_mult"]
                    
                    if pb_min <= dist_atr <= pb_max:
                        res["Status"] = "SETUP"
                        res["Signal"] = {
                            "Type": "LONG Pullback",
                            "DistATR": round(dist_atr, 1),
                            "Zone": f"{entry_zone_bot:.2f} - {entry_zone_top:.2f}",
                            "SL": f"{sl_price:.2f}",
                            "Trail": f"{trail_dist:.2f} (from High)",
                        }
                    elif dist_atr < pb_min:
                        res["Status"] = "WATCH" # approaching
                        res["Signal"] = {"DistATR": round(dist_atr, 1), "Type": "Waiting for dip"}
                    else:
                        res["Status"] = "DEEP" # too deep
                
                else: # SHORT
                    pullback = price - swing_l_val
                    dist_atr = pullback / atr_val
                    
                    entry_zone_top = swing_l_val + (atr_val * pb_max)
                    entry_zone_bot = swing_l_val + (atr_val * pb_min)
                    sl_price = price + (atr_val * PARAMS["sl_atr_mult"])
                    trail_dist = atr_val * PARAMS["trail_atr_mult"]

                    if pb_min <= dist_atr <= pb_max:
                        res["Status"] = "SETUP"
                        res["Signal"] = {
                            "Type": "SHORT Pullback",
                            "DistATR": round(dist_atr, 1),
                            "Zone": f"{entry_zone_bot:.2f} - {entry_zone_top:.2f}",
                            "SL": f"{sl_price:.2f}",
                            "Trail": f"{trail_dist:.2f} (from Low)",
                        }
                    elif dist_atr < pb_min:
                        res["Status"] = "WATCH"
                        res["Signal"] = {"DistATR": round(dist_atr, 1), "Type": "Waiting for rally"}
                    else:
                        res["Status"] = "DEEP"

            results.append(res)
        except Exception as e:
            print(f"  [SKIP] {xm_name}: {e}")

    mt5.shutdown()

    return sorted(results, key=lambda x: x["ADX"], reverse=True)


# ==========================================
# Display
# ==========================================
def display_results(results: list, args: argparse.Namespace) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # Split results
    setups = [r for r in results if r["Status"] == "SETUP"]
    watches = [r for r in results if r["Status"] == "WATCH"]
    trends  = [r for r in results if r["Status"] in ["TREND", "DEEP"]]
    ranges  = [r for r in results if r["Status"] == "RANGE"]
    
    print(f"\n{'='*70}")
    print(f"  TREND SCANNER {'& SIGNALS ' if args.signals else ''}— {now}")
    print(f"  ADX Th: {args.min_adx} | Scanned: {len(results)}")
    print(f"{'='*70}\n")

    if args.signals:
        # --- SETUP (Actionable) ---
        if setups:
            print(f"  🚀 SETUP ({len(setups)}) — Actionable Pullbacks")
            print(f"  {'─'*66}")
            for r in setups:
                sig = r["Signal"]
                print(f"  [{r['Symbol']}] {r['Name']} ({r['Category']})")
                print(f"    {r['Direction']} {sig['Type']} (Dist: {sig['DistATR']} ATR)")
                print(f"    Price: {r['Price']} | ADX: {r['ADX']}")
                print(f"    Entry Zone: {sig['Zone']}")
                print(f"    SL: {sig['SL']} | Trail: {sig['Trail']}")
                print(f"  {'─'*66}")
        else:
            print(f"  🚀 SETUP (0) — No actionable setups right now.")

        # --- WATCH (Approaching) ---
        if watches:
            print(f"\n  👀 WATCH ({len(watches)}) — Approaching Zone (< 0.5 ATR)")
            for r in watches:
                 print(f"    {r['Symbol']:<10} {r['Direction']:<5} {r['ADX']:>4.1f} ADX | {r['Signal']['DistATR']} ATR away")

        # --- TREND (Others) ---
        if trends:
            print(f"\n  📈 TREND ({len(trends)}) — Trending but no signal")
            for r in trends:
                note = "Deep pullback" if r["Status"] == "DEEP" else "Trending"
                print(f"    {r['Symbol']:<10} {r['Direction']:<5} {r['ADX']:>4.1f} ADX | {note}")

        # --- RANGE ---
        print(f"\n  💤 RANGE ({len(ranges)}) — Low ADX")
        
    else:
        # Classic Table View
        for cat in ["fx", "index", "commodity", "futures", "crypto"]:
            cat_res = [r for r in results if r["Category"] == cat]
            if not cat_res: continue
            
            emoji = CATEGORY_EMOJI.get(cat, "")
            print(f"\n  {emoji} {cat.upper()} ({len(cat_res)})")
            print(f"  {'─'*66}")
            print(f"  {'Symbol':<10} {'Name':<18} {'ADX':>5} {'Dir':<8} {'Strength':<8} {'Mom%':>6} {'Status'}")
            print(f"  {'─'*66}")
            for r in cat_res:
                status_icon = "✅ TREND" if r["Trending"] else "❌ RANGE"
                print(f"  {r['Symbol']:<10} {r['Name']:<18} {r['ADX']:>5.1f} {r['Direction']:<8} {r['Strength']:<8} {r['Mom%']:>+6.2f} {status_icon}")

        print(f"\n{'='*70}")
        print(f"  Summary: {len(setups)+len(watches)+len(trends)} TRENDING / {len(ranges)} RANGING")
        print(f"{'='*70}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="XM Trading Trend Scanner")
    parser.add_argument("--category", "-c", choices=["fx", "index", "commodity", "futures", "crypto"],
                        help="Filter by category")
    parser.add_argument("--min-adx", "-a", type=float, default=20.0,
                        help="ADX threshold (default: 20)")
    parser.add_argument("--count", "-p", type=int, default=150,
                        help="Number of bars to fetch (default: 150)")
    parser.add_argument("--interval", "-i", default="1d",
                        help="Data interval (1m, 5m, 1h, 1d, etc.) (default: 1d)")
    parser.add_argument("--signals", "-s", action="store_true",
                        help="Show actionable trading signals")

    args = parser.parse_args()

    data = scan(
        category=args.category,
        min_adx=args.min_adx,
        count=args.count,
        interval=args.interval,
        enable_signals=args.signals
    )
    
    if not data:
        print("[ERROR] No data.")
        sys.exit(1)
        
    display_results(data, args)
