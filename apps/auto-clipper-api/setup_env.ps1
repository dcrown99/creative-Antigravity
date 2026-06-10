$ErrorActionPreference = 'Stop'
Write-Host "🚀 Setting up Auto-Clipper API Environment using uv..." -ForegroundColor Cyan

# 1. System Dependencies Check
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: FFmpeg is required but not installed." -ForegroundColor Red
    Write-Host "   Please install it and add it to your PATH."
    exit 1
}

# 2. uv Version Check
try {
    $version = & uv --version 2>&1
    Write-Host "✨ Using uv: $version" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error: uv is not found." -ForegroundColor Red
    exit 1
}

# 3. Sync Dependencies
Write-Host "⬇️ Installing and syncing Python packages..." -ForegroundColor Cyan
& uv sync

# 4. Create Directory Structure
New-Item -ItemType Directory -Force -Path "temp" | Out-Null
New-Item -ItemType Directory -Force -Path "storage" | Out-Null

Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "👉 To start the server:"
Write-Host "   uv run fastapi dev main.py --port 8000"
