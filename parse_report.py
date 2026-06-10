
import sys
import re
from bs4 import BeautifulSoup

def parse_trades(file_path):
    try:
        with open(file_path, 'r', encoding='utf-16') as f:
            content = f.read()
    except UnicodeError:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            print("Error reading file")
            return

    soup = BeautifulSoup(content, 'html.parser')
    
    # 1. Summary Metrics Extraction
    print("--- Summary Metrics ---")
    tds = soup.find_all(['td', 'th', 'div'])
    target_labels = {
        'Total Net Profit': ['総損益', 'Total Net Profit'],
        'Profit Factor': ['プロフィットファクタ', 'Profit Factor'],
        'Max Drawdown': ['最大ドローダウン', 'Max Drawdown'],
        'Total Trades': ['総取引数', 'Total Trades']
    }
    
    for label, patterns in target_labels.items():
        found_val = "Not Found"
        for i, td in enumerate(tds):
            text = td.get_text(strip=True)
            if any(p in text for p in patterns):
                # Try next few cells
                for j in range(1, 4):
                    if i + j < len(tds):
                        val = tds[i+j].get_text(strip=True)
                        if val and val != ":":
                            found_val = val
                            break
                if found_val != "Not Found": break
        print(f"{label}: {found_val}")
        
    trade_data = []
    rows = soup.find_all('tr')
    
    print(f"Total Rows found: {len(rows)}")
    
    trade_table_started = False
    header_found = False
    
    for row in rows:
        cols = row.find_all(['td', 'th'])
        if not cols: continue
        
        vals = [c.get_text(strip=True) for c in cols]
        
        # Look for header
        # English: Time, Deal, Symbol...
        # Japanese: 時間, トレード, 銘柄...
        if not header_found:
            # Check if this row looks like a header
            if "Time" in vals or "時間" in vals:
                 if "Profit" in vals or "損益" in vals:
                     header_found = True
                     print(f"Header found: {vals}")
                     continue
        
        if not header_found: continue
        
        if len(vals) < 10: continue # Trade rows are usually long
        
        # Debug: Print first 5 identified trade rows
        if len(trade_data) < 5:
             print(f"Trade Row {len(trade_data)}: {vals}")

        # Check Date format
        # YYYY.MM.DD HH:MM:SS
        if not re.match(r'\d{4}\.\d{2}\.\d{2}', vals[0]):
            continue

        # Profit is usually last. 
        # In Japanese report: ['2025.10.31', '43', 'USDJPY#', 'sell', 'out', '0.01', ..., '-65', '48 335']
        # The last one is Balance, second to last is Profit.
        try:
            # Try second to last first (Profit)
            profit_str = vals[-2].replace(' ', '')
            
            # If valid number (allowing for negative)
            if re.match(r'^[\-\d\.]+$', profit_str):
                profit = float(profit_str)
                date = vals[0]
                trade_data.append((date, profit))
                continue
                
            # Try last (maybe structure is different)
            profit_str = vals[-1].replace(' ', '')
            if re.match(r'^[\-\d\.]+$', profit_str):
                profit = float(profit_str)
                date = vals[0]
                trade_data.append((date, profit))

        except:
            pass

    if not trade_data:
        print("No trades extracted. Dumping first 5 rows for inspection:")
        for row in rows[:5]:
             print([c.get_text(strip=True) for c in row.find_all('td')])
        return

    # Analyze
    yearly_pnl = {}
    total_pnl = 0.0
    for date, profit in trade_data:
        year = date.split('.')[0]
        yearly_pnl[year] = yearly_pnl.get(year, 0.0) + profit
        total_pnl += profit
        
    print(f"\nTotal Identified PnL: {total_pnl:.2f}")
    
    print("\nYearly PnL Breakdown:")
    # Sort by year
    sorted_years = sorted(yearly_pnl.keys())
    for year in sorted_years:
        print(f"{year}: {yearly_pnl[year]:.2f}")

    print("\nTrades per Year:")
    yearly_count = {}
    for date, profit in trade_data:
        year = date.split('.')[0]
        yearly_count[year] = yearly_count.get(year, 0) + 1
    for year in sorted_years:
        print(f"{year}: {yearly_count[year]}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        parse_trades(sys.argv[1])
