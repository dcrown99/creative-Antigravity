# Market Watcher

Money Masterのポートフォリオデータを分析し、日次レポートを生成するAIマイクロサービスです。

## 機能
- **ポートフォリオ分析**: `money-master` のデータ (`portfolio.json`) を読み込みます。
- **ニュース収集**: YahooニュースとGoogleニュースのRSSフィードから最新の市場情報を取得します。
- **AI分析**: Google Gemini API (`gemini-2.5-flash-preview-09-2025`) を使用して、市場ニュースとポートフォリオへの影響を分析します。
- **レポート生成**: 辛口の金融アナリスト「ずんだもん」というペルソナで、ポッドキャスト風のスクリプトを生成します。
- **音声合成**: Voicevoxを使用して、生成されたスクリプトを音声（ずんだもん）に変換します。

### Monorepo 構成

このプロジェクトは **Turborepo + pnpm Workspaces** で構成されたMonorepoの一部です。

- **パッケージ名**: Python standalone service
- **依存サービス**: money-master (ポートフォリオデータ), voicevox (音声合成)
- **統合**: `docker-compose` (base/dev/prod) で管理

> [!NOTE]
> Monorepo全体のアーキテクチャは [ARCHITECTURE.md](file:///c:/Users/koume/Downloads/code/ARCHITECTURE.md) を参照してください。

## セットアップ

### 前提条件
- Docker および Docker Compose がインストールされていること。
- Google Gemini API キーが取得済みであること。
- Voicevox コンテナが起動していること（`docker-compose.base.yml` に含まれています）。

### 環境変数
ルートディレクトリの `.env` ファイルに以下を設定してください。

```env
GEMINI_API_KEY=your_actual_api_key_here
VOICEVOX_URL=http://voicevox:50021
```

## 起動方法

### 統合環境での起動（推奨）

スクリプトを使用（推奨）：

```bash
# プロジェクトルートから
cd ../..
docker-compose up -d money-master market-watcher voicevox
```

> [!TIP]
> `money-master` はマルチステージビルドにより高速に起動します。

**依存関係**:
- `money-master`: ポートフォリオデータ（`data/portfolio.json`）を提供
- `voicevox`: 音声合成エンジン (port 50021)

**アクセス**: [http://localhost:8001](http://localhost:8001)

**ログ確認**:
```bash
docker-compose logs -f market-watcher
```

**停止**:
```bash
docker-compose down
```

### スタンドアロン起動

market-watcherのみを起動する場合：

```bash
docker-compose up -d market-watcher
```

> [!NOTE]
> money-masterとvoicevoxコンテナが起動している必要があります。

## API 利用方法

### 1. 日次分析（テキストのみ）

**エンドポイント:** `POST /analyze/daily`

**リクエスト例 (curl):**

```bash
curl -X POST http://localhost:8002/analyze/daily
```

**レスポンス例:**

```json
{
  "title": "今日の金融手術室：AIの麻薬とEVの急ブレーキ",
  "summary": "ハイテク株主導の上昇とEV市場の減速について分析...",
  "script": "（ずんだもん口調のスクリプト...）"
}
```

### 2. 音声レポート生成

**エンドポイント:** `POST /analyze/audio`

**リクエスト例 (curl):**

```bash
curl -X POST http://localhost:8002/analyze/audio --output report.wav
```

**レスポンス:**
- Content-Type: `audio/wav`
- バイナリ音声データ（WAV形式）

## 開発者向け情報

### ディレクトリ構成
- `src/main.py`: FastAPI アプリケーションのエントリーポイント
- `src/analyst.py`: Gemini API を呼び出す分析ロジック
- `src/news.py`: RSSフィードからニュースを収集するモジュール
- `src/tts.py`: Voicevox API クライアント
- `src/db_reader.py`: ポートフォリオデータの読み込み
- `src/config.py`: 環境変数の読み込み

### 使用モデル
現在は `gemini-2.5-flash-preview-09-2025` を使用しています。変更する場合は `src/analyst.py` を編集してください。

## コード品質管理
Ruffを使用してPythonコードの品質を管理しています。Monorepoの一部として統合されているため、`pnpm` コマンドを使用することを推奨します。

```bash
# ルートディレクトリから実行

# Lint (Ruff)
pnpm lint --filter=market-watcher

# Test (Pytest)
pnpm test --filter=market-watcher

# 自動修正 (各ディレクトリで直接実行が必要な場合があります)
cd apps/market-watcher
venv\Scripts\ruff check . --fix
```

**現在の状態**: ✅ TurboRepoパイプラインに統合済み

**設定ファイル**: `pyproject.toml`で行の長さ、ルールセットなどを管理しています。

## 📜 ライセンス

個人使用を目的としています。

### 🌍 公開リポジトリ
本プロジェクトの公開版は以下で管理されています（機密情報を除外済み）:
[https://github.com/dcrown99/creative-Antigravity](https://github.com/dcrown99/creative-Antigravity)
