# AI Rules of Engagement

> **Version:** 3.2 | **Last Updated:** 2026-02-20
> ⚠️ **このファイルはAIが自律的に動くための最重要ルール（鉄の掟）です。**
> 新規機能開発、バグ修正、アーキテクチャ変更などの重たいタスクの開始時には必ず参照してください。

## 📜 1. 鉄の掟 (交渉余地なし)

1.  **二言語プロトコル:**
    *   **思考・コード生成:** 英語で行う。
    *   **ユーザー対話:** 日本語で行う（`notify_user`、説明、報告等）。

2.  **TDD (テスト駆動開発):**
    *   新機能は `implementation_plan.md` で仕様定義 → テスト先行 → 実装の順。
    *   テストは Python: `pytest`、TypeScript: `vitest` / `jest` を使用。
    *   最低30%のカバレッジを維持。
    *   **⚠️ 例外 (MQL5):** EA開発では単体テストの代わりに、`mt5-backtest` スキルを用いた「自動パリティ検証（Python PFとの乖離確認）」をテスト合格基準とする。

3.  **検証チケット制度:**
    *   完了報告前に **`docs/verification_tickets/TICKET_{YYYYMMDD_HHMM}.md`** を必ず作成。
    *   チケットには「変更範囲」「ビルド成功確認」「ブラウザ検証」「テスト通過」を記載。
    *   **チケットなき報告は無効。**

4.  **ブラウザ検証必須:**
    *   UI変更時は `browser_subagent` で localhost を目視確認してから報告する。

5.  **状態管理 (Memory Bank):**
    *   タスク完了/ブロッカー時に `@AI_STATUS.md` を更新（Current Focus / Blockers / Last Ticket）。
    *   セッション復元用の「地図」として最小限の情報を維持する。（パス: `/@AI_STATUS.md` リポジトリルート）

## 📜 2. プロジェクト固有の掟

1.  **スクリプト至上主義 (Script Supremacy):**
    * `docker compose` を手動で実行してはならない。常に提供された PowerShell スクリプトを使用すること。
    * **一括起動:** `./scripts/redeploy_all.ps1`
    * **個別管理:** `./scripts/dev_manager.ps1`
    * **依存関係:** `./scripts/repair_dependencies.ps1` (パッケージ追加・同期)
    * **検証:** `./scripts/verify_system.ps1`
    * **MT5 Strategy Workflow:** `mt5-full-cycle` Skill (Research -> Deploy)

2.  **原子的整合性 (Atomic Consistency):**
    * **UIコンポーネント:** 必ず `@repo/ui` からインポートすること。
    * **設定:** Tailwind/ESLint 設定は必ず `@repo/config` を継承すること。

3.  **コード品質基準 (Code Quality Standards):**
    *   **TypeScript/JavaScript:** Linter: **ESLint**
    *   **Python:** Linter: **Ruff**, Test: **pytest**, 必須ルール(E722, E701, B904, F401/F841, E402)
    *   検証: **`pnpm lint:py`** を使用すること。

## 🚨 3. エラーハンドリング

1.  **エスカレーション:** 自動復旧で解決しない場合、`notify_user` でユーザー判断を仰ぐ。
2.  **エラー記録:** 重大ブロッカーは `@AI_STATUS.md` に記載。詳細は検証チケットに記録。
3.  **ビルドエラー:** `dev_manager.ps1 logs <service>` でログを確認し、原因を特定。
4.  **依存関係エラー:** `repair_dependencies.ps1` を実行して同期。
5.  **回復不能エラー:** `redeploy_all.ps1` で全システムをリセット。

## ⚡ 4. トークン・コンテキスト最適化 (Token Optimization)

限られたコンテキストウィンドウと処理リソースを最大限に活用するためのルール。

1.  **回答の圧縮制約:**
    *   ユーザーへのテキスト返答・説明は「最小限の箇条書き」を徹底すること。無駄な挨拶や謝罪は不要。
    *   既存コードの修正時は、全体書き換え(`write_to_file`の全上書き)を避け、必ず部分修正(`replace_file_content` / `multi_replace_file_content`)を使用すること。
2.  **セッション（記憶）の意図的リセット:**
    *   1つのまとまったタスク（機能実装やバグ修正）が完了したら、速やかに `@AI_STATUS.md` を更新する。
    *   その後、AIは自律的にユーザーに対して「New Chatでのセッション再起動（履歴クリア）」を提案し、肥大化したコンテキストを意図的に切断すること。
    *   不要になった一時ファイルやログ出力は、タスク終了前にこまめに削除（クリーンアップ）すること。
