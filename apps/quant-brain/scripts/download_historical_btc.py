"""
Download Historical BTC Daily Data

CryptoDataDownload または Binance API から2017年以降のBTC日足データを取得
データ期間: 2017-2024 (Binanceローンチ以降)
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
import httpx
import polars as pl

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("data_downloader")

# Output directory
DATA_DIR = "/app/data/historical"
OUTPUT_FILE = f"{DATA_DIR}/btc_daily.parquet"

# Binance Public API (no auth required)
BINANCE_BASE_URL = "https://api.binance.com"


async def fetch_binance_klines(symbol: str = "BTCUSDT", interval: str = "1d", limit: int = 1000) -> list[dict]:
    """
    Binance Klines API から日足データを取得
    https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
    """
    all_data = []
    end_time = int(datetime.now(timezone.utc).timestamp() * 1000)
    
    # 2017年7月14日 (Binance ローンチ日) から開始
    start_time = int(datetime(2017, 7, 14, tzinfo=timezone.utc).timestamp() * 1000)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        while start_time < end_time:
            params = {
                "symbol": symbol,
                "interval": interval,
                "startTime": start_time,
                "limit": limit
            }
            
            resp = await client.get(f"{BINANCE_BASE_URL}/api/v3/klines", params=params)
            resp.raise_for_status()
            data = resp.json()
            
            if not data:
                break
                
            all_data.extend(data)
            logger.info(f"📥 Fetched {len(all_data)} daily candles...")
            
            # 次のページ
            last_ts = data[-1][0]
            start_time = last_ts + 86400000  # +1 day
            
            await asyncio.sleep(0.2)  # Rate limit
            
    return all_data


def process_klines(raw_data: list) -> pl.DataFrame:
    """
    Binance Klines形式をDataFrameに変換
    
    Kline format: [
        Open time, Open, High, Low, Close, Volume,
        Close time, Quote asset volume, Number of trades,
        Taker buy base vol, Taker buy quote vol, Ignore
    ]
    """
    records = []
    for k in raw_data:
        records.append({
            "ts": int(k[0]),
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5])
        })
        
    df = pl.DataFrame(records)
    df = df.sort("ts")
    
    # 重複除去
    df = df.unique(subset=["ts"])
    
    return df


async def main():
    logger.info("🚀 Starting BTC historical data download...")
    
    # ディレクトリ作成
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # データ取得
    raw_data = await fetch_binance_klines("BTCUSDT", "1d")
    
    if not raw_data:
        logger.error("❌ No data fetched!")
        return None
        
    # 変換
    df = process_klines(raw_data)
    
    # 統計情報
    first_date = datetime.fromtimestamp(df["ts"][0] / 1000, tz=timezone.utc)
    last_date = datetime.fromtimestamp(df["ts"][-1] / 1000, tz=timezone.utc)
    
    logger.info(f"📊 Data Summary:")
    logger.info(f"   Period: {first_date.date()} to {last_date.date()}")
    logger.info(f"   Total Records: {len(df)}")
    logger.info(f"   First Price: ${df['close'][0]:,.2f}")
    logger.info(f"   Last Price: ${df['close'][-1]:,.2f}")
    
    # 保存
    df.write_parquet(OUTPUT_FILE)
    logger.info(f"💾 Saved to {OUTPUT_FILE}")
    
    return df


if __name__ == "__main__":
    asyncio.run(main())
