$mt5Path = "C:\Program Files\XM Trading MT5\terminal64.exe"
$reportFile = "C:\Users\koume\Downloads\nakane_report.html" 
$iniFile = "$PSScriptRoot\mt5\tests\nakane_full.ini"

# Update INI content
$iniContent = @"
[Tester]
Expert=NakaneMaster\NakaneMaster.ex5
Symbol=USDJPY
Period=M1
Optimization=0
Model=0
FromDate=2023.01.01
ToDate=2025.12.31
ForwardMode=0
Deposit=1000000
Currency=JPY
Leverage=500
ExecutionMode=0
Report=$reportFile
ReplaceReport=1
ShutdownTerminal=0

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

Write-Host "Started MT5 Backtest..."
Write-Host "Terminal will remain OPEN after test."
Write-Host "Config: $iniFile"
Write-Host "Report Path: $reportFile"

Start-Process -FilePath $mt5Path -ArgumentList "/config:$iniFile"
