# 🗺️ プロジェクトマップ

このドキュメントは、AIアシスタントおよび開発者がコードベースを迅速にナビゲートするための主要なファイル位置を示します。

## 📂 ルート構成 (Core Configuration)
- **設定:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- **Docker (分離構成 - ADR-016):**
  - `docker-compose.base.yml` (共通設定)
  - `docker-compose.dev.yml` (開発環境オーバーライド)
  - `docker-compose.prod.yml` (本番環境オーバーライド)
- **環境変数:** `.env` (ルート設定)
- **無視ファイル:** `.dockerignore` (ルート & 各アプリ), `.gitignore`

## 📦 アプリケーション (`/apps`)

### 💰| **money-master** | `3001` | `:3000` | 資産管理DB (Core) | SQLite (`money-master.db`), `@repo/ui` |
- **場所:** `apps/money-master`
- **スタック:** Next.js 15, Prisma, SQLite, Tailwind
- **環境変数:** `.env` (DB URL: `file:/app/data/money-master.db`)
- **データベース:**
  - スキーマ: `prisma/schema.prisma`
  - データ: `data/money-master.db` (マウントボリューム)
- **ロジック:**
  - **Automation:** `src/lib/scheduler.ts` (Dividend Sync Cron - Mon 09:00)
  - Actions: `src/lib/actions.ts` (Server Actions エントリー)
  - Services: `src/services/*.ts` (ビジネスロジック)
  - Types: `src/types/index.ts`
- **UI:**
  - Pages: `src/app/**/*` (含む `/crypto` War Room)
  - Components: `src/components/**/*` (含む `crypto/ConfluenceGauge.tsx`)
- **Test/Lint:**
  - Jest設定: `jest.config.js` (E2Eテスト除外、カバレッジ閾値5%)
  - E2Eテスト: `e2e/*.spec.ts` (Playwright、Jestから除外)
  - ユニットテスト: `src/**/__tests__/*.test.ts` (152 tests, 51.29% coverage)

### 📚 `my-kindle` (Manga Reader)
- **場所:** `apps/my-kindle`
- **スタック:** Next.js 15, Tailwind
- **設定:** `src/lib/config.ts` (ライブラリパスロジック)
- **API:** `src/app/api/**/*`
- **マウント:** `/mnt/gdrive/Manga` (Google Drive連携)

### 🗣️ `ai-talker` (English Tutor)
- **場所:** `apps/ai-talker`
- **スタック:** Next.js 15, React Three Fiber, Gemini 2.5 Pro
- **役割:** 3Dアバターと音声対話による英会話学習
- **主要機能:** - 音声認識/合成 (WebSpeech + Voicevox)
  - 感情連動型3Dアバター
  - Geminiによる人格/指導スタイルの動的変更
- **ポート:** `3004` (Dev/Docker)

### 📰 `news-reader` (AI News)
- **場所:** `apps/news-reader`
- **スタック:** Next.js 15, Gemini 2.5 Flash, Redis, rss-parser, cheerio
- **役割:** ゼロレイテンシAIニュースリーダー
- **ポート:** `3005` (Dev/Docker)
- **主要機能:**
  - RSSフィード取得・解析 (rss-parser)
  - サイトURLからのフィード検出 (cheerio)
  - AI要約・優先度付け (Gemini)
  - 記事データキャッシュ (Redis)
  - オフライン閲覧 (Service Worker)
- **Key Files:**
  - `src/components/FeedSidebar.tsx`: フィード管理UI
  - `src/hooks/useFeeds.ts`: フィード永続化ロジック (LocalStorage)
  - `e2e/feed.spec.ts`: E2Eテスト

### 🎬 `auto-clipper-web` (Video Editor UI)
- **場所:** `apps/auto-clipper-web`
- **スタック:** Next.js 15, React Query
- **UI:** 動画編集用インターフェース

### ⚙️ `auto-clipper-api` (Video AI Backend)
- **場所:** `apps/auto-clipper-api`
- **スタック:** Python 3.11, FastAPI, Celery, FFmpeg
- **主要ファイル:**
  - Entry: `main.py` (FastAPI)
  - Worker: `celery_app.py`, `tasks.py` (Celery)
  - Config: `config.py`
  - Database: `database.py`, `jobs.db`
- **Lint/Test:**
  - Lint: `ruff` (設定: `pyproject.toml`)
  - Test: `pytest` (設定: `pytest.ini`)
  - 仮想環境: `venv/Scripts/`
- **出力:** `apps/auto-clipper-api/output`

### 📈| **market-watcher** | `8001` | `:8000` | 市場分析AIエージェント | Voicevox, SQLite (`money-master.db`) |
- **場所:** `apps/market-watcher`
- **スタック:** Python 3.11, Redis Streams, ccxt.pro
- **役割:** "The All-Seeing Eye" - 市場データのリアルタイム収集と配信
- **主要ファイル:** `src/main.py` (Redis Stream Ingester)
- **Lint/Test:**
  - Lint: `ruff` (設定: `pyproject.toml`)
  - Test: `pytest` (設定: `pytest.ini`)
  - 仮想環境: `venv/Scripts/`

### 📥 `manga-downloader` (Tool)
- **場所:** `apps/manga-downloader`
- **タイプ:** Standalone Python Script
- **エントリー:** `download_images_as_cbz.py`
- **ドキュメント:** `使い方.md`, `exe化手順.md`

### 🧠 quant-brain (Neural Alpha Engine)
- **場所:** `apps/quant-brain`
- **スタック:** Python 3.11, FastAPI, Redis Streams, Polars, PyArrow
- **役割:** "Neural Alpha Engine" - 戦略実行とシミュレーション
- **ポート:** `8002` (Dev/Docker)
- **バージョン:** v2.0.0 (God Mode)
- **Key Files:**
  - `src/main.py`: Neural Synapse (Redis Consumer)
  - `src/ai/trainer.py`: Model Trainer (LightGBM)
  - `src/strategies/neural_strategy.py`: Neural Strategy (Inference)
  - `monitor.html`: Real-time Neural Monitor (Dashboard)
  - `scripts/train_model.py`: Training Script
  - `src/domain/ghost_client.py`: The Ghost (Simulation Engine)
  - `src/domain/features.py`: Feature Factory (Polars)
  - `src/infrastructure/recorder.py`: Data Recorder (Parquet)
  - `src/infrastructure/backfiller.py`: Historical Data Backfiller
  - `src/domain/interfaces.py`: Abstract Interfaces
  - `scripts/run_backfill.py`: Backfill Execution Script
- **機能:**
  - 🧠 Neural Synapse: Redis Streamsからの高速データ受信
  - 👻 The Ghost: メモリ内高速シミュレーション
  - 💾 Data Recorder: Polars/Parquetによるデータ永続化

## 🧩 共有パッケージ (`/packages`)
- **`ui`**: `packages/ui`
  - Components: `src/components/ui/*.tsx` (Shadcn UI)
  - Utils: `src/lib/utils.ts`
- **`config`**: `packages/config`
  - ESLint: `eslint.config.mjs`
  - TypeScript: `tsconfig.json`

## 📜 スクリプト (`/scripts`)

### 🎮 統合管理
- **`dev_manager.ps1`**: コンテナの統合管理スクリプト
  ```powershell
  # サービスの起動
  ./scripts/dev_manager.ps1 up money-master
  
  # リビルド（HMR対応）
  ./scripts/dev_manager.ps1 rebuild auto-clipper-web -Poll
  
  # ログの確認（フォロー）
  ./scripts/dev_manager.ps1 logs market-watcher -Follow
  
  # コンテナ停止
  ./scripts/dev_manager.ps1 down money-master

  # システムのクリーンアップ (Prune)
  ./scripts/dev_manager.ps1 -Action prune
  ```

### 🔍 検証・ヘルスチェック
- **`verify_system.ps1`**: システム全体のヘルスチェック
  ```powershell
  ./scripts/verify_system.ps1
  # 全コンテナの状態、ポート、ログを確認
  ```
- **`verify_gold_master.ps1`**: Lint、型チェック、ビルド検証
  ```powershell
  ./scripts/verify_gold_master.ps1
  # 本番グレードの品質検証（CI/CD相当）
  # - TypeScript: ESLint + tsc
  # - Python: Ruff + pytest
  # - Build: Next.js apps
  ```
- **`test_runner.ps1`**: ユニットテスト実行ランナー
  ```powershell
  ./scripts/test_runner.ps1
  # 対話形式でテストを実行（Watchモード、カバレッジ対応）
  ```
- **`lint_python.ps1`**: Pythonコードの一括Lint (Ruff)
  ```powershell
  ./scripts/lint_python.ps1
  # Dockerおよびローカル環境のPythonコードをRuffで検査
  ```
- **`verify_docs.py`**: ドキュメント整合性チェック
  ```powershell
  python scripts/verify_docs.py
  # source_of_truth.yaml との整合性を検証
  ```

### 🚀 セットアップ・起動
- **`launch_system.ps1`**: システム全体の起動
  ```powershell
  ./scripts/launch_system.ps1
  # 全サービスを一括起動
  ```
- **`setup_drive.ps1`**: 外部ドライブ（H:）のWSLマウント
  ```powershell
  ./scripts/setup_drive.ps1
  # H: ドライブを /mnt/h にマウント
  ```
- **`redeploy_all.ps1`**: 全サービスの再デプロイ
  ```powershell
  ./scripts/redeploy_all.ps1
  # docker-compose down → up を全サービスで実行
  ```

### 🧹 メンテナンス
- **`cleanup_project.ps1`**: キャッシュとビルド成果物のクリーンアップ
  ```powershell
  ./scripts/cleanup_project.ps1
  # .next, node_modules, .turbo を削除
  ```
### 📦 依存関係管理
- **`repair_dependencies.ps1`**: パッケージ追加とコンテナ同期
  ```powershell
  ./scripts/repair_dependencies.ps1 -Package axios -Filter money-master
  # ホストで追加し、コンテナ内でインストールして再起動（リビルド回避）
  ```
- **`restart_docker.ps1`**: Docker環境の再起動
  ```powershell
  ./scripts/restart_docker.ps1 -Rebuild
  # Dockerデーモン再起動 + リビルド（完全リセット用）
  ```

### 🔄 ユーティリティ
- **`sync_github.ps1`**: GitHubへの変更プッシュ
  ```powershell
  ./scripts/sync_github.ps1
  # git add, commit, push を自動化
  ```
- **`prepare_public_release.ps1`**: 公開リポジトリ用の準備
  ```powershell
  ./scripts/prepare_public_release.ps1
  # 機密情報を除外してクリーンな状態を作成
  ```
- **`migrate_imports.ps1`**: インポート文の一括移行
  ```powershell
  ./scripts/migrate_imports.ps1
  # モノレポ移行時のインポートパス修正
  ```
- **`gitingest.ps1`**: コードベースのダイジェスト生成
  ```powershell
  ./scripts/gitingest.ps1 .
  # リポジトリの内容を1つのテキストファイルに集約
  ```


## 🤖 Agent Skills (`.agent/skills/`)

AIアシスタントが参照する標準化された開発手順書。

| Skill | 説明 | 主な用途 |
|:---|:---|:---|
| **docker-debug** | Dockerトラブルシューティング | コンテナ起動失敗、HMR問題、依存関係不整合 |
| **new-component** | `@repo/ui` コンポーネント追加 | 共有UIコンポーネントの標準テンプレート |
| **new-app** | Turborepo新規アプリ追加 | Next.js / FastAPI アプリのブートストラップ |
| **db-schema** | DBスキーマ変更 | SQLite (Drizzle) / TimescaleDB (Alembic) |
| **api-endpoint** | APIエンドポイント追加 | FastAPI / Next.js Route (TDD付き) |
| **mcp-query** | MCP経由DBクエリ | SQLite / TimescaleDB 安全クエリ |
| **impact-check** | 変更前の影響範囲調査 | grep で依存関係・類似ロジックを特定 |
| **asset-register** | 資産データ登録の計算確認 | money-master の取得単価・数量検証 |
| **release-notes** | チェンジログ生成 | GitHub Release / ADR更新 |
| **perf-check** | パフォーマンス検証 | Lighthouse / Core Web Vitals |
| **ui-verify** | UI変更後のブラウザ検証 | localhost 目視確認 |
| **test-mock** | テストモック設定 | Prisma / 外部API のモック |
| **systematic-debugging** | 体系的デバッグ | 4フェーズの根本原因分析 (修正前に調査必須) |
| **root-cause-tracing** | 根本原因追跡 | エラーの実行パス逆追跡 (UI→API→DB) |
| **test-fixing** | テスト修復 | スマートエラーグルーピングによる体系的修正 |
| **dev-branch-finish** | 開発ブランチ完了 | PR作成→マージ→クリーンアップ |
| **webapp-testing** | Playwright E2Eテスト | 5フロントエンドアプリの自動テスト |
| **defense-in-depth** | 多層防御テスト | 金融アプリ向けセキュリティチェック |
| **review-implementing** | 実装レビュー | PRフィードバック対応 / プラン自己レビュー |

**使用方法:** AIとの会話中に関連するタスクが検出されると自動的に参照されます。

## 🔍 オブザーバビリティ (Observability)
- **Dozzle:** `localhost:8888` (ログビューアー)
- **TimescaleDB:** `localhost:5432` (時系列DB)
- **Redis:** `localhost:6379` (メッセージブローカー)
- **Voicevox:** `localhost:50021` (音声合成エンジン)

