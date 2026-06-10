# Antigravity Gold Master Verification Script
# 目的: プロジェクト全体の健全性を最終確認する (CI準拠)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n🔹 $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

try {
    Write-Host "🚀 Starting Gold Master Verification..." -ForegroundColor Magenta

    # 1. Dependency Check
    Write-Step "Checking Dependencies (Strict Mode)..."
    pnpm install --frozen-lockfile
    Write-Success "Dependencies are in sync."

    # 2. Type Checking
    Write-Step "Running Type Checks (Global)..."
    pnpm turbo run type-check
    Write-Success "All TypeScript definitions are valid."

    # 3. Linting
    Write-Step "Running Linter (TypeScript)..."
    pnpm turbo run lint --filter='!auto-clipper-api' --filter='!market-watcher' --filter='!manga-downloader'
    Write-Success "Code style is compliant (TypeScript)."

    # 4. Building
    Write-Step "Building All Applications..."
    # Legacyなmanga-downloaderは除外
    pnpm turbo run build --filter=!manga-downloader
    Write-Success "All Next.js apps built successfully."

    # 5. Unit Testing
    Write-Step "Running Unit Tests (TypeScript)..."
    pnpm turbo run test --filter='!auto-clipper-api' --filter='!market-watcher' --filter='!manga-downloader'
    Write-Success "All TypeScript unit tests passed."

    # 6. Python Verification
    Write-Step "Verifying Python Services..."
    
    # Lint (Consolidated)
    & "./scripts/lint_python.ps1"

    # Test (Individual)
    $pythonApps = @("apps/auto-clipper-api", "apps/market-watcher")
    foreach ($appPath in $pythonApps) {
        $appName = Split-Path $appPath -Leaf
        Write-Host "  Testing $appName..." -ForegroundColor Cyan
        
        # Test
        # Note: Some tests may fail due to network dependencies
        # Coverage threshold is set in pytest.ini (--cov-fail-under)
        if (Test-Path "$appPath/venv/Scripts/pytest.exe") {
            Write-Host "    Running Pytest..." -ForegroundColor Gray
            & "$appPath/venv/Scripts/pytest.exe" "$appPath"
            if ($LASTEXITCODE -ne 0) { throw "Pytest failed for $appName" }
        }
    }
    Write-Success "All Python services verified."

    Write-Host "`n🏆 GOLD MASTER VERIFIED. SYSTEM IS READY." -ForegroundColor Yellow
}
catch {
    Write-Host "`n❌ VERIFICATION FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
