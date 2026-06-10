<#
.SYNOPSIS
    Antigravity Dependency Manager
    Syncs dependencies from Host to Docker Containers without rebuilding images.

.DESCRIPTION
    This script handles the "Engine vs Fuel" problem.
    1. Optionally adds packages on the Host (updating package.json/pnpm-lock.yaml).
    2. Runs 'pnpm install' inside running containers to sync the anonymous node_modules volume.
    3. Restarts containers to apply changes.

.PARAMETER Package
    (Optional) Name of the package to add. e.g. "axios"

.PARAMETER Filter
    (Optional) Specific app to add the package to. e.g. "money-master".
    If omitted and -Package is set, adds to workspace root (shared).

.PARAMETER Dev
    (Switch) Add as devDependency (-D).

.EXAMPLE
    ./scripts/repair_dependencies.ps1
    Just syncs existing lockfile changes to containers.

.EXAMPLE
    ./scripts/repair_dependencies.ps1 -Package axios -Filter money-master
    Adds axios to money-master and syncs.
#>

param (
    [string]$Package = "",
    [string]$Filter = "",
    [switch]$Dev
)

$ErrorActionPreference = "Stop"

# Docker Compose Split Configuration
$DockerComposeBase = "docker-compose.base.yml"
$DockerComposeDev = "docker-compose.dev.yml"
$DockerComposeArgs = "-f $DockerComposeBase -f $DockerComposeDev"

# ---------------------------------------------------------
# 1. Host Side: Add Package (if requested)
# ---------------------------------------------------------
if ($Package) {
    if ($Filter) {
        Write-Host "`n📦 Adding '$Package' to '$Filter' on Host..." -ForegroundColor Cyan
        pnpm --filter $Filter add $Package $(if ($Dev) { "-D" })
    }
    else {
        Write-Host "`n📦 Adding '$Package' to Workspace Root on Host..." -ForegroundColor Cyan
        pnpm add -w $Package $(if ($Dev) { "-D" })
    }
}
else {
    Write-Host "`nℹ️  No package specified. Syncing existing lockfile state..." -ForegroundColor Cyan
}

# ---------------------------------------------------------
# 2. Container Side: Sync & Restart
# ---------------------------------------------------------
# List of Node.js services that need syncing
$nodeApps = @("money-master", "my-kindle", "auto-clipper-web", "ai-talker")
# List of Python services that need syncing
$pythonApps = @("quant-brain", "market-watcher", "auto-clipper-api")

foreach ($app in $nodeApps) {
    # Check if container is running
    $state = Invoke-Expression "docker compose $DockerComposeArgs ps -q $app"
    if (-not $state) {
        Write-Host "⚠️  $app is not running. Skipping." -ForegroundColor DarkGray
        continue
    }

    Write-Host "`n🔄 Syncing Node.js dependencies for $app..." -ForegroundColor Yellow
    
    # Run pnpm install inside container
    try {
        Invoke-Expression "docker compose $DockerComposeArgs exec -T $app pnpm install --frozen-lockfile"
    }
    catch {
        Write-Host "❌ Failed to install in $app. Check logs." -ForegroundColor Red
        continue
    }

    # Restart container to ensure new modules are loaded
    Write-Host "♻️  Restarting $app..." -ForegroundColor Yellow
    Invoke-Expression "docker compose $DockerComposeArgs restart $app"
}

foreach ($app in $pythonApps) {
    # Check if container is running
    $state = Invoke-Expression "docker compose $DockerComposeArgs ps -q $app"
    if (-not $state) {
        Write-Host "⚠️  $app is not running. Skipping." -ForegroundColor DarkGray
        continue
    }

    Write-Host "`n🔄 Syncing Python dependencies for $app..." -ForegroundColor Yellow
    
    # Run uv sync inside container
    try {
        Invoke-Expression "docker compose $DockerComposeArgs exec -T $app uv sync"
    }
    catch {
        Write-Host "❌ Failed to install in $app. Check logs." -ForegroundColor Red
        continue
    }

    # Restart container to ensure new modules are loaded
    Write-Host "♻️  Restarting $app..." -ForegroundColor Yellow
    Invoke-Expression "docker compose $DockerComposeArgs restart $app"
}

Write-Host "`n✅ Dependency Sync Complete!" -ForegroundColor Green
Write-Host "   You can now use the new packages immediately." -ForegroundColor Gray
