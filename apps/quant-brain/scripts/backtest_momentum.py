"""
Momentum Strategy Walk-forward Backtest
Training: 2017-2022, Test: 2023-2024
"""
import ccxt
import pandas as pd
import numpy as np
from datetime import datetime

# Strategy Parameters (OPTIMIZED via Optuna)
RSI_PERIOD = 16
RSI_THRESHOLD = 55
SMA_PERIOD = 190
TAKER_FEE = 0.00055  # 0.055%
SLIPPAGE = 0.0005    # 0.05%
INITIAL_CAPITAL = 100000  # ¥100,000

def fetch_btc_daily(years_back=8):
    """Binance から BTC/USDT 日足データを取得"""
    exchange = ccxt.binance({'enableRateLimit': True})
    
    print("📊 Fetching BTC/USDT daily data...")
    
    all_data = []
    since = exchange.parse8601(f'{2017}-01-01T00:00:00Z')
    
    while True:
        ohlcv = exchange.fetch_ohlcv('BTC/USDT', '1d', since=since, limit=1000)
        if not ohlcv:
            break
        all_data.extend(ohlcv)
        since = ohlcv[-1][0] + 86400000  # Next day
        if since > exchange.milliseconds():
            break
        print(f"   Fetched {len(all_data)} candles...")
    
    df = pd.DataFrame(all_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
    df.set_index('date', inplace=True)
    
    print(f"✅ Total: {len(df)} days ({df.index.min()} to {df.index.max()})")
    return df

def calculate_indicators(df):
    """RSI と SMA を計算"""
    # SMA
    df['sma200'] = df['close'].rolling(window=SMA_PERIOD).mean()
    
    # RSI
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(window=RSI_PERIOD).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=RSI_PERIOD).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    
    return df

def run_backtest(df, start_date, end_date, fee_pct=TAKER_FEE + SLIPPAGE):
    """バックテスト実行"""
    data = df.loc[start_date:end_date].copy()
    
    capital = INITIAL_CAPITAL
    position = 0
    entry_price = 0
    trades = []
    equity_curve = []
    
    for i, (date, row) in enumerate(data.iterrows()):
        if pd.isna(row['rsi']) or pd.isna(row['sma200']):
            continue
            
        price = row['close']
        
        # Entry condition: RSI > 50 and Price > SMA200
        should_long = row['rsi'] > RSI_THRESHOLD and price > row['sma200']
        
        if position == 0 and should_long:
            # Entry
            position = capital / price
            fee = capital * fee_pct
            capital -= fee
            entry_price = price
            
        elif position > 0 and not should_long:
            # Exit
            exit_value = position * price
            fee = exit_value * fee_pct
            pnl = (price - entry_price) * position - fee
            capital = exit_value - fee
            trades.append({'entry': entry_price, 'exit': price, 'pnl': pnl})
            position = 0
            
        # Track equity
        equity = capital + (position * price if position > 0 else 0)
        equity_curve.append(equity)
    
    # Close final position
    if position > 0:
        final_price = data['close'].iloc[-1]
        exit_value = position * final_price
        fee = exit_value * fee_pct
        pnl = (final_price - entry_price) * position - fee
        trades.append({'entry': entry_price, 'exit': final_price, 'pnl': pnl})
        capital = exit_value - fee
    
    # Calculate metrics
    equity = pd.Series(equity_curve)
    drawdown = (equity.cummax() - equity) / equity.cummax() * 100
    max_dd = drawdown.max()
    
    total_pnl = capital - INITIAL_CAPITAL
    total_return = (capital / INITIAL_CAPITAL - 1) * 100
    years = (pd.to_datetime(end_date) - pd.to_datetime(start_date)).days / 365
    annualized = total_return / years if years > 0 else 0
    
    win_trades = [t for t in trades if t['pnl'] > 0]
    win_rate = len(win_trades) / len(trades) * 100 if trades else 0
    
    return {
        'total_return': total_return,
        'annualized': annualized,
        'max_dd': max_dd,
        'trades': len(trades),
        'win_rate': win_rate,
        'final_capital': capital
    }

def main():
    # Fetch data
    df = fetch_btc_daily()
    df = calculate_indicators(df)
    
    print("\n" + "="*60)
    print("🧪 WALK-FORWARD VALIDATION")
    print("="*60)
    
    # Training period: 2017-2022
    print("\n📈 Training Period (2017-2022):")
    train_result = run_backtest(df, '2017-01-01', '2022-12-31')
    print(f"   Return: {train_result['total_return']:.1f}%")
    print(f"   Annualized: {train_result['annualized']:.1f}%/year")
    print(f"   Max DD: {train_result['max_dd']:.1f}%")
    print(f"   Trades: {train_result['trades']}")
    print(f"   Win Rate: {train_result['win_rate']:.1f}%")
    
    # Test period: 2023-2024 (Out-of-sample)
    print("\n📊 Test Period (2023-2024) [OUT-OF-SAMPLE]:")
    test_result = run_backtest(df, '2023-01-01', '2024-12-31')
    print(f"   Return: {test_result['total_return']:.1f}%")
    print(f"   Annualized: {test_result['annualized']:.1f}%/year")
    print(f"   Max DD: {test_result['max_dd']:.1f}%")
    print(f"   Trades: {test_result['trades']}")
    print(f"   Win Rate: {test_result['win_rate']:.1f}%")
    
    # Verdict
    print("\n" + "="*60)
    print("✅ VERDICT")
    print("="*60)
    
    passed = True
    
    # Check annualized > 10%
    if test_result['annualized'] > 10:
        print(f"✅ Annualized Return: {test_result['annualized']:.1f}% > 10%")
    else:
        print(f"❌ Annualized Return: {test_result['annualized']:.1f}% < 10%")
        passed = False
    
    # Check Max DD < 40%
    if test_result['max_dd'] < 40:
        print(f"✅ Max Drawdown: {test_result['max_dd']:.1f}% < 40%")
    else:
        print(f"❌ Max Drawdown: {test_result['max_dd']:.1f}% > 40%")
        passed = False
    
    # Check Out-of-sample > 0%
    if test_result['total_return'] > 0:
        print(f"✅ Out-of-sample Return: {test_result['total_return']:.1f}% > 0%")
    else:
        print(f"❌ Out-of-sample Return: {test_result['total_return']:.1f}% < 0%")
        passed = False
    
    print("\n" + "="*60)
    if passed:
        print("🎉 ALL CRITERIA PASSED - Proceed to Phase 2")
    else:
        print("⚠️ CRITERIA NOT MET - Review strategy")
    print("="*60)

if __name__ == "__main__":
    main()
