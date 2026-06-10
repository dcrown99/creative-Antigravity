"""
Indicators Module - Standardized Technical Indicator Calculations

RSI / SMA の計算ロジックを統一し、バックテストと本番で同じ結果を保証。
"""
import polars as pl


def calculate_rsi(close: pl.Series, period: int = 14) -> pl.Series:
    """
    標準化された RSI 計算 (Polars 互換)
    
    Args:
        close: 終値のSeries
        period: RSI期間 (デフォルト: 14)
        
    Returns:
        RSI値のSeries (0-100)
    """
    delta = close.diff()
    # when/then/otherwise で Gain/Loss を分離 (Polars 互換性確保)
    gain = delta.map_elements(lambda x: max(x, 0) if x is not None else 0, return_dtype=pl.Float64)
    loss = delta.map_elements(lambda x: max(-x, 0) if x is not None else 0, return_dtype=pl.Float64)
    avg_gain = gain.rolling_mean(window_size=period)
    avg_loss = loss.rolling_mean(window_size=period)
    rs = avg_gain / (avg_loss + 1e-10)  # ゼロ除算防止
    return 100 - (100 / (1 + rs))


def calculate_sma(close: pl.Series, period: int) -> pl.Series:
    """
    標準化された SMA 計算
    
    Args:
        close: 終値のSeries
        period: 移動平均期間
        
    Returns:
        SMA値のSeries
    """
    return close.rolling_mean(window_size=period)


def add_rsi_column(df: pl.DataFrame, period: int = 14, close_col: str = "close") -> pl.DataFrame:
    """
    DataFrameにRSIカラムを追加
    
    Args:
        df: OHLCVデータ
        period: RSI期間
        close_col: 終値カラム名
        
    Returns:
        RSIカラム追加済みDataFrame
    """
    rsi = calculate_rsi(df[close_col], period)
    return df.with_columns([rsi.alias("rsi")])


def add_sma_column(df: pl.DataFrame, period: int, close_col: str = "close", alias: str = None) -> pl.DataFrame:
    """
    DataFrameにSMAカラムを追加
    
    Args:
        df: OHLCVデータ
        period: SMA期間
        close_col: 終値カラム名
        alias: 出力カラム名 (デフォルト: sma_{period})
        
    Returns:
        SMAカラム追加済みDataFrame
    """
    col_name = alias or f"sma_{period}"
    sma = calculate_sma(df[close_col], period)
    return df.with_columns([sma.alias(col_name)])
