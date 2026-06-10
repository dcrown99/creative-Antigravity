import re
import sys

# Read ignoring nulls
with open(sys.argv[1], 'rb') as f:
    clean_data = f.read().replace(b'\x00', b'').decode('utf-8', errors='ignore')

# Split by Worksheet
worksheets = clean_data.split('<Worksheet')
opt_ws = ""
fwd_ws = ""

for ws in worksheets:
    if 'Name="Optimization"' in ws:
        opt_ws = ws
    elif 'Name="Forward"' in ws:
        fwd_ws = ws

def parse_ws(ws_data):
    results = {}
    rows = re.findall(r'<Row>(.*?)</Row>', ws_data, re.DOTALL)
    for row in rows:
        cells = re.findall(r'<Data.*?>(.*?)</Data>', row, re.DOTALL)
        if len(cells) >= 10 and cells[0].strip() != 'Pass':
            try:
                pass_id = cells[0].strip()
                profit = float(cells[1].strip())
                trades = int(cells[2].strip())
                pf = float(cells[3].strip())
                dd = float(cells[5].strip())
                inputs = [c.strip() for c in cells[9:] if '=' in c.strip()]
                
                results[pass_id] = {
                    'Profit': profit,
                    'Trades': trades,
                    'PF': pf,
                    'DD': dd,
                    'Inputs': ", ".join(inputs)
                }
            except Exception as e:
                pass
    return results

opt_results = parse_ws(opt_ws)
fwd_results = parse_ws(fwd_ws)

print(f"{'Pass':<5} | {'[Backtest] Profit / PF / DD':<30} | {'[Forward] Profit / PF / DD':<30} | {'Inputs'}")
print("-" * 140)

# Join on Pass ID
combined = []
for p_id, opt in opt_results.items():
    if p_id in fwd_results:
        fwd = fwd_results[p_id]
        combined.append({
            'Pass': p_id,
            'Opt_Profit': opt['Profit'],
            'Opt_PF': opt['PF'],
            'Opt_DD': opt['DD'],
            'Fwd_Profit': fwd['Profit'],
            'Fwd_PF': fwd['PF'],
            'Fwd_DD': fwd['DD'],
            'Inputs': opt['Inputs']
        })

# Sort by Forward Profit
combined.sort(key=lambda x: x['Fwd_Profit'], reverse=True)

for r in combined[:20]:
    b_stats = f"{r['Opt_Profit']:<8.0f} / {r['Opt_PF']:<4.2f} / {r['Opt_DD']:<5.1f}%"
    f_stats = f"{r['Fwd_Profit']:<8.0f} / {r['Fwd_PF']:<4.2f} / {r['Fwd_DD']:<5.1f}%"
    print(f"{r['Pass']:<5} | {b_stats:<30} | {f_stats:<30} | {r['Inputs']}")

