param (
    [string]$EAName = "NakaneMaster",
    [int]$Lines = 20
)

$logPath = "C:\Users\koume\AppData\Roaming\MetaQuotes\Tester"
$files = Get-ChildItem -Path $logPath -Filter "*.log" -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending

if ($files) {
    $latestLog = $files[0].FullName
    Write-Host "Checking log: $latestLog" -ForegroundColor Cyan
    Write-Host "Filtering: $EAName (last $Lines lines)" -ForegroundColor DarkGray
    Get-Content $latestLog | Select-String $EAName | Select-Object -Last $Lines
}
else {
    Write-Host "No log files found in $logPath" -ForegroundColor Yellow
}
