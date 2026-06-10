param (
    [string]$Source = "c:\Users\koume\Downloads\code\mt5\Experts\NakaneMaster.ex5",
    [string]$EAName = "NakaneMaster"
)

$appData = "C:\Users\koume\AppData\Roaming\MetaQuotes\Terminal"

# --- 動的にインスタンスを検出 ---
$instances = Get-ChildItem -Path $appData -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName "MQL5") }

if (-not $instances) {
    Write-Host "ERROR: No MT5 instances found in $appData" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($instances.Count) MT5 instance(s)" -ForegroundColor Cyan

# --- 既存ファイルの検索と削除 ---
$searchPattern = "$EAName.ex5"
Write-Host "Searching for old $EAName in $appData..."
$oldFiles = Get-ChildItem -Path $appData -Filter $searchPattern -Recurse -ErrorAction SilentlyContinue

foreach ($file in $oldFiles) {
    Write-Host "  Deleting: $($file.FullName)" -ForegroundColor Yellow
    Remove-Item $file.FullName -Force

    if ($file.Directory.Name -eq $EAName) {
        Copy-Item $Source $file.Directory.FullName -Force
        Write-Host "  Replaced at $($file.Directory.FullName)" -ForegroundColor Green
    }
    elseif ($file.Directory.Name -eq "Experts") {
        Copy-Item $Source $file.Directory.FullName -Force
        Write-Host "  Replaced at $($file.Directory.FullName) (Root Experts)" -ForegroundColor Green
    }
}

# --- 全インスタンスへデプロイ ---
foreach ($instance in $instances) {
    $destDir = Join-Path $instance.FullName "MQL5\Experts\$EAName"

    if (!(Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    $destFile = Join-Path $destDir "$EAName.ex5"
    Copy-Item $Source $destFile -Force
    Write-Host "Deployed $EAName to $destFile" -ForegroundColor Green
}

Write-Host "`nForce deployment complete." -ForegroundColor Cyan
