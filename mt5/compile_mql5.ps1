<#
.SYNOPSIS
    Compile MQL5 source file using MetaEditor64 CLI.
.DESCRIPTION
    Locates MetaEditor64.exe, compiles the given .mq5 source,
    parses the log for errors, and returns the .ex5 path on success.
.EXAMPLE
    .\compile_mql5.ps1 -Source "c:\Users\koume\Downloads\code\mt5\Experts\MyEA.mq5"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Source
)

$ErrorActionPreference = "Stop"

# ============================================================
# Step 1: Validate source file
# ============================================================
if (-not (Test-Path $Source)) {
    Write-Host "ERROR: Source file not found: $Source" -ForegroundColor Red
    exit 1
}

$sourceDir = Split-Path $Source -Parent
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($Source)
$logFile = Join-Path $sourceDir "$baseName.log"
$ex5File = Join-Path $sourceDir "$baseName.ex5"

# ============================================================
# Step 2: Locate MetaEditor64.exe
# ============================================================
$metaEditor = $null

# Try common installation paths
$searchPaths = @(
    "C:\Program Files\XM Trading MT5\metaeditor64.exe",
    "C:\Program Files\MetaTrader 5\metaeditor64.exe",
    "C:\Program Files (x86)\XM Trading MT5\metaeditor64.exe"
)

foreach ($path in $searchPaths) {
    if (Test-Path $path) {
        $metaEditor = $path
        break
    }
}

# Fallback: search Program Files
if (-not $metaEditor) {
    $found = Get-ChildItem "C:\Program Files" -Filter "metaeditor64.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $metaEditor = $found.FullName
    }
}

if (-not $metaEditor) {
    Write-Host "ERROR: metaeditor64.exe not found" -ForegroundColor Red
    Write-Host "  Searched: C:\Program Files\*MT5*" -ForegroundColor Yellow
    exit 1
}

Write-Host "MetaEditor: $metaEditor" -ForegroundColor Cyan

# ============================================================
# Step 3: Compile
# ============================================================
# Remove old log and ex5
if (Test-Path $logFile) { Remove-Item $logFile -Force }

Write-Host "Compiling: $Source" -ForegroundColor Yellow

$null = Start-Process -FilePath $metaEditor -ArgumentList "/compile:`"$Source`"", "/log" -PassThru -Wait -NoNewWindow
# MetaEditor may return non-zero even on success, so we check the log instead

# Wait briefly for log file to be written
Start-Sleep -Milliseconds 500

# ============================================================
# Step 4: Parse compilation log
# ============================================================
if (-not (Test-Path $logFile)) {
    Write-Host "ERROR: Compilation log not generated at $logFile" -ForegroundColor Red
    exit 1
}

$logContent = Get-Content $logFile -Raw -Encoding UTF8

# Check for "0 errors" in the Result line
if ($logContent -match "Result:\s*0 errors") {
    Write-Host "✅ Compilation successful: 0 errors" -ForegroundColor Green
}
else {
    Write-Host "❌ Compilation failed:" -ForegroundColor Red
    # Show error lines
    $logLines = Get-Content $logFile -Encoding UTF8
    foreach ($line in $logLines) {
        if ($line -match "error|warning|Result:") {
            Write-Host "  $line" -ForegroundColor Red
        }
    }
    exit 1
}

# ============================================================
# Step 5: Verify .ex5 was generated
# ============================================================
if (-not (Test-Path $ex5File)) {
    Write-Host "ERROR: .ex5 file not generated at $ex5File" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $ex5File
Write-Host "Output: $ex5File ($($fileInfo.Length) bytes)" -ForegroundColor Green

# Return the ex5 path for downstream scripts
return $ex5File
