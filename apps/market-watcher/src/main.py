import asyncio
import contextlib
import logging
import os
from contextlib import asynccontextmanager

import ccxt.pro as ccxt
import orjson
import redis.asyncio as redis
from fastapi import FastAPI

# --- Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s.%(msecs)03d [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("ingester")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
TARGET_SYMBOL = os.getenv("TARGET_SYMBOL", "BTC/USDT:USDT")
# スロットリング間隔 (ミリ秒) - デフォルト500ms
THROTTLE_MS = int(os.getenv("THROTTLE_MS", 500))
MAX_STREAM_LEN = 100000

# --- Global State ---
redis_client: redis.Redis = None
exchange: ccxt.Exchange = None
streamer = None

class SmartStreamer:
    """
    God Mode Traffic Controller
    - Ticker/Orderbook: Conflation (最新のみ保持し、中間を捨てる)
    - Trades: Batch Pipelining (全て保持し、一括送信する)
    """
    def __init__(self, redis_client: redis.Redis, interval_ms: int):
        self.redis = redis_client
        self.interval = interval_ms / 1000.0

        # Buffers (Conflation用)
        self._latest_ticker: dict | None = None
        self._latest_book: dict | None = None

        # Buffers (Batching用)
        self._trade_buffer: list[dict] = []

        self._lock = asyncio.Lock()
        self._running = False
        self._task = None

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._flush_loop())
        logger.info(f"🚦 Smart Streamer started (Interval: {self.interval*1000:.0f}ms)")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        # 最後に残ったデータをフラッシュ
        await self._flush(force=True)

    async def on_ticker(self, data: dict):
        # Stateデータなので上書きでOK (最新が全て)
        self._latest_ticker = data

    async def on_orderbook(self, data: dict):
        # Stateデータなので上書きでOK
        self._latest_book = data

    async def on_trade(self, data: dict):
        # Eventデータなので捨ててはいけない。リストに追加。
        async with self._lock:
            self._trade_buffer.append(data)

    async def _flush_loop(self):
        while self._running:
            await asyncio.sleep(self.interval)
            await self._flush()

    async def _flush(self, force=False):
        """バッファ内のデータをRedisへ放出"""
        try:
            # データがなければ何もしない
            async with self._lock:
                if not (self._latest_ticker or self._latest_book or self._trade_buffer):
                    return

                # Pipeline作成 (これ重要: 複数コマンドを1回の通信で行う)
                pipe = self.redis.pipeline()
                has_data = False

                # 1. Ticker (Conflation)
                if self._latest_ticker:
                    pipe.xadd(
                        "market:ticker",
                        {"payload": orjson.dumps(self._latest_ticker)},
                        maxlen=MAX_STREAM_LEN
                    )
                    self._latest_ticker = None
                    has_data = True

                # 2. Orderbook (Conflation)
                if self._latest_book:
                    pipe.xadd(
                        "market:orderbook",
                        {"payload": orjson.dumps(self._latest_book)},
                        maxlen=MAX_STREAM_LEN
                    )
                    self._latest_book = None
                    has_data = True

                # 3. Trades (Batch Pipelining)
                # quant-brain側を変えなくて済むよう、リストをバラして個別にXADDするが、
                # 通信はPipelineで1回にまとめる。これがGod Modeの互換性維持テクニック。
                if self._trade_buffer:
                    for trade in self._trade_buffer:
                        pipe.xadd(
                            "market:trades",
                            {"payload": orjson.dumps(trade)},
                            maxlen=MAX_STREAM_LEN
                        )
                    # ログに出しすぎないよう、大量の時だけ警告
                    if len(self._trade_buffer) > 100:
                        logger.warning(f"📦 Batched {len(self._trade_buffer)} trades")

                    self._trade_buffer.clear()
                    has_data = True

                if has_data:
                    await pipe.execute()

        except Exception as e:
            logger.error(f"Flush Error: {e}")

# --- Watcher Loops (各データソース監視) ---

async def watch_trades_loop():
    logger.info(f"👁️ Watching Trades: {TARGET_SYMBOL}")
    while True:
        try:
            trades = await exchange.watch_trades(TARGET_SYMBOL)
            for trade in trades:
                # 生データの軽量化と整形
                raw_info = trade.get('info', {})
                is_liquidation = raw_info.get('execType') == 'BustTrade' or raw_info.get('crossSeq') == 0

                payload = {
                    "type": "trade",
                    "ts": trade['timestamp'],
                    "price": trade['price'],
                    "amount": trade['amount'],
                    "side": trade['side'],
                    "liq": is_liquidation,
                    "id": trade['id']
                }
                # Streamerに渡す (即時送信しない)
                await streamer.on_trade(payload)

                if is_liquidation:
                    # 清算は重要かつ低頻度なので即時送信でも良いが、統一のためStreamer経由推奨
                    # ただし今回は別チャンネルなので直接送る（頻度低いのでOK）
                    await redis_client.xadd(
                        "market:liquidations",
                        {"payload": orjson.dumps(payload)},
                        maxlen=MAX_STREAM_LEN
                    )

        except Exception as e:
            logger.error(f"Trade Watcher Error: {e}")
            await asyncio.sleep(2)

async def watch_ticker_loop():
    logger.info(f"👁️ Watching Ticker: {TARGET_SYMBOL}")
    while True:
        try:
            ticker = await exchange.watch_ticker(TARGET_SYMBOL)
            payload = {
                "type": "ticker",
                "ts": ticker['timestamp'],
                "last": ticker['last'],
                "bid": ticker['bid'],
                "ask": ticker['ask'],
                "vol": ticker.get('baseVolume'),
                "funding": ticker.get('info', {}).get('fundingRate')
            }
            # Streamerに渡す (Conflation対象)
            await streamer.on_ticker(payload)
        except Exception as e:
            logger.error(f"Ticker Watcher Error: {e}")
            await asyncio.sleep(2)

async def watch_orderbook_loop():
    logger.info(f"👁️ Watching Orderbook: {TARGET_SYMBOL}")
    while True:
        try:
            # depth=50, 100ms制限 (ccxt側でもある程度制限あるが)
            orderbook = await exchange.watch_order_book(TARGET_SYMBOL, limit=50)
            payload = {
                "type": "book",
                "ts": orderbook['timestamp'],
                "bids": orderbook['bids'][:10], # 転送量削減のためTop10に絞る
                "asks": orderbook['asks'][:10]
            }
            # Streamerに渡す (Conflation対象)
            await streamer.on_orderbook(payload)
        except Exception as e:
            logger.error(f"Orderbook Watcher Error: {e}")
            await asyncio.sleep(2)

# --- Lifecycle ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, exchange, streamer

    logger.info("🚀 Market Ingester (Throttled Edition) Initializing...")

    redis_client = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    exchange = ccxt.bybit({
        'enableRateLimit': True,
        'options': {'defaultType': 'future'}
    })

    # SmartStreamerの起動
    streamer = SmartStreamer(redis_client, interval_ms=THROTTLE_MS)
    await streamer.start()

    tasks = [
        asyncio.create_task(watch_trades_loop()),
        asyncio.create_task(watch_ticker_loop()),
        asyncio.create_task(watch_orderbook_loop())
    ]

    yield

    logger.info("🛑 Shutting down...")
    await streamer.stop()
    for t in tasks:
        t.cancel()
    await exchange.close()
    await redis_client.aclose()

app = FastAPI(title="Market Ingester (Smart)", lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "running", "throttle_ms": THROTTLE_MS}
