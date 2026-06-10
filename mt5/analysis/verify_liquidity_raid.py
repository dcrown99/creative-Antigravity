import yfinance as yf
import pandas as pd
from backtesting import Backtest, Strategy
from backtesting.lib import crossover

# 流動性狩り (Liquidity Raid) 戦略 + トレンドフィルター
class LiquidityRaid(Strategy):
    lookback = 20  # スイング検出の期間 (足数)
    rr_ratio = 2.0 # リスクリワード比
    ema_period = 200 # トレンド判定用 EMA期間

    def init(self):
        # 直近のスイングHigh/Lowを計算
        self.swing_high = self.I(lambda x: pd.Series(x).rolling(self.lookback).max(), self.data.High)
        self.swing_low = self.I(lambda x: pd.Series(x).rolling(self.lookback).min(), self.data.Low)
        # EMA (指数平滑移動平均) を計算
        self.ema = self.I(lambda x: pd.Series(x).ewm(span=self.ema_period).mean(), self.data.Close)

    def next(self):
        # 既にポジションがある場合は何もしない
        if self.position:
            return

        # データ配列へのアクセス
        highs = self.data.High
        lows = self.data.Low
        closes = self.data.Close
        
        # 過去のデータ範囲を取得 (現在の足を含めず、lookback期間前まで)
        prev_lows = lows[-self.lookback-1:-1]
        prev_highs = highs[-self.lookback-1:-1]
        
        if len(prev_lows) < self.lookback:
            return

        recent_low = min(prev_lows)
        recent_high = max(prev_highs)
        
        # 買いシグナル: 安値ブレイク後の騙し (Liquidity Raid of Low) + 上昇トレンド (Close > EMA)
        # 条件: 安値が直近安値を下回ったが、終値は直近安値以上に戻した
        if lows[-1] < recent_low and closes[-1] > recent_low and closes[-1] > self.ema[-1]:
            sl = lows[-1]
            risk = closes[-1] - sl
            if risk == 0: return
            tp = closes[-1] + (risk * self.rr_ratio)
            self.buy(sl=sl, tp=tp)

        # 売りシグナル: 高値ブレイク後の騙し (Liquidity Raid of High) + 下降トレンド (Close < EMA)
        # 条件: 高値が直近高値を上回ったが、終値は直近高値以下に戻した
        elif highs[-1] > recent_high and closes[-1] < recent_high and closes[-1] < self.ema[-1]:
            sl = highs[-1]
            risk = sl - closes[-1]
            if risk == 0: return
            tp = closes[-1] - (risk * self.rr_ratio)
            self.sell(sl=sl, tp=tp)

# データ取得
print("EURUSD=X のデータを取得中...")
data = yf.download("EURUSD=X", period="60d", interval="1h", progress=False)

# データ整形 (Backtesting.py は Open, High, Low, Close, Volume カラムを期待)
if isinstance(data.columns, pd.MultiIndex):
    data.columns = data.columns.droplevel(1)
    
data = data[['Open', 'High', 'Low', 'Close', 'Volume']]
data = data.dropna()

print(f"データ取得完了: {len(data)}件")

# バックテスト実行
bt = Backtest(data, LiquidityRaid, cash=10000, commission=.0001, exclusive_orders=True)
stats = bt.run()
print(stats)

# Plot (optional, requires browser/notebook)
# bt.plot()
