---
description: コード変更前の影響範囲調査手順
---

# 事前影響確認スキル (Impact Analysis)

コード変更を行う前に、影響範囲を特定し、類似ロジックや依存関係を調査する手順。

---

## いつ使うか

- 新しいフィールド/プロパティを追加する時
- 既存のラベル/定義を変更する時
- 共通コンポーネントを修正する時
- データ構造を変更する時

---

## 手順

### Step 1: キーワード検索

変更対象のキーワードで grep 検索を実行:

```powershell
# 例: account 関連の変更
grep_search "account" --path apps/money-master/src --includes "*.ts,*.tsx"

# 例: 型定義の変更
grep_search "AccountType" --path apps/money-master/src --includes "*.ts,*.tsx"
```

### Step 2: 影響箇所の分類

検索結果を以下のカテゴリで分類:

| カテゴリ | 確認ポイント |
|:---|:---|
| **型定義** | 型の追加/変更が他ファイルに影響するか |
| **サービス** | ビジネスロジックへの影響 |
| **コンポーネント** | UI表示への影響 |
| **テスト** | 既存テストの修正が必要か |
| **ラベル/定数** | 同じラベルが複数箇所で定義されていないか |

### Step 3: 類似ロジック確認

同様の処理が他の場所にないか確認:

```powershell
# 例: 口座タイプの表示ラベル定義
grep_search "ACCOUNT_LABELS\|getAccountDisplayName" --path apps/money-master/src
```

### Step 4: 影響一覧表の作成

```markdown
| 箇所 | 影響 | 対応要否 |
|:---|:---|:---:|
| types/index.ts | 型定義 | ✅ |
| SectorPerformanceChart.tsx | ラベル定義 | ✅ |
| export.service.ts | 別のラベル定義あり | ⚠️ 要確認 |
```

### Step 5: ユーザー確認

影響が複数箇所に及ぶ場合は、実装前にユーザーに確認:

> 「〇〇箇所で同様の定義があります。すべて更新しますか？」

---

## チェックリスト

- [ ] grep でキーワード検索実行
- [ ] 型定義への影響確認
- [ ] 類似ロジック/重複定義の確認
- [ ] テストファイルへの影響確認
- [ ] 影響一覧をユーザーに共有 (必要に応じて)
