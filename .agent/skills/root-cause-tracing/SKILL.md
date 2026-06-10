---
name: root-cause-tracing
category: DevOps & DevOpsCore
description: エラーの根本原因を実行パスを遡って特定する手順
---

# 根本原因追跡スキル (Root Cause Tracing)

エラーが深い実行パスで発生した場合に、**元のトリガーまで遡って**根本原因を特定する。

> 💡 `systematic-debugging` の Step 4 で原因が深い場合にこのスキルに移行する。

---

## いつ使うか

- スタックトレースが長い/複雑な時
- エラーの発生箇所と原因箇所が異なる時
- 複数のレイヤー (UI → API → DB) をまたぐ問題
- 非同期処理で因果関係が不明な時

---

## 手順

### Step 1: エラー起点の特定

スタックトレースから**最初のアプリケーションコード**を特定:

```
Error: Cannot read property 'price' of undefined
    at formatPrice (src/utils/format.ts:15)       ← 発生箇所
    at AssetCard (src/components/AssetCard.tsx:42)  ← 呼び出し元
    at AssetsProvider (src/contexts/AssetsContext.tsx:78) ← さらに上流
```

### Step 2: データフロー逆追跡

エラー変数のデータフローを**下流から上流へ**追跡:

```
formatPrice(asset.price)
  ↑ asset は AssetCard の props から
    ↑ props は AssetsProvider の state から
      ↑ state は fetchAssets() の戻り値から
        ↑ fetchAssets は API /api/assets を呼んでいる
          ↑ API は prisma.asset.findMany() を実行
```

// turbo
各レイヤーで `grep_search` を使って追跡:
```powershell
grep_search "formatPrice" --path apps/money-master/src
grep_search "asset.price" --path apps/money-master/src
```

### Step 3: 境界チェック

データが変換される**各境界**でバリデーション:

| 境界 | チェック内容 |
|:---|:---|
| DB → API | クエリ結果の型と NULL 可能性 |
| API → フロント | レスポンス形式の一致 |
| Props → コンポーネント | undefinedチェック |
| 外部API → アプリ | レスポンス形式の変更 |

### Step 4: 根本原因の特定と記録

根本原因を以下のフォーマットで記録:

```markdown
## 根本原因分析

- **症状:** AssetCard で price が undefined エラー
- **発生箇所:** formatPrice (src/utils/format.ts:15)
- **根本原因:** prisma.asset.findMany() のSELECTに price フィールドが含まれていなかった
- **原因の原因:** 直近のスキーマ変更で select句が更新されなかった
- **修正箇所:** src/lib/actions.ts の findMany クエリ
```

### Step 5: 再発防止

- 型安全性の欠如 → Zod/TypeScript の型チェック強化
- テスト不足 → 該当パスのユニットテスト追加
- ドキュメント不足 → ADR に記録

---

## レイヤー別の確認ポイント

### フロントエンド (Next.js)
```typescript
// undefinedチェック
console.log('Props:', JSON.stringify(props));
// レンダリングタイミング
useEffect(() => console.log('Mounted with:', data), [data]);
```

### バックエンド (Python FastAPI)
```python
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Request: {request.json()}")
logger.debug(f"DB result: {result}")
```

### Docker間通信
```powershell
# コンテナ内からの疎通確認
docker exec <container> curl -s http://<other-service>:<port>/health
```

---

## チェックリスト

- [ ] スタックトレースから起点を特定
- [ ] データフローを下流→上流で追跡
- [ ] 各境界でのデータ変換を確認
- [ ] 根本原因を証拠付きで特定
- [ ] 根本原因分析を記録
- [ ] 再発防止策を検討
