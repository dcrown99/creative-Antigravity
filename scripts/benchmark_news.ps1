$url = "http://localhost:3005/api/feeds?url=https%3A%2F%2Ffeeds.feedburner.com%2FTechCrunch%2F"
$count = 10
$times = @()

Write-Host "Starting $count requests to $url..."

for ($i = 1; $i -le $count; $i++) {
    $time = Measure-Command {
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing | Out-Null
        }
        catch {
            Write-Host "Request failed: $_"
        }
    }
    $times += $time.TotalMilliseconds
    Write-Host "Request ${i}: $($time.TotalMilliseconds) ms"
}

$avg = ($times | Measure-Object -Average).Average
$min = ($times | Measure-Object -Minimum).Minimum
$max = ($times | Measure-Object -Maximum).Maximum

Write-Host "------------------------"
Write-Host "Average: $avg ms"
Write-Host "Min: $min ms"
Write-Host "Max: $max ms"
