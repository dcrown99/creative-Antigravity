import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# --- Configuration ---
DATA_FILE = 'data/USDJPY_M1.csv'
SPREAD_PIPS = 1.0
OFFSET_HOURS = 7 # Winter=2+7=9, Summer=3+6=9. Adjusted for standardized JST.

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    
    # Combine Date and Time columns
    # Format appears to be YYYY.MM.DD and HH:MM
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    df.set_index('Datetime', inplace=True)
    
    # Shift to JST
    df.index = df.index + timedelta(hours=OFFSET_HOURS)
    return df

def get_gotobi_date(date):
    """
    Returns the 'Gotobi' date for a given date.
    If date is Sat/Sun, it moves back to Friday.
    """
    if date.weekday() == 5: # Saturday -> Friday
        return date - timedelta(days=1)
    if date.weekday() == 6: # Sunday -> Friday
        return date - timedelta(days=2)
    return date

def is_gotobi(date):
    """
    Checks if the date is a Gotobi (5, 10, 15, 20, 25, 30).
    Adjusts solely for the check.
    """
    d = date.day
    return d % 5 == 0

def analyze_days(df):
    print("Analyzing Short Strategy (09:55 -> 10:25)...")
    
    # 1. Resample to M1 to ensure complete index
    # Fix: Remove duplicates first to avoid reindex error
    df = df[~df.index.duplicated(keep='first')]
    df = df.sort_index()
    
    # Resample and forward fill
    df = df.resample('1min').ffill()
    
    # 2. Extract Entry and Exit Times
    # Entry: 09:55 Open
    entries = df.between_time('09:55', '09:55').copy()
    # Exit: 10:25 Open
    exits = df.between_time('10:25', '10:25').copy()
    
    # Align dates
    # Assuming exit is on the same day as entry (which it is for 9:55->10:25)
    common_index = entries.index.normalize() # Dates
    
    results = []
    
    for date in common_index:
        try:
            # Get Entry/Exit for this date
            entry_row = entries.loc[entries.index.normalize() == date]
            exit_row = exits.loc[exits.index.normalize() == date]
            
            if entry_row.empty or exit_row.empty:
                continue
                
            entry_price = entry_row.iloc[0]['Open']
            exit_price = exit_row.iloc[0]['Open']
            
            # 3. Check if it's a valid Gotobi Trading Day
            # Current date is JST date
            d = date.day
            wd = date.weekday() # 0=Mon, 4=Fri
            
            is_target = False
            target_day_type = 0 # 5, 10, 15...
            
            # Logic: Trade if today is 5/10/15... OR if today is Fri and 5/10/15... is Sat/Sun
            if d % 5 == 0:
                is_target = True
                target_day_type = d
            elif wd == 4: # Friday
                # Check Month Rollover issues roughly or rigorously?
                # Rigorous check:
                sat = date + timedelta(days=1)
                sun = date + timedelta(days=2)
                
                if sat.day % 5 == 0:
                    is_target = True
                    target_day_type = sat.day
                elif sun.day % 5 == 0:
                    is_target = True
                    target_day_type = sun.day
            
            if not is_target:
                continue
                
            # Calcuclate Pips (Short: Entry - Exit)
            pips = (entry_price - exit_price) * 100 - SPREAD_PIPS
            
            results.append({
                'Date': date,
                'DayType': target_day_type,
                'Weekday': wd,
                'Pips': pips
            })
            
        except Exception as e:
            # print(f"Error on {date}: {e}")
            continue

    # Convert to DataFrame
    res_df = pd.DataFrame(results)
    
    if res_df.empty:
        print("No trades found.")
        return

    print("\n=== Performance by Day Date (5, 10, 15...) ===")
    summary = res_df.groupby('DayType')['Pips'].agg(['count', 'sum', 'mean'])
    summary['WinRate'] = res_df.groupby('DayType')['Pips'].apply(lambda x: (x > 0).sum() / len(x) * 100)
    summary['PF'] = res_df.groupby('DayType')['Pips'].apply(lambda x: x[x>0].sum() / abs(x[x<0].sum()) if x[x<0].sum() != 0 else 999)
    print(summary)
    
    print("\n=== Performance by Weekday (0=Mon, 4=Fri) ===")
    wd_summary = res_df.groupby('Weekday')['Pips'].agg(['count', 'sum', 'mean'])
    wd_summary['WinRate'] = res_df.groupby('Weekday')['Pips'].apply(lambda x: (x > 0).sum() / len(x) * 100)
    wd_summary['PF'] = res_df.groupby('Weekday')['Pips'].apply(lambda x: x[x>0].sum() / abs(x[x<0].sum()) if x[x<0].sum() != 0 else 999)
    print(wd_summary)
    
    # Specific Friday Logic (Naka-bi)
    fridays = res_df[res_df['Weekday'] == 4]
    print(f"\n=== Fridays (Naka-bi included) ===")
    print(f"Total: {len(fridays)}")
    print(f"Pips: {fridays['Pips'].sum():.1f}")
    if not fridays.empty:
        pf_fri = fridays[fridays['Pips']>0]['Pips'].sum() / abs(fridays[fridays['Pips']<0]['Pips'].sum())
        print(f"PF: {pf_fri:.2f}")

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    analyze_days(df)
