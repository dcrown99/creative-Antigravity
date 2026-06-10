
import xml.etree.ElementTree as ET
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def analyze_robustness(xml_path):
    ns = {'ss': 'urn:schemas-microsoft-com:office:spreadsheet'}
    tree = ET.parse(xml_path)
    root = tree.getroot()
    worksheet = root.find('ss:Worksheet', ns)
    table = worksheet.find('ss:Table', ns)
    
    data = []
    headers = []
    for i, row in enumerate(table.findall('ss:Row', ns)):
        row_data = []
        for cell in row.findall('ss:Cell', ns):
            data_cell = cell.find('ss:Data', ns)
            val = data_cell.text if data_cell is not None else ""
            row_data.append(val)
            
        if i == 0:
            headers = row_data
        else:
            if len(row_data) == len(headers):
                data.append(row_data)

    df = pd.DataFrame(data, columns=headers)
    
    # Convert numeric columns
    numeric_cols = ['Result', 'Profit', 'Trades', 'Profit Factor', 'Expected Payoff', 'Equity DD %']
    param_cols = [c for c in headers if c.startswith('Inp')]
    for col in numeric_cols + param_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Filter logical passes
    valid_df = df[(df['Trades'] >= 15) & (df['Profit Factor'] > 1.0)].copy()
    
    if len(valid_df) == 0:
        print("No robust passes found with Trades >= 15 and PF > 1.0.")
        return

    # Correlation Matrix of parameters vs Profit Factor
    corr_cols = param_cols + ['Profit Factor', 'Trades', 'Profit']
    corr_matrix = valid_df[corr_cols].corr()
    
    # Identify the best pass
    valid_df['Score'] = (valid_df['Profit Factor'] * 0.5) + (valid_df['Trades'] * 0.05) - (valid_df['Equity DD %'] * 0.1)
    best_pass = valid_df.loc[valid_df['Score'].idxmax()]
    
    print("=== Robustness Analysis: Parameter Landscape ===\n")
    print(f"Total Passes Analyzed: {len(df)}")
    print(f"Valid Passes (Trades>=15, PF>1.0): {len(valid_df)}")
    
    print("\n[Best Pass Parameters]")
    for p in param_cols:
        print(f"  {p}: {best_pass[p]}")
    print(f"  Profit Factor: {best_pass['Profit Factor']}, Trades: {best_pass['Trades']}, Max DD%: {best_pass['Equity DD %']}")
    
    # Neighbor Analysis for the best parameters
    # How much does PF drop if we change ADX Threshold or Min Pullback slightly?
    print("\n[Parameter Sensitivity (Neighbor Analysis)]")
    
    if 'InpAdxThreshold' in param_cols:
        best_adx = best_pass['InpAdxThreshold']
        neighbors = valid_df[(valid_df['InpAdxThreshold'] >= best_adx - 10) & 
                             (valid_df['InpAdxThreshold'] <= best_adx + 10)]
        
        adx_summary = neighbors.groupby('InpAdxThreshold')['Profit Factor'].mean().reset_index()
        print(adx_summary.to_string(index=False))
        print("\nConclusion: If neighboring ADX values show drastically lower PFs, the ADX threshold is curve-fitted.")

    if 'InpMinPbAtr' in param_cols:
        best_pb = best_pass['InpMinPbAtr']
        neighbors_pb = valid_df[(valid_df['InpMinPbAtr'] >= best_pb - 0.5) & 
                                (valid_df['InpMinPbAtr'] <= best_pb + 0.5)]
        pb_summary = neighbors_pb.groupby('InpMinPbAtr')['Profit Factor'].mean().reset_index()
        print("\nMin Pullback ATR Stability:")
        print(pb_summary.to_string(index=False))

    print("\n================================================")
    
if __name__ == "__main__":
    import glob
    import os
    
    # Find the newest XML
    folder = r"C:\Users\koume\Downloads\code\mt5\backtest_results"
    list_of_files = glob.glob(f"{folder}\\TrendScanner_EA_opt_*.xml")
    if not list_of_files:
        print("No optimization XMLs found!")
    else:
        latest_file = max(list_of_files, key=os.path.getmtime)
        print(f"Loading {latest_file}...")
        analyze_robustness(latest_file)

