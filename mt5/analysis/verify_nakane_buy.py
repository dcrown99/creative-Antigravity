import yfinance as yf
import pandas as pd
from backtesting import Backtest, Strategy

# pandas_ta is not standard in my environment usually, so I will implement indicators manually or use simple pandas
# to ensure it runs without extra installs if possible. standard backtesting.lib has some.

class NakaneBuy(Strategy):
    # Parameters
    time_window = 0 # 0:00 UTC = 9:00 JST (Standard time)
    lookback = 20
    
    # Filters
    use_volatility_filter = True
    atr_period = 14
    atr_threshold = 0.05 # Percent of price? No, pure value. Needs normalization.
    
    use_trend_filter = True
    ema_period = 200
    
    # Exit
    hold_bars = 11 # 9:00 -> 9:55 (11 x 5min bars) OR 1 hour bar?
                   # yfinance 1h data: 0:00 is 9:00-10:00.
                   # Next fix is 9:55. So we enter at 0:00 Open/Close? 
                   # Nakane logic: Open at 9:00, Close at 9:55. 
                   # With 1h candles, likely Enter Open of 0:00, Exit Open of 1:00? 
                   # Or Enter Open 0:00, Exit calculated at 55min? 
                   # Backtesting.py works on bars. 
                   # Let's use 5m or 15m data for better precision. 1h is too coarse for 9:55 exit.
    
    def init(self):
        # Indicators
        self.ema = self.I(lambda x: pd.Series(x).ewm(span=self.ema_period).mean(), self.data.Close)
        self.atr = self.I(lambda h, l, c: pd.Series(h).rolling(14).max() - pd.Series(l).rolling(14).min(), # Simple Range for now
                          self.data.High, self.data.Low, self.data.Close) 
        
        # Heuristic for "Market Structure": Close > prev High
        self.prev_high = self.I(lambda x: pd.Series(x).rolling(self.lookback).max().shift(1), self.data.High)

    def next(self):
        # Time Management (UTC)
        # assuming data index is datetime
        current_time = self.data.index[-1]
        
        # Target: 0:00 UTC (9:00 JST)
        if current_time.hour == 0 and current_time.minute == 0:
            
            # 0. Gotobi Filter (Day 5, 10, 15, 20, 25, 30)
            day = current_time.day
            if day % 5 != 0:
                return

            # 1. Trend Filter
            if self.use_trend_filter and self.data.Close[-1] < self.ema[-1]:
                return

            # 2. Volatility/Range Filter (Avoid contraction)
            # if self.use_volatility_filter and self.atr[-1] < threshold: return
            
            # 3. Structure Break
            # if self.data.Close[-1] <= self.prev_high[-1]: return

            # Entry
            self.buy()
            
        # Exit at 0:55 UTC (9:55 JST)
        # With 5m data, this is 0:55 candle
        if current_time.hour == 0 and current_time.minute == 55 and self.position:
            self.position.close()

# Main Logic
if __name__ == '__main__':
    print("Fetching USDJPY data (5m interval for 60d)...")
    try:
        data = yf.download("USDJPY=X", period="60d", interval="5m", progress=False)
        
        # cleanup headers
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.droplevel(1)
            
        data = data[['Open', 'High', 'Low', 'Close', 'Volume']]
        data = data.dropna()

        # Debug Timestamps
        print("Data Head (Timezone Check):")
        print(data.head())
        print("Timezone:", data.index.tz)
        
        bt = Backtest(data, NakaneBuy, cash=100000, commission=.0001)
        stats = bt.run()
        print(stats)
        # bt.plot() # Interactive plot
        
    except Exception as e:
        print(f"Error: {e}")
