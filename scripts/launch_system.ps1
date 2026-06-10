# scripts/launch_system.ps1
$ErrorActionPreference = "Stop"

# Docker Compose Split Configuration
$DockerComposeBase = "docker-compose.base.yml"
$DockerComposeDev = "docker-compose.dev.yml"
$DockerComposeArgs = "-f $DockerComposeBase -f $DockerComposeDev"

Write-Host "🚀 Launching System Integration Phase..." -ForegroundColor Cyan

# 1. Stop & Clean
Write-Host "🛑 Cleaning up old containers..." -ForegroundColor Yellow
Invoke-Expression "docker compose $DockerComposeArgs down --remove-orphans"

# 2. Rebuild & Launch
Write-Host "🐳 Rebuilding and Starting containers..." -ForegroundColor Cyan
Write-Host "   (This may take a few minutes...)" -ForegroundColor Gray
# --build: Pick up root .npmrc changes
# --force-recreate: Ensure new config is applied
Invoke-Expression "docker compose $DockerComposeArgs up -d --build --force-recreate"

# 3. Wait for Initialization
Write-Host "⏳ Waiting 30 seconds for database initialization..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 4. Status Check
Write-Host "📊 Checking Container Health..." -ForegroundColor Green
Invoke-Expression "docker compose $DockerComposeArgs ps"

# 5. Access Dashboard
Write-Host "`n✅ System is LIVE!" -ForegroundColor Green
Write-Host "----------------------------------------"
Write-Host "💰 Money Master:   http://localhost:3001"
Write-Host "📚 My Kindle:      http://localhost:3002"
Write-Host "🎬 Auto Clipper:   http://localhost:3003"
Write-Host "🗣️ AI Talker:      http://localhost:3004"
Write-Host "⚙️ Clipper API:    http://localhost:8000/docs"
Write-Host "📈 Market Watcher: http://localhost:8001/docs"
Write-Host "🧠 Quant Brain:    http://localhost:8002/docs"
Write-Host "🗄️ TimescaleDB:    localhost:5432"
Write-Host "🔊 Voicevox:       http://localhost:50021"
Write-Host "📊 Dozzle:         http://localhost:8888"
Write-Host "----------------------------------------"
Write-Host "👉 Please verify all services are running."
