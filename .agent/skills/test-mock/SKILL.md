---
name: test-mock
category: DevOps & DevOpsCore
description: Prisma/外部APIのモック設定手順
---

# テストモック設定スキル

テストで Prisma や外部 API を使用する場合、適切なモック設定が必要。

---

## 適用条件

以下のいずれかに該当する場合、このスキルを適用:

1. **Prismaテスト**: 新しいモデル/メソッドを使用するテスト
2. **外部API**: Yahoo Finance, Voicevox 等を呼び出すコード

---

## Prisma モック設定

### Step 1: モックファイル確認
```
src/__mocks__/prisma.ts
```

### Step 2: 必要なモデルのモック追加
```typescript
// 例: dividend モデルを追加
export const prisma = {
  asset: { findMany: jest.fn(), update: jest.fn(), ... },
  dividend: { deleteMany: jest.fn(), ... },  // ← 追加
  ...
};
```

### Step 3: テスト実行で確認
```bash
pnpm test
```

---

## 外部 API モック設定

### Yahoo Finance
```typescript
// jest.setup.ts または テストファイル内
jest.mock('yahoo-finance2', () => ({
  default: {
    quote: jest.fn().mockResolvedValue({ regularMarketPrice: 100 }),
  },
}));
```

### fetch モック
```typescript
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'mock' }),
});
```

---

## チェックリスト

テスト作成・修正時に確認:

- [ ] 使用する Prisma モデルがモック済み
- [ ] 使用する Prisma メソッド (findMany, update, deleteMany等) がモック済み
- [ ] 外部 API 呼び出しがモック済み
- [ ] `pnpm test` で該当テストが PASS

---

## よくあるエラーと対処

| エラー | 原因 | 対処 |
|:---|:---|:---|
| `prisma.xxx.yyy is not a function` | メソッドのモック不足 | `__mocks__/prisma.ts` に追加 |
| `fetch is not a function` | fetchモック不足 | `global.fetch = jest.fn()` |
| `TypeError: Cannot read property` | モック返り値が未定義 | `.mockResolvedValue()` で値を設定 |
