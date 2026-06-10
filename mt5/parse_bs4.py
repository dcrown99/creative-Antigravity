from bs4 import BeautifulSoup
import sys
import codecs

with open(sys.argv[1], 'rb') as f:
    clean_data = f.read().replace(b'\x00', b'').decode('utf-8', errors='ignore')

soup = BeautifulSoup(clean_data, 'html.parser')

opt_results = {}
fwd_results = {}

for ws in soup.find_all('worksheet'):
    ws_name = ws.get('ss:name')
    
    table = ws.find('table')
    if not table: continue
    
    for row in table.find_all('row'):
        cells = row.find_all('cell')
        if len(cells) < 10: continue
        
        try:
            p_id = cells[0].text.strip()
            if p_id == 'Pass': continue
            
            profit = float(cells[1].text.strip())
            trades = int(cells[2].text.strip())
            pf = float(cells[3].text.strip())
            dd = float(cells[5].text.strip())
            
            inputs = [c.text.strip() for c in cells[9:] if '=' in c.text]
            
            data = {
                'Profit': profit, 'Trades': trades, 'PF': pf, 'DD': dd,
                'Inputs': ", ".join(inputs)
            }
            if ws_name == 'Optimization':
                opt_results[p_id] = data
            elif ws_name == 'Forward':
                fwd_results[p_id] = data
        except Exception:
            pass

print(f"{'Pass':<5} | {'[Backtest] Profit / PF / DD':<30} | {'[Forward] Profit / PF / DD':<30} | {'Inputs'}")
print("-" * 140)

combined = []
for p_id, opt in opt_results.items():
    if p_id in fwd_results:
        fwd = fwd_results[p_id]
        combined.append({
            'Pass': p_id,
            'Opt_Profit': opt['Profit'], 'Opt_PF': opt['PF'], 'Opt_DD': opt['DD'],
            'Fwd_Profit': fwd['Profit'], 'Fwd_PF': fwd['PF'], 'Fwd_DD': fwd['DD'],
            'Inputs': opt['Inputs']
        })

combined.sort(key=lambda x: x['Fwd_Profit'], reverse=True)

for r in combined[:20]:
    b_stats = f"{r['Opt_Profit']:<8.0f} / {r['Opt_PF']:<4.2f} / {r['Opt_DD']:<5.1f}%"
    f_stats = f"{r['Fwd_Profit']:<8.0f} / {r['Fwd_PF']:<4.2f} / {r['Fwd_DD']:<5.1f}%"
    print(f"{r['Pass']:<5} | {b_stats:<30} | {f_stats:<30} | {r['Inputs']}")

