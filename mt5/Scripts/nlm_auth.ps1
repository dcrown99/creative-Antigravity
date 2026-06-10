<#
.SYNOPSIS
    NotebookLM CLI の認証を確認し、必要に応じて再ログインする。

.DESCRIPTION
    nlm login --check を実行して認証状態を確認。
    無効な場合は nlm login を自動実行する。

.EXAMPLE
    ./mt5/scripts/nlm_auth.ps1
#>

$env:PYTHONIOENCODING = 'utf-8'
$NLM = "uv tool run --from notebooklm-mcp-cli nlm"

Write-Host "[NLM Auth] Checking authentication..." -ForegroundColor Cyan

try {
    $result = Invoke-Expression "$NLM login --check 2>&1" | Out-String
    
    if ($result -match "Authentication valid") {
        Write-Host "[NLM Auth] ✓ Authentication is valid." -ForegroundColor Green
        if ($result -match "Account:\s+(.+)") {
            Write-Host "  Account: $($Matches[1])" -ForegroundColor Gray
        }
        if ($result -match "Notebooks found:\s+(\d+)") {
            Write-Host "  Notebooks: $($Matches[1])" -ForegroundColor Gray
        }
        exit 0
    }
}
catch {
    # Check failed, need to re-authenticate
}

Write-Host "[NLM Auth] ✗ Authentication expired. Starting login..." -ForegroundColor Yellow
Write-Host "[NLM Auth] A browser window will open for Google authentication." -ForegroundColor Yellow
Write-Host ""

try {
    Invoke-Expression "$NLM login"
    
    # Verify after login
    $verify = Invoke-Expression "$NLM login --check 2>&1" | Out-String
    if ($verify -match "Authentication valid") {
        Write-Host ""
        Write-Host "[NLM Auth] ✓ Login successful!" -ForegroundColor Green
        exit 0
    }
    else {
        Write-Host "[NLM Auth] ✗ Login may have failed. Please try again manually:" -ForegroundColor Red
        Write-Host "  uv tool run --from notebooklm-mcp-cli nlm login" -ForegroundColor Gray
        exit 1
    }
}
catch {
    Write-Host "[NLM Auth] ✗ Error during login: $_" -ForegroundColor Red
    exit 1
}
