# 🔌 Database Access MCP Setup Guide

## 1. 📋 Prerequisites
You need to install the following MCP servers.
Most AI Editors (Cursor, etc.) allow you to add these from their "MCP" or "Features" settings.

- **SQLite**: `@modelcontextprotocol/server-sqlite`
- **PostgreSQL**: `@modelcontextprotocol/server-postgres`

## 2. ⚙️ Configuration (JSON)
Copy and paste the following configuration into your editor's MCP settings file (usually `mcp.json` or similar).

### 🗃️ SQLite (Target: Money Master)
> [!IMPORTANT]
> This path is absolute and specific to your machine.

```json
"sqlite": {
  "command": "uvx",
  "args": [
    "mcp-server-sqlite",
    "--db-path",
    "C:/Users/koume/Downloads/code/data/money-master.db"
  ]
}
```

### 🐘 PostgreSQL (Target: Quant Brain / TimescaleDB)
> [!NOTE]
> Connects to the Dockerized TimescaleDB instance running on port 5432.
> Password: `postgres` (Default for this project)

```json
"postgres": {
  "command": "uvx",
  "args": [
    "mcp-server-postgres",
    "postgresql://postgres:postgres@localhost:5432/antigravity"
  ]
}
```

## 3. 🧪 Verification
After adding these servers, ask your AI Advisor the following questions to verify connectivity:

1.  **Money Master Check:**
    > "Execute SQL to show me the last 5 entries in the `Asset` table."

2.  **Quant Brain Check:**
    > "Show me the list of tables in the `public` schema of the postgres database."

## 4. 📝 Tips for AI Prompts
- **Exploration:** "What tables are in the sqlite database?"
- **Data Analysis:** "Calculate the total value of assets where type is 'Stock'."
- **Debugging:** "Check if there are any duplicate tickers in the Asset table."
