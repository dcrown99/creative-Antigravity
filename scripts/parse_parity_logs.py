
import os
import re
import pandas as pd
from io import StringIO

log_dir = r"C:\Users\koume\AppData\Roaming\MetaQuotes\Terminal\C4171FD2B38378D6406D5C84412B5F20\Tester\Logs"

# Get the latest log file
log_files = [os.path.join(log_dir, f) for f in os.listdir(log_dir) if f.endswith('.log')]
if not log_files:
    print("No log files found.")
    exit()

latest_log = max(log_files, key=os.path.getmtime)
print(f"Parsing log: {latest_log}")

parity_data = []

with open(latest_log, 'r', encoding='utf-16le', errors='ignore') as f:
    for line in f:
        if "PARITY_DEBUG" in line:
            # Extract the payload part
            # e.g. 2026.03.03 14:38:00.123 Core 1  2025.01.01 00:00:00   PARITY_DEBUG|2024.12.31 23:00|O:...
            parts = line.split("PARITY_DEBUG|")
            if len(parts) > 1:
                data_string = parts[1].strip()
                # Split by |
                fields = data_string.split('|')
                
                row = {}
                row['Time'] = fields[0]
                
                for field in fields[1:]:
                    k, v = field.split(':')
                    row[k] = float(v)
                    
                parity_data.append(row)

if not parity_data:
    print("No PARITY_DEBUG lines found in the log.")
    exit()

df = pd.DataFrame(parity_data)

# Save to CSV
output_csv = r"C:\Users\koume\Downloads\code\mt5_parity_data.csv"
df.to_csv(output_csv, index=False)
print(f"Saved {len(df)} rows to {output_csv}")
print("--- Sample Data ---")
print(df.head(10).to_string())

