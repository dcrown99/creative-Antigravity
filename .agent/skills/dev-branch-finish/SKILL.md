---
name: dev-branch-finish
category: DevOps & DevOpsCore
description: 開発ブランチの完了・マージ手順
---

# 開発ブランチ完了スキル (Finishing a Development Branch)

開発ブランチの作業を完了し、クリーンな状態でマージする手順。

---

## いつ使うか

- 機能実装が完了し、マージ準備が整った時
- PRを作成・更新する時
- ブランチをクリーンアップする時

---

## 手順

### Step 1: 作業完了の確認

実装が完了していることを確認:

// turbo
```powershell
# テスト通過
pnpm turbo run test

# Lint通過 (TypeScript)
pnpm turbo run lint

# Lint通過 (Python)
pnpm lint:py

# ビルド確認
pnpm turbo run build
```

### Step 2: コミット整理の選択

ユーザーに選択肢を提示:

| オプション | 説明 | 推奨場面 |
|:---|:---|:---|
| **A) そのままマージ** | コミット履歴をすべて保持 | 小さな変更 |
| **B) スカッシュマージ** | 1コミットにまとめる | 機能開発 |
| **C) リベース** | 直線的な履歴を維持 | メイン追従 |

### Step 3: PRの作成/更新

```powershell
# GitHub MCP 経由で PR 作成
# タイトル: `feat: <description>` or `fix: <description>`
# 本文に変更概要と検証チケットリンクを含める
```

PR本文テンプレート:
```markdown
## 変更概要
- [変更内容を箇条書き]

## テスト
- [ ] `pnpm turbo run test` PASS
- [ ] `pnpm turbo run lint` PASS
- [ ] ブラウザ検証済み (チケット: docs/verification_tickets/TICKET_XXXX.md)

## 関連
- Issue: #XX (あれば)
```

### Step 4: マージ後のクリーンアップ

```powershell
# メインブランチに切り替え
git checkout main

# 最新を取得
git pull origin main

# マージ済みブランチを削除 (ローカル)
git branch -d <branch-name>
```

---

## PR レビュー指摘への対応

| 指摘タイプ | 対応 |
|:---|:---|
| バグ修正要求 | 修正コミット追加 → テスト再実行 |
| 設計変更要求 | `implementation_plan.md` を更新 → ユーザーに確認 |
| スタイル指摘 | 即座に修正 |

---

## チェックリスト

- [ ] 全テスト PASS
- [ ] Lint PASS (TypeScript + Python)
- [ ] 検証チケット作成済み
- [ ] PR作成/更新
- [ ] マージ方式をユーザーと合意
- [ ] マージ後、ブランチクリーンアップ
