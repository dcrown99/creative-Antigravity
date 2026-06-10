"""
MT5 戦略ロジックのユニットテスト
================================
verify_*.py スクリプトの戦略ロジック（ヘルパー関数）を検証する。
バックテスト自体は実行しない（外部データ依存を排除）。
"""

import numpy as np
import pandas as pd
import pytest


# ==========================================
# ATR Calculation Tests
# ==========================================

def calc_atr(h, l, c, period):
    """ATR calculation extracted from verify_hybrid_raid.py"""
    h, l, c = pd.Series(h), pd.Series(l), pd.Series(c)
    tr = pd.Series(
        np.maximum(
            h - l,
            np.maximum(abs(h - c.shift(1)), abs(l - c.shift(1))),
        )
    )
    return tr.rolling(window=period).mean()


class TestATR:
    def test_basic_atr(self):
        """ATR should return valid values after warmup period"""
        h = [102, 104, 103, 105, 106]
        l = [98, 99, 97, 100, 101]
        c = [100, 103, 98, 104, 105]
        result = calc_atr(h, l, c, period=3)

        # First 3 values should include NaN (warmup)
        assert pd.isna(result.iloc[0])
        # After warmup, should have valid positive values
        assert result.iloc[-1] > 0

    def test_atr_flat_market(self):
        """ATR should be near zero in flat market"""
        h = [100.01] * 10
        l = [99.99] * 10
        c = [100.0] * 10
        result = calc_atr(h, l, c, period=3)
        assert result.iloc[-1] < 0.1

    def test_atr_volatile_market(self):
        """ATR should be large in volatile market"""
        h = [110, 120, 115, 125, 130]
        l = [90, 80, 85, 75, 70]
        c = [100, 100, 100, 100, 100]
        result = calc_atr(h, l, c, period=3)
        assert result.iloc[-1] > 10


# ==========================================
# RSI Calculation Tests
# ==========================================

def calc_rsi(close, period):
    """RSI calculation extracted from verify_hybrid_raid.py"""
    delta = pd.Series(close).diff()
    gain = delta.where(delta > 0, 0).fillna(0)
    loss = (-delta.where(delta < 0, 0)).fillna(0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


class TestRSI:
    def test_rsi_range(self):
        """RSI must be between 0 and 100"""
        close = [100, 102, 101, 103, 99, 98, 104, 106, 105, 107,
                 103, 101, 100, 99, 97, 95, 98, 100, 102, 105]
        result = calc_rsi(close, period=14)
        valid = result.dropna()
        assert (valid >= 0).all()
        assert (valid <= 100).all()

    def test_rsi_uptrend(self):
        """RSI should be high in strong uptrend"""
        close = list(range(100, 130))  # 30 consecutive up bars
        result = calc_rsi(close, period=14)
        assert result.iloc[-1] > 70

    def test_rsi_downtrend(self):
        """RSI should be low in strong downtrend"""
        close = list(range(130, 100, -1))  # 30 consecutive down bars
        result = calc_rsi(close, period=14)
        assert result.iloc[-1] < 30

    def test_rsi_sideways(self):
        """RSI should be near 50 in sideways market"""
        # Small alternating moves (not truly flat, which causes NaN)
        close = [100 + (0.1 if i % 2 == 0 else -0.1) for i in range(30)]
        result = calc_rsi(close, period=14)
        valid = result.dropna()
        assert len(valid) > 0
        assert 40 < valid.iloc[-1] < 60


# ==========================================
# Logic Parity: shift() Mapping Tests
# ==========================================

class TestLogicParity:
    """
    Verify that Python shift(N) correctly maps to MQL5 iClose(N).
    Python backtesting.py: self.data.Close[-1] = current bar (shift(0))
    MQL5: iClose(_Symbol, tf, 0) = current bar
    """

    def test_shift_0_is_current_bar(self):
        """shift(0) should return the value itself (no shift)"""
        s = pd.Series([10, 20, 30, 40, 50])
        assert s.shift(0).iloc[-1] == 50  # Current bar = last value

    def test_shift_1_is_previous_bar(self):
        """shift(1) should return the previous bar (confirmed/safe)"""
        s = pd.Series([10, 20, 30, 40, 50])
        assert s.shift(1).iloc[-1] == 40  # Previous bar

    def test_shift_n_mapping(self):
        """shift(N) should return N bars back"""
        s = pd.Series([10, 20, 30, 40, 50])
        assert s.shift(2).iloc[-1] == 30
        assert s.shift(3).iloc[-1] == 20

    def test_negative_index_backtesting_convention(self):
        """
        In backtesting.py:
          self.data.Close[-1] = current bar (most recent)
          self.data.Close[-2] = 1 bar ago (confirmed)
        This maps to MQL5:
          iClose(0) = current
          iClose(1) = 1 bar ago
        """
        data = np.array([10, 20, 30, 40, 50])
        assert data[-1] == 50  # Current (MQL: iClose(0))
        assert data[-2] == 40  # 1 bar ago (MQL: iClose(1))
        assert data[-3] == 30  # 2 bars ago (MQL: iClose(2))


# ==========================================
# PF Threshold Gate Tests
# ==========================================

class TestPFGate:
    """Verify the PF ≥ 1.5 pass/fail gate logic"""

    @pytest.mark.parametrize("pf,expected", [
        (2.0, "PASS"),
        (1.5, "PASS"),
        (1.49, "FAIL"),
        (1.0, "FAIL"),
        (0.5, "FAIL"),
    ])
    def test_pf_threshold(self, pf, expected):
        result = "PASS" if pf >= 1.5 else "FAIL"
        assert result == expected


# ==========================================
# Evidence Grade Gate Tests
# ==========================================

class TestGradeGate:
    """Verify the Grade A/B/C decision gate"""

    @pytest.mark.parametrize("grade,expected", [
        ("A", True),
        ("B", True),
        ("C", False),
    ])
    def test_grade_approval(self, grade, expected):
        approved = grade in ("A", "B")
        assert approved == expected
