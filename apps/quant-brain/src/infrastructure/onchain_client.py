"""
On-Chain Alpha Client - Bandwidth-Efficient Implementation
無料公開APIを使用してオンチェーン指標を取得。
CryptoQuant/Glassnodeは有料のため、代替としてblockchain.com/mempool.space APIを使用。
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional
import httpx
import orjson
import redis.asyncio as redis

logger = logging.getLogger("onchain")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# 帯域効率化: 5分に1回のみAPIコール（オンチェーンデータは急変しない）
POLL_INTERVAL_SECONDS = 300  # 5分


class OnChainClient:
    """
    On-Chain Data Client (Free APIs)
    
    データソース:
    - blockchain.com API: ハッシュレート、難易度、未確認TX数
    - mempool.space API: 手数料率、メンプール状況
    
    帯域効率化設計:
    - ポーリング間隔: 300秒 (288 req/day)
    - Redis キャッシュ: TTL 10分
    - HTTPコネクションプール
    """
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.http: Optional[httpx.AsyncClient] = None
        self._running = False
        self._task: Optional[asyncio.Task] = None
        
    async def start(self):
        """クライアント起動"""
        self.redis = redis.from_url(REDIS_URL)
        self.http = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_connections=3)  # 帯域節約
        )
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info(f"⛓️ On-Chain Client started (interval: {POLL_INTERVAL_SECONDS}s)")
        
    async def stop(self):
        """クライアント停止"""
        self._running = False
        if self._task:
            self._task.cancel()
        if self.http:
            await self.http.aclose()
        if self.redis:
            await self.redis.aclose()
        logger.info("⛓️ On-Chain Client stopped")
        
    async def _poll_loop(self):
        """メインポーリングループ"""
        while self._running:
            try:
                await self._fetch_and_cache()
            except Exception as e:
                logger.error(f"On-chain polling error: {e}")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            
    async def _fetch_and_cache(self):
        """オンチェーンデータ取得 & Redisキャッシュ"""
        now_ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        
        # 1. Mempool.space API - 手数料率 & メンプール状況
        mempool_data = await self._fetch_mempool()
        
        # 2. Blockchain.com API - ネットワーク統計
        network_data = await self._fetch_network_stats()
        
        # 統合データ
        combined = {
            "updated_at": now_ts,
            "mempool": mempool_data,
            "network": network_data,
            "signals": self._generate_signals(mempool_data, network_data)
        }
        
        # Redisにキャッシュ (TTL: 10分)
        await self.redis.set(
            "onchain:btc",
            orjson.dumps(combined),
            ex=600
        )
        
        # シグナルがあれば配信
        if combined["signals"]:
            await self._publish_signals(combined["signals"])
            
        logger.debug(f"⛓️ On-chain data updated: {len(combined['signals'])} signals")
        
    async def _fetch_mempool(self) -> dict:
        """Mempool.space API - メンプール状況"""
        try:
            # 推奨手数料率
            resp = await self.http.get("https://mempool.space/api/v1/fees/recommended")
            resp.raise_for_status()
            fees = resp.json()
            
            # メンプール統計
            resp2 = await self.http.get("https://mempool.space/api/mempool")
            resp2.raise_for_status()
            mempool = resp2.json()
            
            return {
                "fee_fastest": fees.get("fastestFee", 0),
                "fee_half_hour": fees.get("halfHourFee", 0),
                "fee_hour": fees.get("hourFee", 0),
                "fee_economy": fees.get("economyFee", 0),
                "tx_count": mempool.get("count", 0),
                "vsize_total": mempool.get("vsize", 0)
            }
        except Exception as e:
            logger.warning(f"Mempool API error: {e}")
            return {}
            
    async def _fetch_network_stats(self) -> dict:
        """Blockchain.com API - ネットワーク統計"""
        try:
            # 未確認TX数
            resp = await self.http.get("https://blockchain.info/q/unconfirmedcount")
            resp.raise_for_status()
            unconfirmed = int(resp.text)
            
            # ハッシュレート (最新ブロック情報から)
            resp2 = await self.http.get("https://blockchain.info/q/hashrate")
            resp2.raise_for_status()
            hashrate = float(resp2.text)
            
            # 難易度
            resp3 = await self.http.get("https://blockchain.info/q/getdifficulty")
            resp3.raise_for_status()
            difficulty = float(resp3.text)
            
            return {
                "unconfirmed_txs": unconfirmed,
                "hashrate_gh": hashrate / 1e9,  # GH/s
                "difficulty": difficulty
            }
        except Exception as e:
            logger.warning(f"Blockchain API error: {e}")
            return {}
            
    def _generate_signals(self, mempool: dict, network: dict) -> list:
        """シグナル生成ロジック"""
        signals = []
        
        # 1. 手数料率急騰 = ネットワーク混雑 = 高ボラティリティ予兆
        if mempool.get("fee_fastest", 0) > 100:  # 100 sat/vB 超え
            signals.append({
                "type": "high_fee",
                "severity": "warning",
                "message": f"High network fees: {mempool['fee_fastest']} sat/vB",
                "implication": "Network congestion - expect volatility"
            })
            
        # 2. 未確認TX数急増 = 大量送金 = 潜在的な価格変動
        if network.get("unconfirmed_txs", 0) > 200000:  # 20万TX超え
            signals.append({
                "type": "mempool_congestion",
                "severity": "warning",
                "message": f"Mempool congestion: {network['unconfirmed_txs']} unconfirmed TXs",
                "implication": "Large volume movement - watch for price action"
            })
            
        # 3. 手数料が非常に低い = ネットワーク空き = 静かな市場
        if mempool.get("fee_fastest", 0) < 5:  # 5 sat/vB 以下
            signals.append({
                "type": "low_fee",
                "severity": "info",
                "message": f"Low network fees: {mempool['fee_fastest']} sat/vB",
                "implication": "Quiet market - low activity"
            })
            
        return signals
        
    async def _publish_signals(self, signals: list):
        """シグナル配信"""
        for signal in signals:
            msg = {
                "type": "onchain_signal",
                "ts": int(datetime.now(timezone.utc).timestamp() * 1000),
                "data": signal
            }
            await self.redis.publish("brain:events", orjson.dumps(msg))
            logger.info(f"⛓️ On-chain signal: {signal['type']} - {signal['message']}")
            
    async def get_data(self) -> Optional[dict]:
        """キャッシュからオンチェーンデータ取得"""
        cached = await self.redis.get("onchain:btc")
        if cached:
            return orjson.loads(cached)
        return None
