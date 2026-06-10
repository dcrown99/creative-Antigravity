"""
Trade Recording Tests - TDD First
Tests for RiskManager.record_trade() integration with strategies
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone


class TestMomentumTradeRecording:
    """Test Momentum Strategy trade recording"""
    
    @pytest.mark.asyncio
    async def test_entry_calls_record_trade(self):
        """Entry should record trade with PnL=0"""
        from src.strategies.momentum_strategy import DailyMomentumStrategy
        from src.domain.ghost_client import GhostClient
        
        # Setup mocks
        ghost = GhostClient(initial_balance=10000.0)
        ghost.create_order = AsyncMock(return_value={"status": "FILLED"})
        ghost.get_position = AsyncMock(return_value=0.0)
        
        risk_manager = MagicMock()
        risk_manager.can_trade.return_value = (True, None)
        risk_manager.get_stats.return_value = {"win_rate": 0.55}
        risk_manager.calculate_position_size.return_value = 0.01
        risk_manager.record_trade = AsyncMock()
        
        strategy = DailyMomentumStrategy(client=ghost, symbol="BTC/USDT", risk_manager=risk_manager)
        strategy.redis = MagicMock()
        strategy.redis.publish = AsyncMock()
        
        # Execute
        await strategy._enter_position(price=90000.0, rsi=60.0, sma200=85000.0, qty=0.01)
        
        # Verify: record_trade was called with PnL=0
        risk_manager.record_trade.assert_called_once()
        call_args = risk_manager.record_trade.call_args
        assert call_args[0][0] == "BTC/USDT"  # symbol
        assert call_args[0][1] == "BUY"       # side
        assert call_args[0][3] == 0           # pnl = 0 for entry
        
    @pytest.mark.asyncio
    async def test_exit_calls_record_trade_with_pnl(self):
        """Exit should record trade with calculated PnL"""
        from src.strategies.momentum_strategy import DailyMomentumStrategy
        from src.domain.ghost_client import GhostClient
        
        ghost = GhostClient(initial_balance=10000.0)
        ghost.create_order = AsyncMock(return_value={"status": "FILLED"})
        
        risk_manager = MagicMock()
        risk_manager.record_trade = AsyncMock()
        
        strategy = DailyMomentumStrategy(client=ghost, symbol="BTC/USDT", risk_manager=risk_manager)
        strategy.redis = MagicMock()
        strategy.redis.publish = AsyncMock()
        strategy._entry_price = 90000.0  # Set entry price
        
        # Execute exit at higher price
        await strategy._exit_position(price=95000.0, rsi=45.0, sma200=85000.0, qty=0.01)
        
        # Verify: record_trade was called with positive PnL
        risk_manager.record_trade.assert_called_once()
        call_args = risk_manager.record_trade.call_args
        assert call_args[0][1] == "SELL"  # side
        expected_pnl = (95000.0 - 90000.0) * 0.01  # = 50
        assert call_args[0][3] == expected_pnl


class TestFundingArbTradeRecording:
    """Test Funding Arb Strategy trade recording"""
    
    @pytest.mark.asyncio
    async def test_exit_calls_record_trade(self):
        """Exit should record trade with funding PnL"""
        from src.strategies.funding_arb import FundingArbStrategy
        from src.domain.ghost_client import GhostClient
        from src.infrastructure.funding_client import FundingRateClient
        
        ghost = GhostClient(initial_balance=10000.0)
        ghost.create_order = AsyncMock(return_value={"status": "FILLED"})
        
        funding_client = MagicMock(spec=FundingRateClient)
        
        risk_manager = MagicMock()
        risk_manager.record_trade = AsyncMock()
        
        strategy = FundingArbStrategy(
            client=ghost, 
            funding_client=funding_client,
            risk_manager=risk_manager
        )
        strategy.redis = MagicMock()
        strategy.redis.publish = AsyncMock()
        
        # Simulate existing position with entry info
        strategy.positions = {"BTCUSDT": {"spot": 0.01, "perp": -0.01}}
        strategy.entry_info = {
            "BTCUSDT": {
                "price": 90000.0,
                "time": datetime.now(timezone.utc),
                "total_funding": 5.0  # Accumulated funding
            }
        }
        
        # Execute exit
        await strategy._exit_position(symbol="BTCUSDT", price=90000.0, rate=2.0)
        
        # Verify: record_trade was called with funding PnL
        risk_manager.record_trade.assert_called_once()
        call_args = risk_manager.record_trade.call_args
        assert call_args[0][0] == "BTCUSDT"  # symbol
        assert call_args[0][3] == 5.0        # pnl = accumulated funding
        assert call_args[1]["strategy"] == "funding_arb"


class TestRiskManagerRecordTrade:
    """Test RiskManager.record_trade() DB persistence"""
    
    @pytest.mark.asyncio
    async def test_record_trade_updates_memory(self):
        """record_trade should update in-memory trade history"""
        from src.domain.risk_manager import RiskManager
        
        rm = RiskManager(initial_balance=10000.0)
        
        # Mock DB to avoid actual DB calls
        with patch("src.domain.risk_manager.AsyncSessionLocal") as mock_session:
            mock_session.return_value.__aenter__ = AsyncMock()
            mock_session.return_value.__aexit__ = AsyncMock()
            
            await rm.record_trade("BTC/USDT", "BUY", 0.01, 50.0, "momentum")
        
        assert len(rm.trade_history) == 1
        assert rm.trade_history[0]["pnl"] == 50.0
        assert rm.current_balance == 10050.0  # Updated
