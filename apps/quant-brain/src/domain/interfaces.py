from abc import ABC, abstractmethod
from typing import Dict, Any

class IOrderClient(ABC):
    """注文実行クライアントの抽象基底クラス"""
    
    @abstractmethod
    async def create_order(self, symbol: str, side: str, qty: float) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def get_position(self, symbol: str) -> float:
        pass
        
    @abstractmethod
    async def get_balance(self) -> float:
        pass

class IStrategy(ABC):
    """戦略エンジンの抽象基底クラス"""
    
    @abstractmethod
    async def on_tick(self, data: Dict[str, Any]):
        """市場データ受信時のフック"""
        pass
