"""
Walk-Forward Validation for Momentum Strategy

過学習を防ぐため、ウォークフォワード検証を実施:
- データを訓練期間とテスト期間に分割
- 訓練期間で最適化 → テスト期間で検証
- 複数の期間でこれを繰り返し、一貫したパフォーマンスを確認
"""
import sys
import os
sys.path.append("/app")

import logging
import numpy as np
import polars as pl
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("walk_forward")

HISTORICAL_FILE = "/app/data/historical/btc_daily.parquet"


def calculate_rsi(close_prices: np.ndarray, period: int) -> np.ndarray:
    """RSI calculation"""
    delta = np.diff(close_prices, prepend=close_prices[0])
    gain = np.where(delta > 0, delta, 0)
    loss = np.where(delta < 0, -delta, 0)
    
    avg_gain = np.zeros_like(close_prices)
    avg_loss = np.zeros_like(close_prices)
    
    avg_gain[period] = np.mean(gain[1:period+1])
    avg_loss[period] = np.mean(loss[1:period+1])
    
    for i in range(period+1, len(close_prices)):
        avg_gain[i] = (avg_gain[i-1] * (period-1) + gain[i]) / period
        avg_loss[i] = (avg_loss[i-1] * (period-1) + loss[i]) / period
    
    rs = np.where(avg_loss != 0, avg_gain / avg_loss, 0)
    return 100 - (100 / (1 + rs))


def backtest_period(close: np.ndarray, rsi_period: int, rsi_threshold: int, sma_period: int) -> dict:
    """Backtest on a specific data segment"""
    if len(close) < sma_period + 50:
        return {"return": 0, "trades": 0, "sharpe": 0}
    
    rsi = calculate_rsi(close, rsi_period)
    sma = np.convolve(close, np.ones(sma_period)/sma_period, mode='same')
    
    capital = 10000
    position = 0
    entry_price = 0
    returns = []
    
    for i in range(sma_period, len(close)):
        should_long = close[i] > sma[i] and rsi[i] > rsi_threshold
        
        if should_long and position == 0:
            position = capital / close[i]
            entry_price = close[i]
        elif not should_long and position > 0:
            pnl = (close[i] - entry_price) / entry_price - 0.001
            returns.append(pnl)
            capital = position * close[i] * 0.9995
            position = 0
    
    if position > 0:
        pnl = (close[-1] - entry_price) / entry_price - 0.001
        returns.append(pnl)
        capital = position * close[-1]
    
    if len(returns) < 2:
        return {"return": 0, "trades": len(returns), "sharpe": 0}
    
    total_return = (capital - 10000) / 10000
    avg_ret = np.mean(returns)
    std_ret = np.std(returns)
    sharpe = avg_ret / std_ret * np.sqrt(len(returns)) if std_ret > 0 else 0
    
    return {
        "return": total_return,
        "trades": len(returns),
        "sharpe": sharpe,
        "win_rate": np.mean(np.array(returns) > 0) * 100
    }


def walk_forward_validation(n_folds: int = 5):
    """
    Walk-Forward Validation
    
    データを時系列で n_folds に分割し、
    各フォールドで「過去データで最適化 → 未来データで検証」を実施
    """
    logger.info("📊 Loading historical data...")
    df = pl.read_parquet(HISTORICAL_FILE)
    close = df["close"].to_numpy()
    
    total_len = len(close)
    fold_size = total_len // n_folds
    
    logger.info(f"📅 Total data: {total_len} days")
    logger.info(f"📅 Fold size: {fold_size} days (~{fold_size//365} years per fold)")
    
    print("\n" + "="*70)
    print("🔬 WALK-FORWARD VALIDATION")
    print("="*70)
    
    # 最適化済みパラメータ
    optimal_params = {"rsi_period": 21, "rsi_threshold": 52, "sma_period": 240}
    
    results = []
    
    for fold in range(1, n_folds):
        train_end = fold * fold_size
        test_start = train_end
        test_end = min(test_start + fold_size, total_len)
        
        train_data = close[:train_end]
        test_data = close[test_start:test_end]
        
        # 訓練期間でのパフォーマンス
        train_result = backtest_period(
            train_data,
            optimal_params["rsi_period"],
            optimal_params["rsi_threshold"],
            optimal_params["sma_period"]
        )
        
        # テスト期間でのパフォーマンス (Out-of-Sample)
        test_result = backtest_period(
            test_data,
            optimal_params["rsi_period"],
            optimal_params["rsi_threshold"],
            optimal_params["sma_period"]
        )
        
        results.append({
            "fold": fold,
            "train_return": train_result["return"] * 100,
            "test_return": test_result["return"] * 100,
            "train_sharpe": train_result["sharpe"],
            "test_sharpe": test_result["sharpe"],
            "test_trades": test_result["trades"]
        })
        
        print(f"\nFold {fold}:")
        print(f"  Train (in-sample):  Return={train_result['return']*100:6.1f}%, Sharpe={train_result['sharpe']:.2f}")
        print(f"  Test (out-sample):  Return={test_result['return']*100:6.1f}%, Sharpe={test_result['sharpe']:.2f}, Trades={test_result['trades']}")
    
    # サマリー
    print("\n" + "="*70)
    print("📊 SUMMARY")
    print("="*70)
    
    avg_train_return = np.mean([r["train_return"] for r in results])
    avg_test_return = np.mean([r["test_return"] for r in results])
    avg_test_sharpe = np.mean([r["test_sharpe"] for r in results])
    
    print(f"Average Train Return: {avg_train_return:.1f}%")
    print(f"Average Test Return:  {avg_test_return:.1f}%")
    print(f"Average Test Sharpe:  {avg_test_sharpe:.2f}")
    
    # 過学習判定
    overfit_ratio = avg_train_return / avg_test_return if avg_test_return != 0 else float('inf')
    
    print(f"\nOverfit Ratio (Train/Test): {overfit_ratio:.2f}")
    
    if overfit_ratio < 1.5:
        print("✅ LOW overfit risk - strategy appears robust")
    elif overfit_ratio < 2.5:
        print("⚠️ MODERATE overfit risk - monitor performance")
    else:
        print("❌ HIGH overfit risk - consider simpler parameters")
    
    print("="*70)
    
    return results


if __name__ == "__main__":
    walk_forward_validation(n_folds=5)
