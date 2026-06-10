param(
    [string]$ExpertName = "NakaneMaster",
    [string]$Symbol = "USDJPY",
    [string]$Period = "M1",
    [string]$FromDate = "2024.01.01",
    [string]$ToDate = "2024.12.31"
)

# Configuration
$mt5Path = "C:\Program Files\XM Trading MT5\terminal64.exe"
$workDir = "$PSScriptRoot\..\..\mt5"  # Adjust relative to where this script runs in the repo
$expertPath = "$workDir\Experts\$ExpertName.mq5"
$iniFile = "$workDir\tests\${ExpertName}_test.ini"
$reportFile = "$workDir\tests\${ExpertName}_report.html"

# Verify Paths
if (-not (Test-Path $xmlPath)) {
    # Write INI Dynamically
    $iniContent = @"
[Tester]
Expert=Experts\\$ExpertName\\$ExpertName.mq5
Symbol=$Symbol
Period=$Period
Optimization=0
Model=1
FromDate=$FromDate
ToDate=$ToDate
ForwardMode=0
Deposit=1000000
Currency=JPY
Leverage=500
ExecutionMode=0
Report=$reportFile
ReplaceReport=1
ShutdownTerminal=1
Deposit=1000000
"@
    Set-Content -Path $iniFile -Value $iniContent -Encoding UTF8
    Write-Host "Created Config: $iniFile"
}

# Run Backtest
Write-Host "Starting Backtest for $ExpertName..."
Start-Process -FilePath $mt5Path -ArgumentList "/config:`"$iniFile`"" -Wait

# Check Result
if (Test-Path $reportFile) {
    Write-Host "Success! Report generated at: $reportFile" -ForegroundColor Green
    Invoke-Item $reportFile
} else {
    Write-Host "Error: Report not found. Check MT5 Journal logs." -ForegroundColor Red
}
