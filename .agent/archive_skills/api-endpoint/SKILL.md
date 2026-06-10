---
name: api-endpoint
category: Web & APIs
description: API エンドポイント追加手順（TDD付き）
---

# API Endpoint Skill

FastAPI または Next.js API Route に新規エンドポイントを追加する標準手順。

## FastAPI (Python)

### 1. ルーター作成
ファイル: `apps/<app-name>/src/routers/<endpoint>.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/<endpoint>", tags=["<Endpoint>"])

class CreateRequest(BaseModel):
    name: str
    value: int

class Response(BaseModel):
    id: str
    name: str

@router.get("/", response_model=list[Response])
async def list_items():
    """一覧取得"""
    return []

@router.post("/", response_model=Response, status_code=201)
async def create_item(request: CreateRequest):
    """新規作成"""
    return Response(id="new-id", name=request.name)

@router.get("/{item_id}", response_model=Response)
async def get_item(item_id: str):
    """詳細取得"""
    raise HTTPException(status_code=404, detail="Not found")
```

### 2. ルーター登録
ファイル: `apps/<app-name>/src/main.py`

```python
from src.routers import new_endpoint

app.include_router(new_endpoint.router)
```

### 3. テスト作成 (TDD)
ファイル: `apps/<app-name>/tests/test_<endpoint>.py`

```python
import pytest
from httpx import AsyncClient
from src.main import app

@pytest.mark.asyncio
async def test_list_items():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/<endpoint>/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

// turbo
```powershell
cd apps/<app-name>
venv\Scripts\pytest tests/test_<endpoint>.py -v
```

---

## Next.js API Route (TypeScript)

### 1. ルート作成
ファイル: `apps/<app-name>/src/app/api/<endpoint>/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createItem(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Bad Request" },
      { status: 400 }
    );
  }
}
```

### 2. テスト作成 (TDD)
ファイル: `apps/<app-name>/src/app/api/<endpoint>/__tests__/route.test.ts`

```typescript
import { GET, POST } from "../route";
import { NextRequest } from "next/server";

describe("/<endpoint> API", () => {
  it("GET returns list", async () => {
    const request = new NextRequest("http://localhost/api/<endpoint>");
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

// turbo
```powershell
pnpm --filter <app-name> test -- --testPathPattern="<endpoint>"
```

---

## TDD フロー

1. **Red**: テストを書いて失敗を確認
2. **Green**: 最小限の実装でテストを通す
3. **Refactor**: コードを整理

> [!TIP]
> テストを先に書くことで、APIの仕様が明確になります
