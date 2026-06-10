$ErrorActionPreference = "Continue"

Write-Host "Starting Python Linting (Ruff)..." -ForegroundColor Green

# 1. Docker Services
$dockerServices = @("quant-brain", "market-watcher", "auto-clipper-api")

foreach ($service in $dockerServices) {
    Write-Host "Linting $service (via Docker)..." -ForegroundColor Cyan
    # Check if the service is running via docker compose
    $state = docker compose ps -q $service 2>$null
    if ($state) {
        docker compose exec $service uv run ruff check .
    }
    else {
        Write-Warning "Container '$service' is not running. Skipping."
    }
}

# 2. Standalone Tools
Write-Host "Linting manga-downloader (via uv)..." -ForegroundColor Cyan
$mangaDir = "apps/manga-downloader"
if (Test-Path "$mangaDir/pyproject.toml") {
    Push-Location $mangaDir
    uv run ruff check .
    Pop-Location
}
else {
    Write-Warning "manga-downloader project not found. Skipping."
}

Write-Host "Python Linting Completed." -ForegroundColor Green
