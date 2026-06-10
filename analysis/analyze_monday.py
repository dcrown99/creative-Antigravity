import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# --- Configuration ---
DATA_FILE = '../data/USDJPY_M1.csv'
SPREAD_PIPS = 1.0
OFFSET_HOURS = 7

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    df.set_index('Datetime', inplace=True)
    df.index = df.index + timedelta(hours=OFFSET_HOURS)
    return df

def analyze_monday(df):
    print("Analyzing Monday Short Strategy (09:55 -> 10:25)...")
    
    df = df[~df.index.duplicated(keep='first')]
    df = df.sort_index()
    df = df.resample('1min').ffill()
    
    entries = df.between_time('09:55', '09:55').copy()
    exits = df.between_time('10:25', '10:25').copy()
    
    common_index = entries.index.normalize()
    
    results = []
    
    for date in common_index:
        try:
            # Check if Monday
            if date.weekday() != 0:
                continue
                
            entry_row = entries.loc[entries.index.normalize() == date]
            exit_row = exits.loc[exits.index.normalize() == date]
            
            if entry_row.empty or exit_row.empty:
                continue
                
            entry_price = entry_row.iloc[0]['Open']
            exit_price = exit_row.iloc[0]['Open']
            
            # Check if it's also a Gotobi (original definition)
            # Gotobi: 5, 10, 15, 20, 25, 30
            d = date.day
            is_gotobi = (d % 5 == 0)
            
            # Check if it's 10th or 25th
            is_loser_gotobi = (d == 10 or d == 25)

            # Calculate Pips (Short: Entry - Exit)
            pips = (entry_price - exit_price) * 100 - SPREAD_PIPS
            
            results.append({
                'Date': date,
                'IsGotobi': is_gotobi,
                'IsLoserGotobi': is_loser_gotobi,
                'Pips': pips
            })
            
        except Exception as e:
            continue

    res_df = pd.DataFrame(results)
    
    if res_df.empty:
        print("No Monday trades found.")
        return

    print("\n=== All Mondays ===")
    print(f"Total: {len(res_df)}")
    print(f"Sum: {res_df['Pips'].sum():.1f}")
    if len(res_df) > 0:
        pf_all = res_df[res_df['Pips']>0]['Pips'].sum() / abs(res_df[res_df['Pips']<0]['Pips'].sum()) if res_df[res_df['Pips']<0]['Pips'].sum() != 0 else 999
        print(f"PF: {pf_all:.2f}")

    print("\n=== Monday 10th/25th (The Suspects) ===")
    suspects = res_df[res_df['IsLoserGotobi'] == True]
    print(f"Total: {len(suspects)}")
    print(f"Sum: {suspects['Pips'].sum():.1f}")
    if len(suspects) > 0:
        pf_sus = suspects[suspects['Pips']>0]['Pips'].sum() / abs(suspects[suspects['Pips']<0]['Pips'].sum()) if suspects[suspects['Pips']<0]['Pips'].sum() != 0 else 999
        print(f"PF: {pf_sus:.2f}")

    print("\n=== Mondays WITHOUT 10th/25th ===")
    clean_mon = res_df[res_df['IsLoserGotobi'] == False]
    print(f"Total: {len(clean_mon)}")
    print(f"Sum: {clean_mon['Pips'].sum():.1f}")
    if len(clean_mon) > 0:
        pf_clean = clean_mon[clean_mon['Pips']>0]['Pips'].sum() / abs(clean_mon[clean_mon['Pips']<0]['Pips'].sum()) if clean_mon[clean_mon['Pips']<0]['Pips'].sum() != 0 else 999
        print(f"PF: {pf_clean:.2f}")

    print("\n=== Yearly Breakdown (v2.21 Logic: All Mondays EXCEPT 10th/25th) ===")
    res_df['Year'] = res_df['Date'].apply(lambda x: x.year)
    
    # Filter for v2.21 (Exclude 10th/25th)
    v221_df = res_df[res_df['IsLoserGotobi'] == False]
    
    years = v221_df['Year'].unique()
    years.sort()
    
    for y in years:
        ydf = v221_df[v221_df['Year'] == y]
        total_pips = ydf['Pips'].sum()
        trades = len(ydf)
        win_pips = ydf[ydf['Pips'] > 0]['Pips'].sum()
        loss_pips = abs(ydf[ydf['Pips'] < 0]['Pips'].sum())
        pf = win_pips / loss_pips if loss_pips > 0 else 999
        
        print(f"Year {y}: Trades={trades}, Pips={total_pips:.1f}, PF={pf:.2f}")

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    analyze_monday(df)
