---
description: GitHubへの変更同期 (sync_github.ps1)
---

# /sync - GitHub 同期ワークフロー

1. ユーザーにコミットメッセージを確認する（省略時はデフォルト使用）
2. 同期スクリプトを実行する:
   // turbo
   ```powershell
   ./scripts/sync_github.ps1 -Message "<コミットメッセージ>"
   ```
3. プッシュ結果を報告する
