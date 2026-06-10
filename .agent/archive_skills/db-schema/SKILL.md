---
name: db-schema
category: DevOps & DevOpsCore
description: データベーススキーマ変更手順
---

# DB Schema Skill

SQLite (Drizzle) および TimescaleDB (Alembic) のスキーマ変更を安全に実行する手順。

## SQLite (money-master)

### 事前準備: バックアップ
> [!CAUTION]
> **この手順は手動実行必須。** `// turbo` 対象外。

```powershell
$date = Get-Date -Format "yyyyMMdd_HHmm"
Copy-Item data/money-master.db "data/backups/money-master_$date.db"
```

### スキーマ変更
1. **スキーマ編集**: `apps/money-master/src/db/schema.ts`
   ```typescript
   export const newTable = sqliteTable("new_table", {
     id: text("id").primaryKey(),
     name: text("name").notNull(),
     createdAt: integer("created_at", { mode: "timestamp" }),
   });
   ```

2. **マイグレーション生成**:
   // turbo
   ```powershell
   pnpm --filter money-master drizzle-kit generate:sqlite
   ```

3. **マイグレーション適用**:
   // turbo
   ```powershell
   pnpm --filter money-master drizzle-kit push:sqlite
   ```

### MCP検証
// turbo
```
mcp_sqlite_list_tables
mcp_sqlite_execute_query("SELECT * FROM new_table LIMIT 5", read_only=true)
```

---

## TimescaleDB (quant-brain)

### 事前準備: バックアップ
```powershell
docker exec timescaledb pg_dump -U postgres quant_brain > "data/backups/quant_brain_$(Get-Date -Format 'yyyyMMdd').sql"
```

### スキーマ変更
1. **マイグレーション作成**:
   ```bash
   docker exec quant-brain alembic revision --autogenerate -m "description"
   ```

2. **マイグレーション適用**:
   ```bash
   docker exec quant-brain alembic upgrade head
   ```

### MCP検証
// turbo
```
mcp_postgres_query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
```

---

## リストア手順

### SQLite
```powershell
Copy-Item "data/backups/money-master_<date>.db" data/money-master.db -Force
./scripts/dev_manager.ps1 rebuild money-master
```

### TimescaleDB
```powershell
docker exec -i timescaledb psql -U postgres quant_brain < "data/backups/quant_brain_<date>.sql"
```

---

## 注意事項
- 本番環境ではマイグレーション前に必ずバックアップを取得
- 破壊的変更（カラム削除等）は段階的に実施
- マイグレーション履歴は Git で管理
