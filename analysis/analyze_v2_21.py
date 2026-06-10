import pandas as pd
import numpy as np
from datetime import timedelta

DATA_FILE = '../data/USDJPY_M1.csv'
SPREAD_PIPS = 0.4
SL_PIPS = 20
TP_PIPS = 40

def load_data_jst(filepath):
    print(f"Loading {filepath}...")
    try:
        df = pd.read_csv(filepath)
        df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
        df.set_index('Datetime', inplace=True)
        df.index = df.index + timedelta(hours=7) # Adjust to JST
        return df
    except Exception as e:
        print(f"Error loading data: {e}")
        return pd.DataFrame()

def get_gotobi_date(dt):
    """
    Returns the 'Gotobi Date' (5, 10, 15, 20, 25, 30) if applicable, else 0.
    Logic matches TimeFilter.mqh:
    - If day is 5, 10... -> Return day.
    - If day is Sat/Sun, shift to Friday.
    """
    d = dt.day
    wd = dt.weekday() # 0=Mon, 6=Sun
    
    # Direct Match
    if d % 5 == 0:
        if wd < 5: return d
        # If Sat/Sun, it was celebrated on Friday?
        # Standard Gotobi logic: If 10th is Sun, Gotobi is Fri 8th.
        # But here we are checking if TODAY (dt) is a Gotobi.
        # If dt is Fri 8th, is it a Gotobi?
        # Logic: Check if (dt + 1) is 10/Sat, or (dt + 2) is 10/Sun?
        pass

    # Reverse Check: Is today a shifted Gotobi?
    # If today is Friday (4), check if Sat(5) or Sun(6) is a Gotobi Day (5, 10, 15...)
    if wd == 4: # Friday
        # Check Sat (d+1)
        if (d + 1) % 5 == 0: return d + 1
        # Check Sun (d+2)
        if (d + 2) % 5 == 0: return d + 2
    
    # Normal Weekday Gotobi
    if d % 5 == 0 and wd < 5:
        return d
        
    return 0

def analyze_v2_21(df):
    results = []
    
    # Enable Days for Gotobi (v2.10 logic)
    ENABLE_GOTOBI = [5, 15, 20, 30]
    
    # Exclude Days (v2.21 logic)
    EXCLUDE_DAYS = [10, 25] # If Gotobi Date is 10 or 25, BLOCK. 
                            # ALSO matches Calendar Date 10/25 block?
                            # In MQL5: if (m_excluded_days[gotobi_date]) return;
                            # AND if (m_excluded_days[calendar_day]) return?
                            # My MQL5 implementation blocked based on GetGotobiDate.
                            # BUT analyze_monday.py used Calendar Day.
                            # Let's check strict MQL5 logic implemented.
                            # MQL5: int gotobi_date = GetGotobiDate();
                            # if (m_excluded_days[gotobi_date]) return;
                            # So it ONLY blocks if it is a "Gotobi 10/25".
                            # It DOES NOT block "Monday 10th" if GetGotobiDate returns 10.
                            # Wait, GetGotobiDate(10th Mon) -> 10. So it IS blocked.
                            # What about Monday 8th (if 10th is Wed)? -> GetGotobi=0. Not blocked.
                            
    days = df.index.normalize().unique()
    
    print(f"Analyzing v2.21 Full Strategy (09:55 -> 10:25)...")
    
    for date in days:
        try:
            # 09:55 Entry
            entry_time = date + timedelta(hours=9, minutes=55)
            if entry_time not in df.index: continue
            
            entry_price = df.loc[entry_time]['Close']
            
            # 10:25 Exit
            exit_time = date + timedelta(hours=10, minutes=25)
            if exit_time not in df.index: continue
            
            # SL/TP Checks
            # Simulating simplified 10:25 exit, but checking highs/lows for SL/TP
            period_data = df.loc[entry_time:exit_time]
            high = period_data['High'].max()
            low = period_data['Low'].min()
            
            # Short Strategy
            # SL = Entry + 20
            # TP = Entry - 40
            sl_price = entry_price + (SL_PIPS * 0.01)
            tp_price = entry_price - (TP_PIPS * 0.01)
            
            is_sl = high >= sl_price
            is_tp = low <= tp_price
            
            exit_price_final = df.loc[exit_time]['Close']
            pips = (entry_price - exit_price_final) * 100 - SPREAD_PIPS
            
            if is_sl and is_tp:
                # Both hit? Assume SL first (conservative)
                pips = -SL_PIPS - SPREAD_PIPS
            elif is_sl:
                pips = -SL_PIPS - SPREAD_PIPS
            elif is_tp:
                pips = TP_PIPS - SPREAD_PIPS
            
            # --- STRATEGY LOGIC v2.21 ---
            dt = entry_time
            g_date = get_gotobi_date(dt)
            wd = dt.weekday() # 0=Mon
            
            is_trade = False
            
            # 1. Hard Block (The "Exclude 10,25" logic)
            # MQL5: if (g_date > 0 && m_excluded_days[g_date]) return;
            if g_date in EXCLUDE_DAYS:
                is_trade = False # Blocked
            else:
                # 2. Gotobi Trigger
                if g_date in ENABLE_GOTOBI:
                    is_trade = True
                
                # 3. Monday Trigger
                if wd == 0:
                    # Is it a "Bad Monday" (10th/25th)?
                    # MQL5 v2.21 only blocks if g_date is 10/25.
                    # Does this cover "Calendar 10th/25th"?
                    # If Today is Monday 10th -> g_date=10. Blocked? Yes.
                    # If Today is Monday 25th -> g_date=25. Blocked? Yes.
                    # So checking g_date covers it.
                    is_trade = True

            if is_trade:
                results.append({
                    'Date': date,
                    'Year': date.year,
                    'Type': 'Gotobi' if g_date in ENABLE_GOTOBI else 'MondayOnly',
                    'Pips': pips
                })
                
        except Exception as e:
            continue

    res_df = pd.DataFrame(results)
    
    if res_df.empty:
        print("No trades found.")
        return

    print("\n=== All Trades (v2.21) ===")
    print(f"Total: {len(res_df)}")
    print(f"Sum: {res_df['Pips'].sum():.1f}")
    
    years = res_df['Year'].unique()
    years.sort()
    
    print("\n=== Yearly Breakdown ===")
    for y in years:
        ydf = res_df[res_df['Year'] == y]
        total_pips = ydf['Pips'].sum()
        trades = len(ydf)
        win_pips = ydf[ydf['Pips'] > 0]['Pips'].sum()
        loss_pips = abs(ydf[ydf['Pips'] < 0]['Pips'].sum())
        pf = win_pips / loss_pips if loss_pips > 0 else 999
        
        print(f"Year {y}: Trades={trades}, Pips={total_pips:.1f}, PF={pf:.2f}")

    print("\n=== Type Breakdown (All Years) ===")
    for t in res_df['Type'].unique():
        tdf = res_df[res_df['Type'] == t]
        total = tdf['Pips'].sum()
        win = tdf[tdf['Pips'] > 0]['Pips'].sum()
        loss = abs(tdf[tdf['Pips'] < 0]['Pips'].sum())
        pf = win / loss if loss > 0 else 999
        print(f"Type {t}: Trades={len(tdf)}, Pips={total:.1f}, PF={pf:.2f}")
    
    print("\n=== Type Breakdown (2025 Only) ===")
    df_2025 = res_df[res_df['Year'] == 2025]
    if not df_2025.empty:
        for t in df_2025['Type'].unique():
            tdf = df_2025[df_2025['Type'] == t]
            total = tdf['Pips'].sum()
            win = tdf[tdf['Pips'] > 0]['Pips'].sum()
            loss = abs(tdf[tdf['Pips'] < 0]['Pips'].sum())
            pf = win / loss if loss > 0 else 999
            print(f"Type {t} (2025): Trades={len(tdf)}, Pips={total:.1f}, PF={pf:.2f}")

def analyze_spreads(df):
    spreads = [0.4, 1.0, 1.5]
    for s in spreads:
        print(f"\n====== SPREAD: {s} pips ======")
        global SPREAD_PIPS
        SPREAD_PIPS = s
        analyze_v2_21(df)

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    analyze_spreads(df)
