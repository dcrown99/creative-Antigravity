"""
MT5 戦略マイニング バックテストテンプレート (軽量版)
=====================================================
mt5-strategy-mining Step 3 用。
発見フェーズで素早くロジックを検証するための軽量テンプレート。

依存: pip install backtesting yfinance pandas numpy
"""

import yfinance as yf
import pandas as pd
import numpy as np
from backtesting import Backtest, Strategy


class DiscoveredStrategy(Strategy):
    """
    NotebookLM から抽出されたロジックをここに実装する。
    
    使い方:
    1. クラス名を戦略名に変更
    2. パラメータを input 変数として定義
    3. init() でインジケータを初期化
    4. next() でエントリー/エグジットロジックを実装
    """
    # --- 抽出されたパラメータ ---
    # TODO: NotebookLM の出力に基づいて設定
    period = 14
    threshold = 50.0

    def init(self):
        # TODO: インジケータを初期化
        pass

    def next(self):
        # TODO: エントリー/エグジットロジック
        if len(self.data) < 200:
            return

        if not self.position:
            # TODO: エントリー条件
            pass


# ==========================================
# 実行 & 判定
# ==========================================
if __name__ == "__main__":
    SYMBOL = "USDJPY=X"
    PERIOD = "60d"       # 発見フェーズは短期間で素早く検証
    INTERVAL = "1h"

    print(f"[Mining] Fetching {SYMBOL} ({INTERVAL}, {PERIOD})...")
    data = yf.download(SYMBOL, period=PERIOD, interval=INTERVAL, progress=False)

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.droplevel(1)
    data = data[["Open", "High", "Low", "Close", "Volume"]].dropna()

    bt = Backtest(data, DiscoveredStrategy, cash=100_000, commission=0.0001)

    # --- 最適化で最良パラメータを探索 ---
    stats, heatmap = bt.optimize(
        period=[10, 14, 20],
        threshold=[30, 50, 70],
        maximize="Profit Factor",
        return_heatmap=True,
    )

    pf = stats["Profit Factor"]
    wr = stats["Win Rate [%]"]
    trades = stats["# Trades"]

    print(f"\n=== Mining Results ===")
    print(f"Best Params: {stats._strategy}")
    print(f"PF: {pf:.2f} | WR: {wr:.1f}% | Trades: {trades}")

    if pf >= 1.5:
        print(f"\n✅ 有望 (PF {pf:.2f}) → mt5-full-cycle Phase 2 で本格検証を推奨")
    elif pf >= 1.0:
        print(f"\n🟡 微妙 (PF {pf:.2f}) → フィルター追加で改善可能か検討 (最大2回)")
    else:
        print(f"\n❌ 不採用 (PF {pf:.2f}) → strategy_post_mortem.txt に記録して終了")

    print("\nTop 5 Configs:")
    print(heatmap.sort_values(ascending=False).head())
