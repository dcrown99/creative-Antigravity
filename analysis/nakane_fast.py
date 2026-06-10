import pandas as pd
from backtesting import Backtest, Strategy
import datetime

DATA_FILE = 'data/USDJPY_M1.csv'
INITIAL_CASH = 10000
COMMISSION = 0.0003 # ~3 pips

class NakaneStrategy(Strategy):
    # Server Time (Assuming data is 2025 Winter? GMT+2)
    entry_hour = 2      
    entry_minute = 0    
    fix_time_minute = 54 
    close_hour = 3     
    close_minute = 30   
    stop_loss_pips = 15
    take_profit_pips = 30
    
    def init(self):
        pass

    def next(self):
        current_time = self.data.index[-1]
        t = current_time.time()
        
        # Phase 1: Buy (Pre-Fix)
        if t.hour == self.entry_hour and t.minute == self.entry_minute:
            if not self.position:
                price = self.data.Close[-1]
                sl = price - (self.stop_loss_pips * 0.01)
                tp = price + (self.take_profit_pips * 0.01)
                self.buy(sl=sl, tp=tp)
        
        # Exit Buy
        if t.hour == self.entry_hour and t.minute == self.fix_time_minute:
             if self.position and self.position.is_long:
                 self.position.close()

        # Phase 2: Sell (Post-Fix)
        if t.hour == self.entry_hour and t.minute == (self.fix_time_minute + 1):
             if not self.position:
                price = self.data.Close[-1]
                sl = price + (self.stop_loss_pips * 0.01)
                tp = price - (self.take_profit_pips * 0.01)
                self.sell(sl=sl, tp=tp)

        # Exit Sell
        if t.hour == self.close_hour and t.minute == self.close_minute:
            if self.position and self.position.is_short:
                self.position.close()

def load_data(filepath):
    print(f"Loading {filepath}...")
    df = pd.read_csv(filepath)
    # Parse Date (yyyy.mm.dd) and Time (HH:MM)
    # 2025.11.05 and 11:47
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], format='%Y.%m.%d %H:%M')
    df = df.set_index('Datetime')
    df = df.rename(columns={'Vol': 'Volume'})
    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
    df = df[~df.index.duplicated(keep='first')]
    
    print(f"Data Loaded: {len(df)} bars")
    print(f"Range: {df.index.min()} - {df.index.max()}")
    return df

if __name__ == '__main__':
    data = load_data(DATA_FILE)
    
    # Use ALL data
    print(f"Running Backtest...")
    bt = Backtest(data, NakaneStrategy, cash=INITIAL_CASH, commission=COMMISSION, exclusive_orders=True)
    stats = bt.run()
    print(stats)
