import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# --- Configuration ---
DATA_FILE = 'data/USDJPY_M1.csv'  # Path to your MT5 exported CSV
SPREAD_PIPS = 1.0     # Cost per trade (Spread)
OFFSET_HOURS = 7      # MT5 Server Time + OFFSET = JST (e.g., Winter GMT+2 + 7 = JST GMT+9)

# --- Data Loading ---
def load_data(filepath):
    """
    Load MT5 CSV Data.
    Expected format: ISO Time or standard MT5 export format.
    """
    # Adjust column names to match your CSV
    df = pd.read_csv(filepath, parse_dates=['Time'], index_col='Time')
    
    # Validation
    if df.empty:
        raise ValueError("CSV is empty or could not be read.")
    
    return df

# --- Strategy Logic ---
def run_analysis(df):
    """
    Implement your strategy logic here.
    Example: Time-based entry (Nakane style)
    """
    print("Running Analysis...")
    
    # Example: Simple Time-based Logic
    # 1. Convert index to JST for easier logic
    df_jst = df.copy()
    df_jst.index = df_jst.index + timedelta(hours=OFFSET_HOURS)
    
    # 2. Filter Targets
    # e.g., Sell at 09:55 JST
    entry_mask = (df_jst.index.hour == 9) & (df_jst.index.minute == 55)
    exit_mask  = (df_jst.index.hour == 10) & (df_jst.index.minute == 25)
    
    entries = df_jst.loc[entry_mask]
    exits   = df_jst.loc[exit_mask]
    
    # 3. Match Entry/Exit pairs (simplified)
    # Note: In real backtesting, use `backtesting.py` or event-loop for accuracy.
    # This is a vectorized approximation.
    
    common_dates = entries.index.date
    results = []
    
    for date in common_dates:
        try:
            entry_price = entries.loc[entries.index.date == date]['Close'].iloc[0]
            exit_price  = exits.loc[exits.index.date == date]['Close'].iloc[0]
            
            # Short Logic: Entry - Exit
            pips = (entry_price - exit_price) * 100 - SPREAD_PIPS
            results.append(pips)
        except IndexError:
            continue
            
    # 4. Report
    total_pips = sum(results)
    win_rate = len([p for p in results if p > 0]) / len(results) * 100 if results else 0
    pf = sum([p for p in results if p > 0]) / abs(sum([p for p in results if p < 0])) if any(r < 0 for r in results) else float('inf')
    
    print(f"Total Trades: {len(results)}")
    print(f"Total Pips: {total_pips:.1f}")
    print(f"Win Rate: {win_rate:.1f}%")
    print(f"Profit Factor: {pf:.2f}")

if __name__ == "__main__":
    df = load_data(DATA_FILE)
    run_analysis(df)
