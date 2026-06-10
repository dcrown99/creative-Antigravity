import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
import ccxt.pro as ccxt
import polars as pl

logger = logging.getLogger("backfiller")

class BybitBackfiller:
    def __init__(self, symbol: str = "BTC/USDT:USDT"):
        self.symbol = symbol
        self.data_dir = "/app/data/raw"
        os.makedirs(self.data_dir, exist_ok=True)
        
    async def fetch_history(self, days: int = 365, timeframe: str = "1m"):
        """
        BybitのAPI制限(Limit)を回避しながら、過去データを少しずつ取得して結合する
        """
        exchange = ccxt.bybit({'enableRateLimit': True})
        all_candles = []
        
        # 現在時刻から遡る
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(days=days)
        current_pointer = int(start_time.timestamp() * 1000)
        
        logger.info(f"⏳ Starting backfill for {self.symbol} ({days} days)...")
        
        try:
            while current_pointer < int(end_time.timestamp() * 1000):
                # Bybitのlimitは最大1000件 (1000分 = 約16時間)
                try:
                    candles = await exchange.fetch_ohlcv(
                        symbol=self.symbol,
                        timeframe=timeframe,
                        since=current_pointer,
                        limit=1000
                    )
                    
                    if not candles:
                        break
                        
                    all_candles.extend(candles)
                    last_ts = candles[-1][0]
                    current_pointer = last_ts + 60000 # 次の1分へ
                    
                    # 進捗表示
                    dt_str = datetime.fromtimestamp(last_ts/1000).strftime('%Y-%m-%d %H:%M')
                    print(f"   Fetched until {dt_str} | Total: {len(all_candles)} candles", end="\r")
                    
                    # APIレートリミットへの配慮
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"❌ Fetch Error: {e}")
                    await asyncio.sleep(5) # エラー時は長めに待機
        
        finally:
            await exchange.close()
            print() # 改行

        if not all_candles:
            logger.warning("⚠️ No data fetched.")
            return

        # Polars DataFrame化 & 保存
        df = pl.DataFrame(
            all_candles, 
            schema=["ts", "open", "high", "low", "close", "volume"],
            orient="row"
        )
        
        # 重複削除とソート
        df = df.unique(subset=["ts"]).sort("ts")
        
        filename = f"history_{self.symbol.replace('/', '_').replace(':', '_')}_{timeframe}.parquet"
        filepath = os.path.join(self.data_dir, filename)
        df.write_parquet(filepath, compression="snappy")
        
        logger.info(f"✅ Saved {len(df)} rows to {filepath}")
