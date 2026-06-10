<#
.SYNOPSIS
    MT5 EA Backtest Automation Script
.DESCRIPTION
    Deploys EA via force_deploy.ps1, generates .ini config,
    runs MT5 Strategy Tester, and parses the report for automated PF judgment.
.EXAMPLE
    .\run_backtest.ps1 -EAName NakaneMaster -PythonPF 1.75 -Mode parity
    .\run_backtest.ps1 -EAName NakaneMaster -Mode validate
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$EAName,

    [string]$Symbol = "USDJPY",
    [string]$Period = "M1",
    [string]$From = "2023.01.01",
    [string]$To = "2025.12.31",
    [ValidateSet("parity", "validate", "compare", "optimize")]
    [string]$Mode = "parity",
    [int]$Optimization = 0,
    [int]$ForwardMode = 0,
    [string]$OptimizationCriterion = "0",
    [double]$PythonPF = 0,
    [string]$BaselineReport,
    [bool]$Shutdown = $true,
    [hashtable]$EAParams = @{},
    [switch]$SkipStaticCheck,
    [switch]$DryRun
)
$checkInputsScript = Join-Path $PSScriptRoot "check_mql_inputs.py"

$ErrorActionPreference = "Stop"
$repoRoot = (Get-Item "$PSScriptRoot\..\..\..\..").FullName
$mt5Terminal = "C:\Program Files\XM Trading MT5\terminal64.exe"
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$reportDir = Join-Path $repoRoot "mt5\backtest_results"
$parseScript = Join-Path $PSScriptRoot "parse_report.py"

# Find MT5 data directory
$mt5DataRoot = "$env:APPDATA\MetaQuotes\Terminal"
$mt5DataDir = Get-ChildItem -Path $mt5DataRoot -Directory | Where-Object {
    Test-Path (Join-Path $_.FullName "MQL5")
} | Select-Object -First 1 -ExpandProperty FullName

if (-not $mt5DataDir) {
    Write-Host "ERROR: Cannot find MT5 data directory" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $reportDir -Force | Out-Null

# ============================================================
# Step 0: Static Analysis (Prevent Unused Inputs)
# ============================================================
if (-not $SkipStaticCheck) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host " STEP 0: Static Analysis" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    
    $eaSource = Join-Path $repoRoot "mt5\Experts\${EAName}.mq5"
    if (Test-Path $eaSource) {
        python $checkInputsScript $eaSource
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Static analysis failed (Unused inputs detected)." -ForegroundColor Red
            Write-Host "Use -SkipStaticCheck to override." -ForegroundColor Yellow
            exit 1
        }
    }
    else {
        Write-Host "WARNING: EA source not found at $eaSource, skipping check." -ForegroundColor Yellow
    }
}

# ============================================================
# Step 1: Compile EA via compile_mql5.ps1
# ============================================================
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host " STEP 1: Compiling $EAName" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

$compileScript = Join-Path $repoRoot "mt5\compile_mql5.ps1"
$eaSourceForCompile = Join-Path $repoRoot "mt5\Experts\${EAName}.mq5"

if ((Test-Path $compileScript) -and (Test-Path $eaSourceForCompile)) {
    & $compileScript -Source $eaSourceForCompile | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Compilation failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "Compile OK" -ForegroundColor Green
}
else {
    if (-not (Test-Path $compileScript)) {
        Write-Host "WARNING: compile_mql5.ps1 not found, skipping compile" -ForegroundColor Yellow
    }
    if (-not (Test-Path $eaSourceForCompile)) {
        Write-Host "WARNING: $eaSourceForCompile not found, skipping compile" -ForegroundColor Yellow
    }
}

# ============================================================
# Step 1b: Deploy EA via force_deploy.ps1
# ============================================================
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host " STEP 1b: Deploying $EAName (force_deploy.ps1)" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

$deployScript = Join-Path $repoRoot "mt5\force_deploy.ps1"
$ex5Source = Join-Path $repoRoot "mt5\Experts\${EAName}.ex5"

if (Test-Path $deployScript) {
    & $deployScript -Source $ex5Source -EAName $EAName
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
        Write-Host "WARNING: Deploy script returned non-zero exit code" -ForegroundColor Yellow
    }
}
else {
    Write-Host "WARNING: force_deploy.ps1 not found, skipping deploy" -ForegroundColor Yellow
}

# Verify .ex5 exists in MT5 data dir
$ex5InData = Join-Path $mt5DataDir "MQL5\Experts\$EAName\$EAName.ex5"
if (-not (Test-Path $ex5InData)) {
    $ex5InData = Join-Path $mt5DataDir "MQL5\Experts\$EAName.ex5"
}
if (-not (Test-Path $ex5InData)) {
    Write-Host "ERROR: $EAName.ex5 not found in MT5 data directory" -ForegroundColor Red
    exit 1
}
Write-Host "Deploy OK: $ex5InData" -ForegroundColor Green

# Determine Expert path for .ini (relative to MQL5\Experts)
$expertIniPath = "$EAName\$EAName.ex5"
if (-not (Test-Path (Join-Path $mt5DataDir "MQL5\Experts\$EAName\$EAName.ex5"))) {
    $expertIniPath = "$EAName.ex5"
}

# ============================================================
# Step 2: Generate .ini and Run Backtest
# ============================================================
function Invoke-SingleBacktest {
    param(
        [string]$Label,
        [string]$FromDate,
        [string]$ToDate,
        [string]$ReportName,
        [bool]$ShutdownAfter,
        [int]$OptMode = 0,
        [int]$FwdMode = 0,
        [string]$OptCriterion = "0"
    )

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host " RUNNING: $Label ($FromDate -> $ToDate)" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan

    $shutdownVal = if ($ShutdownAfter) { 1 } else { 0 }

    # Report path is relative to MT5 data dir (just filename)
    $iniContent = @"
[Tester]
Expert=$expertIniPath
Symbol=$Symbol
Period=$Period
Optimization=$OptMode
Model=1
FromDate=$FromDate
ToDate=$ToDate
ForwardMode=$FwdMode
Deposit=1000000
Currency=JPY
Leverage=500
ExecutionMode=0
Report=$ReportName
ReplaceReport=1
ShutdownTerminal=$shutdownVal
OptimizationCriterion=$OptCriterion
"@

    # Append EA parameters
    if ($EAParams.Count -gt 0) {
        $iniContent += "`n[TesterInputs]`n"
        foreach ($key in $EAParams.Keys) {
            $value = $EAParams[$key]
            
            # If the user provides the new "optimization enable string" (e.g. InpUsePriceAction_F=1)
            # we need to convert it to the strict MT5 format: Value||Start||Step||Stop||Y
            # To simplify, we'll let the user define the raw format in SKILL via `$EAParams` directly as:
            # key="Value||Start||Step||Stop||Y"  or  key="Value||Start||Step||Stop||N"
            
            # However, standard backtests just need key=value.
            $iniContent += "$key=$value`n"
        }
    }

    $iniPath = Join-Path $mt5DataDir "$ReportName.ini"
    Set-Content -Path $iniPath -Value $iniContent -Encoding UTF8

    if ($DryRun) {
        Write-Host "DRY RUN: .ini generated at $iniPath" -ForegroundColor Yellow
        Write-Host $iniContent
        return $null
    }

    Write-Host "Config: $iniPath"
    Write-Host "Report: $ReportName (in MT5 data dir)"
    Write-Host "Starting MT5 Strategy Tester..." -ForegroundColor Yellow

    # Delete old report if exists
    $reportInMt5 = Join-Path $mt5DataDir "$ReportName.htm"
    # For optimization format, it generates XML files instead of single HTM
    $reportXmlInMt5 = Join-Path $mt5DataDir "$ReportName.xml"
    
    if (Test-Path $reportInMt5) { Remove-Item $reportInMt5 -Force }
    if (Test-Path $reportXmlInMt5) { Remove-Item $reportXmlInMt5 -Force }

    Start-Process -FilePath $mt5Terminal -ArgumentList "/config:$iniPath"

    # Poll for report file (max 10 minutes)
    $maxWait = 3600
    $elapsed = 0
    $pollInterval = 5

    while ($elapsed -lt $maxWait) {
        Start-Sleep -Seconds $pollInterval
        $elapsed += $pollInterval

        if (Test-Path $reportInMt5) {
            Start-Sleep -Seconds 3
            $size1 = (Get-Item $reportInMt5).Length
            Start-Sleep -Seconds 2
            $size2 = (Get-Item $reportInMt5).Length
            if ($size1 -eq $size2 -and $size1 -gt 100) {
                Write-Host "Report generated! (${elapsed}s)" -ForegroundColor Green
                # Copy to repo backtest_results
                $destPath = Join-Path $reportDir "$ReportName.htm"
                Copy-Item $reportInMt5 $destPath -Force
                return $destPath
            }
        }
        elseif (Test-Path $reportXmlInMt5) {
            Start-Sleep -Seconds 3
            $size1 = (Get-Item $reportXmlInMt5).Length
            Start-Sleep -Seconds 2
            $size2 = (Get-Item $reportXmlInMt5).Length
            if ($size1 -eq $size2 -and $size1 -gt 100) {
                Write-Host "Optimization Report (XML) generated! (${elapsed}s)" -ForegroundColor Green
                # Copy to repo backtest_results
                $destPath = Join-Path $reportDir "$ReportName.xml"
                Copy-Item $reportXmlInMt5 $destPath -Force
                return $destPath
            }
        }

        if ($elapsed % 30 -eq 0) {
            Write-Host "  Waiting for report... (${elapsed}s / ${maxWait}s)"
        }
    }

    Write-Host "TIMEOUT: Report not generated within ${maxWait}s" -ForegroundColor Red
    return $null
}

# ============================================================
# Step 3: Execute based on Mode
# ============================================================
$env:PYTHONIOENCODING = 'utf-8'

if ($Mode -eq "parity") {
    $reportName = "${EAName}_${timestamp}"
    $result = Invoke-SingleBacktest -Label "parity" -FromDate $From -ToDate $To -ReportName $reportName -ShutdownAfter $Shutdown

    if ($DryRun) {
        Write-Host "`nDry run completed." -ForegroundColor Green
        exit 0
    }

    if ($null -eq $result) {
        Write-Host "ERROR: Backtest failed" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host " RESULTS" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan

    $pyArgs = @($parseScript, $result)
    if ($PythonPF -gt 0) {
        $pyArgs += @("--python-pf", $PythonPF.ToString())
    }
    python @pyArgs

    $latestJson = Join-Path $reportDir "${EAName}_latest.json"
    python @pyArgs | Set-Content -Path $latestJson -Encoding UTF8
}
elseif ($Mode -eq "validate") {
    $fromDate = [datetime]::ParseExact($From, "yyyy.MM.dd", $null)
    $toDate = [datetime]::ParseExact($To, "yyyy.MM.dd", $null)
    $totalDays = ($toDate - $fromDate).Days
    $isDays = [math]::Floor($totalDays * 2 / 3)
    $splitDate = $fromDate.AddDays($isDays)

    $isTo = $splitDate.ToString("yyyy.MM.dd")
    $oosFrom = $splitDate.AddDays(1).ToString("yyyy.MM.dd")

    Write-Host ""
    Write-Host "VALIDATE MODE: IS/OOS Split" -ForegroundColor Magenta
    Write-Host "  IS:  $From -> $isTo" -ForegroundColor White
    Write-Host "  OOS: $oosFrom -> $To" -ForegroundColor White
    Write-Host ""

    $isReportName = "${EAName}_${timestamp}_IS"
    $isResult = Invoke-SingleBacktest -Label "IS" -FromDate $From -ToDate $isTo -ReportName $isReportName -ShutdownAfter $true

    if ($DryRun) {
        $oosReportName = "${EAName}_${timestamp}_OOS"
        Invoke-SingleBacktest -Label "OOS" -FromDate $oosFrom -ToDate $To -ReportName $oosReportName -ShutdownAfter $Shutdown | Out-Null
        Write-Host "`nDry run completed." -ForegroundColor Green
        exit 0
    }

    if ($null -eq $isResult) {
        Write-Host "ERROR: IS backtest failed" -ForegroundColor Red
        exit 1
    }

    Start-Sleep -Seconds 5
    $oosReportName = "${EAName}_${timestamp}_OOS"
    $oosResult = Invoke-SingleBacktest -Label "OOS" -FromDate $oosFrom -ToDate $To -ReportName $oosReportName -ShutdownAfter $Shutdown

    if ($null -eq $oosResult) {
        Write-Host "ERROR: OOS backtest failed" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host " VALIDATION RESULTS" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan

    python $parseScript --validate $isResult $oosResult

    $latestJson = Join-Path $reportDir "${EAName}_validate_latest.json"
    python $parseScript --validate $isResult $oosResult | Set-Content -Path $latestJson -Encoding UTF8
}
elseif ($Mode -eq "compare") {
    if (-not $BaselineReport) {
        Write-Host "ERROR: -BaselineReport is required for compare mode" -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path $BaselineReport)) {
        Write-Host "ERROR: Baseline report not found: $BaselineReport" -ForegroundColor Red
        exit 1
    }

    $reportName = "${EAName}_${timestamp}_compare"
    $result = Invoke-SingleBacktest -Label "compare" -FromDate $From -ToDate $To -ReportName $reportName -ShutdownAfter $Shutdown

    if ($DryRun) {
        Write-Host "`nDry run completed." -ForegroundColor Green
        exit 0
    }

    if ($null -eq $result) {
        Write-Host "ERROR: Backtest failed" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host " COMPARISON RESULTS" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan

    # Compare Result vs Baseline
    python $parseScript --compare $BaselineReport $result
    
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        Write-Host "PASS: Logic change confirmed" -ForegroundColor Green
    }
    else {
        Write-Host "WARNING: Logic unchanged (Results identical)" -ForegroundColor Yellow
    }
}
elseif ($Mode -eq "optimize") {
    $reportName = "${EAName}_opt_${timestamp}"
    $result = Invoke-SingleBacktest -Label "Optimization & Forward Test" -FromDate $From -ToDate $To -ReportName $reportName -ShutdownAfter $Shutdown -OptMode $Optimization -FwdMode $ForwardMode -OptCriterion $OptimizationCriterion
    
    if ($DryRun) {
        Write-Host "`nDry run completed." -ForegroundColor Green
        exit 0
    }

    if ($null -eq $result) {
        Write-Host "ERROR: Optimization failed" -ForegroundColor Red
        exit 1
    }

    Write-Host "`nOptimization complete!" -ForegroundColor Green
    Write-Host "Report saved at: $result" -ForegroundColor Cyan
    Write-Host "Please open the XML file in Excel or a browser to review the optimization results." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
