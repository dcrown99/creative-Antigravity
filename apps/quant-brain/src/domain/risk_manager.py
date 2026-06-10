"""
Risk Manager - Position Sizing and Drawdown Control
トレードのリスク管理を一元化する責任を持つ。
"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional
import orjson
import redis.asyncio as redis
from sqlalchemy import text

logger = logging.getLogger("risk")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# リスクパラメータ (デフォルト値)
MAX_DRAWDOWN_PCT = float(os.getenv("MAX_DRAWDOWN_PCT", 10.0))  # 最大ドローダウン10%
MAX_POSITION_PCT = float(os.getenv("MAX_POSITION_PCT", 20.0))  # 最大ポジション (資産の20%)
DEFAULT_KELLY_FRACTION = float(os.getenv("KELLY_FRACTION", 0.25))  # Kelly Criterion の25%使用
KELLY_REDIS_KEY = "risk:kelly_fraction"


class RiskManager:
    """
    Risk Management Layer
    
    機能:
    1. Max Drawdown監視: 初期残高から10%下落でトレード停止
    2. Position Sizing: Kelly Criterion ベースのサイジング
    3. トレード履歴: TimescaleDB に永続化
    """
    
    def __init__(self, initial_balance: float = 10000.0):
        self.initial_balance = initial_balance
        self.peak_balance = initial_balance
        self.current_balance = initial_balance
        self.is_halted = False
        self.halt_reason: Optional[str] = None
        self.redis: Optional[redis.Redis] = None
        self.trade_history = []
        self.kelly_fraction = DEFAULT_KELLY_FRACTION
        
    async def start(self, redis_client: redis.Redis):
        """リスクマネージャー起動"""
        self.redis = redis_client
        
        # Redis から Kelly 設定をロード
        cached_kelly = await self.redis.get(KELLY_REDIS_KEY)
        if cached_kelly:
            self.kelly_fraction = float(cached_kelly)
            logger.info(f"   Loaded Kelly fraction from Redis: {self.kelly_fraction:.0%}")
        
        # DB から過去トレード履歴をロード
        await self._load_trade_history()
        
        logger.info(f"🛡️ Risk Manager started (Max DD: {MAX_DRAWDOWN_PCT}%, Max Pos: {MAX_POSITION_PCT}%, Kelly: {self.kelly_fraction:.0%})")
        
    async def _load_trade_history(self):
        """DB から直近100件のトレード履歴をロード"""
        try:
            from src.db import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                result = await session.execute(text("""
                    SELECT timestamp, symbol, side, qty, pnl, strategy 
                    FROM trade_history 
                    ORDER BY timestamp DESC 
                    LIMIT 100
                """))
                rows = result.fetchall()
                self.trade_history = [
                    {"ts": int(r[0].timestamp() * 1000), "symbol": r[1], "side": r[2], "qty": r[3], "pnl": r[4], "strategy": r[5]}
                    for r in reversed(rows)
                ]
                if self.trade_history:
                    logger.info(f"   Loaded {len(self.trade_history)} trades from DB")
        except Exception as e:
            logger.warning(f"   ⚠️ Failed to load trade history: {e}")
        
    def update_balance(self, new_balance: float):
        """残高更新 & ドローダウンチェック"""
        self.current_balance = new_balance
        
        # ピーク更新
        if new_balance > self.peak_balance:
            self.peak_balance = new_balance
            
        # ドローダウン計算
        drawdown_pct = ((self.peak_balance - new_balance) / self.peak_balance) * 100
        
        # 最大ドローダウン超過チェック
        if drawdown_pct >= MAX_DRAWDOWN_PCT and not self.is_halted:
            self.is_halted = True
            self.halt_reason = f"Max drawdown exceeded: {drawdown_pct:.2f}% >= {MAX_DRAWDOWN_PCT}%"
            logger.warning(f"🚨 TRADING HALTED: {self.halt_reason}")
            
        return {
            "balance": new_balance,
            "peak": self.peak_balance,
            "drawdown_pct": drawdown_pct,
            "is_halted": self.is_halted
        }
        
    def can_trade(self) -> tuple[bool, Optional[str]]:
        """トレード可否判定"""
        if self.is_halted:
            return False, self.halt_reason
        return True, None
        
    def calculate_position_size(
        self, 
        win_rate: float = 0.55, 
        avg_win: float = 1.0, 
        avg_loss: float = 1.0,
        price: float = 50000.0
    ) -> float:
        """Kelly Criterion ベースのポジションサイズ計算"""
        if avg_loss == 0:
            avg_loss = 0.01
            
        r = avg_win / avg_loss
        kelly = win_rate - ((1 - win_rate) / r)
        
        if kelly <= 0:
            return 0.0
            
        kelly_fraction = kelly * self.kelly_fraction
        max_position = (self.current_balance * (MAX_POSITION_PCT / 100)) / price
        kelly_position = (self.current_balance * kelly_fraction) / price
        
        position_size = min(kelly_position, max_position)
        logger.debug(f"📊 Position sizing: Kelly={kelly:.2%}, Fraction={kelly_fraction:.2%}, Size={position_size:.6f}")
        
        return position_size
        
    async def record_trade(self, symbol: str, side: str, qty: float, pnl: float, strategy: str = "momentum"):
        """トレード記録 (メモリ + DB)"""
        ts = datetime.now(timezone.utc)
        trade = {
            "ts": int(ts.timestamp() * 1000),
            "symbol": symbol,
            "side": side,
            "qty": qty,
            "pnl": pnl,
            "strategy": strategy
        }
        self.trade_history.append(trade)
        
        # 直近100件のみ保持
        if len(self.trade_history) > 100:
            self.trade_history = self.trade_history[-100:]
            
        # 残高更新
        self.update_balance(self.current_balance + pnl)
        
        # DB に保存
        try:
            from src.db import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                await session.execute(text("""
                    INSERT INTO trade_history (timestamp, symbol, side, qty, pnl, strategy)
                    VALUES (:ts, :symbol, :side, :qty, :pnl, :strategy)
                """), {"ts": ts, "symbol": symbol, "side": side, "qty": qty, "pnl": pnl, "strategy": strategy})
                await session.commit()
                logger.info(f"   💾 Trade saved to DB: {symbol} {side} {qty:.6f} PnL=${pnl:.2f}")
        except Exception as e:
            logger.warning(f"   ⚠️ DB save failed: {e}")
        
    def get_stats(self) -> dict:
        """統計情報取得"""
        if not self.trade_history:
            return {
                "trade_count": 0,
                "win_rate": 0,
                "avg_pnl": 0,
                "total_pnl": 0
            }
            
        wins = [t for t in self.trade_history if t["pnl"] > 0]
        total_pnl = sum(t["pnl"] for t in self.trade_history)
        
        return {
            "trade_count": len(self.trade_history),
            "win_rate": len(wins) / len(self.trade_history) if self.trade_history else 0,
            "avg_pnl": total_pnl / len(self.trade_history) if self.trade_history else 0,
            "total_pnl": total_pnl,
            "current_balance": self.current_balance,
            "peak_balance": self.peak_balance,
            "drawdown_pct": ((self.peak_balance - self.current_balance) / self.peak_balance) * 100,
            "is_halted": self.is_halted,
            "halt_reason": self.halt_reason,
            "kelly_fraction": self.kelly_fraction
        }
    
    async def set_kelly_fraction(self, fraction: float):
        """Kelly fraction を動的に変更"""
        self.kelly_fraction = max(0.05, min(fraction, 1.0))  # 5% - 100% に制限
        if self.redis:
            await self.redis.set(KELLY_REDIS_KEY, str(self.kelly_fraction))
        logger.info(f"🎯 Kelly fraction updated to {self.kelly_fraction:.0%}")
        return self.kelly_fraction
        
    def reset_halt(self):
        """トレード停止解除 (手動オーバーライド)"""
        self.is_halted = False
        self.halt_reason = None
        self.peak_balance = self.current_balance
        logger.info("🔓 Trading halt released manually")

