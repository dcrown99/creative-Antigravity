# Antigravity Ultimate Monorepo

**"dcrown99-code"** は、Gemini 3 Pro (Antigravity Ultimate Edition) によって管理される、高性能アプリケーションスイートを含む本番グレードのモノレポです。

## 🏗️ アーキテクチャ

このプロジェクトは、高性能なビルドシステムとして **TurboRepo** を、コンテナ化環境として **Docker** を使用しています。

### 📦 アプリケーション一覧
| アプリ名 | 説明 | 技術スタック | ステータス | アクセス |
| :--- | :--- | :--- | :--- | :--- |
| **money-master** | 資産管理ダッシュボード | Next.js, Prisma | 🟢 Prod | [http://localhost:3001](http://localhost:3001) |
| **my-kindle** | セルフホスト型マンガリーダー | Next.js, FileSystem | 🟢 Prod | [http://localhost:3002](http://localhost:3002) |
| **auto-clipper** | 動画処理 AI エージェント | Next.js, FastAPI | 🟡 Active | [http://localhost:3003](http://localhost:3003) |
| **ai-talker** | 英会話学習 (3D Avatar) | Next.js, Voicevox, Gemini | 🟢 Prod | [http://localhost:3004](http://localhost:3004) |
| **news-reader** | AIニュースリーダー | Next.js, Gemini, Redis | 🟢 Prod | [http://localhost:3005](http://localhost:3005) |
| **manga-downloader** | レガシー収集ツール | Python, Playwright | ⏸️ Legacy | (手動実行) |


---

## 🚀 クイックスタート (One-Click)

前提条件: **Docker Desktop (Windows)**, **Node.js 20+**, **pnpm 9+**.

### 1. 初期設定
Windows上で外部ドライブ（H:）がマウントされていることを確認してください。

./scripts/redeploy_all.ps1
```

### 4. システム健全性確認
Gold Master検証スクリプトを実行し、全アプリのLint、型チェック、ビルドを確認します。

```powershell
./scripts/verify_gold_master.ps1
```

---

## 🛠️ 開発ワークフロー

### 📦 Docker内でのパッケージ管理
`node_modules` はコンテナの状態を保持するためにボリュームマウントされていますが、`package.json` とロックファイルはホストと同期されています。

**新しいパッケージを追加する場合 (リビルド不要):**
以下のスクリプトを使用すると、ホスト側でのパッケージ追加とコンテナ内への同期を自動で行います。

```powershell
# 例: money-master に axios を追加
./scripts/repair_dependencies.ps1 -Package axios -Filter money-master

# 例: 開発用依存関係を追加
./scripts/repair_dependencies.ps1 -Package @types/node -Dev

# 例: ホスト側で手動変更した後、コンテナに同期のみ行う
./scripts/repair_dependencies.ps1
```

これにより、**Dockerイメージの再構築（数分）を回避し、数秒で依存関係を更新**できます。

### 🎨 UIコンポーネント開発
コンポーネントの独立開発には Storybook を使用します。

```bash
cd packages/ui
pnpm storybook
```

### 🗄️ データベースマイグレーション
`money-master` で `schema.prisma` を変更した場合:

```bash
cd apps/money-master
npx prisma migrate dev --name <migration_name>
```

```bash
cd apps/money-master
npx prisma migrate dev --name <migration_name>
```

### 🛡️ Pre-commit Hook
コミット時に `husky` と `lint-staged` が自動的に実行され、変更されたファイルに対してLintとフォーマットチェックを行います。

- **TypeScript:** `eslint --fix`
- **Python:** `ruff check --fix`

---

## 🧪 テスト

このプロジェクトは包括的なテスト基盤を実装しています。

### テストカバレッジ

| アプリケーション | テスト数 | カバレッジ | ステータス |
|:---|:---:|:---:|:---:|
| **money-master** | 152 tests | **51.29%** | ✅ |
| **news-reader** | 2 tests (E2E) | - | ✅ |
| **auto-clipper-api** | 11 tests | 30%+ | ✅ |
| **market-watcher** | 14 tests | 30%+ | ✅ |

### ユニットテスト実行

#### 🖥️ インタラクティブ実行 (推奨)

開発管理ツールから簡単にテストを実行できます。

```powershell
```powershell
./scripts/dev_manager.ps1
# メニューから 't' を選択
# または、特定のスタック(quant/clipper)のみを起動:
# ./scripts/dev_manager.ps1 -Stack "quant"
```

#### TypeScript（Jest）

```powershell
# money-master の全テスト実行
cd apps/money-master
pnpm test

# カバレッジレポート付き
pnpm test --coverage

# Watch モード
pnpm test:watch
```

#### Python（pytest）

```powershell
# auto-clipper-api のテスト実行
cd apps/auto-clipper-api
venv\Scripts\pytest

# カバレッジレポート付き
venv\Scripts\pytest --cov

# market-watcher のテスト実行
cd apps/market-watcher
venv\Scripts\pytest --cov=src
```

### E2Eテスト（Playwright）

```powershell
# money-master のE2Eテスト
cd apps/money-master
pnpm test:e2e

# news-reader のE2Eテスト
cd apps/news-reader
npx playwright test

# UI モードで実行
pnpm exec playwright test --ui
```

### 全アプリのテスト実行（TurboRepo）

```powershell
# ルートディレクトリで実行
pnpm turbo run test

# 特定のアプリのみ
pnpm turbo run test --filter=money-master
```

### カバレッジレポート

テスト実行後、以下の場所でHTMLレポートを確認できます：

- **money-master:** `apps/money-master/coverage/index.html`
- **auto-clipper-api:** `apps/auto-clipper-api/htmlcov/index.html`
- **market-watcher:** `apps/market-watcher/htmlcov/index.html`

または、Codecov で統合レポートを確認：  
https://codecov.io/gh/dcrown99/code

---

## 🤖 Agent Skills

AIアシスタントが参照する標準化された開発手順書です。`.agent/skills/` に格納されています。

| Skill | 用途 |
|:---|:---|
| `docker-debug` | Dockerトラブルシューティング |
| `new-component` | `@repo/ui` コンポーネント追加 |
| `new-app` | Turborepo新規アプリ追加 |
| `db-schema` | DBスキーマ変更 (SQLite/TimescaleDB) |
| `api-endpoint` | API エンドポイント追加 (TDD付き) |
| `mcp-query` | MCP経由のDBクエリ実行 |
| `release-notes` | チェンジログ生成 |
| `perf-check` | パフォーマンス検証 |

---

## 📜 ライセンス & メンテナンス
Gemini 3 Pro (Antigravity Ultimate Edition) によって保守されています。アーキテクチャの背景については `@AI_STATUS.md` および `ADR.md` を参照してください。

### 🌍 公開リポジトリ
本プロジェクトの公開版は以下で管理されています（機密情報を除外済み）:
[https://github.com/dcrown99/creative-Antigravity](https://github.com/dcrown99/creative-Antigravity)
