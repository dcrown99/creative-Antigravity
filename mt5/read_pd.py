import pandas as pd
import sys

try:
    df = pd.read_html(sys.argv[1])[0]
    print(df.head(20).to_string())
except Exception as e:
    print(f"Failed to read with read_html: {e}")
    try:
        # Sometimes it's just a TSV with XML extension if saved from MT5
        df = pd.read_csv(sys.argv[1], sep='\t', encoding='utf-16le')
        print(df.head(20).to_string())
    except Exception as e2:
        print(f"Failed to read with read_csv: {e2}")
        
