---
name: docker-debug
category: DevOps & DevOpsCore
description: Dockerコンテナのトラブルシューティング
---

# Docker Debug Skill

Dockerコンテナの問題を診断・解決するための標準手順。

## 症状別対処法

### コンテナが起動しない
// turbo
1. ログ確認: `./scripts/dev_manager.ps1 logs <service>`
2. 終了コード確認: `docker ps -a --filter "name=<service>"`
3. 依存コンテナ確認 (redis, timescaledb, voicevox)

### ビルドエラー
// turbo
1. 依存関係同期: `./scripts/repair_dependencies.ps1`
2. キャッシュクリア: `docker builder prune -f`
3. 再ビルド: `./scripts/dev_manager.ps1 rebuild <service>`

### ポート競合
1. 使用中プロセス特定: `netstat -ano | findstr :<port>`
2. プロセス終了: `Stop-Process -Id <PID>`
3. または別ポートを使用

### HMR (Hot Reload) が動作しない
Windows/WSL2環境では頻発する問題。
1. ポーリングモードで再起動: `./scripts/dev_manager.ps1 rebuild <app>`
2. 匿名ボリューム再作成: `-V` フラグ付きで再起動

### 依存関係不整合 (node_modules)
// turbo
1. 同期実行: `./scripts/repair_dependencies.ps1`
2. 特定パッケージ追加時: `./scripts/repair_dependencies.ps1 -Package <pkg> -Filter <app>`

## リカバリ手順 (最終手段)
全システムリセット:
```powershell
./scripts/redeploy_all.ps1
```

## 参照
- ログビューアー: http://localhost:8888 (dozzle)
- Docker Compose構成: `docker-compose.base.yml` + `docker-compose.dev.yml`
