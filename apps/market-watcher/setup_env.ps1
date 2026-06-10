# Market Watcher Setup Script for Windows
$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Market Watcher using uv..." -ForegroundColor Cyan

# 1. Check uv
try {
    $version = & uv --version 2>&1
    Write-Host "✨ Found: $version" -ForegroundColor Green
}
catch {
    Write-Error "❌ uv not found. Please install uv first: https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
}

# 2. Sync Dependencies
Write-Host "⬇️ Installing and syncing dependencies..." -ForegroundColor Yellow
& uv sync

# 3. Setup .env
if (-not (Test-Path ".env")) {
    Write-Host "⚙️ Creating .env from template..." -ForegroundColor Yellow
    $envContent = @"
GEMINI_API_KEY=YOUR_API_KEY_HERE
VOICEVOX_URL=http://localhost:50021
"@
    Set-Content ".env" -Value $envContent -Encoding UTF8
    Write-Warning "⚠️ Created .env file. Please update GEMINI_API_KEY with your actual key!"
}

# 4. Create Output Directory
if (-not (Test-Path "output")) {
    New-Item -ItemType Directory -Force -Path "output" | Out-Null
}

Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "👉 Run this to start: uv run fastapi dev src/main.py --port 8000" -ForegroundColor Cyan
