# News Reader AI 📰

高機能AIニュースリーダー。Inoreader同等機能を備えた、サーバーサイド永続化対応RSSリーダー。

## ✨ 機能

### コア機能
- 🔍 **AI要約** - Gemini 2.5 Flashによる記事分析（優先度、トピック、センチメント）
- 📂 **フォルダ管理** - フィードを階層的に整理
- ⭐ **スター & 既読管理** - 重要記事の保存と進捗追跡
- 🔎 **全文検索 (FTS5)** - 記事の高速全文検索
- 📥 **OPML対応** - 他のRSSリーダーからのインポート/エクスポート

### 高度な機能
### 高度な機能
- 📊 **AIダイジェスト** - 毎日の重要ニュースをAIがまとめて表示
- ⌨️ **キーボードショートカット** - J/K/M/S/Oでパワーユーザー操作
- 🏷️ **タグ管理** - 記事にカスタムタグを付与
- ⚙️ **自動化ルール** - 条件に基づく自動アクション
- 📱 **オフライン対応** - Service Workerによるキャッシュ
- 🖥️ **3カラムレイアウト** - フォルダ/記事一覧/閲覧ペインの効率的な表示
- 👁️ **5つのビューモード** - List, Expanded, Column, Card, Magazine
- 🤖 **AI分析パネル** - 記事閲覧時に優先度やセンチメントを即座に確認

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ FeedSidebar │  │ ArticleList │  │ ReadingPane     │ │
│  │ (フォルダ)   │  │ (Grid/List) │  │ (AI Panel)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                      API Layer                          │
│  /api/feeds  /api/articles  /api/folders  /api/opml    │
│  /api/digest /api/rules     /api/tags     /api/cron    │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                           │
│  ┌──────────────┐  ┌───────────┐  ┌─────────────────┐  │
│  │ SQLite+Drizzle│  │ BullMQ    │  │ Gemini API     │  │
│  │ (永続化+FTS5) │  │ (Queue)   │  │ (AI分析)       │  │
│  └──────────────┘  └───────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## ⌨️ キーボードショートカット

| キー | 動作 |
|:---|:---|
| `J` | 次の記事 |
| `K` | 前の記事 |
| `M` | 既読/未読切替 |
| `S` | スター切替 |
| `O` / `Enter` | 記事を開く |
| `Shift+A` | 全て既読 |
| `?` | ヘルプ表示 |

## 📡 API リファレンス

### フィード管理
| Method | Endpoint | 説明 |
|:---|:---|:---|
| GET | `/api/feeds` | フィード一覧（未読数付き） |
| POST | `/api/feeds` | フィード追加 |
| DELETE | `/api/feeds?id=xxx` | フィード削除 |

### 記事
| Method | Endpoint | 説明 |
|:---|:---|:---|
| GET | `/api/articles` | 記事一覧（フィルタ/検索対応） |
| PATCH | `/api/articles` | 記事状態更新 |

### フォルダ
| Method | Endpoint | 説明 |
|:---|:---|:---|
| GET | `/api/folders` | フォルダ一覧 |
| POST | `/api/folders` | フォルダ作成 |
| PATCH | `/api/folders` | フォルダ更新 |
| DELETE | `/api/folders?id=xxx` | フォルダ削除 |

### OPML
| Method | Endpoint | 説明 |
|:---|:---|:---|
| GET | `/api/opml` | OPMLエクスポート |
| POST | `/api/opml` | OPMLインポート (FormData) |

### その他
| Method | Endpoint | 説明 |
|:---|:---|:---|
| GET | `/api/digest` | AIダイジェスト取得 |
| GET/POST/PATCH/DELETE | `/api/tags` | タグ管理 |
| GET/POST/PATCH/DELETE | `/api/rules` | ルール管理 |
| GET | `/api/cron` | 定期フェッチトリガー |

## 🗄️ データベーススキーマ

```sql
-- 主要テーブル
folders     -- フォルダ階層
feeds       -- RSSフィード
articles    -- 記事データ
article_analysis -- AI分析結果
tags        -- タグ
article_tags -- 記事-タグ関連
rules       -- 自動化ルール
user_preferences -- ユーザー設定
articles_fts -- 全文検索インデックス (FTS5)
```

## 🚀 起動方法

```powershell
# 開発モード（Docker）
./scripts/dev_manager.ps1 rebuild news-reader

# ログ確認
./scripts/dev_manager.ps1 logs news-reader
```

## 🌐 アクセス

- **URL**: http://localhost:3005
- **Port**: 3005

## 📦 技術スタック

- **Frontend**: Next.js 15, React 19, Tailwind CSS, SWR
- **Database**: SQLite + Drizzle ORM + FTS5
- **Queue**: BullMQ + Redis
- **AI**: Google Gemini 2.5 Flash
- **UI**: @repo/ui (共有コンポーネント)

## 🔧 環境変数

| 変数 | 説明 |
|:---|:---|
| `GEMINI_NEWS_API_KEY` | Gemini API キー |
| `REDIS_URL` | Redis接続URL（デフォルト: redis://redis:6379） |
| `CRON_SECRET` | Cronエンドポイント保護用シークレット |

## 💻 開発ガイド
+
+### コマンド
+
+```powershell
+# Lint実行 (ESLint)
+pnpm turbo run lint --filter=news-reader
+
+# テスト実行 (Jest)
+pnpm turbo run test --filter=news-reader
+
+# ビルド確認
+pnpm turbo run build --filter=news-reader
+```
+
+### 開発ノート
+- **DB接続**: ビルド時の接続エラーを防ぐため、`src/lib/db/index.ts` および `src/lib/queue/index.ts` では遅延初期化（Lazy Initialization）を採用しています。
+- **テスト**: `cheerio` のESM互換性問題に対処するため、`jest.config.ts` でモックおよび `transformIgnorePatterns` を設定しています。
+
+## 📁 プロジェクト構造

```
apps/news-reader/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── feeds/      # フィードCRUD
│   │   │   ├── articles/   # 記事API
│   │   │   ├── folders/    # フォルダAPI
│   │   │   ├── opml/       # OPMLインポート/エクスポート
│   │   │   ├── digest/     # AIダイジェスト
│   │   │   ├── tags/       # タグ管理
│   │   │   ├── rules/      # ルール管理
│   │   │   └── cron/       # 定期フェッチ
│   │   └── page.tsx        # メインページ
│   ├── components/
│   │   ├── ArticleCard.tsx
│   │   ├── ArticleList.tsx
│   │   ├── ArticleRow.tsx      # 新規
│   │   ├── ReadingPane.tsx     # 新規
│   │   ├── FeedSidebar.tsx
│   │   ├── DigestCard.tsx
│   │   ├── KeyboardHelp.tsx
│   │   ├── TagManager.tsx
│   │   ├── ViewModeToggle.tsx
│   │   └── Settings/
│   │       └── ImportExport.tsx
│   ├── hooks/
│   │   ├── useFeeds.ts
│   │   ├── useArticles.ts
│   │   ├── useArticleActions.ts
│   │   └── useKeyboardShortcuts.ts
│   └── lib/
│       ├── db/
│       │   ├── schema.ts   # Drizzleスキーマ
│       │   └── index.ts    # DB初期化
│       ├── queue/
│       │   └── index.ts    # BullMQキュー
│       └── workers/
│           └── feed-fetcher.ts
└── data/
    └── news-reader.db      # SQLiteデータベース
```
