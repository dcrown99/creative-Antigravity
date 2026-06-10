import MetaTrader5 as mt5
import pandas as pd
import pandas_ta as ta
from datetime import datetime

if not mt5.initialize():
    print('mt5.initialize() failed, error code =', mt5.last_error())
    quit()

symbol = 'BTCUSD#'
timeframe = mt5.TIMEFRAME_H1
utc_from = datetime(2025, 1, 1)
utc_to = datetime(2025, 2, 1)

rates = mt5.copy_rates_range(symbol, timeframe, utc_from, utc_to)
mt5.shutdown()

if rates is None or len(rates) == 0:
    print('Failed to get data')
    quit()

df = pd.DataFrame(rates)
df['time'] = pd.to_datetime(df['time'], unit='s')

# Pandas-TA
df.ta.adx(length=14, append=True)
df.ta.atr(length=14, append=True)
df.ta.sma(length=50, append=True)
df.ta.sma(length=200, append=True)

print('--- Python (Pandas-TA) Parity Check ---')
print(df[['time', 'close', 'ADX_14', 'DMP_14', 'DMN_14', 'ATRr_14', 'SMA_50', 'SMA_200']].tail(15).to_string())
