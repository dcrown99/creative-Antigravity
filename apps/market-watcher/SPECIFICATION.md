# Market Watcher (God Mode) - 技術仕様書

"The All-Seeing Eye" - 市場のあらゆる動きを監視し、リアルタイムでデータを供給するAIエージェント。

---

## 🏗️ アーキテクチャ

**Redis Streams** を中心としたイベント駆動型アーキテクチャを採用。
`ccxt.pro` を使用して取引所(Bybit)からリアルタイムデータを取得し、ダウンストリームのサービス (`quant-brain`) に配信します。

```mermaid
graph LR
    subgraph Market_Watcher ["Market Watcher (The Eye)"]
        Ingester[ccxt.pro Ingester]
    end

    subgraph Redis_Layer [Redis (Persistent Buffer)]
        Stream_Trade[Stream: market:trades]
        Stream_Tick[Stream: market:ticker]
        Stream_Book[Stream: market:orderbook]
        Stream_Liq[Stream: market:liquidations]
    end

    subgraph Consumers
        Quant[Quant Brain]
        Dashboard[Money Master]
    end

    Ingester -->|XADD| Stream_Trade
    Ingester -->|XADD| Stream_Tick
    Ingester -->|XADD| Stream_Book
    
    Stream_Trade -->|Filter| Stream_Liq
    
    Stream_Trade -->|XREAD| Quant
    Stream_Tick -->|XREAD| Quant
    Stream_Book -->|XREAD| Quant
```

---

## 🌊 データストリーム定義

すべてのデータは **Redis Streams** (`XADD`) で配信されます。
キー: `payload` (値は `orjson` でシリアライズされたJSON文字列)

### 1. `market:trades` (全約定)
市場のすべての約定イベント。

```json
{
  "type": "trade",
  "ts": 1700000000123,
  "price": 92000.5,
  "amount": 0.05,
  "side": "buy",
  "liq": false,  // 清算判定フラグ
  "id": "trade-id-123"
}
```

### 2. `market:liquidations` (清算)
`market:trades` のうち、清算 (`liq: true`) と判定されたもののみを転送。
`quant-brain` の "Liquidation Magnet" 戦略で使用。

### 3. `market:ticker` (価格・出来高)
1秒ごとのスナップショット。

```json
{
  "type": "ticker",
  "ts": 1700000001000,
  "last": 92001.0,
  "bid": 92000.5,
  "ask": 92001.5,
  "vol": 5000.0,
  "funding": 0.0001
}
```

### 4. `market:orderbook` (板情報)
板情報のスナップショット (Top 5 levels)。
`quant-brain` の "Wall Hunter" 戦略で使用。

```json
{
  "type": "book",
  "ts": 1700000001000,
  "bids": [[92000.0, 1.5], [91999.5, 0.5], ...],
  "asks": [[92001.0, 2.0], [92001.5, 1.2], ...]
}
```

---

## 🛠️ 技術スタック

- **Language**: Python 3.11 (Slim)
- **Framework**: FastAPI (Health Check用)
- **Library**: 
  - `ccxt` (Pro): WebSocket接続
  - `redis`: 非同期Redisクライアント
  - `orjson`: 高速JSONシリアライザ
- **Infrastructure**: Docker, Redis

---

## 🚀 運用・監視

- **ヘルスチェック**: `GET /health`
  - Redis接続とWebSocket接続の状態を返却。
- **ログ**: JSON形式 (時刻はミリ秒精度)
  - `Starting Trade Watcher...`
  - `💀 LIQUIDATION DETECTED: ...`

---

## ⚠️ 廃止された機能 (Legacy)

以下の機能は "God Mode" リファクタリングにより削除されました。
- **RSS News Fetcher**: `news.py` (廃止)
- **Gemini Analyst**: `analyst.py` (廃止 -> `quant-brain` へ移行予定)
- **Voicevox TTS**: `tts.py` (廃止 -> `ai-talker` へ集約)
