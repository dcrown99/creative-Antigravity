import pandas as pd
from datetime import datetime, timedelta

DATA_FILE = 'data/USDJPY_M1.csv'
OFFSET_HOURS = 7

def debug_data():
    print(f"Loading {DATA_FILE}...")
    df = pd.read_csv(DATA_FILE)
    print("Available Columns:", df.columns)
    print("Head:\n", df.head())
    
    # Check Time Parsing
    try:
        df['Time'] = pd.to_datetime(df['Time'])
        print("\nTime Parsed Successfully.")
        print("Time range:", df['Time'].min(), "to", df['Time'].max())
    except Exception as e:
        print("\nTime Parsing Failed:", e)
        return

    # Check JST Shift
    df.set_index('Time', inplace=True)
    df.index = df.index + timedelta(hours=OFFSET_HOURS)
    print("\nJST Shift Applied.")
    print("New Head Index:\n", df.index[:5])
    
    # Check target times (09:55)
    target_entries = df.between_time('09:55', '09:55')
    print(f"\nEntries found at 09:55: {len(target_entries)}")
    if not target_entries.empty:
        print(target_entries.head())
        
    # Check simple Gotobi logic (naive)
    print("\nChecking Gotobi Logic (Day % 5 == 0)...")
    gotobi_entries = target_entries[target_entries.index.day % 5 == 0]
    print(f"Entries on 5, 10, 15...: {len(gotobi_entries)}")

if __name__ == "__main__":
    debug_data()
