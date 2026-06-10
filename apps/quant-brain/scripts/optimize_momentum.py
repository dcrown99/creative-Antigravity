"""
Momentum Strategy Parameter Optimizer

DailyMomentumStrategy のパラメータを Optuna で最適化
- RSI閾値
- SMA期間
- Position Size

目的関数: Sharpe Ratio (リスク調整後リターン)
"""
import sys
import os

# プロジェクトルート (/app) をパスに追加
sys.path.append("/app")

import logging
import glob
import orjson
import numpy as np
import polars as pl
import optuna
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("momentum_optimizer")


class MomentumOptimizer:
    """
    DailyMomentumStrategy のバックテスト最適化
    
    最適化パラメータ:
    - RSI期間 (7-21)
    - RSI閾値 (40-60)
    - SMA期間 (100-300)
    
    目的関数: Sharpe Ratio
    """
    
    def __init__(self, data_dir="/app/data/raw", config_dir="/app/config"):
        self.data_dir = data_dir
        self.config_dir = config_dir
        self.historical_file = "/app/data/historical/btc_daily.parquet"
        os.makedirs(config_dir, exist_ok=True)
        self.df = self._load_daily_data()
        
    def _load_daily_data(self) -> pl.DataFrame:
        """日足データを読み込み (長期データ優先)"""
        # 1. まず長期データファイルを試す
        if os.path.exists(self.historical_file):
            logger.info(f"📚 Loading historical data from {self.historical_file}")
            df = pl.read_parquet(self.historical_file)
            logger.info(f"📊 Loaded {len(df)} daily candles")
            return df
            
        # 2. フォールバック: raw ディレクトリから1分足を集約
        files = glob.glob(f"{self.data_dir}/*.parquet")
        if not files:
            raise FileNotFoundError("No data found for optimization")
            
        logger.info(f"📚 Found {len(files)} files. Loading...")
        
        dfs = []
        for f in files:
            try:
                d = pl.read_parquet(f)
                required_cols = ["ts", "open", "high", "low", "close", "volume"]
                if len(d) > 0 and all(c in d.columns for c in required_cols):
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
        
        # 1分足 → 日足リサンプリング
        df = df.with_columns([
            (pl.col("ts") // 86400000 * 86400000).alias("day_ts")  # 日単位に丸める
        ]).group_by("day_ts").agg([
            pl.col("open").first().alias("open"),
            pl.col("high").max().alias("high"),
            pl.col("low").min().alias("low"),
            pl.col("close").last().alias("close"),
            pl.col("volume").sum().alias("volume")
        ]).sort("day_ts").rename({"day_ts": "ts"})
        
        logger.info(f"📊 Resampled to {len(df)} daily candles")
        return df
        
    def _calculate_rsi(self, df: pl.DataFrame, period: int) -> pl.DataFrame:
        """RSI計算 (共通モジュール使用)"""
        from src.domain.indicators import calculate_rsi
        rsi = calculate_rsi(df["close"], period)
        return df.with_columns([rsi.alias("rsi")])
        
    def _backtest_momentum(
        self, 
        rsi_period: int, 
        rsi_threshold: int, 
        sma_period: int
    ) -> dict:
        """モメンタム戦略のバックテスト"""
        
        df = self.df.clone()
        
        # データが足りない場合
        if len(df) < sma_period + 10:
            return {"sharpe": -9999, "total_return": 0, "trades": 0}
        
        # 指標計算
        df = df.with_columns([
            pl.col("close").rolling_mean(window_size=sma_period).alias("sma")
        ])
        df = self._calculate_rsi(df, rsi_period)
        df = df.drop_nulls()
        
        # シグナル生成
        # Entry: RSI > threshold AND Close > SMA
        # Exit: RSI < threshold OR Close < SMA
        
        close = df["close"].to_numpy()
        sma = df["sma"].to_numpy()
        rsi = df["rsi"].to_numpy()
        
        # Equity tracking for Max Drawdown
        initial_capital = 10000
        capital = initial_capital
        position_qty = 0
        entry_price = 0
        returns = []
        trade_count = 0
        peak_equity = initial_capital
        max_drawdown = 0
        
        for i in range(1, len(close)):
            should_be_long = (close[i] > sma[i]) and (rsi[i] > rsi_threshold)
            
            if should_be_long and position_qty == 0:
                # Entry
                position_qty = capital / close[i]
                entry_price = close[i]
                trade_count += 1
                
            elif not should_be_long and position_qty > 0:
                # Exit
                exit_price = close[i]
                trade_return = (exit_price - entry_price) / entry_price
                # 手数料控除 (0.1% 往復)
                trade_return -= 0.001
                returns.append(trade_return)
                capital = position_qty * exit_price * (1 - 0.0005)  # 売却手数料
                position_qty = 0
            
            # Current equity for drawdown calculation
            if position_qty > 0:
                current_equity = position_qty * close[i]
            else:
                current_equity = capital
                
            # Update peak and max drawdown
            if current_equity > peak_equity:
                peak_equity = current_equity
            drawdown = (peak_equity - current_equity) / peak_equity * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                
        # 最後のポジションをクローズ
        if position_qty > 0:
            exit_price = close[-1]
            trade_return = (exit_price - entry_price) / entry_price - 0.001
            returns.append(trade_return)
            capital = position_qty * exit_price
        
        # メトリクス計算
        if len(returns) < 3:
            return {"sharpe": -9999, "total_return": 0, "trades": len(returns), "max_drawdown": 0}
            
        returns_arr = np.array(returns)
        total_return = (capital - initial_capital) / initial_capital
        avg_return = np.mean(returns_arr)
        std_return = np.std(returns_arr)
        
        if std_return == 0:
            return {"sharpe": -9999, "total_return": total_return, "trades": len(returns), "max_drawdown": max_drawdown}
            
        # Sharpe Ratio (年率換算せず、トレード単位)
        sharpe = avg_return / std_return * np.sqrt(len(returns))
        
        return {
            "sharpe": sharpe,
            "total_return": total_return,
            "trades": len(returns),
            "win_rate": np.mean(returns_arr > 0) * 100,
            "max_drawdown": max_drawdown
        }
        
    def objective(self, trial):
        """Optuna目的関数"""
        
        # パラメータ探索範囲
        rsi_period = trial.suggest_int("rsi_period", 7, 21)
        rsi_threshold = trial.suggest_int("rsi_threshold", 40, 60)
        sma_period = trial.suggest_int("sma_period", 100, 300, step=10)
        
        # バックテスト実行
        result = self._backtest_momentum(rsi_period, rsi_threshold, sma_period)
        
        # ペナルティ: 取引回数が少なすぎる
        if result["trades"] < 5:
            return -9999
            
        # ペナルティ: トータルで損失
        if result["total_return"] < 0:
            return result["total_return"]
            
        return result["sharpe"]
        
    def run(self, n_trials: int = 50):
        """最適化実行"""
        logger.info(f"🚀 Starting Momentum Optimization with {n_trials} trials...")
        
        study = optuna.create_study(direction="maximize")
        study.optimize(self.objective, n_trials=n_trials, show_progress_bar=True)
        
        best_params = study.best_params
        logger.info(f"🏆 Best Params: {best_params}")
        logger.info(f"📈 Best Sharpe Ratio: {study.best_value:.4f}")
        
        # 最良パラメータでバックテスト結果を取得
        best_result = self._backtest_momentum(
            best_params["rsi_period"],
            best_params["rsi_threshold"],
            best_params["sma_period"]
        )
        logger.info(f"📊 Total Return: {best_result['total_return']*100:.2f}%")
        logger.info(f"📊 Trades: {best_result['trades']}")
        logger.info(f"📊 Win Rate: {best_result.get('win_rate', 0):.1f}%")
        logger.info(f"📊 Max Drawdown: {best_result.get('max_drawdown', 0):.1f}%")
        
        # 保存 (momentum_params.json)
        output = {
            **best_params,
            "sharpe_ratio": float(study.best_value),
            "total_return_pct": float(best_result["total_return"] * 100),
            "trade_count": int(best_result["trades"]),
            "win_rate_pct": float(best_result.get("win_rate", 0)),
            "max_drawdown_pct": float(best_result.get("max_drawdown", 0)),
            "optimized_at": datetime.now().isoformat()
        }
        
        with open(f"{self.config_dir}/momentum_params.json", "wb") as f:
            f.write(orjson.dumps(output))
            
        logger.info("💾 Saved momentum_params.json")
        return output


if __name__ == "__main__":
    optimizer = MomentumOptimizer()
    optimizer.run(n_trials=30)
