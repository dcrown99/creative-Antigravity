import time
import pandas as pd
import MetaTrader5 as mt5
from backtesting import Backtest, Strategy
import sys
import os

# mt5_utils.py へのパスを通す
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
try:
    from mt5.analysis.mt5_utils import initialize_mt5, ensure_symbol_data_sync
except ImportError:
    # 実行時のカレントディレクトリの違いに備えて直接importも試す
    try:
        from mt5_utils import initialize_mt5, ensure_symbol_data_sync
    except ImportError:
        print("Error: 必要なライブラリ mt5_utils.py が見つかりません。")
        sys.exit(1)


class RonfikuNakaneAnomaly(Strategy):
    """
    検証ルール:
    - 通貨ペア: EURJPY
    - ポジション: ロング
    - エントリー: 火〜金の JST 01:00 (ロンドンフィックス後)
    - エグジット: 同日の JST 09:53 (東京仲値直前)
    """

    def init(self):
        pass

    def next(self):
        # Index は JST の日時 (pd.Timestamp) に変換済みと想定
        current_time = self.data.index[-1]
        
        # 曜日判定 (月=0, 火=1, 水=2, 木=3, 金=4, 土=5, 日=6)
        # 火曜〜金曜がエントリー対象
        # 01:00にエントリー条件を満たしているかチェック
        if current_time.weekday() in [1, 2, 3, 4]:
            if current_time.hour == 1 and current_time.minute == 0:
                # 既にポジションがあれば何もしない（通常はないはずだが安全のため）
                if not self.position.is_long:
                    self.buy()
        
        # エグジット判定 (JST 09:53)
        # ポジションがあり、かつ指定時刻になったらクローズ
        if self.position.is_long:
            if current_time.hour == 9 and current_time.minute == 53:
                self.position.close()


if __name__ == '__main__':
    symbol = "EURJPY"
    timeframe = mt5.TIMEFRAME_M1
    
    # 過去数年分として約10万本取得する (1日=1440分、1年約37万本。10万本は約3ヶ月〜半年分程度。今回は長めに50万本取得して数年検証する)
    # MT5のヒストリカルデータ量に依存する。
    num_bars = 500000 

    print("MetaTrader5に接続してデータを取得します...")
    if not initialize_mt5():
        print("MT5への接続に失敗しました。")
        sys.exit(1)

    try:
        from mt5.analysis.mt5_utils import ensure_symbol_data_sync
        print(f"シンボル [{symbol}] をMT5 Market Watchに登録し、同期を待ちます...")
        resolved_symbol = ensure_symbol_data_sync(symbol, timeout_sec=10)
        if not resolved_symbol:
            print(f"Warning: {symbol} のデータ同期または解決に失敗した可能性がありますが、取得を試行します。")
            resolved_symbol = symbol
        else:
            print(f"Success: シンボルは '{resolved_symbol}' として解決されました。")
            symbol = resolved_symbol
    except Exception as e:
        print(f"Symbol sync ignored because: {e}")

    print(f"{symbol} の M1 データを {num_bars} 本取得中...")
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, num_bars)
    mt5.shutdown()

    if rates is None or len(rates) == 0:
        print(f"データの取得に失敗しました。{symbol} の M1 データが MT5 に存在するか確認してください。")
        sys.exit(1)

    print(f"{len(rates)} 本のデータを取得完了。DataFrameを構築します...")

    # DataFrame に変換
    df = pd.DataFrame(rates)
    
    # 時間を適切に処理する
    # MT5から来るデータは POSIX タイムスタンプ (UTC ベースだが、ブローカーによってタイムゾーンがずれている可能性がある)
    # しかし、copy_rates は UTC として扱える int タイムスタンプ（epoch）を返すのが標準。(※正確にはサーバー時間ですが、タイムスタンプ自体はUTC epochからの経過秒数として表現されることが多い)。
    # Pandas で UTC の datetime として DatetimeIndex 化し、Asia/Tokyo へ JST 変換する。
    # ！！重要！！ MT5サーバー時間がブローカーによって異なるため、厳密には「ブローカーのサーバー時間がUTCから何時間ずれているか」を知る必要がある。
    # XM の場合、サーバー時間は EET/EEST (UTC+2/UTC+3)。
    # そのため、Unixタイムスタンプの解釈時に EET/EEST 分の補正を行うか、最初から tz="EET" として解釈して tz_convert("Asia/Tokyo") するのが正しい。
    # ただし `time` は秒数であり、これを単純に pd.to_datetime すると UTC として解釈される。
    
    # pd.to_datetime(df['time'], unit='s') で生成される時間は「MT5 サーバーのローカル時間」を「UTCの時刻文字列」として表現したものになる。
    # XM(EET/EEST)の場合は、時間軸に +6 または +7 (JST は UTC+9 のため、EET->JST は通常+6〜+7時間) すればよいが、サマータイムでずれる。
    
    # より安全な手法として、タイムゾーンを考慮した変換を行う：
    # `pytz` 等で処理もできるが、Pandas の tz 機能を使う。
    df['time'] = pd.to_datetime(df['time'], unit='s')
    # 一旦 tz_localize でサーバーの時間帯 (EET/EEST) を強制するやり方もあるが、EET/EESTをまたぐ履歴データの正確な判定は複雑。
    # 今回はシンプルに、MT5の時間は "UTCとして読み込まれたサーバー時間" なので、
    # XM は夏時間=UTC+3, 冬時間=UTC+2。日本はUTC+9。
    # ここではXMベースと仮定し（ユーザーはXMを利用）、MT5のサーバー時刻(EET/EEST)を扱う。
    # MT5の取得日時(UTCとして解釈される)を一旦「GMT/UTC」ではなく「EET/EEST」として認識させる。
    # pandas には `Eastern European Time` (EET/EEST 自動切り替え) がある。 'Europe/Athens' や 'Europe/Kiev' 等を使うのが定石。
    try:
        df['time'] = df['time'].dt.tz_localize('Europe/Athens').dt.tz_convert('Asia/Tokyo')
    except Exception as e:
        print(f"Timezone conversion note: {e}")
        # tz_localize で AmbigousTimeError (サマータイム切り替え時の1時間の重複) が出た場合は、
        # 引数で ambiguous='NaT' もしくは 'infer' などを指定して逃げる必要がある。
        df['time'] = pd.to_datetime(rates['time'], unit='s').dt.tz_localize('Europe/Athens', ambiguous='NaT', nonexistent='NaT').dt.tz_convert('Asia/Tokyo')
        df = df.dropna(subset=['time'])

    df.set_index('time', inplace=True)

    # 必要な列名を backtesting.py の仕様 (頭文字大文字) に合わせる
    df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'tick_volume': 'Volume'}, inplace=True)
    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]

    print(f"JST変換完了。データ範囲: {df.index.min()} から {df.index.min()}")

    print("バックテストを開始します...")
    # 手数料 (commission) などの設定は取引環境に合わせる。一旦スプレッド分を考慮するためやや厳し目に 0.0001 (0.1 pips程度？)
    # EURJPYのため 0.0001 = 0.01円 = 1.0 pips 相当。
    bt = Backtest(df, RonfikuNakaneAnomaly, cash=100000, commission=0.0001, margin=1.0)
    stats = bt.run()
    
    print("\n" + "=" * 40)
    print(" === RONFIKU ~ NAKANE ANOMALY TEST ===")
    print("=" * 40)
    print(stats)
    
    pf = stats.get('Profit Factor', 0.0)
    wr = stats.get('Win Rate [%]', 0.0)
    
    print("\n--- 結論 ---")
    if pd.isna(pf): # pf が NaN (取引無し等)
        print("取引が行われませんでした。エントリー条件かデータ範囲を確認してください。")
    elif pf >= 1.5:
        print(f"✅ 優位性あり！ Profit Factor: {pf:.2f} がプロジェクト水準 (1.5) を満たしています。")
    elif pf >= 1.0:
        print(f"🟡 微妙。 Profit Factor: {pf:.2f} はプラスですが、プロジェクト水準 (1.5) には届いていません。")
    else:
        print(f"❌ 優位性なし。 Profit Factor: {pf:.2f} はマイナス期待値です。")
    
    # ターミナルで確認しやすくするため、一部の追加情報を出力
    print(f"Trades: {stats.get('# Trades', 0)}")
    print(f"Win Rate: {wr:.2f}%")
    print(f"Max Drawdown: {stats.get('Max. Drawdown [%]', 0.0):.2f}%")
