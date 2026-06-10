import asyncio
import os
import logging
from contextlib import asynccontextmanager
import orjson
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from src.infrastructure.recorder import DataRecorder
from src.infrastructure.discord import DiscordNotifier # New!
from src.infrastructure.onchain_client import OnChainClient  # Phase 2
from src.infrastructure.scheduler import ModelTrainingScheduler  # Scheduler
from src.infrastructure.indicator_service import IndicatorService  # Daily Indicators
from src.domain.ghost_client import GhostClient
from src.domain.risk_manager import RiskManager  # Phase 3

from src.strategies.momentum_strategy import DailyMomentumStrategy  # Long-term

# --- Configuration ---
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s.%(msecs)03d [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("brain")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
STREAM_KEYS = ["market:trades", "market:ticker", "market:liquidations"]
CONSUMER_GROUP = "brain_group"
CONSUMER_NAME = f"brain_{os.uname().nodename}"

# --- Global State ---
redis_client: redis.Redis = None
recorder: DataRecorder = None
ghost: GhostClient = None
momentum_strategy: DailyMomentumStrategy = None  # Long-term (replaces NeuralStrategy)
discord_bot: DiscordNotifier = None # New!

onchain_client: OnChainClient = None  # Phase 2
risk_manager: RiskManager = None  # Phase 3
indicator_service: IndicatorService = None  # Daily Indicators
training_scheduler: ModelTrainingScheduler = None  # Weekly Training
shutdown_event = asyncio.Event()
connected_websockets = set()

# --- WebSocket Manager ---
async def broadcast_ws(message: str):
    """接続中の全ブラウザに配信"""
    for ws in list(connected_websockets):
        try:
            await ws.send_text(message)
        except Exception:
            connected_websockets.discard(ws)

async def pubsub_loop():
    """
    Redis Pub/Sub (brain:events) を監視して:
    1. WebSocket (Monitor) に流す
    2. Discord (Notify) に流す
    """
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("brain:events")
    logger.info("📡 Broadcasting System Online (WS + Discord)")
    
    async for message in pubsub.listen():
        if message['type'] == 'message':
            try:
                raw_data = message['data']
                payload = orjson.loads(raw_data)
                
                # 1. WebSocketへ転送 (Monitor用)
                # これは軽量なのでawaitしてもOK
                await broadcast_ws(raw_data.decode())
                
                # 2. Discordへ通知 (New!)
                # APIコールは遅いので、Fire and Forget (create_task) する
                if discord_bot:
                    asyncio.create_task(
                        discord_bot.send_event(payload.get("type"), payload.get("data"))
                    )
                    
            except Exception as e:
                logger.error(f"PubSub Handler Error: {e}")

# --- Core Logic (Consumer) ---
async def process_stream_message(stream: str, msg_id: str, data: dict):
    try:
        if b'payload' not in data:
            return
        payload = orjson.loads(data[b'payload'])
        
        tasks = []
        tasks.append(asyncio.create_task(recorder.add(payload)))
        
        # Broadcast ticker price to WebSocket monitor
        if stream == "market:ticker" and "last" in payload:
            price_msg = orjson.dumps({
                "type": "market_price",
                "data": {
                    "price": float(payload.get("last", 0)),
                    "ts": payload.get("ts", 0)
                }
            }).decode()
            tasks.append(asyncio.create_task(broadcast_ws(price_msg)))
            
        await asyncio.gather(*tasks, return_exceptions=True)
        await redis_client.xack(stream, CONSUMER_GROUP, msg_id)
    except Exception as e:
        logger.error(f"Error {msg_id}: {e}")

async def consume_loop():
    for key in STREAM_KEYS:
        try:
            await redis_client.xgroup_create(key, CONSUMER_GROUP, mkstream=True)
        except Exception:
            pass
    
    while not shutdown_event.is_set():
        try:
            streams = {k: ">" for k in STREAM_KEYS}
            results = await redis_client.xreadgroup(CONSUMER_GROUP, CONSUMER_NAME, streams, count=100, block=2000)
            if not results:
                await recorder.flush()
                continue
            for sb, msgs in results:
                for mid, d in msgs:
                    await process_stream_message(sb.decode(), mid, d)
            if len(recorder.buffer) > 1000:
                await recorder.flush()
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(1)

# --- Lifecycle ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, recorder, ghost, momentum_strategy, discord_bot, funding_client, funding_strategy, onchain_client, risk_manager, indicator_service
    
    logger.info("🚀 Quant Brain Initializing...")
    redis_client = redis.from_url(REDIS_URL)
    recorder = DataRecorder()
    
    # Initialize Database (create tables if not exist)
    from src.db import init_db
    await init_db()
    
    # Init Discord Bot
    discord_bot = DiscordNotifier()
    
    # Phase 3: Risk Manager (before strategies)
    risk_manager = RiskManager(initial_balance=10000.0)
    await risk_manager.start(redis_client)
    
    # Daily Indicator Service (before momentum strategy)
    indicator_service = IndicatorService(symbol="BTC/USDT:USDT")
    await indicator_service.start()
    
    # Ghost with Redis for Telemetry
    ghost = GhostClient(initial_balance=10000.0, redis=redis_client)
    
    # Long-term: Daily Momentum Strategy (with RiskManager integration)
    momentum_strategy = DailyMomentumStrategy(client=ghost, symbol="BTC/USDT", risk_manager=risk_manager)
    await momentum_strategy.start(redis_client)
    logger.info("📈 Daily Momentum Strategy Online (Evidence-Based + RiskManager)")
    

    
    # Phase 2: On-Chain Alpha (Bandwidth-efficient: 1 req/5min)
    onchain_client = OnChainClient()
    await onchain_client.start()
    logger.info("⛓️ On-Chain Alpha Online")
    
    # Start Weekly Training Scheduler
    training_scheduler = ModelTrainingScheduler()
    await training_scheduler.start()
    logger.info("📅 Weekly Training Scheduler Online")
    
    task_consume = asyncio.create_task(consume_loop())
    task_pubsub = asyncio.create_task(pubsub_loop())
    
    yield
    
    shutdown_event.set()
    task_consume.cancel()
    task_pubsub.cancel()
    
    # Cleanup Scheduler
    await training_scheduler.stop()
    
    # Cleanup Phase 2
    await onchain_client.stop()
    
    # Cleanup Long-term Strategy
    await indicator_service.stop()
    await momentum_strategy.stop()
    

    
    await recorder.flush()
    await redis_client.aclose()
    logger.info("👋 Brain Offline")

app = FastAPI(title="Quant Brain (Visual Cortex + Discord)", lifespan=lifespan)

@app.websocket("/ws/monitor")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_websockets.discard(websocket)

@app.get("/status")
async def status():
    pos = await ghost.get_position("BTC/USDT") if ghost else 0
    bal = await ghost.get_balance() if ghost else 0
    return {
        "status": "online", 
        "mode": "GHOST", 
        "discord": bool(discord_bot.webhook_url),
        "balance": bal,
        "position": pos
    }



@app.get("/onchain")
async def onchain_status():
    """On-Chain Alpha Status (Phase 2)"""
    data = await onchain_client.get_data() if onchain_client else None
    return {
        "status": "active",
        "poll_interval_sec": 300,
        "data": data
    }

@app.get("/risk")
async def risk_status():
    """Risk Management Status (Phase 3)"""
    stats = risk_manager.get_stats() if risk_manager else {}
    can_trade, reason = risk_manager.can_trade() if risk_manager else (False, "Not initialized")
    return {
        "status": "active" if can_trade else "halted",
        "reason": reason,
        "stats": stats
    }

@app.put("/risk/kelly")
async def update_kelly(fraction: float):
    """Update Kelly Criterion fraction (0.05 - 1.0)"""
    if not risk_manager:
        return {"error": "Risk manager not initialized"}
    new_fraction = await risk_manager.set_kelly_fraction(fraction)
    return {"kelly_fraction": new_fraction, "message": f"Kelly fraction updated to {new_fraction:.0%}"}

@app.get("/scheduler")
async def scheduler_status():
    """Weekly Training Scheduler Status"""
    next_run = training_scheduler.get_next_run() if training_scheduler else None
    return {
        "status": "active",
        "schedule": "Every Monday 09:00 JST",
        "next_run": next_run.isoformat() if next_run else None
    }

@app.post("/scheduler/run")
async def trigger_training():
    """手動でモデル学習をトリガー"""
    if training_scheduler:
        asyncio.create_task(training_scheduler.run_now())
        return {"status": "triggered", "message": "Training pipeline started in background"}
    return {"status": "error", "message": "Scheduler not initialized"}

@app.get("/momentum")
async def momentum_status():
    """Daily Momentum Strategy Status (Long-term)"""
    status = momentum_strategy.get_status() if momentum_strategy else {}
    return {
        "status": "active",
        "strategy": "Daily RSI Momentum + SMA200 Filter",
        "evidence": "CAGR 122% vs B&H 101% (backtest 2013-2023)",
        **status
    }

@app.post("/notifications/test")
async def send_test_notification():
    """Send a test notification to Discord"""
    if discord_bot:
        await discord_bot.send_event("test", {"message": "This is a test signal from Quant Brain. 🧠"})
        return {"status": "sent", "message": "Check your Discord channel"}
    return {"status": "error", "message": "Discord bot not initialized"}

