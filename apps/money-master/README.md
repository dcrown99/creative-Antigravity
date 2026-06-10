# Money Master

個人資産管理のためのNext.jsアプリケーションです。資産、取引、配当などを追跡・可視化し、財務状況を包括的に管理できます。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan)


## 概要

Money Masterは、モダンなUIとグラスモーフィズムデザインを採用した、洗練された資産管理Webアプリケーションです。日本円および米ドル建ての資産を一元管理し、リアルタイムの価格情報を取得して資産評価を行います。

### 主な機能

- **📊 ダッシュボード**: 総資産、資産配分、収益/損失を視覚的に表示
- **🚀 War Room (Crypto)**: 仮想通貨先物市場のリアルタイム監視・統合判断ダッシュボード (God Mode)
- **🧠 AI Decision Engine**: Confluence Gaugeによる「買い/売り」の統合判断
- **💰 資産管理**: 現金、株式、投資信託、ETFなどの多様な資産タイプに対応
- **📈 取引履歴**: すべての金融取引を記録・追跡
- **💵 配当管理**: 配当履歴の記録・分析、および「編集」「自動登録」機能の強化
- **📉 アナリティクス**: 資産推移、収益分析などのチャート表示

- **🧠 カテゴリ自動学習**: CSVインポート時にカテゴリ修正を学習し、次回から自動分類
- **💱 為替自動取得**: USD/JPYレートをリアルタイムで取得
- **📁 CSV インポート**: 楽天証券などのCSVファイルから取引データを一括インポート
- **🌓 ダークモード**: 目に優しいダークテーマに対応
- **📱 レスポンシブデザイン**: PC、タブレット、スマートフォンで快適に使用可能

## 技術スタック

- **フロントエンド**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS 4
- **共通UI**: @repo/ui (Shadcn + Radix UI)
- **チャート**: Recharts
- **データベース**: Prisma + SQLite
- **データ取得**: Yahoo Finance API (yahoo-finance2)
- **フォーム**: React Hook Form + Zod
- **状態管理**: React Context API + Server Actions

### Monorepo 構成

このプロジェクトは **Turborepo + pnpm Workspaces** で構成されたMonorepoの一部です。

- **パッケージ名**: `@app/money-master`
- **共有パッケージ**: `@repo/ui` (共通UIコンポーネント)
- **ビルドシステム**: Turborepo (並列ビルド、キャッシュ最適化)

> [!NOTE]
> Monorepo全体のアーキテクチャは [ARCHITECTURE.md](file:///c:/Users/koume/Downloads/code/ARCHITECTURE.md) を参照してください。

## 必要環境

- Node.js 22以上 (yahoo-finance2 v3.11.x の要件)
- npm、yarn、pnpm、またはbun

## クイックスタート (Docker)

本環境では**Dockerでの実行**が標準です。

### 統合環境での起動 (推奨)

プロジェクトルートから実行:

```bash
# Money Master + Market Watcher + VOICEVOX を起動
cd ../..
docker-compose up -d money-master market-watcher voicevox
```

**アクセス**: http://localhost:3000

**停止**:
```bash
docker-compose down
```

### ログ確認

```bash
# Money Masterのログ
docker-compose logs -f money-master

# 再ビルド (マルチステージビルドにより高速化)
docker-compose up -d --build money-master
```

## ローカル開発

### Turborepo経由 (推奨)

プロジェクトルートから:
```bash
# 全アプリの開発サーバーを並列起動
pnpm dev

# Money Masterのみ起動
pnpm --filter @app/money-master dev
```

### 個別起動

```bash
cd apps/money-master
pnpm dev
```

### Prisma

Docker環境内でPrismaコマンドを実行:

```bash
# マイグレーション
docker-compose exec money-master pnpm exec prisma db push

# Prisma Clientの生成
docker-compose exec money-master pnpm exec prisma generate

# Prisma Studio
docker-compose exec money-master pnpm exec prisma studio
```

### Docker内でのスクリプト実行

`scripts/` ディレクトリ内のTypeScriptスクリプトをDocker内で実行する場合:

```bash
# 汎用パターン
docker exec money-master sh -c "cd /app/apps/money-master && npx tsx scripts/your-script.ts"

# 例: 日付正規化マイグレーション (保守用)
docker exec money-master sh -c "cd /app/apps/money-master && npx tsx scripts/normalize-dates.ts"
```

> [!NOTE]
> ソースコードは `/app/apps/money-master` にマウントされています。
> スクリプト実行時は `cd` でそのディレクトリに移動してから実行してください。


## データ管理

### データベース (Prisma + SQLite)

Money MasterはPrisma ORMとSQLiteデータベースを使用してデータを管理します。

**データベースファイル**: `data/money-master.db`

### データバックアップ

#### UI経由でのバックアップ (推奨)

**設定画面**からワンクリックでバックアップを作成できます:

1. ダッシュボードの「設定」ページに移動
2. **データ管理**セクションで以下の機能を利用:
   - **手動バックアップ**: 「バックアップを作成」ボタンをクリック
   - **自動バックアップ設定**: 有効/無効、実行時刻、保持期間をカスタマイズ可能
   - **バックアップ一覧**: 過去のバックアップファイルを表示・管理

**バックアップ保存先**: `data/backups/backup-YYYY-MM-DD-HHmmss.db`

#### 自動バックアップ設定

| 設定項目 | デフォルト | 説明 |
|:---|:---:|:---|
| 有効/無効 | ✅ 有効 | 自動バックアップのオン/オフ |
| 実行時刻 | 09:00 | 毎日のバックアップ実行時刻 |
| 保持期間 | 30日 | 指定日数より古いバックアップは自動削除 |

#### Docker環境でのバックアップ (手動)

Docker環境でのバックアップ:

```bash
# データベースファイルをローカルにコピー
docker-compose cp money-master:/app/data/money-master.db ./money-master-backup-$(date +%Y%m%d).db

# または、dataディレクトリ全体をバックアップ
cp -r apps/money-master/data ./backups/money-master-data-$(date +%Y%m%d)
```

Windows (PowerShell):
```powershell
# データベースバックアップ
Copy-Item apps\money-master\data\money-master.db -Destination ".\backups\money-master-$(Get-Date -Format 'yyyyMMdd').db"
```



### データ復元

#### UI経由でのリストア (推奨)

**設定画面**からバックアップを選択して復元:

1. 設定ページの**データ管理**セクションに移動
2. バックアップ一覧から復元したいバックアップを選択
3. 「復元」ボタンをクリック
4. 確認ダイアログで「はい」を選択

> [!NOTE]
> リストア実行前に、現在のデータベースが自動的にバックアップされます (`pre-restore-*.db`)

#### Docker環境での手動リストア

SQLiteデータベースを復元:

```bash
# バックアップから復元
cp ./backups/money-master-20241128.db data/money-master.db

# Dockerコンテナ再起動
docker-compose restart money-master
```

## 主要機能の使い方

### 1. 資産の追加

1. ダッシュボード画面の「資産を追加」ボタンをクリック
2. 資産タイプ（現金、株式、投資信託など）を選択
3. 必要な情報（名称、残高、口座タイプなど）を入力
4. 「追加」をクリック

### 2. 取引の記録

1. 取引履歴ページに移動
2. 「新規取引」ボタンをクリック
3. 取引内容（日付、カテゴリ、金額など）を入力
4. 「保存」をクリック

### 3. CSVインポート

1. インポートページに移動
2. 楽天証券などのCSVファイルを選択
3. カラムマッピングを確認
4. 「インポート」をクリック

### 4. 配当の記録

1. 配当履歴ページに移動
2. 「配当を追加」ボタンをクリック
3. 配当情報（日付、銘柄、金額など）を入力
4. 「保存」をクリック

### 5. アナリティクス

1. アナリティクスページに移動
2. 期間（月次/年次）を選択
3. 資産推移、収益分析などのチャートを確認

### 6. カテゴリ自動化ルール

1. 設定ページに移動
2. 「カテゴリ自動化ルール」セクションを確認
3. キーワードとカテゴリを入力して「追加」をクリック
4. 登録されたルールは次回のCSVインポート時から自動適用されます

### 7. インポート時の学習機能

1. CSVインポートのプレビュー画面で、カテゴリが間違っている行を見つける
2. カテゴリを正しいものに変更
3. 右側の「🧠(学習)」ボタンをクリック
4. キーワードを確認して保存すると、ルールとして登録され、即座に他の行にも適用されます

## 対応する資産タイプ

- **現金**: 預金、普通預金など
- **株式**: 国内株式、米国株式
- **投資信託**: インデックスファンド、アクティブファンドなど
- **ETF**: 上場投資信託
- **暗号通貨** (将来的に対応予定)

## アカウントタイプ

- **特定口座**: `TOKUTEI`
- **NISA（つみたて）**: `NISA_TSUMITATE`
- **NISA（成長）**: `NISA_GROWTH`

## カスタマイズ

### カラースキーム

`src/app/globals.css`でカラースキームをカスタマイズできます。

### チャート表示

Rechartsを使用しており、`src/components/dashboard/`内のコンポーネントで設定を変更できます。



トラブルシューティング

### 資産が表示されない

1. データベース接続を確認 (`data/money-master.db`が存在するか)
2. Dockerコンテナが起動しているか確認
3. ブラウザのコンソールでエラーメッセージを確認
4. ページを再読み込み

### 価格情報が取得できない

Yahoo Finance APIへのアクセスに問題がある可能性があります：
1. インターネット接続を確認
2. ティッカーシンボルが正しいか確認
3. **429 (Too Many Requests) エラーの場合:**
   - Yahoo FinanceがIPアドレスをレート制限している可能性があります
   - システムはキャッシュまたはデフォルト値にフォールバックします
   - しばらく待ってから手動で価格更新を試みてください
4. **Node.jsバージョンを確認:** yahoo-finance2 v3.11.x はNode.js 22以上を要求します

### ビルドエラー

```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

## プロジェクト構造

```
money-master/
├── src/
│   ├── app/              # Next.js App Router ページ
│   ├── components/       # Reactコンポーネント
│   ├── lib/              # ユーティリティ関数、Server Actions
│   ├── services/         # ビジネスロジック層
│   ├── types/            # TypeScript型定義
│   └── hooks/            # カスタムReact Hooks
├── prisma/               # Prisma schema定義
│   └── schema.prisma
├── data/                 # SQLiteデータベース
│   └── money-master.db
├── public/               # 静的ファイル
├── scripts/              # ユーティリティスクリプト

└── Dockerfile            # Docker設定
```

## 貢献

このプロジェクトは個人使用を目的としていますが、改善の提案やバグ報告は歓迎します。

## ライセンス

このプロジェクトは個人使用を目的としています。

### 🌍 公開リポジトリ
本プロジェクトの公開版は以下で管理されています（機密情報を除外済み）:
[https://github.com/dcrown99/creative-Antigravity](https://github.com/dcrown99/creative-Antigravity)

## 注意事項

- データはPrisma ORM + SQLiteデータベース (`data/money-master.db`) に保存されます
- 定期的なデータベースバックアップを推奨します
- 価格情報はYahoo Financeから取得され、リアルタイムではない場合があります
- 投資判断は自己責任で行ってください

## コード品質管理

このプロジェクトでは以下のツールを使用してコード品質を管理しています:

### ESLint

```bash
# Lintチェック
npm run lint

# TypeScript型チェック
npx tsc --noEmit
```

**現在の状態**: ✅ ESLintエラー 0件
