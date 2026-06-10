import sys
import os

# プロジェクトルート (/app) をパスに追加
sys.path.append("/app")

import logging
import pickle
import glob
import orjson
import numpy as np
import polars as pl
import lightgbm as lgb
import optuna
from datetime import datetime
from src.domain.features import FeatureFactory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("optimizer")

class HyperOptimizer:
    def __init__(self, data_dir="/app/data/raw", config_dir="/app/config"):
        self.data_dir = data_dir
        self.config_dir = config_dir
        os.makedirs(config_dir, exist_ok=True)
        self.df = self._load_data()

    def _load_data(self) -> pl.DataFrame:
        files = glob.glob(f"{self.data_dir}/*.parquet")
        if not files:
            raise FileNotFoundError("No data found for optimization")
            
        logger.info(f"📚 Found {len(files)} files. Loading safely...")
        
        dfs = []
        for f in files:
            try:
                # 個別に読み込んで検証
                d = pl.read_parquet(f)
                # 必須カラムのみに絞る (OHLCV + ts)
                required_cols = ["ts", "open", "high", "low", "close", "volume"]
                if len(d) > 0 and all(c in d.columns for c in required_cols):
                    # 型を統一 (Float64)
                    d = d.select([
                        pl.col("ts").cast(pl.Int64),
                        pl.col("open").cast(pl.Float64),
                        pl.col("high").cast(pl.Float64),
                        pl.col("low").cast(pl.Float64),
                        pl.col("close").cast(pl.Float64),
                        pl.col("volume").cast(pl.Float64)
                    ])
                    dfs.append(d)
            except Exception as e:
                logger.warning(f"⚠️ Skipping bad file {f}: {e}")
                
        if not dfs:
            raise ValueError("No valid data loaded!")
            
        df = pl.concat(dfs)
        df = FeatureFactory.add_technical_indicators(df)
        
        # 1分後の価格 (Next Close) を取得して、リターン計算に使う
        df = df.with_columns([
            pl.col("close").shift(-1).alias("next_close"),
            (pl.col("close").shift(-1) > pl.col("close")).cast(pl.Int8).alias("target")
        ]).drop_nulls()
        
        return df

    def objective(self, trial):
        """
        Optunaが最大化する目的関数 (God Mode Fix: Fee & Risk Aware)
        
        単純な利益額ではなく、「手数料を引いた後の、リスクあたりのリターン（Sharpe Ratio）」を最大化する。
        これにより、AIは「無駄な売買を避け、確実な時だけ動く」ようになる。
        """
        
        # --- 1. Params Suggestion (ハイパーパラメータの探索範囲) ---
        param = {
            'objective': 'binary',
            'metric': 'auc',
            'verbosity': -1,
            'boosting_type': 'gbdt',
            'lambda_l1': trial.suggest_float('lambda_l1', 1e-8, 10.0, log=True),
            'lambda_l2': trial.suggest_float('lambda_l2', 1e-8, 10.0, log=True),
            'num_leaves': trial.suggest_int('num_leaves', 2, 256),
            'feature_fraction': trial.suggest_float('feature_fraction', 0.4, 1.0),
            'bagging_fraction': trial.suggest_float('bagging_fraction', 0.4, 1.0),
            'bagging_freq': trial.suggest_int('bagging_freq', 1, 7),
            'min_child_samples': trial.suggest_int('min_child_samples', 5, 100),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3)
        }
        
        # 戦略閾値の提案 (閾値も最適化対象にする)
        # Buyは少なくとも0.55以上、Sellは0.45以下に強制して、ノイズエントリーを防ぐ
        threshold_buy = trial.suggest_float('threshold_buy', 0.55, 0.95)
        threshold_sell = trial.suggest_float('threshold_sell', 0.05, 0.45)

        # --- 2. Training (学習プロセス) ---
        # 時系列分割: 過去80%で学習、最新20%で検証
        split_idx = int(len(self.df) * 0.8)
        train_df = self.df[:split_idx]
        val_df = self.df[split_idx:]
        
        # 学習に使用するカラム (ts, target, datetime, next_close などを除外)
        feature_cols = [c for c in train_df.columns if c not in ["ts", "target", "datetime", "next_close"]]
        
        # Dataset作成
        dtrain = lgb.Dataset(
            train_df.select(feature_cols).to_numpy(), 
            label=train_df.select("target").to_numpy().flatten()
        )
        dval = lgb.Dataset(
            val_df.select(feature_cols).to_numpy(), 
            label=val_df.select("target").to_numpy().flatten(), 
            reference=dtrain
        )
        
        # モデル学習
        model = lgb.train(
            param, 
            dtrain, 
            num_boost_round=1000, 
            valid_sets=[dval], 
            callbacks=[lgb.early_stopping(stopping_rounds=20, verbose=False)]
        )
        
        # --- 3. Vectorized Backtest with FEES (ここが修正の核) ---
        # 検証データに対する予測確率を取得
        preds = model.predict(val_df.select(feature_cols).to_numpy())
        
        # 検証用の価格データ
        close_prices = val_df["close"].to_numpy()
        next_close_prices = val_df["next_close"].to_numpy() # 1分後の価格
        
        # シグナル生成 (ベクトル演算で高速化)
        signals = np.zeros(len(preds))
        signals[preds > threshold_buy] = 1.0  # Long
        signals[preds < threshold_sell] = -1.0 # Short
        
        # 取引コスト設定
        # Taker Fee 0.06% + Slippage 0.01% = 0.07% (0.0007) 想定
        FEE_RATE = 0.0007 
        
        # グロス損益 (手数料なしの純粋な値幅)
        # Longの場合: (Next - Curr) * 1.0 -> 上がればプラス
        # Shortの場合: (Next - Curr) * -1.0 -> 下がればプラス
        price_diff = next_close_prices - close_prices
        gross_pnl = signals * price_diff
        
        # コスト計算
        # エントリーとイグジットの往復分 (EntryPrice * Fee * 2) と仮定
        # signals が 0 でない場所のみコストが発生する
        costs = np.abs(signals) * close_prices * (FEE_RATE * 2)
        
        # ネット損益 (手数料控除後)
        net_pnl = gross_pnl - costs
        
        # --- 4. Metric Calculation (評価スコア計算) ---
        total_profit = np.sum(net_pnl)
        trade_count = np.count_nonzero(signals)
        
        # ペナルティ1: 取引回数が少なすぎる (過学習やビビリすぎを排除)
        if trade_count < 10:
            return -9999 
            
        # シャープレシオ計算 (平均リターン / リターンの標準偏差)
        # これにより「ドローダウンが激しいギャンブル」より「安定して勝てる戦略」を優遇する
        std_pnl = np.std(net_pnl)
        
        # ペナルティ2: 標準偏差が0 (動いてない) 場合
        if std_pnl == 0:
            return -9999
            
        avg_pnl = np.mean(net_pnl)
        # 年率換算等はせず、単純な試行回数ベースのリスク調整後リターン
        sharpe_ratio = (avg_pnl / std_pnl) * np.sqrt(trade_count)
        
        # ペナルティ3: そもそもトータルで損しているなら、シャープレシオ以前の問題
        if total_profit < 0:
            # 損失額そのものを返すことで、よりマシな損失の方へ誘導する
            return total_profit 
            
        # 最終スコアとしてシャープレシオを返す (これを最大化させる)
        return sharpe_ratio

    def run(self, n_trials=50):
        logger.info(f"🚀 Starting Optimization with {n_trials} trials...")
        study = optuna.create_study(direction="maximize")
        study.optimize(self.objective, n_trials=n_trials)
        
        best_params = study.best_params
        logger.info(f"🏆 Best Params: {best_params}")
        logger.info(f"📈 Best Sharpe Ratio: {study.best_value}")
        
        # 保存
        with open(f"{self.config_dir}/best_params.json", "wb") as f:
            f.write(orjson.dumps(best_params))
            
        logger.info("💾 Saved best_params.json")

if __name__ == "__main__":
    optimizer = HyperOptimizer()
    optimizer.run(n_trials=30) # デモ用に30回
