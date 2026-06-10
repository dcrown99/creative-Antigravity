# System Architecture & Port Registry

> **Version:** 3.2 | **Last Updated:** 2026-02-20
> プロジェクトのサーバー構成、ポート一覧、パスマッピングなどのインフラ情報です。

プロジェクトは **Webエコシステム（13コンテナ）** と **Tradingエコシステム（MT5 / Python）** の2軸で構成されています。

## 🌐 Web & API エコシステム (Docker 13コンテナ)

| サービス | ポート | 内部ポート | 役割 | 重要な依存関係 |
| :--- | :--- | :--- | :--- | :--- |
| **money-master** | `3001` | `:3000` | 資産管理DB (Core) | SQLite (`money-master.db`), `@repo/ui` |
| **my-kindle** | `3002` | `:3000` | マンガリーダー | Host Mount (`H:\漫画`), `@repo/ui` |
| **auto-clipper-web** | `3003` | `:3000` | 動画編集UI | `@repo/ui`, auto-clipper-api |
| **ai-talker** | `3004` | `:3000` | 英会話学習 (3D Avatar) | Voicevox, Gemini 2.5 Pro, `@repo/ui` |
| **news-reader** | `3005` | `:3000` | AIニュースリーダー | Gemini 2.5 Flash, Redis, `@repo/ui` |
| **auto-clipper-api** | `8000` | `:8000` | 動画AIバックエンド | Redis, auto-clipper-worker, FFmpeg |
| **market-watcher** | `8001` | `:8000` | 市場分析AIエージェント | Voicevox, SQLite (`money-master.db`) |
| **quant-brain** | `8002` | `:8000` | 金融分析エンジン | TimescaleDB, ccxt |
| **timescaledb** | `5432` | `:5432` | 時系列DB | PostgreSQL互換 |
| **redis** | `6379` | `:6379` | メッセージブローカー | (なし) |
| **voicevox** | `50021` | `:50021` | 音声合成エンジン | (なし) |
| **dozzle** | `8888` | `:8080` | ログビューアー | Docker Socket |
| **auto-clipper-worker** | 非公開 | N/A | バックグラウンドワーカー | Redis, FFmpeg |

## 📈 Trading エコシステム (MT5 / MQL5 / Python)
- **MT5 (Windows Host)**: EA実行環境・自動売買システム・Strategy Tester
- **Python Quant**: バックテスト解析 (`mt5-backtest` クラスター)、アルファ検証 (`verify_*.py`)

## 💻 Windows/WSL2 Awareness

- **パスマッピング参照:**
  | Windows パス | WSL2 パス | 備考 |
  | :--- | :--- | :--- |
  | `H:\漫画` | `/mnt/h/漫画` | my-kindle用ホストマウント |
  | `C:\Users\koume\Downloads\code` | `/mnt/c/Users/koume/Downloads/code` | リポジトリルート |
- **エンコーディング (UTF-8 徹底):**
  - **PowerShell ファイル操作:** `Set-Content` / `Out-File` 使用時は必ず `-Encoding UTF8` を付与
  - **Python 実行:** `$env:PYTHONIOENCODING='utf-8'` を設定してから実行
