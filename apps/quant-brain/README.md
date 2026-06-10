# Quant Brain 🧠 (Neural Alpha Engine)

**God Mode 2025 Edition**

金融市場の「神経中枢」として機能する、超低遅延・高スループットなアルゴリズム取引基盤。
Redis Streams を介して市場データを受け取り、戦略エンジン（Strategy）とシミュレーション（Ghost）に振り分けます。

## 🚀 Architecture

### 1. Neural Synapse (`src/main.py`)
- **役割**: Redis Streams (`market:trades`, `market:ticker`, etc.) のコンシューマー。
- **機能**:
  - 高速なデータ受信とデシリアライズ (`orjson`)
  - データのルーティング（Recorderへ保存、Strategyへ配信）
  - **WebSocket Gateway**: `/ws/monitor` 経由でブラウザへリアルタイムデータを配信。
  - 異常検知と自動復旧

### 2. The Ghost (`src/domain/ghost_client.py`)
- **役割**: メモリ内シミュレーションエンジン (Telemetry Enabled)。
- **機能**:
  - **通信ラグゼロ**: ネットワーク遅延なしで約定をシミュレート。
  - **仮想口座**: 100%リアルな残高・ポジション管理。
  - **Telemetry**: 注文・約定イベントをRedis Pub/Sub (`brain:events`) へ即時放送。

### 3. Risk Manager (`src/domain/risk_manager.py`) 🆕
- **役割**: リスク管理レイヤー。
- **機能**:
  - **Max Drawdown**: 10%超でトレード自動停止。
  - **Position Sizing**: Kelly Criterion (25%) ベース。
  - **統計追跡**: 勝率、PnL、残高推移。

### 4. Funding Rate Strategy (`src/strategies/funding_arb.py`) 🆕
- **役割**: 市場中立型Funding Rate Arbitrage。
- **機能**:
  - スポット買い + 永久先物ショート。
  - 年率15%超でエントリー、5%以下でイグジット。
  - **帯域効率**: 1 req/min (Bybit API)。

### 5. On-Chain Alpha (`src/infrastructure/onchain_client.py`) 🆕
- **役割**: オンチェーン指標によるシグナル生成。
- **機能**:
  - mempool.space API: 手数料率、メンプール状況。
  - blockchain.com API: ハッシュレート、未確認TX数。
  - **帯域効率**: 1 req/5min。

### 6. Data Recorder (`src/infrastructure/recorder.py`)
- **役割**: 市場データの永続化担当。
- **機能**:
  - **Polars**: 高速なDataFrame操作。
  - **Parquet**: カラムナフォーマットでの圧縮保存。
  - **Batch Flush**: メモリバッファリングによるI/O負荷軽減。

### 7. Neural Monitor (`monitor.html`)
- **役割**: リアルタイム可視化ダッシュボード。
- **機能**:
  - WebSocket経由でBrainと直結。
  - 現在価格、AI予測確率、売買ログをミリ秒単位で表示。

## 🛠️ Tech Stack

- **Runtime**: Python 3.11 (Slim)
- **Framework**: FastAPI (Management API & WebSocket)
- **Messaging**: Redis Streams (Input), Redis Pub/Sub (Output)
- **Data**: Polars, PyArrow (Parquet)
- **AI**: LightGBM, Scikit-learn
- **Serialization**: orjson

## 📂 Directory Structure

```
src/
├── ai/
│   └── trainer.py           # LightGBM学習パイプライン
├── domain/
│   ├── interfaces.py        # 抽象基底クラス
│   ├── ghost_client.py      # シミュレーション (Telemetry)
│   ├── risk_manager.py      # リスク管理
│   ├── indicators.py        # RSI/SMA共通モジュール 🆕
│   └── features.py          # 特徴量生成 (Polars)
├── infrastructure/
│   ├── backfiller.py        # 過去データ取得 (Bybit)
│   ├── discord.py           # Discord通知
│   ├── funding_client.py    # Funding Rate取得
│   ├── indicator_service.py # 日足OHLCV取得・キャッシュ 🆕
│   ├── onchain_client.py    # On-Chain指標
│   └── recorder.py          # データ保存
├── strategies/
│   ├── momentum_strategy.py # Daily Momentum (Long-term + RiskManager)
│   └── funding_arb.py       # Funding Rate Arb
└── main.py                  # エントリーポイント (Synapse)
```

## 🚦 API & WebSocket

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | システム稼働状況とバッファサイズ |
| GET | `/funding` | Funding Rate戦略状況 |
| GET | `/momentum` | Daily Momentum戦略状況 🆕 |
| GET | `/onchain` | On-Chain指標 |
| GET | `/risk` | リスク管理状況 🆕 |
| GET | `/correlation/matrix` | 銘柄間相関行列 |
| GET | `/correlation/lags` | ラグ相関分析 |
| GET | `/analysis/technical/{symbol}` | テクニカル指標 |
| WS | `/ws/monitor` | リアルタイムモニタリング用ストリーム |

## 起動

```bash
./scripts/dev_manager.ps1 rebuild quant-brain
```

## データ準備 (Backfill)

AI学習用の過去データをBybitから取得します。

```bash
# コンテナ内で実行
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml exec quant-brain python scripts/run_backfill.py
```

## ハイパーパラメータ最適化 (Optimization)

Optunaを使用して、Sharpe Ratioを最大化するパラメータを探索します。

```bash
# コンテナ内で実行
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml exec quant-brain python scripts/optimize.py
```

## モニタリング

`apps/quant-brain/monitor.html` をブラウザで開くことで、リアルタイムの脳内活動を監視できます。

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `REDIS_URL` | Redis接続URL | `redis://redis:6379/0` |
| `DATABASE_URL` | TimescaleDB接続URL | `postgresql+asyncpg://...` |
| `DISCORD_WEBHOOK_URL` | Discord通知用Webhook | (なし) |
| `MAX_DRAWDOWN_PCT` | 最大ドローダウン(%) | `10.0` |
| `MAX_POSITION_PCT` | 最大ポジション(%) | `20.0` |
| `MIN_FUNDING_RATE` | 最低Funding Rate(%) | `10.0` |

## 🔄 Weekly Momentum Optimization

毎週月曜日 09:00 JST に戦略パラメータを自動最適化します。

| Endpoint | Description |
|----------|-------------|
| GET `/scheduler` | 次回実行時刻を確認 |
| POST `/scheduler/run` | 手動で今すぐ実行 |

**パイプライン:**
1. `run_backfill.py` - 過去データ取得
2. `optimize_momentum.py` - Optunaでパラメータ最適化 🆕

**最適化対象:**
| パラメータ | 探索範囲 |
|:---|:---|
| RSI期間 | 7-21 |
| RSI閾値 | 40-60 |
| SMA期間 | 100-300 |

結果は `config/momentum_params.json` に保存され、再起動時に自動読み込み。

## 🆕 Multi-Signal Feature Integration

LightGBMモデルは以下の14特徴量を使用:

| カテゴリ | 特徴量 |
|:---|:---|
| **テクニカル (8)** | log_return, volatility_20, sma_20, sma_50, momentum_10, volume_ratio, signal_trend, high_volatility |
| **Funding Rate (2)** | funding_rate, funding_annualized |
| **On-Chain (4)** | mempool_size, fee_fast, unconfirmed_tx, hashrate_normalized |

## 🆕 Funding Rate Data Persistence

Funding RateをTimescaleDBに自動保存（重複防止機能付き）:
- 保存頻度: FR変化時のみ (~8時間)
- 保持期間: 1年間
- 圧縮: 7日以上のデータは自動圧縮

## 🆕 Discord Notifications

以下のイベントをDiscordに通知:

| イベント | 説明 |
|:---|:---|
| `order_filled` | 約定通知 |
| `funding_signal` | 高FR検出 (年率10%超) |
| `funding_entry/exit` | FRポジション変更 |
| `daily_momentum_entry` | 長期戦略エントリー 🆕 |
| `daily_momentum_exit` | 長期戦略イグジット 🆕 |
| `onchain_signal` | ネットワーク異常 |
