from bs4 import BeautifulSoup
import pandas as pd
import sys

FILE_PATH = r"c:\Users\koume\Downloads\code\mt5\backtest_results\ReportTester-72377205.html"

# Universal Reader
content = ""
encodings = ["utf-16", "cp932", "utf-8"]
for enc in encodings:
    try:
        print(f"Trying encoding: {enc}...")
        with open(FILE_PATH, "r", encoding=enc) as f:
            content = f.read()
        print(f"Success with {enc}")
        break
    except UnicodeError:
        print(f"Failed with {enc}")
        continue
    except Exception as e:
        print(f"Error reading file with {enc}: {e}")
        continue

if not content:
    print("Could not read file with any encoding.")
    sys.exit(1)

soup = BeautifulSoup(content, 'html.parser')

tables = soup.find_all('table')
if not tables:
    print("No tables found.")
    sys.exit(0)

print(f"Found {len(tables)} tables.")
summary_table = tables[0]
rows = summary_table.find_all('tr')

print("\n--- Summary Table Data ---")
for row in rows:
    cols = row.find_all(['td', 'th'])
    for col in cols:
        text = col.get_text(strip=True)
        
        # Check for Value in next sibling
        val = "?"
        sibling = col.find_next_sibling()
        if sibling:
            val = sibling.get_text(strip=True)

        # Keywords
        keywords = [
            "Total Net Profit", "Profit Factor", "Drawdown", "Total Trades", 
            "Expected Payoff", "Sharpe Ratio", "Recovery Factor",
            "総損益", "プロフィットファクター", "最大ドローダウン", "取引数", 
            "期待利得", "シャープレシオ", "リカバリファクター"
        ]
        
        for k in keywords:
            if k in text:
                print(f"{k}: {val}")

# Try to find year-by-year data if available (Graph?)
# MT5 reports don't usually have a yearly table unless custom made.
# But we can inspect the first few lines of text to confirm Header info.
print("\n--- Header Info ---")
text_content = soup.get_text()
lines = [line.strip() for line in text_content.splitlines() if line.strip()]
for i, line in enumerate(lines[:20]):
    print(f"{i}: {line}")
