# Auto-Clipper API (v2.0 - Ultimate Edition)

YouTube動画からハイライトを自動抽出し、Shorts動画や総集編を作成・投稿する完全自律型バックエンドサービスです。

## 🌟 Key Features

### 1. Unified Video Engine
ショート動画（縦型）と総集編（横型）を、単一の高性能エンジン `VideoEngine` で処理。
- **Smart Crop:** 顔認識により、縦型動画でも被写体を常に中心に捉えます。
- **Dynamic Subtitles:** 視認性の高い字幕を自動で焼き付けます（位置調整可能）。
- **BGM Mixing:** 動画の長さに合わせてBGMを自動ループ・フェードイン/アウト合成。

### 2. AI Director & Packaging
Gemini 2.5 Flash が動画制作を指揮します。
- **Semantic Analysis:** 文脈を理解し、「面白い」「盛り上がる」シーンを抽出。
- **Metadata Generation:** YouTube Shorts/Video 向けに、クリック率を高めるタイトル・概要欄・タグを自動生成。

### 3. Full Automation Pipeline
- **Auto-Upload:** 作成した動画を YouTube へ自動投稿（プライバシー設定可）。
- **Thumbnail:** AIがベストショットを選定し、カスタムサムネイルを生成・設定。

## 🛠️ Setup & Deployment

### 1. Environment Variables
`.env` ファイルを作成し、APIキーを設定してください。

```bash
# Required
GEMINI_API_KEY=your_gemini_key

# Optional (HuggingFace for Speaker Diarization)
HF_TOKEN=your_hf_token
```

### 2. YouTube Integration (One-Time Setup)
自動投稿機能を使用するには、ローカル環境での認証が必要です。

1. Google Cloud Console で OAuth 2.0 Client ID を作成し、JSONをダウンロード。
2. `apps/auto-clipper-api/credentials/client_secrets.json` として保存。
3. ローカルPC で以下の認証スクリプトを実行（Docker内ではブラウザが開けないため）:

```bash
# 認証ツールの実行（必要なパッケージは自動解決されます）
uv run python scripts/auth_youtube.py
```

4. 生成された `token.pickle` をサーバーの `apps/auto-clipper-api/credentials/` に配置。

### 3. Assets
BGMを使用する場合、MP3/WAVファイルを以下に配置してください。

`apps/auto-clipper-api/assets/bgm/`

## 🚀 Running with Docker

```bash
# 全サービスの起動 (マルチステージビルド対応)
docker compose up -d --build

# ログの確認
docker compose logs -f auto-clipper-api
```

- API Swagger UI: http://localhost:8000/docs
- Web Interface: http://localhost:3002

## 💻 Development & Quality Control

本プロジェクトは Monorepo (TurboRepo) の一部として統合されています。

```bash
# 依存関係の同期（開発ツール含む全体環境のセットアップ）
uv sync
```

> [!NOTE]
> **話者分離 (pyannote.audio) について**: `pyannote.audio` はオプション依存です。
> インストールされていない場合、話者分離機能は無効になりますが、文字起こしと動画処理は正常に動作します。

### Linting & Testing
Pythonサービスも `package.json` を介して TurboRepo のパイプラインに統合されています。

```bash
# ルートディレクトリから実行

# Lint (Ruff)
pnpm lint --filter=auto-clipper-api

# Test (Pytest)
pnpm test --filter=auto-clipper-api
```

## 📜 ライセンス

個人使用を目的としています。

### 🌍 公開リポジトリ
本プロジェクトの公開版は以下で管理されています（機密情報を除外済み）:
[https://github.com/dcrown99/creative-Antigravity](https://github.com/dcrown99/creative-Antigravity)
