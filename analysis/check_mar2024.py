import pandas as pd
import numpy as np
from datetime import timedelta

DATA_FILE = r'c:\Users\koume\Downloads\code\data\USDJPY_M1.csv'
SPREAD_PIPS = 0.4
SL_PIPS = 20
TP_PIPS = 40

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    try:
        df = pd.read_csv(filepath)
        df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
        df.set_index('Datetime', inplace=True)
        # Adjust GMT+2/3 to JST (GMT+9)
        # Data is likely GMT+2/3 (Eastern European Time)
        # Standard shift is usually +7 hours (Invast/XM style)
        df.index = df.index + timedelta(hours=7) 
        return df
    except Exception as e:
        print(f"Error loading data: {e}")
        return pd.DataFrame()

def get_gotobi_date(dt):
    d = dt.day
    wd = dt.weekday() # 0=Mon
    
    # Direct
    if d % 5 == 0:
        if wd < 5: return d
    
    # Friday Shift
    if wd == 4:
        if (d + 1) % 5 == 0: return d + 1
        if (d + 2) % 5 == 0: return d + 2
        
    return 0

def run_simulation(df):
    results = []
    
    # v2.21 Logic
    ENABLE_GOTOBI = [5, 15, 20, 30]
    EXCLUDE_DAYS = [10, 25] # Hard Block
    
    # Filter for March 2024
    start_date = pd.Timestamp("2024-03-01 00:00:00")
    end_date = pd.Timestamp("2024-03-31 23:59:59")
    
    days = df.index.normalize().unique()
    days = [d for d in days if start_date <= d <= end_date]
    
    print(f"\nAnalyzing March 2024 ({len(days)} days)...")
    
    for date in days:
        try:
            # Entry 09:55 JST
            entry_time = date + timedelta(hours=9, minutes=55)
            if entry_time not in df.index: continue
            
            # v2.21 Logic Check
            g_date = get_gotobi_date(entry_time)
            wd = entry_time.weekday()
            
            is_trade = False
            trade_type = ""
            
            # HARD BLOCK
            if g_date in EXCLUDE_DAYS:
                is_trade = False
                print(f"{date.date()} (wd={wd}, g={g_date}) -> BLOCKED (Exclude)")
                continue
            
            if g_date in ENABLE_GOTOBI:
                is_trade = True
                trade_type = "Gotobi"
            elif wd == 0:
                is_trade = True
                trade_type = "Monday"
            
            if not is_trade:
                # print(f"{date.date()} -> No Trade")
                continue
                
            # Execute Trade
            entry_price = df.loc[entry_time]['Close']
            
            # Exit 10:25 JST
            exit_time = date + timedelta(hours=10, minutes=25)
            if exit_time not in df.index:
                print(f"{date.date()} -> Exit Data Missing")
                continue
                
            exit_price = df.loc[exit_time]['Close']
            
            # Check Max/Min for SL/TP
            period = df.loc[entry_time:exit_time]
            high = period['High'].max()
            low = period['Low'].min()
            
            sl_price = entry_price + (SL_PIPS * 0.01)
            tp_price = entry_price - (TP_PIPS * 0.01)
            
            res_pips = 0
            result_str = ""
            
            if high >= sl_price:
                res_pips = -SL_PIPS - SPREAD_PIPS
                result_str = "SL Loss"
            elif low <= tp_price:
                res_pips = TP_PIPS - SPREAD_PIPS
                result_str = "TP Win"
            else:
                pips_raw = (entry_price - exit_price) * 100
                res_pips = pips_raw - SPREAD_PIPS
                result_str = "Time Exit"
                
            print(f"{date.date()} [{trade_type}] Entry: {entry_price:.3f} -> Exit: {exit_price:.3f} | Pips: {res_pips:.1f} ({result_str})")
            
            results.append(res_pips)
            
        except Exception as e:
            print(f"Error on {date}: {e}")
            
    # Summary
    if results:
        total = sum(results)
        wins = len([r for r in results if r > 0])
        total_trades = len(results)
        win_rate = wins / total_trades * 100
        print(f"\nMarch 2024 Summary:")
        print(f"Trades: {total_trades}")
        print(f"Total Pips: {total:.1f}")
        print(f"Win Rate: {win_rate:.1f}%")
    else:
        print("No trades found for Mar 2024.")

if __name__ == "__main__":
    df = load_data_jst(DATA_FILE)
    if not df.empty:
        run_simulation(df)
