---
name: test-fixing
category: DevOps & DevOpsCore
description: 失敗テストの診断と修正手順
---

# テスト修復スキル (Test Fixing)

Based on [mhattingpete/claude-skills-marketplace](https://github.com/mhattingpete/claude-skills-marketplace/blob/main/engineering-workflow-plugin/skills/test-fixing/SKILL.md)

失敗したテストをスマートなエラーグルーピングで体系的に修正する。

> 💡 モック設定が原因の場合は `test-mock` スキルを参照。

---

## いつ使うか

- 「テストを直して」「テストを通して」と言われた時
- テスト失敗の報告があった時
- 実装完了後にテストを通す時
- CI/CD がテストで失敗した時

---

## 体系的アプローチ

### Step 1: 初期テスト実行

// turbo
```powershell
# TypeScript テスト
pnpm turbo run test --filter=<app>

# Python テスト
pnpm lint:py
```

出力を分析:
- 失敗の総数
- エラーの種類とパターン
- 影響を受けるモジュール/ファイル

### Step 2: スマートエラーグルーピング

類似の失敗をグルーピング:

| グループ基準 | 例 |
|:---|:---|
| **エラー種類** | ImportError, TypeError, AssertionError |
| **モジュール/ファイル** | 同一ファイルで複数テスト失敗 |
| **根本原因** | 依存関係の欠如、API変更、リファクタリングの影響 |

**優先度の決定:**
1. 影響テスト数が最多のグループから (最大インパクト)
2. 依存関係順 (インフラを機能より先に修正)

### Step 3: グループ単位の修正

各グループについて (最大インパクトから):

**① 根本原因を特定**
```powershell
# 関連コードを読む
grep_search "<error keyword>" --path apps/<app>/src

# 最近の変更を確認
git diff HEAD~5 --stat
```

**② 修正を実施**
- プロジェクト規約に従う (GEMINI.md)
- 最小限の焦点を絞った変更
- 1グループずつ

**③ グループ単位で検証**
// turbo
```powershell
# TypeScript: 特定テストファイルのみ
pnpm turbo run test --filter=<app> -- --testPathPattern="<test-file>"

# Python: 特定テストファイルのみ
docker exec <container> python -m pytest tests/<test-file> -v
```

**④ PASSを確認してから次のグループへ**

### Step 4: 修正の優先順

```
1. インフラ系 (最初に修正)
   ├─ Import エラー
   ├─ 依存関係の欠如
   └─ 設定の問題

2. API変更系 (次に修正)
   ├─ 関数シグネチャの変更
   ├─ モジュール再構成
   └─ リネームされた変数/関数

3. ロジック系 (最後に修正)
   ├─ アサーション失敗
   ├─ ビジネスロジックのバグ
   └─ エッジケース処理
```

### Step 5: 最終検証

// turbo
すべてのグループ修正後:
```powershell
# 全テスト実行
pnpm turbo run test --filter=<app>

# Lint確認
pnpm turbo run lint
pnpm lint:py
```

---

## よくある失敗パターンと修正

### 日付関連 (タイムゾーン依存)
```typescript
// ❌ タイムゾーンで不安定
expect(result.date).toBe('2025-01-01');

// ✅ タイムゾーンを固定 or 範囲で比較
expect(result.date).toMatch(/2025-01-0[12]/);
```

### 非同期テスト
```typescript
// ❌ 非同期を待っていない
expect(screen.getByText('Loaded')).toBeInTheDocument();

// ✅ waitFor で待機
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### モック不足
```typescript
// ❌ prisma.xxx.yyy is not a function
// → test-mock スキルを参照して __mocks__/prisma.ts にメソッド追加
```

---

## ベストプラクティス

- **1グループずつ修正** — 次に進む前にPASS確認
- **テストを壊すのではなく、コードを直す** (仕様変更が明確な場合のみテスト修正)
- **最小限の変更** — 「ついでに」の改善はしない
- **`git diff`** で最近の変更を理解する
- **パターンを探す** — 同じ原因の失敗はまとめて修正

---

## ワークフロー例

```
ユーザー: 「リファクタリング後にテストが落ちた」

1. pnpm turbo run test → 15件の失敗を確認
2. エラーをグルーピング:
   - 8件 ImportError (モジュールリネーム)
   - 5件 TypeError (関数シグネチャ変更)
   - 2件 AssertionError (ロジックバグ)
3. ImportError を修正 → サブセット実行 → PASS ✓
4. TypeError を修正 → サブセット実行 → PASS ✓
5. AssertionError を修正 → サブセット実行 → PASS ✓
6. 全テスト実行 → 全PASS ✓
```

---

## チェックリスト

- [ ] 初期テスト実行で全失敗を把握
- [ ] エラーをグルーピング・優先度付け
- [ ] 最大インパクトのグループから修正
- [ ] 各グループ修正後にサブセットテストPASS
- [ ] 全テスト最終実行でリグレッションなし
