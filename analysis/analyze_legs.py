import pandas as pd
import numpy as np
import datetime

DATA_FILE = 'data/USDJPY_M1.csv'
COST_PER_TRADE = 2.0 

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    
    years = df['Datetime'].dt.year.unique()
    df['Offset'] = 7 
    for y in years:
        march_31 = pd.Timestamp(year=y, month=3, day=31)
        last_sun_mar = march_31 - pd.Timedelta(days=(march_31.dayofweek + 1) % 7)
        dst_start = last_sun_mar + pd.Timedelta(hours=3)
        oct_31 = pd.Timestamp(year=y, month=10, day=31)
        last_sun_oct = oct_31 - pd.Timedelta(days=(oct_31.dayofweek + 1) % 7)
        dst_end = last_sun_oct + pd.Timedelta(hours=4)
        mask = (df['Datetime'] >= dst_start) & (df['Datetime'] < dst_end)
        df.loc[mask, 'Offset'] = 6
        
    df['JST'] = df['Datetime'] + pd.to_timedelta(df['Offset'], unit='h')
    df = df.set_index('JST')
    df = df.rename(columns={'Vol': 'Volume'})
    df = df[['Open', 'High', 'Low', 'Close']]
    df = df[~df.index.duplicated(keep='first')]
    df['Day'] = df.index.day
    return df

def analyze_legs(df):
    entry_hour = 9
    entry_minute = 0
    fix_minute = 54 # Python used 54? Wait, code said 9:55 Fix? 
    # Check validate_winner.py: it used fix_minute = 54. 
    # NakaneMaster.mq5 uses 9:55.
    # Discrepancy Found! 
    # Python: Close 9:54 (Before Fix)
    # MT5: Close 9:55 (On Fix) -> potential volatility/spread issue.
    # Let's test both 54 and 55 in Python.
    
    valid_days = [5, 10, 15, 20, 25, 30]
    day_mask = df['Day'].isin(valid_days)
    
    for fix_m in [54, 55]:
        print(f"\n=== Analyzing Fix Minute: {fix_m} ===")
        
        # Long
        entry_mask = (df.index.hour == 9) & (df.index.minute == 0) & day_mask
        entries = df.loc[entry_mask].copy()
        entries['DateStr'] = entries.index.date
        
        fix_mask = (df.index.hour == 9) & (df.index.minute == fix_m) & day_mask
        fixes = df.loc[fix_mask].copy()
        fixes['DateStr'] = fixes.index.date
        
        longs = pd.merge(entries[['Close', 'DateStr']], fixes[['Close', 'DateStr']], on='DateStr', suffixes=('_entry', '_exit'))
        longs['NetPips'] = (longs['Close_exit'] - longs['Close_entry']) * 100 - COST_PER_TRADE
        
        l_prof = longs[longs['NetPips']>0]['NetPips'].sum()
        l_loss = abs(longs[longs['NetPips']<0]['NetPips'].sum())
        l_pf = l_prof/l_loss if l_loss > 0 else 0
        
        print(f"LONG  (9:00->9:{fix_m}): PF {l_pf:.2f}, Net {longs['NetPips'].sum():.1f}, Trades {len(longs)}")
        
        # Short
        # Short starts at fix_m, ends at fix_m + 30
        close_min = (fix_m + 30) % 60
        close_hr = 9 + ((fix_m + 30) // 60)
        
        close_mask = (df.index.hour == close_hr) & (df.index.minute == close_min) & day_mask
        closes = df.loc[close_mask].copy()
        closes['DateStr'] = closes.index.date
        
        shorts = pd.merge(fixes[['Close', 'DateStr']], closes[['Close', 'DateStr']], on='DateStr', suffixes=('_entry', '_exit'))
        shorts['NetPips'] = (shorts['Close_entry'] - shorts['Close_exit']) * 100 - COST_PER_TRADE
        
        s_prof = shorts[shorts['NetPips']>0]['NetPips'].sum()
        s_loss = abs(shorts[shorts['NetPips']<0]['NetPips'].sum())
        s_pf = s_prof/s_loss if s_loss > 0 else 0
        
        print(f"SHORT (9:{fix_m}->{close_hr}:{close_min:02d}): PF {s_pf:.2f}, Net {shorts['NetPips'].sum():.1f}, Trades {len(shorts)}")
        
        # Total
        total_pips = longs['NetPips'].sum() + shorts['NetPips'].sum()
        print(f"TOTAL: {total_pips:.1f} pips")

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    analyze_legs(df)
