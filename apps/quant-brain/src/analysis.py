import pandas as pd
import numpy as np
from sqlalchemy import select
from src.db import AsyncSessionLocal, MarketCandle
from datetime import datetime, timedelta, timezone


class MarketAnalyzer:
    """市場分析エンジン - 相関分析、テクニカル指標計算"""

    async def _fetch_candles(
        self, symbol: str, interval: str, days: int
    ) -> pd.DataFrame:
        """共通: DBからローソク足データをDataFrameとして取得"""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        async with AsyncSessionLocal() as session:
            stmt = (
                select(
                    MarketCandle.timestamp,
                    MarketCandle.open,
                    MarketCandle.high,
                    MarketCandle.low,
                    MarketCandle.close,
                    MarketCandle.volume,
                )
                .where(
                    MarketCandle.symbol == symbol,
                    MarketCandle.interval == interval,
                    MarketCandle.timestamp >= start_date,
                )
                .order_by(MarketCandle.timestamp)
            )
            result = await session.execute(stmt)
            data = result.fetchall()

        if not data:
            return pd.DataFrame()

        df = pd.DataFrame(
            data, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )
        df.set_index("timestamp", inplace=True)
        return df

    async def get_correlation_matrix(self, days: int = 7, interval: str = "1h"):
        """指定期間・指定足での銘柄間相関行列を算出"""
        print(f"🧠 Analyst: Calculating correlation ({interval}) for last {days} days...")

        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        async with AsyncSessionLocal() as session:
            stmt = select(
                MarketCandle.timestamp, MarketCandle.symbol, MarketCandle.close
            ).where(
                MarketCandle.timestamp >= start_date, MarketCandle.interval == interval
            )
            result = await session.execute(stmt)
            data = result.fetchall()

        if not data:
            print("⚠️ Analyst: No data found for specified criteria.")
            return {"error": "Insufficient data", "matrix": [], "symbols": []}

        df = pd.DataFrame(data, columns=["timestamp", "symbol", "close"])
        pivot_df = df.pivot(index="timestamp", columns="symbol", values="close")
        pivot_df = pivot_df.ffill().dropna()

        if pivot_df.empty or len(pivot_df.columns) < 2:
            return {
                "error": "Not enough overlapping data for correlation",
                "matrix": [],
                "symbols": pivot_df.columns.tolist(),
            }

        returns_df = pivot_df.pct_change()
        correlation_matrix = returns_df.corr(method="pearson")

        symbols = correlation_matrix.columns.tolist()
        matrix_values = [
            [(x if pd.notna(x) else 0) for x in row]
            for row in correlation_matrix.values.tolist()
        ]

        return {
            "symbols": symbols,
            "matrix": matrix_values,
            "period_days": days,
            "interval": interval,
        }

    async def get_technical_indicators(
        self, symbol: str, interval: str = "1h", days: int = 30
    ):
        """
        テクニカル指標を一括計算
        - RSI (14期間)
        - SMA (7, 25, 99)
        - EMA (12, 26)
        - ボラティリティ (標準偏差)
        - MACD
        """
        print(f"📊 Analyst: Calculating indicators for {symbol} ({interval})...")

        df = await self._fetch_candles(symbol, interval, days)

        if df.empty or len(df) < 30:
            return {"error": "Insufficient data", "symbol": symbol}

        close = df["close"]
        high = df["high"]
        low = df["low"]

        # --- RSI (14期間) ---
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))

        # --- SMA ---
        sma_7 = close.rolling(window=7).mean()
        sma_25 = close.rolling(window=25).mean()
        sma_99 = close.rolling(window=99).mean()

        # --- EMA ---
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()

        # --- MACD ---
        macd_line = ema_12 - ema_26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        macd_histogram = macd_line - signal_line

        # --- ボラティリティ (20期間標準偏差) ---
        volatility = close.pct_change().rolling(window=20).std() * np.sqrt(24)  # 年率換算係数

        # --- ATR (Average True Range) ---
        tr = pd.concat(
            [
                high - low,
                (high - close.shift()).abs(),
                (low - close.shift()).abs(),
            ],
            axis=1,
        ).max(axis=1)
        atr = tr.rolling(window=14).mean()

        # 最新値を取得
        latest = df.iloc[-1]
        
        return {
            "symbol": symbol,
            "interval": interval,
            "timestamp": str(latest.name),
            "price": {
                "open": float(latest["open"]),
                "high": float(latest["high"]),
                "low": float(latest["low"]),
                "close": float(latest["close"]),
                "volume": float(latest["volume"]),
            },
            "indicators": {
                "rsi_14": round(float(rsi.iloc[-1]), 2) if pd.notna(rsi.iloc[-1]) else None,
                "sma_7": round(float(sma_7.iloc[-1]), 2) if pd.notna(sma_7.iloc[-1]) else None,
                "sma_25": round(float(sma_25.iloc[-1]), 2) if pd.notna(sma_25.iloc[-1]) else None,
                "sma_99": round(float(sma_99.iloc[-1]), 2) if pd.notna(sma_99.iloc[-1]) else None,
                "ema_12": round(float(ema_12.iloc[-1]), 2) if pd.notna(ema_12.iloc[-1]) else None,
                "ema_26": round(float(ema_26.iloc[-1]), 2) if pd.notna(ema_26.iloc[-1]) else None,
                "macd": round(float(macd_line.iloc[-1]), 2) if pd.notna(macd_line.iloc[-1]) else None,
                "macd_signal": round(float(signal_line.iloc[-1]), 2) if pd.notna(signal_line.iloc[-1]) else None,
                "macd_histogram": round(float(macd_histogram.iloc[-1]), 2) if pd.notna(macd_histogram.iloc[-1]) else None,
                "volatility_20": round(float(volatility.iloc[-1]) * 100, 2) if pd.notna(volatility.iloc[-1]) else None,
                "atr_14": round(float(atr.iloc[-1]), 2) if pd.notna(atr.iloc[-1]) else None,
            },
            "signal": self._generate_signal(rsi.iloc[-1], macd_histogram.iloc[-1], close.iloc[-1], sma_25.iloc[-1]),
        }

    def _generate_signal(self, rsi, macd_hist, price, sma_25) -> dict:
        """シグナル判定ロジック"""
        signals = []
        overall = "NEUTRAL"

        # RSI
        if pd.notna(rsi):
            if rsi < 30:
                signals.append("RSI: 売られ過ぎ (買いシグナル)")
                overall = "BUY"
            elif rsi > 70:
                signals.append("RSI: 買われ過ぎ (売りシグナル)")
                overall = "SELL"

        # MACD
        if pd.notna(macd_hist):
            if macd_hist > 0:
                signals.append("MACD: 上昇トレンド")
                if overall == "NEUTRAL":
                    overall = "BUY"
            else:
                signals.append("MACD: 下降トレンド")
                if overall == "NEUTRAL":
                    overall = "SELL"

        # Price vs SMA
        if pd.notna(sma_25) and pd.notna(price):
            if price > sma_25:
                signals.append("価格 > SMA25: 強気")
            else:
                signals.append("価格 < SMA25: 弱気")

        return {"overall": overall, "details": signals}

    async def get_market_overview(self, interval: str = "1h"):
        """全監視銘柄のサマリーを取得"""
        from src.scheduler import WATCH_LIST
        
        # 指定 interval の銘柄を抽出
        symbols = list(set(
            item["symbol"] for item in WATCH_LIST if item["interval"] == interval
        ))
        results = []

        for symbol in symbols:
            data = await self.get_technical_indicators(symbol, interval, days=30)
            if "error" not in data:
                results.append(
                    {
                        "symbol": symbol,
                        "price": data["price"]["close"],
                        "rsi": data["indicators"]["rsi_14"],
                        "macd": data["indicators"]["macd"],
                        "signal": data["signal"]["overall"],
                    }
                )

        # 価格でソート (降順)
        results.sort(key=lambda x: x["price"], reverse=True)

        return {"interval": interval, "count": len(results), "markets": results}
