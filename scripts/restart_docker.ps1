# Antigravity Docker Manager (DEPRECATED)
# This script is deprecated. Redirecting to redeploy_all.ps1.

Write-Warning "⚠️  DEPRECATED: This script is deprecated. Please use './scripts/redeploy_all.ps1' instead."
Write-Host "Redirecting to redeploy_all.ps1..." -ForegroundColor Cyan

# Forward execution to redeploy_all.ps1
& "$PSScriptRoot/redeploy_all.ps1"
