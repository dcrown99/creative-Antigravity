# Auto-Clipper

YouTube動画から「最も面白い瞬間」をAIが自動検出し、ショート動画（縦型・字幕付き）を全自動で生成するツールです。

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Python](https://img.shields.io/badge/python-3.8--3.13-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-orange)

## 概要

Auto-Clipperは、YouTube動画をダウンロードし、以下の高度な処理を自動で行う**日本語対応**Webアプリケーションです。

- **🎬 AutoClipper Studio**: プロフェッショナルな動画編集ツールのようなリッチなUI
- **🗣️ 話者分離 & 字幕**: 複数人の会話でも話者を識別し、日本語字幕を生成
- **⚡ リアルタイム更新**: Server-Sent Events (SSE) により、進捗状況をリアルタイムに表示
- **🎙️ AI解説 (Smart Narration)**: Geminiが脚本を書き、VOICEVOXが読み上げる「AI実況」を自動合成
- **🖼️ 自動サムネイル**: AIが選んだベストショットに、AIが考えた「釣れる」タイトルを自動合成
- **🎬 AI自動総集編**: 「見どころ」を自動で繋ぎ合わせ、BGMのような感覚で楽しめるダイジェスト動画を作成
- **💾 スマートキャッシュ**: 一度ダウンロード・解析したデータは再利用し、無駄な待ち時間を削減
- **🇯🇵 日本語UI**: すべてのインターフェースが日本語化されています
- **⬇️ ワンクリックダウンロード**: 完成した動画とサムネイルをブラウザから直接ダウンロード可能

## 技術スタック

### Backend
- **Framework**: FastAPI
- **Async Queue**: Celery + Redis
- **Real-time**: Server-Sent Events (SSE)
- **LLM**: Google Gemini 2.5 Flash API
- **文字起こし**: faster-whisper (CUDA対応)
- **音声合成 (TTS)**: VOICEVOX (Docker)
- **話者分離**: pyannote.audio (オプション)

### 1. リポジトリをクローン

```bash
git clone <repository-url>
cd auto-clipper
```

### 2. バックエンドのセットアップ

```bash
cd backend
uv sync
```

> [!NOTE]
> **Python 3.13 ユーザーへ**: `mediapipe` は現在Python 3.13に対応していません。自動的にスキップされ、OpenCVによる顔認識（Haar Cascade）にフォールバックします。機能に大きな違いはありません。

`.env`ファイルを`backend/`ディレクトリに作成し、APIキーを設定してください：

```env
GEMINI_API_KEY=your_gemini_api_key_here
HF_TOKEN=your_hugging_face_token_here
```

### 3. フロントエンドのセットアップ

```bash
cd frontend
npm install
```

### 4. Dockerでの実行 (推奨)

Dockerを使用すると、環境構築の手間を省き、すぐにアプリケーションを実行できます。

#### 統合環境での実行（推奨）

全サービスが統合されたDocker環境を使用：

```bash
# プロジェクトルートで実行
# プロジェクトルートで実行 (マルチステージビルド対応)
cd ..
docker-compose up -d auto-clipper-backend auto-clipper-frontend voicevox
```
> [!NOTE]
> スタンドアロン実行の場合、Google Driveへの自動保存は利用できません。

## 使用方法

### 起動

手動で起動します。

**バックエンド:**
```bash
cd backend
uvicorn main:app --reload
```

サーバーは http://127.0.0.1:8000 で起動します。

**フロントエンド:**
```bash
cd frontend
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスします。

### ワークフロー (Studio Mode)

1.  **動画入力**: YouTubeのURLを入力して「動画を処理」をクリック。
2.  **分析**:
    - 動画のダウンロード
    - 音声の文字起こし
    - AIによる「面白い瞬間」の検出（最大3つの候補）
3.  **クリップ編集 (Clip Editor)**:
    - **波形表示**: 音声波形を見ながら、直感的に切り抜き範囲を微調整できます。
    - **AI推奨リスト**: 右側のリストから、AIが提案した「見どころ」を選択できます。
    - **オプション**:
        - 「縦型動画 (9:16)」: スマホ向けに自動クロップ
        - 「字幕を追加」: 日本語字幕を自動生成
        - 「🗣️ AI解説」: VOICEVOX (ずんだもん) によるナレーション追加
        - 「🖼️ サムネイル生成」: YouTuber風サムネイルを自動作成
    - **総集編**: 「🎬 総集編を作成」ボタンで、動画全体のダイジェストを自動生成します。
4.  **レンダリング & 結果確認**:
    - 「動画を生成」をクリックすると、最終的な動画生成が始まります。
    - **リッチリザルト画面**: 完成した動画をその場で再生確認できます。
    - 「動画をダウンロード」ボタンでファイルを保存できます。

## Tips for Best Results (より良い結果のために)

- **動画の選択**: 会話が明瞭で、BGMが大きすぎない動画が最適です。
- **総集編の活用**: 長時間の配信アーカイブなどから「おいしいとこ取り」をしたい場合に「総集編」機能が非常に便利です。
- **キャッシュ**: 同じ動画を再度処理する場合、ダウンロードや文字起こしはスキップされるため高速です。

## トラブルシューティング

### 認証エラー (403 Forbidden / Sign in required)
YouTubeの仕様変更により、ダウンロードにCookieが必要な場合があります。
1. Chrome/EdgeでYouTubeにログインする。
2. 拡張機能「Get cookies.txt LOCALLY」などでCookieをエクスポートし、`backend/cookies.txt` に保存する。
3. バックエンドが自動的にリトライします。

### 字幕が文字化けする
- Windows用の日本語フォント（MS Gothic, Meiryo, Yu Gothic）が自動的に使用されます。
- これらのフォントが見つからない場合、字幕が表示されないことがあります。

### 話者分離が動作しない
- Hugging Faceで以下のモデルへのアクセス許可をリクエストしてください：
  - [pyannote/speaker-diarization-3.1](https://hf.co/pyannote/speaker-diarization-3.1)
  - [pyannote/segmentation-3.0](https://hf.co/pyannote/segmentation-3.0)
- `HF_TOKEN`を`.env`ファイルに設定してください。
- 話者分離が失敗しても、音声解析にフォールバックするため動画生成は継続されます。

### GPUが使われない
- NVIDIAドライバーとCUDA Toolkitがインストールされているか確認してください。
- `torch.cuda.is_available()` が `True` を返す環境が必要です。
- CPU環境でも動作しますが、処理に時間がかかります。

### FFmpegエラー
- 基本的に `imageio-ffmpeg` が内蔵のFFmpegを使用しますが、環境によってはシステムにインストールされたFFmpegが必要になる場合があります。
- エラーが出る場合は、[FFmpeg公式サイト](https://ffmpeg.org/download.html)からダウンロードし、パスを通してください。

### VOICEVOXエラー
- AI解説機能を使用するには、VOICEVOXコンテナが起動している必要があります。
- `docker-compose ps` で `voicevox` サービスが `Up` 状態であることを確認してください。
- ローカル開発環境でDockerを使用していない場合、別途VOICEVOXエンジンをインストール・起動し、`VOICEVOX_URL`環境変数を設定する必要があります。

## 生成ファイルの管理

- ダウンロードした動画と生成されたクリップは `backend/temp/` に保存されます。
- このディレクトリは `.gitignore` に追加されており、Gitにコミットされません。
- ディスク容量が気になる場合は、手動で削除してください。
- 文字起こしキャッシュ（`.json`ファイル）を残しておくと、同じ動画の再処理が高速になります。

## 制限事項

- **MediaPipe**: Python 3.13では利用できません（OpenCVフォールバック使用）
- **動画時間**: 長い動画（1時間以上）は処理に時間がかかります
- **GPU**: CUDA対応GPUがない環境では処理が遅くなります
- **API制限**: Gemini APIには無料枠の制限があります

## コード品質管理

### Python (Backend)

Ruffを使用してコード品質を管理：

```bash
# Docker環境内で実行（推奨）
cd ..
docker-compose exec auto-clipper-backend ruff check .

# 自動修正
docker-compose exec auto-clipper-backend ruff check . --fix

# ホスト環境で実行
cd backend
uv run ruff check .
```

**現在の状態**: ✅ 17件 → 4件（自動修正済み）

**設定ファイル**: `pyproject.toml`で行の長さ、ルールセットなどを管理しています。

### TypeScript (Frontend)

```bash
cd frontend
npm run lint
```

---

## ライセンス

個人使用を目的としています。生成されたコンテンツの権利は元の動画の権利者に帰属します。

### 🌍 公開リポジトリ
本プロジェクトの公開版は以下で管理されています（機密情報を除外済み）:
[https://github.com/dcrown99/creative-Antigravity](https://github.com/dcrown99/creative-Antigravity)

---

**Developed with ❤️ using Google Gemini AI**
