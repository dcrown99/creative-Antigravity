<#
.SYNOPSIS
    Antigravity Development Manager v2.7
.DESCRIPTION
    全サービスの統合管理コンソール。
    対話型メニューにより、Docker操作や特定アプリの起動を簡略化します。
    Docker Compose分割対応: base + dev/prod オーバーライド
#>

param (
    [string]$Action = "",
    [string]$Service = "",
    [string]$Stack = "",
    [switch]$Prod = $false
)

# Docker Compose Split Configuration
$DockerComposeBase = "docker-compose.base.yml"
$DockerComposeDev = "docker-compose.dev.yml"
$DockerComposeProd = "docker-compose.prod.yml"
$DockerComposeFiles = if ($Prod) { "-f $DockerComposeBase -f $DockerComposeProd" } else { "-f $DockerComposeBase -f $DockerComposeDev" }

# Service Stacks Schema
$Stacks = @{
    "quant"   = @("quant-brain", "db", "redis", "dozzle")
    "clipper" = @("auto-clipper-web", "auto-clipper-api", "auto-clipper-worker", "redis")
    "voice"   = @("ai-talker", "market-watcher", "voicevox", "money-master", "dozzle")
    "core"    = @("money-master", "db")
}

function Log-Info { param([string]$msg) Write-Host "INFO: $msg" -ForegroundColor Cyan }
function Log-Success { param([string]$msg) Write-Host "SUCCESS: $msg" -ForegroundColor Green }
function Log-Warn { param([string]$msg) Write-Host "WARN: $msg" -ForegroundColor Yellow }

function Smart-Rebuild {
    param ([string]$TargetService)
    Log-Info "Rebuilding $TargetService with Docker BuildKit..."
    Invoke-Expression "docker-compose $DockerComposeFiles stop $TargetService"
    Invoke-Expression "docker-compose $DockerComposeFiles rm -f $TargetService"
    Invoke-Expression "docker-compose $DockerComposeFiles build $TargetService"
    # -V: Renew anonymous volumes (crucial for node_modules updates)
    # --force-recreate: Ensure container is fresh
    Invoke-Expression "docker-compose $DockerComposeFiles up -d --no-deps --force-recreate -V $TargetService"
    Log-Success "$TargetService restarted."
}

function Start-Stack {
    param ([string]$StackName)
    if (-not $Stacks.ContainsKey($StackName)) {
        Log-Warn "Stack '$StackName' not found."
        return
    }
    $services = $Stacks[$StackName]
    Log-Info "🚀 Starting Stack: $StackName ($($services -join ', '))"
    $serviceStr = $services -join ' '
    Invoke-Expression "docker-compose $DockerComposeFiles up -d $serviceStr"
    Log-Success "Stack '$StackName' started."
}

function Show-Menu {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "   Antigravity Development Manager v2.8   " -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "   [ Applications ]"
    Write-Host "1.  Run All Systems (Docker Up)"
    Write-Host "2.  Restart Money Master (Dev Mode)"
    Write-Host "3.  Restart My Kindle"
    Write-Host "4.  Restart Auto Clipper"
    Write-Host "5.  Restart Market Watcher"
    Write-Host "6.  Restart AI Talker (English Tutor)"
    Write-Host "7.  Restart Quant Brain (Financial Analysis)"
    Write-Host "8.  Restart News Reader (AI News)"
    Write-Host ""
    Write-Host "   [ Stack Launchers ]"
    Write-Host "9.  Start Quant Stack (Backend Analysis)"
    Write-Host "10. Start Clipper Stack (Video Gen)"
    Write-Host "11. Start Voice/AI Stack (Avatar & News)"
    Write-Host ""
    Write-Host "   [ Maintenance ]"
    Write-Host "t.  Run Tests (Test Runner)"
    Write-Host "d.  Stop All Containers (Down)"
    Write-Host "l.  View Logs (All)"
    Write-Host "p.  Prune System (Clean Cache)"
    Write-Host "q.  Quit"
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "(Mode: $(if ($Prod) { 'PRODUCTION' } else { 'DEVELOPMENT' }))" -ForegroundColor $(if ($Prod) { 'Red' } else { 'Green' })
}

# 引数がある場合は従来通り処理 (CI/CD互換)
if ($Action -ne "" -or $Stack -ne "") {
    if ($Stack -ne "") {
        Start-Stack -StackName $Stack
        exit
    }
    switch ($Action) {
        "up" { Invoke-Expression "docker-compose $DockerComposeFiles up -d" }
        "down" { Invoke-Expression "docker-compose $DockerComposeFiles down" }
        "rebuild" { Smart-Rebuild -TargetService $Service }
        "logs" { Invoke-Expression "docker-compose $DockerComposeFiles logs -f $Service" }
        "prune" { 
            Write-Host "🧹 Pruning Docker System..." -ForegroundColor Cyan
            docker system prune -f 
            Write-Host "✅ Prune Complete." -ForegroundColor Green
        }
    }
    exit
}

# インタラクティブモード
do {
    Show-Menu
    $input = Read-Host "Select an option"
    switch ($input) {
        "1" { 
            Log-Info "Starting entire ecosystem..."
            Invoke-Expression "docker-compose $DockerComposeFiles up -d"
            Log-Success "System is running. Check http://localhost:8888 for logs."
            Pause
        }
        "2" { Smart-Rebuild "money-master"; Pause }
        "3" { Smart-Rebuild "my-kindle"; Pause }
        "4" { 
            Smart-Rebuild "auto-clipper-api"
            Smart-Rebuild "auto-clipper-worker"
            Smart-Rebuild "auto-clipper-web"
            Pause 
        }
        "5" { Smart-Rebuild "market-watcher"; Pause }
        "6" { 
            Log-Info "Initializing AI Talker..."
            # Voicevoxの事前確認
            if (!(docker ps | Select-String "voicevox")) {
                Log-Warn "Voicevox is not running. Starting dependency..."
                Invoke-Expression "docker-compose $DockerComposeFiles up -d voicevox"
            }
            Smart-Rebuild "ai-talker"
            Log-Success "AI Talker accessible at http://localhost:3004"
            Pause 
        }
        "7" {
            Log-Info "Initializing Quant Brain..."
            # TimescaleDBの事前確認
            if (!(docker ps | Select-String "timescaledb")) {
                Log-Warn "TimescaleDB is not running. Starting dependency..."
                Invoke-Expression "docker-compose $DockerComposeFiles up -d db"
                Start-Sleep -Seconds 5
            }
            Smart-Rebuild "quant-brain"
            Log-Success "Quant Brain accessible at http://localhost:8002/docs"
            Pause
        }
        "8" { Smart-Rebuild "news-reader"; Pause }
        "9" { Start-Stack "quant"; Pause }
        "10" { Start-Stack "clipper"; Pause }
        "11" { Start-Stack "voice"; Pause }
        "t" { ./scripts/test_runner.ps1 }
        "d" { Invoke-Expression "docker-compose $DockerComposeFiles down"; Pause }
        "l" { Invoke-Expression "docker-compose $DockerComposeFiles logs -f" }
        "p" { docker system prune -f; Pause }
        "q" { Write-Host "Bye!" -ForegroundColor Green; break }
    }
} until ($input -eq "q")
