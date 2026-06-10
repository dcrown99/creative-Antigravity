import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import datetime

DATA_FILE = 'data/USDJPY_M1.csv'
COST_PER_TRADE = 2.0 # Conservative: 2 pips per trade (Spread + Comm)

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

def run_winner(df):
    # Config: Gotobi, Entry 9:00, Fix 9:54
    entry_hour = 9
    entry_minute = 0
    fix_minute = 54
    
    valid_days = [5, 10, 15, 20, 25, 30]
    day_mask = df['Day'].isin(valid_days)
    
    # 1. Long (9:00 -> 9:54)
    entry_mask = (df.index.hour == entry_hour) & (df.index.minute == entry_minute) & day_mask
    entries = df.loc[entry_mask].copy()
    entries['DateStr'] = entries.index.date
    
    fix_mask = (df.index.hour == entry_hour) & (df.index.minute == fix_minute) & day_mask
    fixes = df.loc[fix_mask].copy()
    fixes['DateStr'] = fixes.index.date
    
    merged_long = pd.merge(entries[['Close', 'DateStr']], fixes[['Close', 'DateStr']], on='DateStr', suffixes=('_entry', '_exit'))
    merged_long['Pips'] = (merged_long['Close_exit'] - merged_long['Close_entry']) * 100
    merged_long['NetPips'] = merged_long['Pips'] - COST_PER_TRADE
    merged_long['Type'] = 'Long'
    
    # 2. Short (9:54 -> 10:25 approx?)
    # Previous opt used Fix+30m = 10:24
    close_minute = (fix_minute + 30) % 60
    close_hour = entry_hour + ((fix_minute + 30) // 60)
    
    close_mask = (df.index.hour == close_hour) & (df.index.minute == close_minute) & day_mask
    closes = df.loc[close_mask].copy()
    closes['DateStr'] = closes.index.date
    
    merged_short = pd.merge(fixes[['Close', 'DateStr']], closes[['Close', 'DateStr']], on='DateStr', suffixes=('_entry', '_exit'))
    merged_short['Pips'] = (merged_short['Close_entry'] - merged_short['Close_exit']) * 100
    merged_short['NetPips'] = merged_short['Pips'] - COST_PER_TRADE
    merged_short['Type'] = 'Short'
    
    # Combine
    trades = pd.concat([merged_long, merged_short])
    # Sort by Date? They are same day. Long comes before Short.
    # We can infer order or just sum per day.
    
    # Let's plot cumulative pips
    # Need to interleave long/short correctly for specific chart?
    # Or just sum.
    
    # Sort by Date
    trades['DateTime'] = pd.to_datetime(trades['DateStr'])
    trades = trades.sort_values('DateTime')
    
    trades['Cumulative'] = trades['NetPips'].cumsum()
    trades['Peak'] = trades['Cumulative'].cummax()
    trades['Drawdown'] = trades['Cumulative'] - trades['Peak']
    max_dd = trades['Drawdown'].min()
    
    print("=== Validation Results ===")
    print(f"Strategy: Gotobi 9:00 -> 9:54 JST")
    print(f"Cost: {COST_PER_TRADE} pips")
    print(f"Total Trades: {len(trades)}")
    print(f"Net Pips: {trades['NetPips'].sum():.1f}")
    print(f"Win Rate: {(trades['NetPips'] > 0).mean()*100:.1f}%")
    profit = trades[trades['NetPips'] > 0]['NetPips'].sum()
    loss = abs(trades[trades['NetPips'] < 0]['NetPips'].sum())
    pf = profit / loss if loss > 0 else 999
    print(f"Profit Factor: {pf:.2f}")
    print(f"Max Drawdown: {max_dd:.1f} pips")
    
    print("\n=== Year-over-Year Analysis ===")
    trades['Year'] = trades['DateTime'].dt.year
    years = trades['Year'].unique()
    for y in years:
        y_trades = trades[trades['Year'] == y]
        net = y_trades['NetPips'].sum()
        count = len(y_trades)
        y_profit = y_trades[y_trades['NetPips'] > 0]['NetPips'].sum()
        y_loss = abs(y_trades[y_trades['NetPips'] < 0]['NetPips'].sum())
        y_pf = y_profit / y_loss if y_loss > 0 else 999
        print(f"{y}: {net:6.1f} pips (PF: {y_pf:.2f}, Trades: {count})")

    # Plot
    plt.figure(figsize=(10, 6))
    plt.plot(trades['DateTime'], trades['Cumulative'])
    plt.title(f"Nakane (Gotobi) Equity Curve (Cost={COST_PER_TRADE} pips)\nPF: {pf:.2f}, Net: {trades['NetPips'].sum():.0f} pips, DD: {max_dd:.0f}")
    plt.grid(True)
    plt.ylabel("Pips")
    plt.savefig('nakane_gotobi_final.png')
    print("Saved chart to nakane_gotobi_final.png")

if __name__ == '__main__':
    df = load_data_jst(DATA_FILE)
    run_winner(df)
