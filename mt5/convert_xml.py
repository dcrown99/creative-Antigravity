import sys
import win32com.client as win32
import os

xml_file = os.path.abspath(sys.argv[1])
csv_file = xml_file.replace('.xml', '.csv')

print(f"Converting {xml_file} to CSV...", flush=True)

try:
    excel = win32.gencache.EnsureDispatch('Excel.Application')
    excel.DisplayAlerts = False
    excel.Visible = False
    
    wb = excel.Workbooks.Open(xml_file)
    wb.SaveAs(csv_file, FileFormat=6) # 6 = csv
    wb.Close()
    excel.Quit()
    print(f"Saved: {csv_file}")
    
    import pandas as pd
    df = pd.read_csv(csv_file)
    print(df.sort_values(by="Profit", ascending=False).head(15).to_string())
    
except Exception as e:
    print(f"Excel COM error: {e}")
