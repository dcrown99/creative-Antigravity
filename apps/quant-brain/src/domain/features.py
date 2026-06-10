"""
Feature Factory - Multi-Signal Integration
Polars Expression を使用した超高速特徴量生成。
Funding Rate / On-Chain データも統合。
"""
import polars as pl
from typing import Optional
import redis.asyncio as redis
import orjson
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")


class FeatureFactory:
    """
    Multi-Signal Feature Factory
    
    特徴量カテゴリ:
    1. テクニカル指標 (価格ベース)
    2. Funding Rate (市場センチメント)
    3. On-Chain (ネットワーク活動)
    """
    
    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._cached_funding: dict = {}
        self._cached_onchain: dict = {}
    
    async def _ensure_redis(self):
        """Redis接続を確保"""
        if self._redis is None:
            self._redis = redis.from_url(REDIS_URL)
        return self._redis
    
    async def get_funding_features(self, symbol: str = "BTCUSDT") -> dict:
        """Funding Rate 特徴量を取得"""
        r = await self._ensure_redis()
        cached = await r.get(f"funding:{symbol}")
        if cached:
            data = orjson.loads(cached)
            return {
                "funding_rate": data.get("rate", 0),
                "funding_annualized": data.get("annualized_pct", 0),
            }
        return {"funding_rate": 0, "funding_annualized": 0}
    
    async def get_onchain_features(self) -> dict:
        """On-Chain 特徴量を取得"""
        r = await self._ensure_redis()
        cached = await r.get("onchain:data")
        if cached:
            data = orjson.loads(cached)
            mempool = data.get("mempool", {})
            blockchain = data.get("blockchain", {})
            fees = data.get("fees", {})
            return {
                "mempool_size": mempool.get("vsize", 0) / 1e8,  # Normalize
                "mempool_count": mempool.get("count", 0) / 100000,  # Normalize
                "fee_fast": fees.get("fastestFee", 0) / 100,  # sat/vB normalized
                "fee_medium": fees.get("halfHourFee", 0) / 100,
                "unconfirmed_tx": blockchain.get("unconfirmed_count", 0) / 100000,
                "hashrate_normalized": min(blockchain.get("hashrate", 0) / 1e20, 1),
            }
        return {
            "mempool_size": 0, "mempool_count": 0,
            "fee_fast": 0, "fee_medium": 0,
            "unconfirmed_tx": 0, "hashrate_normalized": 0
        }
    
    @staticmethod
    def add_technical_indicators(df: pl.DataFrame) -> pl.DataFrame:
        """
        OHLCVデータにテクニカル指標を追加する。
        """
        return df.with_columns([
            # 1. Log Returns (対数収益率) - 定常性が高い
            pl.col("close").log().diff().alias("log_return"),
            
            # 2. Volatility (Rolling StdDev)
            pl.col("close").rolling_std(window_size=20).alias("volatility_20"),
            
            # 3. Simple Moving Averages
            pl.col("close").rolling_mean(window_size=20).alias("sma_20"),
            pl.col("close").rolling_mean(window_size=50).alias("sma_50"),
            
            # 4. Price momentum
            (pl.col("close") / pl.col("close").shift(10) - 1).alias("momentum_10"),
            
            # 5. Volume momentum
            (pl.col("volume") / pl.col("volume").rolling_mean(window_size=20)).alias("volume_ratio"),
            
        ]).with_columns([
            # SMA Cross Signal
            (pl.col("sma_20") > pl.col("sma_50")).cast(pl.Int8).alias("signal_trend"),
            
            # Volatility regime
            (pl.col("volatility_20") > pl.col("volatility_20").rolling_mean(window_size=50)).cast(pl.Int8).alias("high_volatility"),
        ]).drop_nulls()
    
    @staticmethod
    def add_external_features(df: pl.DataFrame, funding: dict, onchain: dict) -> pl.DataFrame:
        """
        外部データ (Funding Rate, On-Chain) を特徴量として追加
        
        Note: 外部データは時系列ではなく最新値として全行に追加
        """
        return df.with_columns([
            # Funding Rate Features
            pl.lit(funding.get("funding_rate", 0)).alias("funding_rate"),
            pl.lit(funding.get("funding_annualized", 0)).alias("funding_annualized"),
            
            # On-Chain Features
            pl.lit(onchain.get("mempool_size", 0)).alias("mempool_size"),
            pl.lit(onchain.get("fee_fast", 0)).alias("fee_fast"),
            pl.lit(onchain.get("unconfirmed_tx", 0)).alias("unconfirmed_tx"),
            pl.lit(onchain.get("hashrate_normalized", 0)).alias("hashrate_normalized"),
        ])
    
    async def build_features(self, df: pl.DataFrame, symbol: str = "BTCUSDT") -> pl.DataFrame:
        """
        完全な特徴量セットを構築 (オンライン推論用)
        """
        # 1. テクニカル指標
        df = self.add_technical_indicators(df)
        
        # 2. 外部データ取得
        funding = await self.get_funding_features(symbol)
        onchain = await self.get_onchain_features()
        
        # 3. 外部特徴量追加
        df = self.add_external_features(df, funding, onchain)
        
        return df
    
    @staticmethod
    def get_feature_columns() -> list[str]:
        """モデル学習に使用する特徴量カラムリスト"""
        return [
            # Technical
            "log_return", "volatility_20", "sma_20", "sma_50",
            "momentum_10", "volume_ratio", "signal_trend", "high_volatility",
            # Funding
            "funding_rate", "funding_annualized",
            # On-Chain
            "mempool_size", "fee_fast", "unconfirmed_tx", "hashrate_normalized"
        ]
