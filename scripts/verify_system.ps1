<#
.SYNOPSIS
    Smart System Health Verifier
.DESCRIPTION
    全マイクロサービスのヘルスチェックエンドポイントを監視します。
    起動直後の不安定な状態を考慮し、リトライロジックを含みます。
.PARAMETER Retries
    最大リトライ回数 (デフォルト: 12回 = 約1分)
.PARAMETER Delay
    リトライ間隔 (秒) (デフォルト: 5秒)
#>

param (
    [int]$Retries = 12,
    [int]$Delay = 5
)

$ErrorActionPreference = "SilentlyContinue"

# 監視対象サービス定義
$Services = @(
    @{ Name = "Money Master (Web)"; Url = "http://localhost:3001"; Type = "Web" },
    @{ Name = "My Kindle (Web)"; Url = "http://localhost:3002"; Type = "Web" },
    @{ Name = "Auto Clipper (Web)"; Url = "http://localhost:3003"; Type = "Web" },
    @{ Name = "AI Talker (Web)"; Url = "http://localhost:3004"; Type = "Web" },
    @{ Name = "Auto Clipper (API)"; Url = "http://localhost:8000/docs"; Type = "API" },
    @{ Name = "Market Watcher (API)"; Url = "http://localhost:8001/docs"; Type = "API" },
    @{ Name = "Quant Brain (API)"; Url = "http://localhost:8002/"; Type = "API" },
    @{ Name = "Voicevox Engine"; Url = "http://localhost:50021/docs"; Type = "API" },
    @{ Name = "Dozzle (Logs)"; Url = "http://localhost:8888"; Type = "Web" }
)

function Check-Url {
    param ([string]$Url)
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 3 -UseBasicParsing
        return $resp.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

Write-Host "`n🔍 Starting System Health Check (Max Wait: $($Retries * $Delay)s)...`n" -ForegroundColor Cyan

$OverallStatus = $true

foreach ($svc in $Services) {
    $Name = $svc.Name.PadRight(25)
    $Url = $svc.Url
    $IsReady = $false
    
    Write-Host -NoNewline "Checking $Name "

    # Retry Loop
    for ($i = 1; $i -le $Retries; $i++) {
        if (Check-Url -Url $Url) {
            $IsReady = $true
            break
        }
        # 進捗インジケータ ( . )
        Write-Host -NoNewline "." -ForegroundColor Yellow
        Start-Sleep -Seconds $Delay
    }

    if ($IsReady) {
        Write-Host " [OK]" -ForegroundColor Green
    }
    else {
        Write-Host " [FAILED]" -ForegroundColor Red
        $OverallStatus = $false
    }
}

Write-Host "`n----------------------------------------"
if (-not $OverallStatus) {
    Write-Host "❌ Some services failed to start." -ForegroundColor Red
    Write-Host "   Run './scripts/dev_manager.ps1 logs <service_name>' to investigate." -ForegroundColor Gray
    exit 1
}
else {
    Write-Host "✅ All Systems Operational. Ready for coding!" -ForegroundColor Green
    exit 0
}
