"""
NakaneMaster PF Improvement Ideas - Quantitative Verification
=============================================================
Tests 5 hypotheses against USDJPY M1 data (2023-2025):

1. Entry/Exit Time Optimization (1-min grid around 09:55 / 10:25)
2. Volatility Filter (skip low-ATR days)
3. Month-End as Gotobi Day
4. Day-of-Week PF Breakdown (Monday validation)
5. Conditional Long Revival (prev-day bearish candle filter)
"""
import pandas as pd
import numpy as np
from datetime import timedelta
import warnings
warnings.filterwarnings('ignore')

DATA_FILE = 'data/USDJPY_M1.csv'
SPREAD_PIPS = 1.0  # 1 pip spread cost

# ─────────────────────────────────────────────
# Data Loading (DST-aware JST conversion)
# ─────────────────────────────────────────────
def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    
    years = df['Datetime'].dt.year.unique()
    df['Offset'] = 7  # Winter: GMT+2 -> JST = +7

    for y in years:
        # US DST: 2nd Sunday March -> 1st Sunday November
        # March
        mar1 = pd.Timestamp(year=y, month=3, day=1)
        days_to_sun = (6 - mar1.dayofweek) % 7
        sun1 = mar1 + pd.Timedelta(days=days_to_sun)
        sun2 = sun1 + pd.Timedelta(days=7)
        dst_start = sun2 + pd.Timedelta(hours=2)
        
        # November
        nov1 = pd.Timestamp(year=y, month=11, day=1)
        days_to_sun_nov = (6 - nov1.dayofweek) % 7
        sun1_nov = nov1 + pd.Timedelta(days=days_to_sun_nov)
        dst_end = sun1_nov + pd.Timedelta(hours=2)
        
        # Summer: GMT+3 -> JST = +6
        mask = (df['Datetime'] >= dst_start) & (df['Datetime'] < dst_end)
        df.loc[mask, 'Offset'] = 6

    df['JST'] = df['Datetime'] + pd.to_timedelta(df['Offset'], unit='h')
    df = df.set_index('JST')
    df = df[['Open', 'High', 'Low', 'Close']]
    df = df[~df.index.duplicated(keep='first')]
    df = df.sort_index()
    return df


# ─────────────────────────────────────────────
# Gotobi Check (with weekend Friday adjustment)
# ─────────────────────────────────────────────
def get_gotobi_type(date):
    """Returns the Gotobi date (5,10,15,20,25,30) or 0."""
    d = date.day
    wd = date.weekday()  # 0=Mon, 4=Fri
    
    if d % 5 == 0 and wd < 5:
        return d
    if wd == 4:  # Friday
        sat = date + timedelta(days=1)
        sun = date + timedelta(days=2)
        if sat.day % 5 == 0:
            return sat.day
        if sun.day % 5 == 0:
            return sun.day
    return 0


def is_month_end(date):
    """Check if date is the last business day of the month."""
    next_day = date + timedelta(days=1)
    # If next business day is in a different month
    check = date
    for i in range(1, 4):
        nxt = date + timedelta(days=i)
        if nxt.weekday() < 5:  # Next weekday
            return nxt.month != date.month
    return False


# ─────────────────────────────────────────────
# Core Trade Simulation
# ─────────────────────────────────────────────
def simulate_trades(df, entry_time='09:55', exit_time='10:25', 
                    gotobi_days=None, include_monday=True, 
                    exclude_days=None, include_month_end=False,
                    min_atr=None, direction='short',
                    long_filter_fn=None):
    """
    Simulate trades and return per-trade results.
    
    Args:
        gotobi_days: list of day numbers to include (e.g., [5,15,20,30])
        include_monday: whether to include all Mondays
        exclude_days: list of day numbers to hard-block
        include_month_end: treat month-end as tradeable
        min_atr: minimum ATR (in pips) to filter
        direction: 'short' or 'long'
        long_filter_fn: callable(date, df) -> bool for conditional long
    """
    if gotobi_days is None:
        gotobi_days = [5, 15, 20, 30]
    if exclude_days is None:
        exclude_days = [10, 25]
    
    # Resample to ensure complete M1 index
    df_r = df.resample('1min').ffill()
    
    # Parse times
    e_h, e_m = map(int, entry_time.split(':'))
    x_h, x_m = map(int, exit_time.split(':'))
    
    entries = df_r.between_time(entry_time, entry_time).copy()
    exits = df_r.between_time(exit_time, exit_time).copy()
    
    # Pre-compute daily ATR if needed
    daily_atr = None
    if min_atr is not None:
        daily = df_r.resample('D').agg({'High': 'max', 'Low': 'min', 'Close': 'last'})
        daily['ATR'] = (daily['High'] - daily['Low']) * 100  # in pips
        daily['ATR_MA'] = daily['ATR'].rolling(5).mean()
        daily_atr = daily['ATR_MA']
    
    # Pre-compute daily candles for long filter
    daily_candles = None
    if long_filter_fn is not None:
        daily_candles = df_r.resample('D').agg({
            'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last'
        }).dropna()
    
    results = []
    
    for date in entries.index.normalize().unique():
        try:
            entry_rows = entries.loc[entries.index.normalize() == date]
            exit_rows = exits.loc[exits.index.normalize() == date]
            
            if entry_rows.empty or exit_rows.empty:
                continue
            
            dt = date.to_pydatetime()
            wd = dt.weekday()
            
            # Skip weekends
            if wd >= 5:
                continue
            
            # Check if valid trading day
            gotobi = get_gotobi_type(dt)
            is_valid = False
            day_category = 'none'
            
            # Hard block
            if gotobi > 0 and gotobi in exclude_days:
                continue
            
            # Gotobi check
            if gotobi > 0 and gotobi in gotobi_days:
                is_valid = True
                day_category = f'gotobi_{gotobi}'
            
            # Monday check
            if include_monday and wd == 0:
                is_valid = True
                day_category = 'monday' if day_category == 'none' else day_category
            
            # Month-end check
            if include_month_end and is_month_end(dt):
                if not is_valid:
                    is_valid = True
                    day_category = 'month_end'
            
            if not is_valid:
                continue
            
            # ATR filter
            if min_atr is not None and daily_atr is not None:
                prev_date = date - pd.Timedelta(days=1)
                # Find closest previous date with ATR
                atr_val = daily_atr.asof(prev_date)
                if pd.isna(atr_val) or atr_val < min_atr:
                    continue
            
            # Long filter
            if direction == 'long' and long_filter_fn is not None:
                if daily_candles is not None:
                    prev_date = date - pd.Timedelta(days=1)
                    prev_candle = daily_candles.asof(prev_date)
                    if pd.isna(prev_candle['Close']):
                        continue
                    if not long_filter_fn(prev_candle):
                        continue
            
            entry_price = entry_rows.iloc[0]['Open']
            exit_price = exit_rows.iloc[0]['Open']
            
            if direction == 'short':
                pips = (entry_price - exit_price) * 100 - SPREAD_PIPS
            else:
                pips = (exit_price - entry_price) * 100 - SPREAD_PIPS
            
            results.append({
                'Date': date,
                'Weekday': wd,
                'DayType': gotobi if gotobi > 0 else 0,
                'Category': day_category,
                'Entry': entry_price,
                'Exit': exit_price,
                'Pips': pips
            })
        except Exception:
            continue
    
    return pd.DataFrame(results) if results else pd.DataFrame()


def calc_pf(df_trades):
    """Calculate Profit Factor from trades DataFrame."""
    if df_trades.empty:
        return 0, 0, 0, 0
    wins = df_trades[df_trades['Pips'] > 0]['Pips'].sum()
    losses = abs(df_trades[df_trades['Pips'] < 0]['Pips'].sum())
    pf = wins / losses if losses > 0 else 999.0
    wr = (df_trades['Pips'] > 0).sum() / len(df_trades) * 100
    return pf, wr, df_trades['Pips'].sum(), len(df_trades)


def print_stats(label, trades_df):
    """Pretty print trade statistics."""
    pf, wr, total, n = calc_pf(trades_df)
    print(f"  {label:40s} | PF={pf:5.2f} | WR={wr:5.1f}% | Pips={total:7.1f} | N={n:4d}")
    return {'Label': label, 'PF': pf, 'WinRate': wr, 'TotalPips': total, 'Trades': n}


# ─────────────────────────────────────────────
# MAIN ANALYSIS
# ─────────────────────────────────────────────
if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    print(f"Data range: {df.index.min()} - {df.index.max()}")
    print(f"Total bars: {len(df):,}")
    
    all_results = []
    
    # ═══════════════════════════════════════════
    # BASELINE: Current EA Configuration
    # ═══════════════════════════════════════════
    print("\n" + "="*80)
    print("BASELINE: Current EA (Short Only, 09:55->10:25, Gotobi=[5,15,20,30], Mon=ON)")
    print("="*80)
    baseline = simulate_trades(df, '09:55', '10:25', 
                               gotobi_days=[5,15,20,30], include_monday=True,
                               exclude_days=[10,25])
    r = print_stats("Current EA", baseline)
    all_results.append(r)
    
    # ═══════════════════════════════════════════
    # IDEA 1: Entry/Exit Time Optimization
    # ═══════════════════════════════════════════
    print("\n" + "="*80)
    print("IDEA 1: Entry/Exit Time Optimization (1-min grid)")
    print("="*80)
    
    best_pf = 0
    best_combo = ""
    
    for entry_m in range(50, 60):
        for exit_m in range(20, 35):
            trades = simulate_trades(df, f'09:{entry_m:02d}', f'10:{exit_m:02d}',
                                     gotobi_days=[5,15,20,30], include_monday=True,
                                     exclude_days=[10,25])
            pf, wr, total, n = calc_pf(trades)
            if pf > best_pf and n >= 30:
                best_pf = pf
                best_combo = f"09:{entry_m:02d}->10:{exit_m:02d}"
    
    print(f"  Best: {best_combo} (PF={best_pf:.2f})")
    
    # Test key candidates
    for entry, exit_ in [('09:53', '10:25'), ('09:54', '10:25'), ('09:55', '10:25'),
                          ('09:56', '10:25'), ('09:57', '10:25'),
                          ('09:55', '10:20'), ('09:55', '10:30'),
                          ('09:54', '10:24'), ('09:56', '10:26')]:
        trades = simulate_trades(df, entry, exit_,
                                 gotobi_days=[5,15,20,30], include_monday=True,
                                 exclude_days=[10,25])
        r = print_stats(f"Short {entry}->{exit_}", trades)
        all_results.append(r)
    
    # ═══════════════════════════════════════════
    # IDEA 2: Volatility Filter (ATR)
    # ═══════════════════════════════════════════
    print("\n" + "="*80)
    print("IDEA 2: Volatility Filter (skip low ATR-5 days)")
    print("="*80)
    
    for atr_thresh in [30, 50, 70, 90, 100, 120]:
        trades = simulate_trades(df, '09:55', '10:25',
                                 gotobi_days=[5,15,20,30], include_monday=True,
                                 exclude_days=[10,25], min_atr=atr_thresh)
        r = print_stats(f"ATR >= {atr_thresh} pips", trades)
        all_results.append(r)

    # ═══════════════════════════════════════════
    # IDEA 3: Month-End as Gotobi
    # ═══════════════════════════════════════════
    print("\n" + "="*80)
    print("IDEA 3: Month-End Days as Additional Gotobi")
    print("="*80)
    
    # Month-end only
    trades_me_only = simulate_trades(df, '09:55', '10:25',
                                     gotobi_days=[], include_monday=False,
                                     exclude_days=[], include_month_end=True)
    r = print_stats("Month-End ONLY (Short)", trades_me_only)
    all_results.append(r)
    
    # Current + Month-end
    trades_with_me = simulate_trades(df, '09:55', '10:25',
                                     gotobi_days=[5,15,20,30], include_monday=True,
                                     exclude_days=[10,25], include_month_end=True)
    r = print_stats("Current + Month-End", trades_with_me)
    all_results.append(r)
    
    # ═══════════════════════════════════════════
    # IDEA 4: Day-of-Week PF Breakdown
    # ═══════════════════════════════════════════
    print("\n" + "="*80)
    print("IDEA 4: Day-of-Week Analysis")
    print("="*80)
    
    wd_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    
    if not baseline.empty:
        for wd in range(5):
            wd_trades = baseline[baseline['Weekday'] == wd]
            r = print_stats(f"Weekday: {wd_names[wd]}", wd_trades)
            all_results.append(r)
    
    # Test without Monday
    no_monday = simulate_trades(df, '09:55', '10:25',
                                gotobi_days=[5,15,20,30], include_monday=False,
                                exclude_days=[10,25])
    r = print_stats("Gotobi Only (No Monday)", no_monday)
    all_results.append(r)

    # ═══════════════════════════════════════════
    # IDEA 5: Conditional Long Revival
    # ═══════════════════════════════════════════
    print("\n" + "="*80)
    print("IDEA 5: Conditional Long Revival (09:00->09:55)")
    print("="*80)
    
    # 5a. Long unconditional (baseline)
    long_all = simulate_trades(df, '09:00', '09:55',
                               gotobi_days=[5,15,20,30], include_monday=True,
                               exclude_days=[10,25], direction='long')
    r = print_stats("Long ALL (09:00->09:55)", long_all)
    all_results.append(r)
    
    # 5b. Long only when previous day was bearish (Close < Open)
    def prev_day_bearish(prev_candle):
        return prev_candle['Close'] < prev_candle['Open']
    
    long_bearish = simulate_trades(df, '09:00', '09:55',
                                   gotobi_days=[5,15,20,30], include_monday=True,
                                   exclude_days=[10,25], direction='long',
                                   long_filter_fn=prev_day_bearish)
    r = print_stats("Long (prev bearish)", long_bearish)
    all_results.append(r)
    
    # 5c. Long only when previous day was strongly bearish (> 30 pips drop)
    def prev_day_strong_bearish(prev_candle):
        return (prev_candle['Open'] - prev_candle['Close']) * 100 > 30
    
    long_strong = simulate_trades(df, '09:00', '09:55',
                                  gotobi_days=[5,15,20,30], include_monday=True,
                                  exclude_days=[10,25], direction='long',
                                  long_filter_fn=prev_day_strong_bearish)
    r = print_stats("Long (prev strong bearish >30p)", long_strong)
    all_results.append(r)
    
    # 5d. Long only on month-end
    long_month_end = simulate_trades(df, '09:00', '09:55',
                                     gotobi_days=[], include_monday=False,
                                     exclude_days=[], include_month_end=True,
                                     direction='long')
    r = print_stats("Long Month-End ONLY", long_month_end)
    all_results.append(r)
    
    # ═══════════════════════════════════════════
    # BONUS: Gotobi Day Number Analysis
    # ═══════════════════════════════════════════
    print("\n" + "="*80)
    print("BONUS: Individual Gotobi Day Performance")
    print("="*80)
    
    for day in [5, 10, 15, 20, 25, 30]:
        trades = simulate_trades(df, '09:55', '10:25',
                                 gotobi_days=[day], include_monday=False,
                                 exclude_days=[])
        r = print_stats(f"Gotobi {day}th ONLY", trades)
        all_results.append(r)
    
    # ═══════════════════════════════════════════
    # SUMMARY TABLE
    # ═══════════════════════════════════════════
    print("\n" + "="*80)
    print("SUMMARY (sorted by PF)")
    print("="*80)
    
    summary = pd.DataFrame(all_results)
    summary = summary.sort_values('PF', ascending=False)
    print(summary.to_string(index=False))
    
    summary.to_csv('analysis/nakane_pf_ideas_results.csv', index=False)
    print("\nResults saved to analysis/nakane_pf_ideas_results.csv")
