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
# 戦略パラメータ（input に相当）
# ==========================================
# MQL5 の input 変数と 1:1 で対応させること
# ==========================================

class MyStrategy(Strategy):
    # --- パラメータ（最適化対象）---
    param1 = 14       # 例: ATR期間
    param2 = 2.0      # 例: リスクリワード比
    stop_loss_pips = 15.0

    def init(self):
        """
        インジケータの初期化。
        self.I() でラップすることでプロット対象になる。
        """
        # 例: SMA
        # self.sma = self.I(lambda x: pd.Series(x).rolling(200).mean(), self.data.Close)

        # 例: ATR
        # self.atr = self.I(self._calc_atr, self.data.High, self.data.Low, self.data.Close, self.param1)
        pass

    def next(self):
        """
        毎足呼ばれるメインロジック。

        ⚠️ ロジックパリティ注意:
          - self.data.Close[-1] = 現在足 (MQL: iClose(0)) ← リペインティング注意
          - self.data.Close[-2] = 1本前の確定足 (MQL: iClose(1)) ← 安全
        """
        # --- ウォームアップ ---
        if len(self.data) < 200:
            return

        # --- エントリー条件 ---
        if not self.position:
            # TODO: エントリーロジックを実装
            # 例:
            # if self.data.Close[-1] > self.sma[-1]:
            #     self.buy(sl=..., tp=...)
            pass

    # --- ヘルパー関数 ---
    @staticmethod
    def _calc_atr(h, l, c, period):
        """ATR 計算 (MQL: iATR と同等)"""
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

    @staticmethod
    def _calc_rsi(close, period):
        """RSI 計算 (MQL: iRSI と同等)"""
        delta = pd.Series(close).diff()
        gain = delta.where(delta > 0, 0).fillna(0)
        loss = (-delta.where(delta < 0, 0)).fillna(0)
        avg_gain = gain.rolling(window=period).mean()
        avg_loss = loss.rolling(window=period).mean()
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))


# ==========================================
# 実行
# ==========================================
if __name__ == "__main__":
    # --- データ取得 ---
    SYMBOL = "USDJPY=X"
    PERIOD = "2y"        # バックテスト期間
    INTERVAL = "1h"      # 時間足

    print(f"Fetching {SYMBOL} data ({INTERVAL}, {PERIOD})...")
    data = yf.download(SYMBOL, period=PERIOD, interval=INTERVAL, progress=False)

    # MultiIndex 対応
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.droplevel(1)
    data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()

    print(f"Data: {len(data)} bars ({data.index[0]} ~ {data.index[-1]})")

    # --- バックテスト実行 ---
    bt = Backtest(
        data,
        MyStrategy,
        cash=100_000,
        commission=0.0001,  # 0.01% (スプレッド相当)
    )

    # --- 単純実行 ---
    stats = bt.run()
    print("\n=== Backtest Results ===")
    print(f"Profit Factor: {stats['Profit Factor']:.2f}")
    print(f"Win Rate:      {stats['Win Rate [%]']:.1f}%")
    print(f"Max Drawdown:  {stats['Max. Drawdown [%]']:.1f}%")
    print(f"Total Trades:  {stats['# Trades']}")

    # --- 合否判定 ---
    pf = stats["Profit Factor"]
    if pf >= 1.5:
        print(f"\n✅ PASS (PF {pf:.2f} >= 1.5) → Phase 3 (MQL実装) へ進行")
    else:
        print(f"\n❌ FAIL (PF {pf:.2f} < 1.5) → アーカイブして中止")
        print("   → mt5/research/strategy_post_mortem.txt に記録すること")

    # --- 最適化（オプション）---
    # stats, heatmap = bt.optimize(
    #     param1=[10, 14, 20],
    #     param2=[1.5, 2.0, 3.0],
    #     maximize="Profit Factor",
    #     return_heatmap=True,
    # )
    # print("\nTop 5 Configs:")
    # print(heatmap.sort_values(ascending=False).head())
