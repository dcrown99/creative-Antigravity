import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, DateTime, Float, String, Integer, text, select, func

# 環境変数
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/antigravity"
)

Base = declarative_base()


# --- Model: Market Candle (OHLCV) ---
class MarketCandle(Base):
    __tablename__ = "market_candles"

    # TimescaleDBのパーティションキー (必須)
    timestamp = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)  # ex: BTC/USDT
    interval = Column(String, primary_key=True, nullable=False)  # ex: 1m, 1h

    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)


# --- Model: Whale Alert (大口約定) ---
class WhaleAlert(Base):
    __tablename__ = "whale_alerts"

    # IDではなくタイムスタンプを主キーの一部にする(TimescaleDBのお作法)
    timestamp = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)

    side = Column(String, nullable=False)  # 'buy' or 'sell'
    price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)  # BTC枚数
    usd_value = Column(Float, nullable=False)  # ドル換算額 (閾値判定用)


# --- Model: Market Metrics (Futures Data: OI/FR) ---
class MarketMetric(Base):
    __tablename__ = "market_metrics"

    timestamp = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)

    open_interest = Column(Float, nullable=False)  # 未決済建玉(USD換算)
    funding_rate = Column(Float, nullable=False)  # 資金調達率(%)


# --- [NEW] Model: Liquidation Magnet (ロスカット推定) ---
class LiquidationMagnet(Base):
    __tablename__ = "liquidation_magnets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False) # 検知時刻
    symbol = Column(String, nullable=False)
    
    magnet_price = Column(Float, nullable=False) # ロスカット価格
    strength = Column(Float, nullable=False)     # 推定ロスカット額 (USD)
    leverage = Column(Integer, nullable=False)   # 推定レバレッジ倍率 (25, 50, 100)
    side = Column(String, nullable=False)        # 'long_liq' (下で死ぬ) or 'short_liq' (上で死ぬ)


# --- [NEW] Model: Trade History (トレード履歴) ---
class TradeHistory(Base):
    __tablename__ = "trade_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False)      # BUY/SELL
    qty = Column(Float, nullable=False)
    pnl = Column(Float, nullable=False)
    strategy = Column(String, nullable=False)  # momentum/funding/onchain


# --- Engine Setup ---
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """DB初期化: テーブル作成 & TimescaleDB Hypertable化"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))

        # Market Candles Hypertable
        try:
            await conn.execute(
                text(
                    "SELECT create_hypertable('market_candles', 'timestamp', if_not_exists => TRUE);"
                )
            )
            print("🧠 DB: Hypertable 'market_candles' is ready.")
        except Exception as e:
            print(f"🧠 DB Note: {e}")

        # Whale Alerts Hypertable
        try:
            await conn.execute(
                text(
                    "SELECT create_hypertable('whale_alerts', 'timestamp', if_not_exists => TRUE);"
                )
            )
            print("🧠 DB: Hypertable 'whale_alerts' is ready.")
        except Exception as e:
            print(f"🧠 DB Note: {e}")

        # Market Metrics Hypertable
        try:
            await conn.execute(
                text(
                    "SELECT create_hypertable('market_metrics', 'timestamp', if_not_exists => TRUE);"
                )
            )
            print("🧠 DB: Hypertable 'market_metrics' is ready.")
        except Exception as e:
            print(f"🧠 DB Note: {e}")


async def get_latest_timestamp(symbol: str, interval: str) -> int | None:
    """
    指定ペア・時間足の「最後に保存された時刻(ms)」を取得。
    データが無ければ None を返す。
    """
    async with AsyncSessionLocal() as session:
        stmt = select(func.max(MarketCandle.timestamp)).where(
            MarketCandle.symbol == symbol, MarketCandle.interval == interval
        )
        result = await session.execute(stmt)
        dt = result.scalar()

        if dt:
            # datetime -> timestamp (ms)
            return int(dt.timestamp() * 1000)
        return None
