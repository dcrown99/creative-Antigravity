import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# --- Configuration ---
DATA_FILE = '../data/USDJPY_M1.csv'
SPREAD_PIPS = 1.0
OFFSET_HOURS = 7
TARGET_DAYS = [5, 15, 20, 30] # The "Winning Set" (v2.10)

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    df.set_index('Datetime', inplace=True)
    df.index = df.index + timedelta(hours=OFFSET_HOURS)
    return df

def get_gotobi_adjusted_date(date):
    if date.weekday() == 5: return date - timedelta(days=1)
    if date.weekday() == 6: return date - timedelta(days=2)
    return date

def is_target_day(date):
    d = date.day
    adj_d = d
    if d % 5 == 0:
        adj_d = d
    elif date.weekday() == 4: # Friday check
        sat = date + timedelta(days=1)
        sun = date + timedelta(days=2)
        if sat.day % 5 == 0: adj_d = sat.day
        elif sun.day % 5 == 0: adj_d = sun.day
    
    return adj_d in TARGET_DAYS

def simulate_trade(slice_df, entry_price, sl_pips, tp_pips):
    """
    Simulate a SHORT trade given M1 bars.
    Returns realized pips.
    """
    sl_price = entry_price + (sl_pips / 100.0)
    tp_price = entry_price - (tp_pips / 100.0)
    
    for i, row in slice_df.iterrows():
        # Check High for SL (Short)
        if row['High'] >= sl_price:
            return -sl_pips
        # Check Low for TP (Short)
        if row['Low'] <= tp_price:
            return tp_pips
            
    # If neither hit, close at last Close (or Open of 10:25?)
    # Strategy closes at 10:25 Open usually.
    # The slice passed should be 09:55 to 10:24 (inclusive)
    # The exit price is the Open of 10:25.
    # But here we are iterating bars.
    # Let's assume exit at the end of the last bar in slice (Close of 10:24) which is approx Open of 10:25.
    exit_price = slice_df.iloc[-1]['Close']
    return (entry_price - exit_price) * 100 - SPREAD_PIPS

def analyze_sl_tp(df):
    print("Preparing 30-minute slices...")
    df = df.sort_index()
    # Resample to ensure continuity? 
    # M1 data might have gaps.
    
    # Identify Entry Points (09:55)
    entries = df.between_time('09:55', '09:55').copy()
    
    valid_days = []
    
    # Filter entries for Target Days
    for date in entries.index:
        if is_target_day(date):
            valid_days.append(date)
            
    print(f"Found {len(valid_days)} valid trading days (Winning Set).")
    
    # Grid Search Specs
    sl_range = [10, 15, 20, 25, 30, 50, 100]
    tp_range = [10, 20, 30, 40, 50, 100]
    
    # Store trade data (date, entry, m1_slice) to avoid re-slicing
    trades_data = []
    for entry_time in valid_days:
        try:
            entry_price = df.loc[entry_time]['Open']
            # Get slice from 09:55 to 10:25
            # We want to check price action *during* the trade.
            # Trade starts 09:55. Ends 10:25.
            # Slice: 09:55:00 to 10:24:59? 
            # MT5 M1 bars: 09:55 bar covers 09:55:00-59.
            end_time = entry_time + timedelta(minutes=30) # 10:25
            
            # Get bars strictly between entry (inclusive) and exit (exclusive)
            # Actually, standard strategy exits at 10:25 Open.
            # So price action is 09:55, 56... 10:24.
            # If 10:25 Open is reached, we close.
            
            mask = (df.index >= entry_time) & (df.index < end_time)
            slice_df = df.loc[mask]
            
            if slice_df.empty: continue
            
            # Append exit price (10:25 Open) for non-SL/TP case?
            # Or just use last Close.
            # For accurate "Time Close", need 10:25 Open.
            
            try:
                exit_price_at_time = df.loc[end_time]['Open']
            except:
                exit_price_at_time = slice_df.iloc[-1]['Close']

            trades_data.append({
                'entry_price': entry_price,
                'slice': slice_df,
                'time_exit': exit_price_at_time
            })
        except Exception as e:
            continue

    print(f"Simulating {len(trades_data)} trades across parameter grid...")
    
    results = []
    
    for sl in sl_range:
        for tp in tp_range:
            total_pips = 0
            wins = 0
            losses = 0
            
            for trade in trades_data:
                # Custom logic for efficiency
                entry = trade['entry_price']
                sl_price = entry + (sl / 100.0)
                tp_price = entry - (tp / 100.0)
                
                outcome = 0
                hit = False
                
                # Check High/Low of intraday bars
                # Vectorized verification is hard, looping is safer for logic
                for row in trade['slice'].itertuples():
                    if row.High >= sl_price:
                        outcome = -sl
                        hit = True
                        break
                    if row.Low <= tp_price:
                        outcome = tp
                        hit = True
                        break
                
                if not hit:
                     outcome = (entry - trade['time_exit']) * 100 - SPREAD_PIPS
                
                total_pips += outcome
                if outcome > 0: wins += 1
                else: losses += 1
            
            pf = 0
            if losses > 0:
                # Can't calc accurate PF without summing gross win/loss.
                # Simplified: Pips Profit Factor?
                pass 
            
            results.append({
                'SL': sl,
                'TP': tp,
                'TotalPips': total_pips,
                'WinRate': (wins / len(trades_data)) * 100 if trades_data else 0
            })
            print(f"SL={sl}, TP={tp} -> {total_pips:.1f} pips")

    res_df = pd.DataFrame(results)
    print("\n=== Best Settings by Total Pips ===")
    print(res_df.sort_values('TotalPips', ascending=False).head(10))

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    analyze_sl_tp(df)
