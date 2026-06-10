<#
.SYNOPSIS
    Antigravity Test Runner
.DESCRIPTION
    Dockerコンテナ内でユニットテストを実行するためのユーティリティスクリプト。
    対話型メニューでアプリケーションとテストモードを選択できます。
#>

function Show-Menu {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "      Antigravity Test Runner v1.0        " -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "   [ Target Application ]"
    Write-Host "1.  Money Master (TypeScript/Jest)"
    Write-Host "2.  Auto Clipper API (Python/pytest)"
    Write-Host "3.  Market Watcher (Python/pytest)"
    Write-Host "4.  News Reader (TypeScript/Jest)"
    Write-Host "5.  Run All Tests (TurboRepo)"
    Write-Host ""
    Write-Host "q.  Quit"
    Write-Host "==========================================" -ForegroundColor Cyan
}

function Show-Mode-Menu {
    param([string]$AppName)
    Write-Host "`n   [ Test Mode for $AppName ]" -ForegroundColor Green
    Write-Host "1.  Run Once (Standard)"
    Write-Host "2.  Watch Mode (Dev)"
    Write-Host "3.  Coverage Report"
    Write-Host "b.  Back"
}

function Run-MoneyMaster-Test {
    param([string]$Mode)
    $Container = "money-master"
    $WorkDir = "/app/apps/money-master"
    
    switch ($Mode) {
        "1" { docker exec -it -w $WorkDir $Container pnpm test }
        "2" { docker exec -it -w $WorkDir $Container pnpm test:watch }
        "3" { 
            docker exec -it -w $WorkDir $Container pnpm test --coverage 
            Write-Host "`n📊 Report generated at: apps/money-master/coverage/index.html" -ForegroundColor Green
        }
    }
}

function Run-Python-Test {
    param([string]$Container, [string]$Mode)
    $WorkDir = "/app"
    
    switch ($Mode) {
        "1" { docker exec -it -w $WorkDir $Container pytest }
        "2" { docker exec -it -w $WorkDir $Container pytest-watch } # Requires pytest-watch installed
        "3" { 
            docker exec -it -w $WorkDir $Container pytest --cov --cov-report=term-missing --cov-report=html
            Write-Host "`n📊 Report generated at: apps/$Container/htmlcov/index.html" -ForegroundColor Green
        }
    }
}

# Main Loop
do {
    Show-Menu
    $input = Read-Host "Select an application"
    
    if ($input -eq "q") { break }
    if ($input -eq "5") { 
        Write-Host "Running all tests via TurboRepo..." -ForegroundColor Magenta
        pnpm turbo run test
        Pause
        continue
    }

    $AppName = switch ($input) {
        "1" { "Money Master" }
        "2" { "Auto Clipper API" }
        "3" { "Market Watcher" }
        "4" { "News Reader" }
        default { $null }
    }

    if ($AppName) {
        Show-Mode-Menu -AppName $AppName
        $mode = Read-Host "Select mode"
        
        if ($mode -eq "b") { continue }

        switch ($input) {
            "1" { Run-MoneyMaster-Test -Mode $mode }
            "2" { Run-Python-Test -Container "auto-clipper-api" -Mode $mode }
            "3" { Run-Python-Test -Container "market-watcher" -Mode $mode }
            "4" { 
                # Reusing MoneyMaster logic as it is also Next.js/Jest
                $Container = "news-reader"
                $WorkDir = "/app/apps/news-reader"
                switch ($mode) {
                    "1" { docker exec -it -w $WorkDir $Container pnpm test }
                    "2" { docker exec -it -w $WorkDir $Container pnpm test:watch }
                    "3" { 
                        docker exec -it -w $WorkDir $Container pnpm test --coverage 
                        Write-Host "`n📊 Report generated at: apps/news-reader/coverage/index.html" -ForegroundColor Green
                    }
                }
            }
        }
        Pause
    }

} until ($input -eq "q")
