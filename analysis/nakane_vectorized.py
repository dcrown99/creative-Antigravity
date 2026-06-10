import pandas as pd
from backtesting import Backtest, Strategy
import numpy as np
import datetime

DATA_FILE = 'data/USDJPY_M1.csv'
INITIAL_CASH = 10000
COMMISSION = 0.0003

class NakaneVectorized(Strategy):
    entry_hour = 2
    entry_minute = 0
    fix_minute = 54
    sl_pips = 15
    tp_pips = 30
    
    def init(self):
        pass # Logic moved to next() for simplicity in backtesting.py optimization context
        
    def next(self):
        t_hour = self.data.index[-1].hour
        t_minute = self.data.index[-1].minute
        
        # Entry (Long)
        if t_hour == self.entry_hour and t_minute == self.entry_minute:
            if not self.position:
                self.buy(sl=self.data.Close[-1] - self.sl_pips*0.01, tp=self.data.Close[-1] + self.tp_pips*0.01)
        
        # Exit Long / Entry Short (Fix)
        elif t_hour == self.entry_hour and t_minute == self.fix_minute:
            if self.position.is_long:
                self.position.close()
            # Sell
            self.sell(sl=self.data.Close[-1] + self.sl_pips*0.01, tp=self.data.Close[-1] - self.tp_pips*0.01)
            
        # Exit Short (Fix + 30m approx)
        elif t_hour == (self.entry_hour + 1) and t_minute == 30: 
             if self.position.is_short:
                 self.position.close()

def load_data(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    df = df.set_index('Datetime')
    df = df.rename(columns={'Vol': 'Volume'})
    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
    df = df[~df.index.duplicated(keep='first')]
    return df

if __name__ == '__main__':
    data = load_data(DATA_FILE)
    
    # Slice 2025 for speed
    data = data.loc['2025-01-01':]
    print(f"Optimizing on {len(data)} bars (2025)...")
    
    bt = Backtest(data, NakaneVectorized, cash=INITIAL_CASH, commission=COMMISSION)
    
    stats, heatmap = bt.optimize(
        entry_hour=[0, 1, 2, 3],
        entry_minute=[0, 15, 30, 45],
        fix_minute=[50, 54, 55],
        sl_pips=[10, 15, 20],
        maximize='Profit Factor',
        return_heatmap=True
    )
    
    print(stats)
    print("\nBest Params:")
    print(stats._strategy)
    heatmap.to_csv("analysis/heatmap_2025.csv")
