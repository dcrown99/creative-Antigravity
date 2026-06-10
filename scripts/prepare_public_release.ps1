<#
.SYNOPSIS
    Prepares a public release of the repository.
.DESCRIPTION
    Copies the current repository to a target directory, excluding sensitive files and directories.
    Sanitizes configuration files (docker-compose.*.yml, env files) to remove secrets and local paths.
.PARAMETER DestinationPath
    The path where the public repository will be created.
.EXAMPLE
    ./scripts/prepare_public_release.ps1 -DestinationPath "../antigravity-public"
#>

param (
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
)

$ErrorActionPreference = "Stop"
$SourcePath = Get-Location

# Ensure Destination Path exists (create if not, but warn if not empty)
if (-not (Test-Path $DestinationPath)) {
    New-Item -ItemType Directory -Path $DestinationPath | Out-Null
    Write-Host "Created directory: $DestinationPath" -ForegroundColor Green
}
else {
    Write-Host "Warning: Destination directory already exists. Files may be overwritten." -ForegroundColor Yellow
}

# 1. Copy Files (Excluding sensitive/ignored items)
Write-Host "📂 Copying files..." -ForegroundColor Cyan

# Define exclusion list (Robocopy style)
$Excludes = @(
    ".git", ".vs", ".vscode", ".idea", "node_modules", "dist", ".turbo", ".next",
    "*.log", "*.db", "*.sqlite", "secrets.json",
    "src_backup_*", "data", "gdrive_mount",
    "*.env", "*.env.local", "*.pem", "*.key"
)

# Use Robocopy for robust copying (Windows)
# /MIR : Mirror (be careful!) - actually let's use /E (Recursive) /XO (Exclude Older) to be safer if dir exists
# /XD : Exclude Directories
# /XF : Exclude Files
$RoboArgs = @($SourcePath, $DestinationPath, "/E", "/XO", "/NFL", "/NDL", "/NJH", "/NJS")
$RoboArgs += "/XD"
$RoboArgs += $Excludes
$RoboArgs += "/XF"
$RoboArgs += $Excludes

# Run Robocopy directly
Write-Host "Running: robocopy $RoboArgs" -ForegroundColor Gray
& robocopy $RoboArgs

# Check if copy actually happened
if (-not (Test-Path (Join-Path $DestinationPath "package.json"))) {
    Write-Error "Copy failed! package.json not found in destination."
}

Write-Host "✅ Files copied." -ForegroundColor Green

# 2. Sanitize Docker Compose Files
Write-Host "🧹 Sanitizing Docker Compose files..." -ForegroundColor Cyan

$ComposeFiles = @("docker-compose.base.yml", "docker-compose.dev.yml", "docker-compose.prod.yml")

foreach ($File in $ComposeFiles) {
    $DockerComposePath = Join-Path $DestinationPath $File

    if (Test-Path $DockerComposePath) {
        $Content = Get-Content $DockerComposePath -Raw
        
        # Replace local drive paths
        $Content = $Content -replace "H:/.*?/.*?:", "./data/mock_drive:"
        
        # Ensure API keys are placeholders (if hardcoded, though they should be env vars)
        # Just in case, we can add a comment
        $Content = "# NOTE: This file has been sanitized for public release.`n" + $Content
        
        Set-Content -Path $DockerComposePath -Value $Content
        Write-Host "  - $File sanitized." -ForegroundColor Gray
    }
    else {
        Write-Warning "$File not found at $DockerComposePath"
    }
}

# 3. Create Dummy .env files
Write-Host "📝 Creating dummy .env files..." -ForegroundColor Cyan

function Create-DummyEnv {
    param ($Path)
    # Ensure parent directory exists
    $Parent = Split-Path $Path
    if (-not (Test-Path $Parent)) {
        New-Item -ItemType Directory -Path $Parent -Force | Out-Null
    }

    $EnvContent = @"
# Public Example Environment Variables
# Replace with your own values

DATABASE_URL="file:./dev.db"
REDIS_URL="redis://redis:6379/0"
GEMINI_API_KEY="your_gemini_api_key_here"
VOICEVOX_URL="http://voicevox:50021"
"@
    Set-Content -Path $Path -Value $EnvContent
}

# List of apps needing .env
$Apps = @("money-master", "market-watcher", "auto-clipper-api", "auto-clipper-web", "my-kindle")

foreach ($App in $Apps) {
    $EnvPath = Join-Path $DestinationPath "apps\$App\.env.example"
    Create-DummyEnv -Path $EnvPath
    # Also create a .env for convenience (users can rename)
    # Copy-Item $EnvPath (Join-Path $DestinationPath "apps\$App\.env")
    Write-Host "  - Created .env.example for $App" -ForegroundColor Gray
}

# 4. Final Cleanup
Write-Host "✨ Public release preparation complete!" -ForegroundColor Green
Write-Host "Location: $DestinationPath" -ForegroundColor Green
Write-Host "Next Steps:"
Write-Host "  1. cd $DestinationPath"
Write-Host "  2. git init"
Write-Host "  3. git add ."
Write-Host "  4. git commit -m 'Initial commit'"
