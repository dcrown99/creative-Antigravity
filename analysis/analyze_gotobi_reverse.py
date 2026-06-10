import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# --- Configuration ---
DATA_FILE = '../data/USDJPY_M1.csv'
SPREAD_PIPS = 1.0
OFFSET_HOURS = 7 # Winter=2+7=9, Summer=3+6=9. Adjusted for standardized JST.

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    
    # Combine Date and Time columns
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    df.set_index('Datetime', inplace=True)
    
    # Shift to JST
    df.index = df.index + timedelta(hours=OFFSET_HOURS)
    return df

def analyze_days(df):
    print("Analyzing LONG Strategy (09:55 -> 10:25)...")
    
    # 1. Resample to M1 to ensure complete index
    df = df[~df.index.duplicated(keep='first')]
    df = df.sort_index()
    df = df.resample('1min').ffill()
    
    # 2. Extract Entry and Exit Times
    # Entry: 09:55 Open
    entries = df.between_time('09:55', '09:55').copy()
    # Exit: 10:25 Open
    exits = df.between_time('10:25', '10:25').copy()
    
    common_index = entries.index.normalize()
    
    results = []
    
    for date in common_index:
        try:
            entry_row = entries.loc[entries.index.normalize() == date]
            exit_row = exits.loc[exits.index.normalize() == date]
            
            if entry_row.empty or exit_row.empty:
                continue
                
            entry_price = entry_row.iloc[0]['Open']
            exit_price = exit_row.iloc[0]['Open']
            
            # 3. Check if it's a valid Gotobi Trading Day
            d = date.day
            wd = date.weekday() # 0=Mon, 4=Fri
            
            is_target = False
            target_day_type = 0
            
            if d % 5 == 0:
                is_target = True
                target_day_type = d
            elif wd == 4: # Friday
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
                
            # Calculate Pips (LONG: Exit - Entry)
            pips = (exit_price - entry_price) * 100 - SPREAD_PIPS
            
            results.append({
                'Date': date,
                'DayType': target_day_type,
                'Weekday': wd,
                'Pips': pips
            })
            
        except Exception as e:
            continue

    res_df = pd.DataFrame(results)
    
    if res_df.empty:
        print("No trades found.")
        return

    print("\n=== Performance by Day Date (LONG) ===")
    summary = res_df.groupby('DayType')['Pips'].agg(['count', 'sum', 'mean'])
    summary['WinRate'] = res_df.groupby('DayType')['Pips'].apply(lambda x: (x > 0).sum() / len(x) * 100)
    summary['PF'] = res_df.groupby('DayType')['Pips'].apply(lambda x: x[x>0].sum() / abs(x[x<0].sum()) if x[x<0].sum() != 0 else 999)
    print(summary)
    
    print("\n=== Special Focus: 10th and 25th ===")
    losers = res_df[res_df['DayType'].isin([10, 25])]
    print(f"Total Trades: {len(losers)}")
    print(f"Total Pips: {losers['Pips'].sum():.1f}")
    if not losers.empty:
        pf = losers[losers['Pips']>0]['Pips'].sum() / abs(losers[losers['Pips']<0]['Pips'].sum())
        print(f"PF: {pf:.2f}")

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    analyze_days(df)
