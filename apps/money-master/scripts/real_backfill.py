
import sqlite3
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import json
import uuid

DB_PATH = r"C:\Users\koume\Downloads\code\apps\money-master\data\money-master.db"

def get_assets():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT ticker, type, currency, quantity, currentPrice, balance FROM Asset WHERE isArchived = 0 AND quantity > 0")
    assets = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return assets

def fetch_historical_prices(tickers, start_date, end_date):
    print(f"Fetching historical data for {len(tickers)} tickers from {start_date} to {end_date}...")
    # Add USDJPY
    all_tickers = list(set(tickers)) + ["USDJPY=X"]
    data = yf.download(all_tickers, start=start_date, end=end_date, interval="1d")["Close"]
    return data

def main():
    assets = get_assets()
    tickers = [a['ticker'] for a in assets if a['ticker'] and not a['type'] == 'TRUST']
    # Filter out TRUST numeric codes for yfinance (usually 8 digits)
    yf_tickers = [t for t in tickers if not (t.isdigit() and len(t) == 8)]
    
    start_date = "2024-12-01" # Fetch a bit more for safety
    end_date = "2025-12-19"
    
    hist_data = fetch_historical_prices(yf_tickers, start_date, end_date)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    dates_to_fill = pd.date_range(start="2025-12-01", end="2025-12-17")
    
    for dt in dates_to_fill:
        date_str = dt.strftime('%Y-%m-%d')
        print(f"Processing {date_str}...")
        
        # Get USDJPY for this date
        try:
            # Find the closest date in hist_data or use reindex/ffill
            # Actually ffill is better for weekends
            usd_jpy = hist_data.loc[:date_str, "USDJPY=X"].iloc[-1]
        except:
            usd_jpy = 150.0 # Fallback
            
        daily_total_value = 0
        
        for asset in assets:
            ticker = asset['ticker']
            quantity = float(asset['quantity'] or 0)
            price = 0
            
            if asset['type'] in ['bank', 'cash']:
                price = float(asset['balance'] or 0)
                daily_total_value += price
                continue

            # Try to get historical price
            if ticker in hist_data.columns:
                try:
                    price = hist_data.loc[:date_str, ticker].iloc[-1]
                except:
                    price = None
            
            # Fallback to currentPrice if historical fails or not available
            if price is None or pd.isna(price) or price == 0:
                price = float(asset['currentPrice'] or 0)
            
            # Application Logic
            value = 0
            if asset['type'] == 'TRUST':
                # TRUST usually price is per 10,000 units
                value = (price * quantity) / 10000
            else:
                value = price * quantity
                
            if asset['currency'] == 'USD':
                value *= usd_jpy
                
            daily_total_value += value
            
        print(f"  Total Value: {daily_total_value}")
        
        # Update DB
        # We assume totalCost and totalPL are relatively flat or calculated from value
        # For simplicity, we keep totalCost same as 11/30 (approximated)
        cursor.execute("SELECT totalCost FROM HistoryEntry WHERE date = '2025-11-30'")
        cost_row = cursor.fetchone()
        total_cost = cost_row[0] if cost_row else 5475338.21
        total_pl = daily_total_value - total_cost
        
        cursor.execute("""
            INSERT INTO HistoryEntry (id, date, totalValue, totalCost, totalPL, data)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                totalValue=excluded.totalValue,
                totalPL=excluded.totalPL
        """, (str(uuid.uuid4()), date_str, daily_total_value, total_cost, total_pl, None))

    conn.commit()
    conn.close()
    print("Backfill completed successfully.")

if __name__ == "__main__":
    main()
