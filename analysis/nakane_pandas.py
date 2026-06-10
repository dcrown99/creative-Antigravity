import pandas as pd
import numpy as np
import datetime

DATA_FILE = 'data/USDJPY_M1.csv'
COMMISSION = 0.0003

def is_dst(dt):
    # EET DST: Last Sunday March to Last Sunday October
    # Simple approx:
    # March:
    # Oct:
    
    year = dt.year
    # Last Sunday March
    march_31 = datetime.datetime(year, 3, 31)
    last_sun_mar = march_31 - datetime.timedelta(days=(march_31.weekday() + 1) % 7)
    dst_start = last_sun_mar.replace(hour=3) # Clock jumps forward at 3am
    
    # Last Sunday Oct
    oct_31 = datetime.datetime(year, 10, 31)
    last_sun_oct = oct_31 - datetime.timedelta(days=(oct_31.weekday() + 1) % 7)
    dst_end = last_sun_oct.replace(hour=4) # Clock jumps back (was 4am -> 3am?) basically late night
    
    return dst_start <= dt < dst_end

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    
    # Vectorized DST Check?
    # Slow to apply row by row.
    # But we have 1.1M rows.
    # Faster: create an index of DST switch times and use searchsorted?
    # Or just loop years (3 years).
    
    years = df['Datetime'].dt.year.unique()
    df['Offset'] = 7 # Default Winter (GMT+2 -> JST(GMT+9) = +7)
    
    for y in years:
        march_31 = pd.Timestamp(year=y, month=3, day=31)
        last_sun_mar = march_31 - pd.Timedelta(days=(march_31.dayofweek + 1) % 7)
        dst_start = last_sun_mar + pd.Timedelta(hours=3) # shift happens early morning
        
        oct_31 = pd.Timestamp(year=y, month=10, day=31)
        last_sun_oct = oct_31 - pd.Timedelta(days=(oct_31.dayofweek + 1) % 7)
        dst_end = last_sun_oct + pd.Timedelta(hours=4)
        
        # Summer: GMT+3 -> JST(GMT+9) = +6
        # Apply +6 offset during DST
        mask = (df['Datetime'] >= dst_start) & (df['Datetime'] < dst_end)
        df.loc[mask, 'Offset'] = 6
        
    df['JST'] = df['Datetime'] + pd.to_timedelta(df['Offset'], unit='h')
    
    df = df.set_index('JST')
    df = df.rename(columns={'Vol': 'Volume'})
    df = df[['Open', 'High', 'Low', 'Close']]
    df = df[~df.index.duplicated(keep='first')]
    
    df['Day'] = df.index.day
    return df

def run_backtest(df, entry_hour, entry_minute, fix_minute, gotobi_only=False):
    # Normalized JST Logic
    # Fix is ALWAYS 9:55 JST (approx)
    # Actually TTM is 9:55.
    
    if gotobi_only:
        valid_days = [5, 10, 15, 20, 25, 30]
        day_mask = df['Day'].isin(valid_days)
    else:
        day_mask = np.ones(len(df), dtype=bool)
        
    # Entry
    entry_mask = (df.index.hour == entry_hour) & (df.index.minute == entry_minute) & day_mask
    entries = df.loc[entry_mask].copy()
    entries['DateStr'] = entries.index.date
    
    # Fix (9:55 or customized)
    # Note: Optimizing "Fix Minute" around 50-59 (Hour is usually same as entry or +1?)
    # Usually Entry is 9:xx. Fix is 9:55.
    # So Fix Hour is same as Entry Hour (9).
    fix_hour = entry_hour
    fix_mask = (df.index.hour == fix_hour) & (df.index.minute == fix_minute) & day_mask
    fixes = df.loc[fix_mask].copy()
    fixes['DateStr'] = fixes.index.date
    
    merged_long = pd.merge(entries[['Close', 'DateStr']], fixes[['Close', 'DateStr']], on='DateStr', suffixes=('_entry', '_exit'))
    long_pips = (merged_long['Close_exit'] - merged_long['Close_entry']) * 100
    
    # Short (Fix -> +30m)
    # Close time
    total_mins = fix_minute + 30
    close_hour = fix_hour + (total_mins // 60)
    close_minute = total_mins % 60
    
    close_mask = (df.index.hour == close_hour) & (df.index.minute == close_minute) & day_mask
    closes = df.loc[close_mask].copy()
    closes['DateStr'] = closes.index.date
    
    merged_short = pd.merge(fixes[['Close', 'DateStr']], closes[['Close', 'DateStr']], on='DateStr', suffixes=('_entry', '_exit'))
    short_pips = (merged_short['Close_entry'] - merged_short['Close_exit']) * 100
    
    cost_per_trade = 1.0
    
    total_long = long_pips.sum() - (len(long_pips) * cost_per_trade)
    total_short = short_pips.sum() - (len(short_pips) * cost_per_trade)
    
    total_net_pips = total_long + total_short
    total_trades = len(long_pips) + len(short_pips)
    
    gross_profit = long_pips[long_pips > 0].sum() + short_pips[short_pips > 0].sum()
    gross_loss = abs(long_pips[long_pips < 0].sum() + short_pips[short_pips < 0].sum()) + (total_trades * cost_per_trade)
    
    pf = 0
    if gross_loss > 0:
        pf = gross_profit / gross_loss
    elif gross_profit > 0:
        pf = 999.0
        
    return {
        'Entry (JST)': f"{entry_hour}:{entry_minute:02d}",
        'Fix (JST)': f"{fix_hour}:{fix_minute:02d}",
        'Gotobi': gotobi_only,
        'Total Pips': total_net_pips,
        'PF': pf,
        'Trades': total_trades
    }

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    print(f"Data Loaded (JST Converted): {len(df)} bars")
    print(f"Range: {df.index.min()} - {df.index.max()}")
    
    results = []
    
    # Optimize JST 9:00 - 9:55
    hours = [9] 
    entry_minutes = [0, 15, 30, 40, 45, 50]
    fix_minutes = [50, 54, 55]
    gotobi_options = [False, True]
    
    print("Testing combinations...")
    
    for h in hours:
        for em in entry_minutes:
            for fm in fix_minutes:
                if em >= fm: continue
                # Also try Entry at 8:xx? Maybe too early. Stick to 9:xx first.
                for g in gotobi_options:
                    res = run_backtest(df, h, em, fm, g)
                    results.append(res)
                    
    results_df = pd.DataFrame(results)
    print("\nTop 10 Configurations by PF:")
    print(results_df.sort_values('PF', ascending=False).head(10))
    
    print("\nTop 10 Configurations by Total Pips:")
    print(results_df.sort_values('Total Pips', ascending=False).head(10))
    
    results_df.to_csv('analysis/nakane_pandas_results_jst.csv')
