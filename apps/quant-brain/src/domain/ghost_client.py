import logging
import orjson
from uuid import uuid4
from datetime import datetime
from .interfaces import IOrderClient

logger = logging.getLogger("ghost")

# Fee configuration (Binance Spot)
TAKER_FEE = 0.00055   # 0.055%
SLIPPAGE = 0.0005     # 0.05%
TOTAL_FEE_PCT = TAKER_FEE + SLIPPAGE  # 0.105%

class GhostClient(IOrderClient):
    """
    メモリ内シミュレーション用クライアント (Fee Simulation Enabled)
    """
    def __init__(self, initial_balance: float = 10000.0, redis=None):
        self.balance = initial_balance
        self.initial_balance = initial_balance
        self.positions = {} 
        self.entry_prices = {}  # Track entry prices for PnL
        self.total_fees = 0.0
        self.redis = redis
        logger.info(f"👻 Ghost Client Initialized with ${initial_balance} (Fee: {TOTAL_FEE_PCT*100:.3f}%)")

    async def _broadcast(self, event_type: str, payload: dict):
        if self.redis:
            msg = {
                "type": event_type,
                "ts": int(datetime.now().timestamp() * 1000),
                "data": payload
            }
            await self.redis.publish("brain:events", orjson.dumps(msg))

    async def create_order(self, symbol: str, side: str, qty: float, price: float = 0) -> dict:
        order_id = str(uuid4())[:8]
        
        # Calculate fee
        order_value = qty * price if price > 0 else qty * 90000  # Fallback price
        fee = order_value * TOTAL_FEE_PCT
        self.total_fees += fee
        
        current_qty = self.positions.get(symbol, 0.0)
        
        if side.upper() == "BUY":
            self.positions[symbol] = current_qty + qty
            self.entry_prices[symbol] = price
            self.balance -= fee  # Deduct fee on entry
            logger.info(f"👻 [SIM] BUY {qty:.6f} {symbol} @ ${price:,.2f} (Fee: ${fee:.2f})")
            
        else:  # SELL
            self.positions[symbol] = current_qty - qty
            entry_price = self.entry_prices.get(symbol, price)
            pnl = (price - entry_price) * qty - fee
            self.balance += pnl
            logger.info(f"👻 [SIM] SELL {qty:.6f} {symbol} @ ${price:,.2f} (PnL: ${pnl:.2f}, Fee: ${fee:.2f})")
            
        # Broadcast event
        await self._broadcast("order_filled", {
            "id": order_id, "symbol": symbol, "side": side, 
            "qty": qty, "price": price, "fee": fee, "balance": self.balance
        })
            
        return {"status": "FILLED", "orderId": order_id, "fee": fee}

    async def get_position(self, symbol: str) -> float:
        return self.positions.get(symbol, 0.0)

    async def get_balance(self) -> float:
        return self.balance
    
    def get_stats(self) -> dict:
        """Get simulation statistics"""
        return {
            "initial_balance": self.initial_balance,
            "current_balance": self.balance,
            "pnl": self.balance - self.initial_balance,
            "pnl_pct": (self.balance / self.initial_balance - 1) * 100,
            "total_fees": self.total_fees
        }
