---
name: mcp-query
category: DevOps & DevOpsCore
description: MCP経由でデータベースクエリを安全に実行
---

# MCP クエリスキル

Model Context Protocol (MCP) 経由でデータベースへ安全にクエリを実行する手順。

---

## 利用可能な MCP サーバー

| サーバー | データベース | 用途 | 書き込み制御 |
|:---|:---|:---|:---|
| `sqlite` | `data/money-master.db` | 資産管理データ | `read_only=true` をパラメータで指定 |
| `postgres` | TimescaleDB (`quant_brain`) | 時系列市場データ | サーバー側で読み取り専用接続 |

---

## SQLite クエリ (money-master)

### テーブル一覧確認
// turbo
```
mcp_sqlite_list_tables
```

### データ取得
// turbo
```
mcp_sqlite_execute_query("SELECT * FROM Asset LIMIT 10", read_only=true)
```

### 例: 資産サマリー
// turbo
```
mcp_sqlite_execute_query("
  SELECT 
    type,
    COUNT(*) as count,
    SUM(quantity * currentPrice) as total_value
  FROM Asset
  GROUP BY type
", read_only=true)
```

### 例: 配当履歴
// turbo
```
mcp_sqlite_execute_query("
  SELECT 
    a.name,
    d.amount,
    d.paymentDate
  FROM Dividend d
  JOIN Asset a ON d.assetId = a.id
  ORDER BY d.paymentDate DESC
  LIMIT 20
", read_only=true)
```

---

## PostgreSQL クエリ (TimescaleDB)

> [!NOTE]
> PostgreSQL MCP サーバーはサーバー側で読み取り専用接続として構成済み。
> `read_only` パラメータの明示指定は不要。

### テーブル一覧確認
// turbo
```
mcp_postgres_query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
```

### 例: 価格データ取得
// turbo
```
mcp_postgres_query("
  SELECT symbol, timestamp, close, volume
  FROM ohlcv
  WHERE symbol = 'BTCUSDT'
  ORDER BY timestamp DESC
  LIMIT 100
")
```

### 例: 時間集計（TimescaleDB 固有関数）
// turbo
```
mcp_postgres_query("
  SELECT 
    time_bucket('1 hour', timestamp) AS bucket,
    symbol,
    first(open, timestamp) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, timestamp) AS close,
    sum(volume) AS volume
  FROM ohlcv
  WHERE symbol = 'BTCUSDT'
    AND timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY bucket, symbol
  ORDER BY bucket DESC
")
```

### 例: テーブルのカラム情報
// turbo
```
mcp_postgres_query("
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ohlcv'
  ORDER BY ordinal_position
")
```

---

## 安全ガイドライン

> [!CAUTION]
> **書き込みクエリは禁止**  
> MCP 経由では読み取り専用クエリのみ実行すること。
> SQLite は `read_only=true`、PostgreSQL はサーバー側で制御。

> [!WARNING]
> **大量データに注意**  
> 必ず `LIMIT` を使用し、過大なデータ取得を避けること。

> [!TIP]
> **クエリが遅い場合**  
> `EXPLAIN` でクエリプランを確認すること。
> ```
> mcp_sqlite_execute_query("EXPLAIN QUERY PLAN SELECT ...", read_only=true)
> ```
