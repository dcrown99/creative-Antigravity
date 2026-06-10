---
description: AI_STATUS と Docker 状態の確認
---
// turbo-all

# /status - 現在のプロジェクト状態確認

1. `@AI_STATUS.md` を読み込み、内容をそのまま表示する
2. Docker コンテナの状態を確認する:
   ```powershell
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   ```
3. 実行中 / 停止中のコンテナ数をサマリーとして報告する
