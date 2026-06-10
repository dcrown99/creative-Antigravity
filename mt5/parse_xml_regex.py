import re
import sys

# Read removing NULL bytes that interfere with some string decoding
with open(sys.argv[1], 'rb') as f:
    raw_data = f.read()
    
# Clean null bytes (if utf-16le was written wrongly or if it's utf-8 with garbage)
clean_data = raw_data.replace(b'\x00', b'').decode('utf-8', errors='ignore')

# We can regex parse the <Row> directly since we only care about Profit and Inputs
rows = re.findall(r'<Row>(.*?)</Row>', clean_data, re.DOTALL)

results = []
for row in rows:
    cells = re.findall(r'<Data.*?>(.*?)</Data>', row)
    if len(cells) >= 10 and cells[0] != 'Pass':
        try:
            profit = float(cells[1])
            trades = int(cells[2])
            pf = float(cells[3])
            dd = float(cells[5])
            inputs = [c for c in cells[9:] if '=' in c]
            
            # Since we ran Forward testing, we want to look at Forward results 
            # MT5 optimization outputs the OOS results as well.
            results.append({
                'Profit': profit,
                'Trades': trades,
                'PF': pf,
                'DD': dd,
                'Inputs': ", ".join(inputs)
            })
        except:
            pass

# Sort by Profit (Descending)
results.sort(key=lambda x: x['Profit'], reverse=True)

print(f"{'Profit':<10} | {'Trades':<8} | {'PF':<6} | {'DD%':<6} | {'Inputs'}")
print("-" * 120)
for r in results[:20]:
    print(f"{r['Profit']:<10} | {r['Trades']:<8} | {r['PF']:<6.2f} | {r['DD']:<6.2f} | {r['Inputs']}")

