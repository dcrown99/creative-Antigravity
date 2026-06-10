---
name: perf-check
category: DevOps & DevOpsCore
description: パフォーマンス検証手順
---

# Performance Check Skill

フロントエンドアプリケーションのパフォーマンス検証手順。

## Lighthouse 検証

### ブラウザ DevTools での実行
1. Chrome DevTools を開く (F12)
2. Lighthouse タブを選択
3. Categories: Performance, Accessibility, Best Practices, SEO
4. Device: Desktop または Mobile
5. "Analyze page load" をクリック

### 目標スコア
| カテゴリ | 目標 | 許容最低 |
|:---|:---:|:---:|
| Performance | 90+ | 70 |
| Accessibility | 95+ | 90 |
| Best Practices | 90+ | 80 |
| SEO | 90+ | 85 |

---

## Core Web Vitals

### 指標と目標
| 指標 | 良好 | 要改善 | 不良 |
|:---|:---:|:---:|:---:|
| **LCP** (Largest Contentful Paint) | ≤2.5s | ≤4.0s | >4.0s |
| **INP** (Interaction to Next Paint) | ≤200ms | ≤500ms | >500ms |
| **CLS** (Cumulative Layout Shift) | ≤0.1 | ≤0.25 | >0.25 |

### 確認方法
1. DevTools → Performance タブ
2. "Start profiling and reload page" をクリック
3. Summary の Web Vitals を確認

---

## Bundle Size 分析

### Next.js Bundle Analyzer
```powershell
# 環境変数を設定してビルド
$env:ANALYZE = "true"
pnpm --filter <app-name> build
```

### 目標サイズ
| ファイル | 目標 | 警告 |
|:---|:---:|:---:|
| First Load JS | < 100KB | > 150KB |
| Total Bundle | < 500KB | > 800KB |

---

## ネットワーク検証

### DevTools Network タブ
1. "Disable cache" をチェック
2. Throttling: Fast 3G または Slow 3G
3. ページをリロード
4. 確認項目:
   - 初回ロード時間
   - リクエスト数
   - 転送サイズ

---

## メモリリーク検出

### DevTools Memory タブ
1. "Heap snapshot" を取得
2. 操作を繰り返す
3. 再度 "Heap snapshot" を取得
4. Comparison ビューで増加を確認

---

## パフォーマンス改善チェックリスト

### 画像最適化
- [ ] next/image を使用
- [ ] WebP / AVIF 形式
- [ ] 適切な sizes 属性

### コード分割
- [ ] dynamic import
- [ ] React.lazy / Suspense
- [ ] Route-based splitting

### キャッシュ
- [ ] SWR / React Query
- [ ] Service Worker
- [ ] CDN 活用

### レンダリング
- [ ] SSG / ISR 活用
- [ ] useMemo / useCallback
- [ ] 仮想スクロール (大量リスト)

---

## 自動テスト (オプション)

### Playwright でのパフォーマンステスト
```typescript
import { test, expect } from '@playwright/test';

test('page loads within 3 seconds', async ({ page }) => {
  const start = Date.now();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - start;
  expect(loadTime).toBeLessThan(3000);
});
```
