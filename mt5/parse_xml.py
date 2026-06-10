import xml.etree.ElementTree as ET
import sys
import codecs
import re

with open(sys.argv[1], 'r', encoding='utf-16le') as f:
    content = f.read()

# MT5 XML header fix for standard python xml parser
content = re.sub(r'<\?xml.*?\?>', '', content)
content = re.sub(r'<([a-zA-Z0-9]+):([a-zA-Z0-9]+)', r'<\2', content)
content = re.sub(r'</([a-zA-Z0-9]+):([a-zA-Z0-9]+)', r'</\2', content)
content = '<root>' + content + '</root>'

try:
    root = ET.fromstring(content)
except Exception as e:
    print(f"XML Parse error: {e}")
    sys.exit(1)

print(f"{'Pass':<5} | {'Profit':<10} | {'Trades':<8} | {'PF':<6} | {'DD%':<6} | {'Inputs'}")
print("-" * 100)

for ws in root.findall('.//Worksheet'):
    if ws.attrib.get('Name') == 'Optimization':
        table = ws.find('Table')
        rows = table.findall('Row')
        for i, row in enumerate(rows):
            if i == 0: continue # Header
            cells = row.findall('Cell/Data')
            if len(cells) < 10: continue
            
            p_pass = cells[0].text
            p_profit = cells[1].text
            p_trades = cells[2].text
            p_pf = cells[3].text
            p_dd = cells[5].text
            
            inputs = []
            for cell in cells[9:]:
                if cell.text and '=' in cell.text:
                    inputs.append(cell.text)
                    
            p_inputs = ", ".join(inputs)
            
            print(f"{p_pass:<5} | {p_profit:<10} | {p_trades:<8} | {p_pf:<6} | {p_dd:<6} | {p_inputs}")
