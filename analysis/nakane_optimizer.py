import pandas as pd
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
import datetime

# --- Configuration ---
DATA_FILE = 'data/USDJPY_M1.csv'
# 10,000 USD, 1:500 Leverage? Backtesting.py handles margin.
INITIAL_CASH = 10000
COMMISSION = 0.0003  # ~3 pips spread/comm equivalent? or 0.03%?
# XM Spread is ~1.5 pips. 0.015 / 150 = 0.0001. Let's use 2 pips fixed cost.

class NakaneStrategy(Strategy):
    # Parameters to optimize
    entry_hour = 9      # 9:00 JST (0:00 GMT+9)
    entry_minute = 0    
    fix_time_minute = 54 # Close Buy / Open Sell around 9:54-9:55
    close_hour = 10     # Close Sell
    close_minute = 30   
    
    stop_loss_pips = 15
    take_profit_pips = 30
    
    # Internal
    # Note: Optimization engine sets these class variables.
    
    def init(self):
        # Precompute any indicators if needed.
        # For time-based, we access self.data.index in next()
        pass

    def next(self):
        # Current Time
        # Backtesting.py index is datetime
        current_time = self.data.index[-1]
        
        # Convert to JST (Assuming Data is GMT+2/3? Or GMT+0?)
        # MT5 Export usually follows Server Time.
        # XM Server Time is GMT+2 (Winter) / GMT+3 (Summer).
        # JST is GMT+9.
        # So Server+7 (Winter) = JST. Server+6 (Summer) = JST.
        # This is TRICKY in backtesting without dynamic offset.
        # FOR NOW: Let's assume data is GMT+2 (Winter) and we optimize "Server Time".
        # Nakane (9:55 JST) = 0:55 GMT = 2:55 Server (Winter) / 3:55 Server (Summer).
        # We will optimize "Entry Hour" in SERVER TIME to find the cluster.
        
        t = current_time.time()
        
        # Phase 1: Buy (Pre-Fix)
        # Entry
        if t.hour == self.entry_hour and t.minute == self.entry_minute:
            if not self.position:
                price = self.data.Close[-1]
                sl = price - (self.stop_loss_pips * 0.01)
                tp = price + (self.take_profit_pips * 0.01)
                self.buy(sl=sl, tp=tp)
        
        # Exit Buy (At Fix Time)
        # 9:54 JST -> Close Buy
        if t.hour == self.entry_hour and t.minute == self.fix_time_minute:
             if self.position and self.position.is_long:
                 self.position.close()

        # Phase 2: Sell (Post-Fix)
        # 9:55 JST -> Open Sell
        # We use fix_time_minute + 1 for simplicity or same bar?
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
    # Parse standard MT5 Export format
    # Date,Time,Open,High,Low,Close,TickVol,Vol,Spread
    # 2023.01.01,12:00,...
    
    # We need to combine Date and Time
    df = pd.read_csv(filepath)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    df = df.set_index('Datetime')
    
    # Backtesting expects 'Open', 'High', 'Low', 'Close', 'Volume'
    # Drop TickVol, Spread for now (or use Spread for variable cost simulation?)
    df = df.rename(columns={'Vol': 'Volume'})
    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
    
    # Drop duplicates
    df = df[~df.index.duplicated(keep='first')]
    
    print(f"Loaded {len(df)} bars. Range: {df.index[0]} - {df.index[-1]}")
    return df

if __name__ == '__main__':
    data = load_data(DATA_FILE)
    
    # Run Backtest
    bt = Backtest(data, NakaneStrategy, cash=INITIAL_CASH, commission=COMMISSION, exclusive_orders=True)
    
    print("Running Initial Backtest (Default Params)...")
    stats = bt.run()
    print(stats)
    
    # Optimize
    print("\nRunning Optimization...")
    # Optimize Server Time Hours: 0-23
    # Nakane is likely around Server Time 0-3.
    stats, heatmap = bt.optimize(
        entry_hour=range(0, 5), # Narrow search 0-4 AM Server Time
        entry_minute=[0, 15, 30, 45],
        fix_time_minute=[50, 54, 55],
        stop_loss_pips=[10, 15, 20],
        maximize='Profit Factor',
        return_heatmap=True
    )
    
    print("\nBest Parameters:")
    print(stats._strategy)
    print("\nOptimization Stats:")
    print(stats)
    
    # Save Heatmap?
    # heatmap.to_csv("analysis/heatmap.csv")
