@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d %~dp0

echo ================================================
echo    漫画ダウンローダー - Canvas Extractor
echo ================================================

REM --- 1. uvと依存関係のセットアップ ---
echo [初期設定] uvを使用して依存関係を同期しています...
uv sync

echo [初期設定] ブラウザエンジンをインストール/更新しています...
uv run playwright install chromium

:MENU
echo.
echo ------------------------------------------------
echo オプション:
echo   1. URLを直接入力してダウンロード
echo   2. urls.txt から一括ダウンロード
echo   3. 終了
echo   4. ライブラリの強制再インストール（トラブル時用）
echo ------------------------------------------------
set /p choice=選択してください (1-4): 

if "!choice!"=="1" (
    echo.
    set /p url=ダウンロードするURLを入力してください: 
    if "!url!"=="" (
        echo [警告] URLが入力されていません。
    ) else (
        echo.
        echo [実行中] ダウンロードを開始します...
        uv run python download_images_as_cbz.py "!url!"
    )
) else if "!choice!"=="2" (
    if exist urls.txt (
        echo.
        echo [実行中] urls.txt から一括ダウンロードを開始します...
        uv run python download_images_as_cbz.py --file urls.txt
    ) else (
        echo.
        echo [エラー] urls.txt ファイルが見つかりません。
    )
) else if "!choice!"=="3" (
    echo.
    echo 終了します。
    exit /b 0
) else if "!choice!"=="4" (
    echo.
    echo [メンテナンス] ライブラリを再同期しています...
    uv sync
    uv run playwright install chromium
    echo [完了] 再同期が完了しました。
) else (
    echo.
    echo [エラー] 無効な選択です。
)

echo.
pause
goto MENU