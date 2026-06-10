$mt5Path = "C:\Program Files\XM Trading MT5\terminal64.exe"
$reportFile = "$PSScriptRoot\mt5\tests\nakane_short_report.html"
$iniFile = "$PSScriptRoot\mt5\tests\nakane_short.ini"

# Ensure directory exists
New-Item -ItemType Directory -Path "$PSScriptRoot\mt5\tests" -Force | Out-Null

$iniContent = @"
[Tester]
Expert=NakaneMaster\NakaneMaster.ex5
Symbol=USDJPY
Period=M1
Optimization=0
Model=1
FromDate=2024.01.01
ToDate=2024.02.01
ForwardMode=0
Deposit=1000000
Currency=JPY
Leverage=500
ExecutionMode=0
Report=$reportFile
ReplaceReport=1
ShutdownTerminal=1

[TesterInputs]
InpServerGMTOffset=2
InpGotobiOnly=true
InpRiskPercent=2.0
InpSL_Pips=15.0
InpTP_Pips=30.0
InpMaxSpread_Pips=2.0
InpMagicNumber=20260216
InpDeviation=30
"@

Set-Content -Path $iniFile -Value $iniContent -Encoding UTF8

Write-Host "Starting MT5 Short Backtest (1 Month)..."
Write-Host "Config: $iniFile"
Start-Process -FilePath $mt5Path -ArgumentList "/config:$iniFile" -Wait

if (Test-Path $reportFile) {
    Write-Host "Report Generated Successfully: $reportFile"
}
else {
    Write-Host "Report Failed."
}
