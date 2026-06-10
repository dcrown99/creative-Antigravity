
import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy

# ==========================================
# Strategy Logic: Hybrid Liquidity Raid
# ==========================================
# 1. Objective Swing: 3-Bar Fractal + ATR Filter
# 2. Entry: Price sweeps Swing High/Low but closes back inside (Liquidity Raid)
# 3. Filter: Trend (SMA 200) + RSI (Deep Value)
# ==========================================

class HybridLiquidityRaid(Strategy):
    atr_period = 14
    atr_multiplier = 1.0
    risk_reward = 2.0
    use_trend_filter = True
    use_rsi_filter = True 
    rsi_period = 14
    rsi_lower = 30 # Deep Oversold
    rsi_upper = 70 # Deep Overbought
    
    def init(self):
        self.atr = self.I(self.calculate_atr, self.data.High, self.data.Low, self.data.Close, self.atr_period)
        self.sma200 = self.I(lambda x: pd.Series(x).rolling(200).mean(), self.data.Close)
        self.rsi = self.I(self.calculate_rsi, self.data.Close, self.rsi_period)
        
        self.swing_highs = []
        self.swing_lows = []
        self.last_swing_type = 0
        self.last_swing_val = 0

    def calculate_atr(self, h, l, c, period):
        return pd.Series(np.maximum((h - l), np.maximum(abs(h - pd.Series(c).shift(1)), abs(l - pd.Series(c).shift(1))))).rolling(window=period).mean()

    def calculate_rsi(self, close, period):
        delta = pd.Series(close).diff()
        gain = (delta.where(delta > 0, 0)).fillna(0)
        loss = (-delta.where(delta < 0, 0)).fillna(0)
        avg_gain = gain.rolling(window=period).mean()
        avg_loss = loss.rolling(window=period).mean()
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))

    def next(self):
        if len(self.data) < 200: return

        high = self.data.High
        low = self.data.Low
        close = self.data.Close
        current_atr = self.atr[-1]
        trend_up = close[-1] > self.sma200[-1]
        current_rsi = self.rsi[-1]
        
        # --- 1. DETECT OBJECTIVE SWINGS (Delayed 1 bar) ---
        is_fractal_high = (high[-2] > high[-3]) and (high[-2] > high[-1])
        is_fractal_low = (low[-2] < low[-3]) and (low[-2] < low[-1])
        
        if self.last_swing_type == 0:
            if is_fractal_high:
                self.last_swing_type = 1
                self.last_swing_val = high[-2]
                self.swing_highs.append(high[-2])
            elif is_fractal_low:
                self.last_swing_type = -1
                self.last_swing_val = low[-2]
                self.swing_lows.append(low[-2])
        elif self.last_swing_type == 1:
            if high[-2] > self.last_swing_val:
                self.last_swing_val = high[-2]
                if self.swing_highs: self.swing_highs[-1] = high[-2]
            elif is_fractal_low:
                if (self.last_swing_val - low[-2]) > (current_atr * self.atr_multiplier):
                    self.last_swing_type = -1
                    self.last_swing_val = low[-2]
                    self.swing_lows.append(low[-2])
        elif self.last_swing_type == -1:
            if low[-2] < self.last_swing_val:
                self.last_swing_val = low[-2]
                if self.swing_lows: self.swing_lows[-1] = low[-2]
            elif is_fractal_high:
                if (high[-2] - self.last_swing_val) > (current_atr * self.atr_multiplier):
                    self.last_swing_type = 1
                    self.last_swing_val = high[-2]
                    self.swing_highs.append(high[-2])

        # --- 2. ENTRY LOGIC ---
        if not self.position:
            # BUY
            if self.swing_lows:
                recent_low = self.swing_lows[-1]
                if low[-1] < recent_low and close[-1] > recent_low: # RAID
                    if self.use_trend_filter and not trend_up: return
                    if self.use_rsi_filter and current_rsi > self.rsi_lower: return
                    
                    if close[-1] > (low[-1] + (high[-1] - low[-1]) * 0.5): # HAMMER-ish
                        stop_loss = low[-1] - (current_atr * 0.2)
                        take_profit = close[-1] + (close[-1] - stop_loss) * self.risk_reward
                        self.buy(sl=stop_loss, tp=take_profit)
            
            # SELL
            if self.swing_highs:
                recent_high = self.swing_highs[-1]
                if high[-1] > recent_high and close[-1] < recent_high: # RAID
                    if self.use_trend_filter and trend_up: return
                    if self.use_rsi_filter and current_rsi < self.rsi_upper: return
                    
                    if close[-1] < (high[-1] - (high[-1] - low[-1]) * 0.5): # SHOOTING STAR-ish
                        stop_loss = high[-1] + (current_atr * 0.2)
                        take_profit = close[-1] - (stop_loss - close[-1]) * self.risk_reward
                        self.sell(sl=stop_loss, tp=take_profit)

# Main Execution
if __name__ == '__main__':
    print("Fetching USDJPY data (1h)...")
    data = yf.download("USDJPY=X", period="60d", interval="1h", progress=False)
    if isinstance(data.columns, pd.MultiIndex): data.columns = data.columns.droplevel(1)
    data = data[['Open', 'High', 'Low', 'Close', 'Volume']].dropna()
    
    bt = Backtest(data, HybridLiquidityRaid, cash=100000, commission=.0001)
    
    print("Running Optimization (Trend + RSI)...")
    stats, heatmap = bt.optimize(
        atr_multiplier=[1.0, 1.5, 2.0],
        risk_reward=[1.5, 2.0, 3.0],
        use_rsi_filter=[True, False], # Test impact
        rsi_lower=[30, 40],
        maximize='Profit Factor',
        return_heatmap=True
    )
    print("\nBest Parameters:")
    print(stats._strategy)
    print(stats)
    print("\nTop 5 Configs:")
    print(heatmap.sort_values(ascending=False).head())
