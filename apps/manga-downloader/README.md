# Manga Downloader

マンガサイトからCanvas画像を抽出してCBZ形式で保存するPythonスクリプトです。

## 概要

このツールは、PlaywrightとSeleniumを使用してブラウザを自動操作し、Canvas要素に描画されたマンガ画像を抽出してCBZ(Comic Book Archive)形式で保存します。

### 主な機能

- **Canvas画像の自動抽出**: Canvasに描画されたマンガページを自動的に検出して保存
- **CBZ形式への変換**: 抽出した画像を自動的にCBZアーカイブに変換
- **遅延読み込み対応**: スクロールして全ページを確実にロード
- **複数URL対応**: 一度に複数のマンガURLを処理可能
- **URL一括処理**: テキストファイルからURLリストを読み込んで一括処理
- **自動ファイル名生成**: URLからファイル名を自動生成

## 必要環境

- **Playwright ブラウザ**: `playwright install chromium`
- その他の依存パッケージは`pyproject.toml`に記載

## インストール

1. リポジリをクローン（またはファイルをダウンロード）:
```bash
git clone <repository-url>
cd manga_downloader
```

2. uvを使用して依存パッケージとツールをインストール・同期:
```bash
uv sync
uv run playwright install chromium
```

## 使用方法

### 基本的な使い方

単一のURLを処理:
```bash
uv run python download_images_as_cbz.py https://example.com/manga/episode-1
```

### URLを対話的に入力

引数なしで実行すると、対話的にURLを入力できます:
```bash
uv run python download_images_as_cbz.py
```

### 複数URLを一度に処理

```bash
uv run python download_images_as_cbz.py https://example.com/manga/ep1 https://example.com/manga/ep2
```

### URLリストファイルから一括処理

`urls.txt`などのテキストファイルにURLを記載（1行に1URL）:
```
https://example.com/manga/episode-1
https://example.com/manga/episode-2
https://example.com/manga/episode-3
```

実行:
```bash
uv run python download_images_as_cbz.py --file urls.txt
```

### オプション

| オプション | 短縮形 | 説明 | デフォルト値 |
|---|---|---|---|
| `--file` | `-f` | URLリストが記載されたテキストファイル | - |
| `--name` | `-n` | 出力ファイル名（単一URL指定時のみ有効） | URLから自動生成 |
| `--output-dir` | `-o` | 保存先フォルダ | `H:\DL\MangaDownloads` |
| `--keep-temp` | `-k` | 一時フォルダを削除せずに残す | 削除する |

### 使用例

カスタムファイル名を指定:
```bash
uv run python download_images_as_cbz.py https://example.com/manga/ep1 --name "第1話"
```

保存先を変更:
```bash
uv run python download_images_as_cbz.py https://example.com/manga/ep1 --output-dir "./downloads"
```

一時フォルダを保持:
```bash
uv run python download_images_as_cbz.py https://example.com/manga/ep1 --keep-temp
```

## 出力形式

- **CBZファイル**: ZIP形式で圧縮された画像ファイル群（.cbz拡張子）
- **画像形式**: JPEG（品質: 95%）
- **ファイル名**: URLから自動生成、または`--name`オプションで指定

## トラブルシューティング

### エラー: "ModuleNotFoundError: No module named 'playwright'"

依存パッケージが不足しています:
```bash
uv sync
uv run playwright install chromium
```

### エラー: "保存先ディレクトリが作成できません"

デフォルトの保存先（`H:\DL\MangaDownloads`）が存在しない場合、`--output-dir`オプションで保存先を指定してください:
```bash
uv run python download_images_as_cbz.py <URL> --output-dir "./downloads"
```

### ページ要素が見つからない

対象サイトの構造が変更された可能性があります。スクリプト内の以下の定数を確認してください:
- `SELECTOR_PAGE_WRAPPER`: ページを包む要素のセレクタ
- `SELECTOR_CANVAS`: Canvas要素のセレクタ

## 注意事項

- このツールは教育・研究目的でのみ使用してください
- 著作権法を遵守し、権利者の許可なく配布・共有しないでください
- 対象サイトの利用規約を必ず確認してください
- 過度なアクセスはサーバーに負荷をかけるため、適切な間隔で実行してください

## Docker環境について

> [!NOTE]
> manga_downloaderは**Docker環境に含まれていません**。
> 
> このツールはスタンドアロンで動作するように設計されており、ホスト環境のPythonで直接実行することを推奨します。

### 理由
- ブラウザ自動化にPlaywrightを使用（Docker内での実行は複雑）
- 出力先が固定パス（`H:\DL\MangaDownloads`）
- 単機能ツールのため、他サービスとの統合不要

### Monorepo Context

このツールは Monorepo (`dcrown99/code`) に含まれていますが、**スタンドアロン実行**を前提としています。

> [!NOTE]
> Monorepo全体のアーキテクチャについては [ARCHITECTURE.md](file:///c:/Users/koume/Downloads/code/ARCHITECTURE.md) を参照してください。

## コード品質管理
このプロジェクトではRuffを使用してコード品質を管理しています。TurboRepoパイプラインに統合されています。

```bash
# ルートディレクトリから実行

# Lint (Ruff)
pnpm lint --filter=manga-downloader

# 自動修正 (ディレクトリ内で実行)
cd apps/manga-downloader
uv run ruff check . --fix
```

**現在の状態**: ✅ TurboRepoパイプラインに統合済み

### 設定ファイル

`pyproject.toml`で以下が設定されています：
- 行の長さ: 88文字
- Python対応バージョン: 3.11+
- 有効なルール: E (pycodestyle), F (pyflakes), I (isort), など

## ライセンス

このプロジェクトは個人使用を目的としています。商用利用は禁止されています。

### 🌍 公開リポジトリ
本プロジェクトの公開版は以下で管理されています（機密情報を除外済み）:
[https://github.com/dcrown99/creative-Antigravity](https://github.com/dcrown99/creative-Antigravity)

## その他のファイル

- **メインスクリプト**:
  - `download_images_as_cbz.py`: メインのダウンロードスクリプト
  
- **ユーティリティ**:
  - `check_image_size.py`: 画像サイズを確認するユーティリティスクリプト
  - `test_playwright.py`: Playwrightの動作テスト用スクリプト
  
- **設定・データ**:
  - `urls.txt`: URLリストのサンプルファイル
  - `pyproject.toml`: Python依存パッケージリストと設定
  
- **ドキュメント**:
  - `使い方.md`: 詳細な使用方法ガイド
  - `exe化手順.md`: 実行可能ファイル化の手順書
  
- **バッチファイル（Windows用）**:
  - `漫画ダウンローダー.bat`: GUIベースでURLを入力してダウンロードできるバッチファイル
  - `デスクトップにショートカット作成.bat`: デスクトップにショートカットを作成

### バッチファイルの使い方

Windowsユーザーは`漫画ダウンローダー.bat`をダブルクリックすることで、コマンドライン操作なしで簡単に使用できます：

1. `漫画ダウンローダー.bat`をダブルクリック
2. 表示される指示に従ってURLを入力
3. 自動的にダウンロードとCBZ変換が実行されます
