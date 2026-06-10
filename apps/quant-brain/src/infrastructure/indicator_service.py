"""
Indicator Service - Daily OHLCV Fetch & RSI/SMA Calculation

起動時に過去300日の日足データを取得し、RSI/SMAを計算してRedisにキャッシュ。
毎日 UTC 00:05 に最新データで更新。TimescaleDB にも永続化。
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional
import orjson
import redis.asyncio as redis
import httpx
import polars as pl
from sqlalchemy import text

from src.db import AsyncSessionLocal

logger = logging.getLogger("indicator_service")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
HISTORY_DAYS = 300  # RSI/SMA計算に十分な日数
UPDATE_HOUR_UTC = 0
UPDATE_MINUTE_UTC = 5
CONFIG_PATH = "/app/config/momentum_params.json"

# Load optimized parameters
def _load_indicator_params() -> dict:
    """Load RSI/SMA periods from momentum_params.json"""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "rb") as f:
                params = orjson.loads(f.read())
                return {
                    "rsi_period": params.get("rsi_period", 14),
                    "sma_period": params.get("sma_period", 200),
                    "rsi_threshold": params.get("rsi_threshold", 50)
                }
        except Exception:
            pass
    return {"rsi_period": 14, "sma_period": 200, "rsi_threshold": 50}

_PARAMS = _load_indicator_params()
RSI_PERIOD = _PARAMS["rsi_period"]
SMA_PERIOD = _PARAMS["sma_period"]
RSI_THRESHOLD = _PARAMS["rsi_threshold"]


class IndicatorService:
    """
    日足インジケーター計算・キャッシュサービス
    
    Features:
    - Bybit API から日足 OHLCV 取得
    - RSI / SMA 計算 (パラメータは momentum_params.json から読み込み)
    - Redis にキャッシュ (indicators:{symbol})
    - TimescaleDB に永続化 (market_candles)
    """
    
    def __init__(self, symbol: str = "BTC/USDT:USDT"):
        self.symbol = symbol
        self.cache_key = f"indicators:{symbol.replace(':USDT', '').replace('/', '')}"
        self._redis: Optional[redis.Redis] = None
        self._running = False
        self._task: Optional[asyncio.Task] = None
        
    async def start(self):
        """サービス起動"""
        self._redis = redis.from_url(REDIS_URL)
        self._running = True
        
        # 起動時に即座にデータ取得・キャッシュ
        logger.info(f"📊 IndicatorService starting for {self.symbol}...")
        await self._fetch_and_cache()
        
        # 定期更新タスク開始
        self._task = asyncio.create_task(self._schedule_loop())
        logger.info(f"📊 IndicatorService Online (updates daily at UTC {UPDATE_HOUR_UTC:02d}:{UPDATE_MINUTE_UTC:02d})")
        
    async def stop(self):
        """サービス停止"""
        self._running = False
        if self._task:
            self._task.cancel()
        if self._redis:
            await self._redis.aclose()
        logger.info("📊 IndicatorService stopped")
        
    async def _schedule_loop(self):
        """毎日 UTC 00:05 に更新"""
        while self._running:
            try:
                now = datetime.now(timezone.utc)
                if now.hour == UPDATE_HOUR_UTC and now.minute == UPDATE_MINUTE_UTC:
                    await self._fetch_and_cache()
                    # 同じ分に再実行しないよう待機
                    await asyncio.sleep(60)
                else:
                    await asyncio.sleep(30)  # 30秒ごとにチェック
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Schedule error: {e}")
                await asyncio.sleep(60)
    
    async def _save_to_db(self, candles: list, api_symbol: str):
        """日足データを TimescaleDB に保存 (重複防止)"""
        try:
            async with AsyncSessionLocal() as session:
                saved_count = 0
                for c in candles:
                    ts = datetime.fromtimestamp(c[0] / 1000, tz=timezone.utc)
                    stmt = text("""
                        INSERT INTO market_candles (timestamp, symbol, interval, open, high, low, close, volume)
                        VALUES (:ts, :symbol, '1d', :open, :high, :low, :close, :volume)
                        ON CONFLICT (timestamp, symbol, interval) DO NOTHING
                    """)
                    result = await session.execute(stmt, {
                        "ts": ts, "symbol": api_symbol,
                        "open": c[1], "high": c[2], "low": c[3], "close": c[4], "volume": c[5]
                    })
                    if result.rowcount > 0:
                        saved_count += 1
                await session.commit()
                if saved_count > 0:
                    logger.info(f"   💾 Saved {saved_count} new daily candles to TimescaleDB")
        except Exception as e:
            logger.warning(f"   ⚠️ DB save failed (non-critical): {e}")
                
    async def _fetch_and_cache(self):
        """日足データ取得 → インジケーター計算 → キャッシュ"""
        try:
            # Binance API で日足 OHLCV を取得
            # Symbol format: BTC/USDT:USDT -> BTCUSDT
            api_symbol = self.symbol.replace("/", "").replace(":USDT", "")
            since = int((datetime.now(timezone.utc).timestamp() - HISTORY_DAYS * 86400) * 1000)
            
            url = "https://api.binance.com/api/v3/klines"
            params = {
                "symbol": api_symbol,
                "interval": "1d",
                "startTime": since,
                "limit": HISTORY_DAYS
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                raw_candles = response.json()
                
            if not raw_candles or len(raw_candles) < 50:
                logger.warning(f"⚠️ Insufficient data: {len(raw_candles) if raw_candles else 0} candles")
                return
            
            # Binance returns [openTime, open, high, low, close, volume, closeTime, ...]
            candles = [[int(c[0]), float(c[1]), float(c[2]), float(c[3]), float(c[4]), float(c[5])] 
                       for c in raw_candles]
                
            logger.info(f"   Fetched {len(candles)} daily candles from Binance")
            
            # TimescaleDB に保存 (非クリティカル)
            await self._save_to_db(candles, api_symbol)
            
            # DataFrame化
            df = pl.DataFrame(
                candles,
                schema=["ts", "open", "high", "low", "close", "volume"],
                orient="row"
            )
            
            # RSI計算 (動的パラメータ使用)
            close = df["close"]
            delta = close.diff()
            gain = delta.map_elements(lambda x: max(x, 0) if x is not None else 0, return_dtype=pl.Float64)
            loss = delta.map_elements(lambda x: max(-x, 0) if x is not None else 0, return_dtype=pl.Float64)
            avg_gain = gain.rolling_mean(window_size=RSI_PERIOD)
            avg_loss = loss.rolling_mean(window_size=RSI_PERIOD)
            rs = avg_gain / (avg_loss + 1e-10)
            rsi = 100 - (100 / (1 + rs))
            
            # SMA計算 (動的パラメータ使用)
            sma = close.rolling_mean(window_size=SMA_PERIOD)
            
            # 最新値を取得
            latest_idx = len(df) - 1
            latest_close = float(close[latest_idx])
            latest_rsi = float(rsi[latest_idx]) if rsi[latest_idx] is not None else 50.0
            latest_sma = float(sma[latest_idx]) if sma[latest_idx] is not None else latest_close
            
            # キャッシュ
            indicators = {
                "symbol": self.symbol,
                "close": latest_close,
                "rsi": latest_rsi,
                "sma200": latest_sma,  # 互換性のためキー名は維持
                "rsi_period": RSI_PERIOD,
                "sma_period": SMA_PERIOD,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "candle_count": len(candles)
            }
            
            await self._redis.set(self.cache_key, orjson.dumps(indicators))
            logger.info(f"   ✅ Cached: RSI({RSI_PERIOD})={latest_rsi:.1f}, Close=${latest_close:,.0f}, SMA({SMA_PERIOD})=${latest_sma:,.0f}")
            
        except Exception as e:
            logger.error(f"❌ Fetch error: {e}")
                
    async def get_indicators(self) -> Optional[dict]:
        """キャッシュからインジケーター取得"""
        if self._redis:
            cached = await self._redis.get(self.cache_key)
            if cached:
                return orjson.loads(cached)
        return None

