<#
.SYNOPSIS
    Antigravity Ultimate Edition - Master Launch Script (v2.1)
    全12コンテナの環境設定、依存チェック、ビルド、起動、DB初期化を一括で行います。
#>

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Antigravity Launch Control"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   🚀 ANTIGRAVITY GOD MODE - LAUNCH SEQUENCE   " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# ---------------------------------------------------------
# 0. Pre-flight Checks (Infrastructure)
# ---------------------------------------------------------
Write-Host "`n[0/5] 🛡️ Checking Infrastructure..." -ForegroundColor Yellow

# Check for External Drive (Crucial for Auto-Clipper)
if (-not (Test-Path "H:\")) {
    Write-Warning "⚠️  External Drive (H:\) not found! Media mounts may fail."
    Write-Warning "   'Auto Clipper' and 'My Kindle' may not access remote files."
    # Automated environment: Skip prompt if running in non-interactive mode or assume yes if we can't prompt
    Write-Warning "   Continue anyway? (y/n)"
    # if ($confirm -ne 'y') { exit }
    Write-Warning "   Continuing without External Drive..."
}
else {
    Write-Host "   ✅ External Drive mount detected." -ForegroundColor Green
}

# ---------------------------------------------------------
# 1. Environment Setup (Auto-Generate .env if missing)
# ---------------------------------------------------------
Write-Host "`n[1/5] 🔧 Verifying Environment Configuration..." -ForegroundColor Yellow

function Ensure-EnvFile ($path, $content) {
    if (-not (Test-Path $path)) {
        Write-Warning "   Directory not found: $path (Skipping .env creation)"
        return
    }
    $envPath = Join-Path $path ".env"
    if (-not (Test-Path $envPath)) {
        Write-Host "   + Creating default .env for: $path" -ForegroundColor Gray
        $content | Out-File -FilePath $envPath -Encoding UTF8
    }
    else {
        Write-Host "   ok: .env exists for $path" -ForegroundColor DarkGray
    }
}

# Define defaults (Optimized for Windows/Docker)
$envMoney = @"
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_BASE_URL="http://localhost:3001"
NODE_ENV="development"
WATCHPACK_POLLING=true
"@

$envKindle = @"
NEXT_PUBLIC_BASE_URL="http://localhost:3002"
MANGA_DIR="/app/library"
NODE_ENV="development"
WATCHPACK_POLLING=true
"@

$envClipperWeb = @"
NEXT_PUBLIC_API_URL="http://localhost:8000"
NODE_ENV="development"
WATCHPACK_POLLING=true
"@

$envClipperApi = @"
FINAL_OUTPUT_DIR="/app/output"
REDIS_URL="redis://redis:6379/0"
WATCHFILES_FORCE_POLLING=true
IMAGEMAGICK_BINARY="/usr/bin/convert"
"@

$envMarket = @"
PORTFOLIO_DB_PATH="/data/dev.db"
VOICEVOX_URL="http://voicevox:50021"
GEMINI_API_KEY=""
"@

$envTalker = @"
NEXT_PUBLIC_GEMINI_MODEL="gemini-2.5-pro"
NEXT_PUBLIC_VOICEVOX_URL="http://voicevox:50021"
GEMINI_API_KEY=""
"@

# Apply defaults
Ensure-EnvFile "apps/money-master" $envMoney
Ensure-EnvFile "apps/my-kindle" $envKindle
Ensure-EnvFile "apps/auto-clipper-web" $envClipperWeb
Ensure-EnvFile "apps/auto-clipper-api" $envClipperApi
Ensure-EnvFile "apps/market-watcher" $envMarket
Ensure-EnvFile "apps/ai-talker" $envTalker

$envQuantBrain = @"
DATABASE_URL="postgresql+asyncpg://postgres:postgres@db:5432/antigravity"
ENV="dev"
"@

Ensure-EnvFile "apps/quant-brain" $envQuantBrain

# ---------------------------------------------------------
# 2. File System Preparation
# ---------------------------------------------------------
Write-Host "`n[2/5] 📂 Preparing Directories & Files..." -ForegroundColor Yellow

$clipperPath = "apps/auto-clipper-api"
if (Test-Path $clipperPath) {
    if (-not (Test-Path "$clipperPath/cookies.txt")) { 
        New-Item -ItemType File -Force -Path "$clipperPath/cookies.txt" | Out-Null 
        Write-Host "   + Created placeholder: $clipperPath/cookies.txt" -ForegroundColor Gray
    }
    New-Item -ItemType Directory -Force -Path "$clipperPath/output" | Out-Null
    New-Item -ItemType Directory -Force -Path "$clipperPath/temp" | Out-Null
}

# ---------------------------------------------------------
# 3. Cleanup & Install
# ---------------------------------------------------------
Write-Host "`n[3/5] 🧹 Cleaning & Installing Dependencies..." -ForegroundColor Yellow

# Docker Compose Split Configuration (ADR-016)
$DockerComposeBase = "docker-compose.base.yml"
$DockerComposeDev = "docker-compose.dev.yml"
$DockerComposeArgs = "-f $DockerComposeBase -f $DockerComposeDev"

# Remove Legacy/Previous Containers
if ((Test-Path $DockerComposeBase) -and (Test-Path $DockerComposeDev)) {
    Write-Host "   - Removing previous containers..." -ForegroundColor Gray
    Invoke-Expression "docker compose $DockerComposeArgs down --remove-orphans 2>`$null"
}

# Install Root Dependencies
Write-Host "   - Running pnpm install..." -ForegroundColor Gray
pnpm install

# ---------------------------------------------------------
# 4. Container Launch (The 10 Units)
# ---------------------------------------------------------
Write-Host "`n[4/5] 🚀 Launching 12 Containers (base + dev)..." -ForegroundColor Green

# Launch Logic: Use split Docker Compose configuration
if ((Test-Path $DockerComposeBase) -and (Test-Path $DockerComposeDev)) {
    Write-Host "   > Using Split Compose: $DockerComposeBase + $DockerComposeDev" -ForegroundColor Cyan
    Invoke-Expression "docker compose $DockerComposeArgs up -d --build --remove-orphans"
}
else {
    Write-Error "❌ Required Docker Compose files not found!"
    Write-Error "   Expected: $DockerComposeBase, $DockerComposeDev"
    exit 1
}

# ---------------------------------------------------------
# 5. Database Initialization
# ---------------------------------------------------------
Write-Host "`n[5/5] 🗄️  Finalizing Database..." -ForegroundColor Yellow
Write-Host "   - Waiting for DB container stability..." -ForegroundColor Gray
Start-Sleep -Seconds 10

if (Test-Path "apps/money-master/prisma/schema.prisma") {
    Write-Host "   - Applying migrations..." -ForegroundColor Gray
    docker exec money-master npx prisma generate
    docker exec money-master npx prisma migrate deploy
}

# ---------------------------------------------------------
# Completion Report
# ---------------------------------------------------------
Write-Host "`n✅ SYSTEM ONLINE - GOD MODE ACTIVATED" -ForegroundColor Green -BackgroundColor Black
Write-Host "==============================================" -ForegroundColor Green
Write-Host "   💰 Money Master:   http://localhost:3001 (Dev Mode)"
Write-Host "   📚 My Kindle:      http://localhost:3002"
Write-Host "   🎬 Auto Clipper:   http://localhost:3003"
Write-Host "   🗣️ AI Talker:      http://localhost:3004"
Write-Host "   ⚙️ Clipper API:    http://localhost:8000/docs"
Write-Host "   📈 Market Watcher: http://localhost:8001/docs"
Write-Host "   🧠 Quant Brain:    http://localhost:8002/docs"
Write-Host "   🗄️ TimescaleDB:    localhost:5432"
Write-Host "   📊 System Logs:    http://localhost:8888"
Write-Host "----------------------------------------------" -ForegroundColor Gray
Write-Host "   ⚠️  ACTION REQUIRED:" -ForegroundColor Yellow
Write-Host "   1. Edit 'apps/market-watcher/.env' to set GEMINI_API_KEY for AI features."
Write-Host "   2. Ensure 'apps/auto-clipper-api/cookies.txt' has valid YouTube cookies."
Write-Host "==============================================" -ForegroundColor Green
