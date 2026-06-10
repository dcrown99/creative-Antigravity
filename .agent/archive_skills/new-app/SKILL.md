---
name: new-app
category: Web & APIs
description: Turborepoへの新規アプリ追加
---

# New App Skill

Turborepoモノレポに新規アプリを追加する標準手順。

## フロントエンド (Next.js)

### 1. ディレクトリ構造作成
```
apps/<app-name>/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
├── public/
├── package.json
├── next.config.mjs
├── tsconfig.json
└── Dockerfile
```

### 2. package.json テンプレート
```json
{
  "name": "<app-name>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint ."
  },
  "dependencies": {
    "@repo/ui": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 3. Docker Compose 追加 (docker-compose.base.yml)
```yaml
<app-name>:
  build:
    context: .
    dockerfile: apps/<app-name>/Dockerfile
  container_name: <app-name>
  restart: unless-stopped
```

### 4. Docker Compose 追加 (docker-compose.dev.yml)
```yaml
<app-name>:
  ports:
    - "<port>:3000"
  volumes:
    - ./apps/<app-name>/src:/app/apps/<app-name>/src
    - ./packages/ui/src:/app/packages/ui/src
  environment:
    - WATCHPACK_POLLING=true
```

---

## バックエンド (FastAPI)

### 1. ディレクトリ構造作成
```
apps/<app-name>/
├── src/
│   ├── __init__.py
│   ├── main.py
│   └── routers/
├── tests/
├── pyproject.toml
├── Dockerfile
└── alembic/ (if DB)
```

### 2. pyproject.toml テンプレート
```toml
[project]
name = "<app-name>"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
]

[tool.ruff]
line-length = 100
```

### 3. main.py テンプレート
```python
from fastapi import FastAPI

app = FastAPI(title="<App Name>")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

---

## 最終チェック

> [!IMPORTANT]
> 新規アプリ追加後は `ARCHITECTURE.md` のポートレジストリを必ず更新すること

// turbo
1. 依存関係インストール: `pnpm install`
2. ビルド確認: `pnpm turbo run build --filter=<app-name>`
