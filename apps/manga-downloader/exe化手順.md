# 漫画ダウンローダーを .exe 化する手順

このドキュメントでは、漫画ダウンローダーを単体の実行ファイル (.exe) に変換する方法を説明します。

## 方法1: PyInstaller を使用 (推奨)

### 1. PyInstaller のインストール

```bash
uv add --dev pyinstaller
```

### 2. 実行ファイルの作成

以下のコマンドを実行します:

```bash
uv run pyinstaller --onefile --console --name "漫画ダウンローダー" --icon=NONE download_images_as_cbz.py
```

#### オプションの説明:
- `--onefile`: 単一の exe ファイルを生成
- `--console`: コンソールウィンドウを表示（進捗を確認できる）
- `--name "漫画ダウンローダー"`: 出力ファイル名を指定
- `--icon=NONE`: アイコンなし（カスタムアイコンがある場合は指定可能）

### 3. Playwright のブラウザを含める

PyInstaller でビルドした後、以下の追加作業が必要です:

```bash
# 生成された exe と同じディレクトリに Playwright のブラウザをインストール
uv run playwright install chromium
```

### 4. 生成されたファイルの場所

- `dist\漫画ダウンローダー.exe` - これが実行ファイルです

### 5. 実行ファイルの配布

実行ファイルを配布する場合は、以下のファイルを一緒に配布してください:

```
配布フォルダ/
├── 漫画ダウンローダー.exe
├── urls.txt (オプション)
└── README.md (使い方の説明)
```

**注意**: Playwright のブラウザ (Chromium) は約 300MB のサイズがあるため、初回実行時に自動ダウンロードされます。

## 方法2: より高度な設定 (spec ファイルを使用)

### 1. spec ファイルの作成

以下の内容で `manga_downloader.spec` ファイルを作成します:

```python
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['download_images_as_cbz.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['playwright', 'tqdm'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='漫画ダウンローダー',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

### 2. spec ファイルでビルド

```bash
uv run pyinstaller manga_downloader.spec
```

## トラブルシューティング

### エラー: "ModuleNotFoundError: No module named 'playwright'"

- PyInstaller がすべての依存関係を含めていない可能性があります
- `--hidden-import=playwright` オプションを追加してみてください

### エラー: "Playwright executable doesn't exist"

- exe 実行前に以下のコマンドでインストール確認をしてください:
  ```bash
  uv run playwright install chromium
  ```

### ファイルサイズが大きすぎる

- `--exclude-module` オプションで不要なモジュールを除外できます
- 例: `--exclude-module pandas --exclude-module numpy`
  （これらは現在のスクリプトでは使用されていません）

## 推奨: バッチファイルの使用

.exe 化は複雑で依存関係の問題が発生しやすいため、**バッチファイル (`漫画ダウンローダー.bat`) の使用を推奨します**。

バッチファイルの利点:
- セットアップが簡単
- 依存関係の問題が発生しにくい
- 更新が容易
- デバッグが簡単

バッチファイルは既に用意されているので、「デスクトップにショートカット作成.bat」を実行するだけでデスクトップから簡単に起動できます。
