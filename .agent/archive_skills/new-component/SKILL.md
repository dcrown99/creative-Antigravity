---
name: new-component
category: Web & APIs
description: "@repo/ui への新規コンポーネント追加"
---

# New Component Skill

`@repo/ui` パッケージに新規UIコンポーネントを追加する標準手順。

> **原子的整合性**: アプリ内でのローカルコンポーネント作成は禁止。必ず `@repo/ui` を経由すること。

## 手順

### 1. コンポーネント作成
ファイル: `packages/ui/src/components/ui/<component-name>.tsx`

**テンプレート**:
```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export interface ComponentNameProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary";
}

const ComponentName = React.forwardRef<HTMLDivElement, ComponentNameProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "base-styles-here",
        variant === "secondary" && "secondary-styles",
        className
      )}
      {...props}
    />
  )
);
ComponentName.displayName = "ComponentName";

export { ComponentName };
```

### 2. エクスポート追加
ファイル: `packages/ui/src/index.ts`

```typescript
export { ComponentName, type ComponentNameProps } from "./components/ui/<component-name>";
```

### 3. 型チェック
// turbo
```powershell
pnpm turbo run type-check --filter=@repo/ui
```

### 4. 使用例 (アプリ側)
```tsx
import { ComponentName } from "@repo/ui";

export default function Page() {
  return <ComponentName variant="secondary">Content</ComponentName>;
}
```

## 注意事項
- shadcn/ui ベースのコンポーネントは `components/ui/` 配下に配置
- カスタムコンポーネントは `components/` 直下に配置
- `cn()` ユーティリティを使ってクラス名をマージ
