"""
MT5 Python 検証テンプレート
===========================
mt5-full-cycle Phase 2 用のバックテストテンプレート。
使い方: コピーして戦略名に変更 → ロジックを next() に実装 → 実行

依存: pip install backtesting yfinance pandas numpy
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy


# ==========================================
# ガンマ・ピンニング（ラウンドナンバー近似）戦略
# ==========================================
class GammaPinningStrategy(Strategy):
    # --- パラメータ（最適化対象）---
    magnet_distance_pips = 15.0  # (Opt) ストライクから何pips接近したら磁力圏内とみなすか
    stop_loss_pips = 15.0        # (Opt) ピン留め失敗時の損切りpips
    entry_hour_start = 12        # エントリー開始時刻 (UTC)
    entry_hour_end = 14          # エントリー終了時刻 (UTC)
    atr_period = 14
    max_atr_pips = 20.0          # (Opt) 5分足ATRがこの値以下の場合のみトレード (低ボラ環境限定)
    
    def init(self):
        """初期化。ATRなどを計算"""
        self.pip_value = 0.01
        
        # ボラティリティフィルター（ATR）の計算
        self.atr = self.I(self._calc_atr, self.data.High, self.data.Low, self.data.Close, self.atr_period)

    @staticmethod
    def _calc_atr(h, l, c, period):
        tr = pd.Series(
            np.maximum(
                h - l,
                np.maximum(
                    abs(h - pd.Series(c).shift(1)),
                    abs(l - pd.Series(c).shift(1)),
                ),
            )
        )
        return tr.rolling(window=period).mean()

    def next(self):
        # --- ウォームアップ ---
        if len(self.data) < max(20, self.atr_period + 1):
            return

        current_time = self.data.index[-1]
        hour = current_time.hour
        
        # ボラティリティフィルター: 高ボラ環境下ではオプションバリアが突破されやすいため見送り
        current_atr_pips = self.atr[-1] / self.pip_value
        if current_atr_pips > self.max_atr_pips:
            return

        # NYカット（15:00 GMT）に向けてのエントリー時間帯フィルター
        if self.entry_hour_start <= hour <= self.entry_hour_end:
            if not self.position:
                current_price = self.data.Close[-1]
                
                # 直近のラウンドナンバー（.00 または .50）
                lower_bound = np.floor(current_price * 2) / 2
                upper_bound = np.ceil(current_price * 2) / 2
                
                dist_to_lower = (current_price - lower_bound) / self.pip_value
                dist_to_upper = (upper_bound - current_price) / self.pip_value
                
                if 3.0 <= dist_to_upper <= self.magnet_distance_pips:
                    sl_price = current_price - (self.stop_loss_pips * self.pip_value)
                    self.buy(sl=sl_price, tp=upper_bound)
                    
                elif 3.0 <= dist_to_lower <= self.magnet_distance_pips:
                    sl_price = current_price + (self.stop_loss_pips * self.pip_value)
                    self.sell(sl=sl_price, tp=lower_bound)
        
        else:
            # NYカット時間を過ぎたら強制エグジット
            if self.position and hour >= 15:
                self.position.close()


# ==========================================
# 実行
# ==========================================
if __name__ == "__main__":
    SYMBOL = "USDJPY=X"
    PERIOD = "60d"       
    INTERVAL = "5m"      

    print(f"Fetching {SYMBOL} data ({INTERVAL}, {PERIOD})...")
    data = yf.download(SYMBOL, period=PERIOD, interval=INTERVAL, progress=False)

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.droplevel(1)
    data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()

    bt = Backtest(
        data,
        GammaPinningStrategy,
        cash=100_000,
        margin=1/30, 
        commission=0.00005, 
    )

    # --- 最適化実行（改善ループ1回目: ATRフィルター調整）---
    stats, heatmap = bt.optimize(
        magnet_distance_pips=[10, 15, 20],
        stop_loss_pips=[10, 15, 20],
        max_atr_pips=[10, 15, 20, 25],  # 新しいフィルター
        maximize="Profit Factor",
        return_heatmap=True,
    )
    
    print("\n=== Backtest Results (Best Params) ===")
    print(stats)
    print("\nProfit Factor : {:.2f}".format(stats["Profit Factor"]))
    print("Win Rate      : {:.1f}%".format(stats["Win Rate [%]"]))
    print("Total Trades  : {}".format(stats["# Trades"]))
    
    print("\n=== Top 5 Configurations ===")
    print(heatmap.sort_values(ascending=False).head())

    pf = stats["Profit Factor"]
    if pd.isna(pf): pf = 0
    if pf >= 1.5:
        print(f"\n✅ PASS (PF {pf:.2f} >= 1.5) → Phase 4 (MQL実装) へ進行")
    else:
        print(f"\n❌ FAIL (PF {pf:.2f} < 1.5) → アーカイブして中止")
        print("   → mt5/research/strategy_post_mortem.txt に記録すること")
