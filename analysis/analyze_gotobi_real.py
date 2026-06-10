import pandas as pd
import numpy as np
import datetime

DATA_FILE = 'data/USDJPY_M1.csv'
COST_PER_TRADE = 2.0 

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    
    # DST Calculation (EET Standard)
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
    df = df[['Open', 'High', 'Low', 'Close']]
    df = df[~df.index.duplicated(keep='first')]
    return df

def is_gotobi(date):
    day = date.day
    # Check if naive Gotobi (5, 10, 15, 20, 25, 30)
    if day % 5 != 0:
        return False
    
    # If falling on weekend, it should have been executed on Friday.
    # But here we are iterating actual trading days.
    # The logic is: Is TODAY a Gotobi day?
    # Standard Japan Logic: 
    # If 5th is Sat -> Gotobi is 4th (Fri)
    # If 5th is Sun -> Gotobi is 3rd (Fri)
    # So if Today is 3rd (Fri), is it a Gotobi? Yes, because 5th is Sun.
    return False # Placeholder, logic below is better

def get_gotobi_days(start_date, end_date):
    # Generates a set of valid Gotobi dates (dates where the trade ACTUALLY happens)
    current = start_date
    gotobi_dates = set()
    
    while current <= end_date:
        # Check specific days that *would* be Gotobi
        if current.day % 5 == 0:
            trade_date = current
            # Adjust if weekend
            if current.weekday() == 5: # Saturday
                trade_date = current - datetime.timedelta(days=1)
            elif current.weekday() == 6: # Sunday
                trade_date = current - datetime.timedelta(days=2)
            
            # If trade_date is Saturday (e.g. 5th is Mon, wait. 
            # If 5th is Sat -> 4th (Fri). Correct.
            # If 5th is Sun -> 3rd (Fri). Correct.
            
            # What if 5th is Mon? It is just 5th.
            
            # Additional Rule for market holidays? 
            # We assume data exists if market is open.
            
            # trade_date is already a date object (current is date)
            gotobi_dates.add(trade_date)
            
        current += datetime.timedelta(days=1)
    return gotobi_dates

def analyze_legs(df):
    # Generate Reference Gotobi Dates
    start_dt = df.index[0].date()
    end_dt = df.index[-1].date()
    gotobi_set = get_gotobi_days(start_dt, end_dt)
    
    df['Date'] = df.index.date
    # Filter rows that are in the Gotobi Set
    day_mask = df['Date'].isin(gotobi_set)
    
    # Analyze Fix 54 (09:55:00) vs Fix 55 (09:56:00)
    # Just check Fix 54 (matches MQL5 9:55 Open)
    
    for fix_m in [53, 54, 55]:
        print(f"\n=== Analyzing Fix Minute: {fix_m} (Exit at 09:{fix_m+1:02d}:00) ===")
        
        # Long (9:00 -> 9:fix_m Close)
        entry_mask = (df.index.hour == 9) & (df.index.minute == 0) & day_mask
        entries = df.loc[entry_mask].copy()
        
        fix_mask = (df.index.hour == 9) & (df.index.minute == fix_m) & day_mask
        fixes = df.loc[fix_mask].copy()
        
        # Merge on Date
        longs = pd.merge(entries[['Close', 'Date']], fixes[['Close', 'Date']], on='Date', suffixes=('_entry', '_exit'))
        longs['NetPips'] = (longs['Close_exit'] - longs['Close_entry']) * 100 - COST_PER_TRADE
        
        l_prof = longs[longs['NetPips']>0]['NetPips'].sum()
        l_loss = abs(longs[longs['NetPips']<0]['NetPips'].sum())
        l_pf = l_prof/l_loss if l_loss > 0 else 0
        
        print(f"LONG  : PF {l_pf:.2f}, Net {longs['NetPips'].sum():.1f}, Trades {len(longs)}")
        
        # Short (9:fix_m Close -> 9:fix_m+30 Close)
        close_min = (fix_m + 30) % 60
        close_hr = 9 + ((fix_m + 30) // 60)
        
        close_mask = (df.index.hour == close_hr) & (df.index.minute == close_min) & day_mask
        closes = df.loc[close_mask].copy()
        
        shorts = pd.merge(fixes[['Close', 'Date']], closes[['Close', 'Date']], on='Date', suffixes=('_entry', '_exit'))
        shorts['NetPips'] = (shorts['Close_entry'] - shorts['Close_exit']) * 100 - COST_PER_TRADE
        
        s_prof = shorts[shorts['NetPips']>0]['NetPips'].sum()
        s_loss = abs(shorts[shorts['NetPips']<0]['NetPips'].sum())
        s_pf = s_prof/s_loss if s_loss > 0 else 0
        
        print(f"SHORT : PF {s_pf:.2f}, Net {shorts['NetPips'].sum():.1f}, Trades {len(shorts)}")
        
        total_pips = longs['NetPips'].sum() + shorts['NetPips'].sum()
        pf_total = (l_prof + s_prof) / (l_loss + s_loss) if (l_loss + s_loss) > 0 else 0
        print(f"TOTAL : PF {pf_total:.2f}, {total_pips:.1f} pips")

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    analyze_legs(df)
