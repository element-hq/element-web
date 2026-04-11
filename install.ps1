# install.ps1 — element-tor installer for Windows
# Usage: irm https://raw.githubusercontent.com/Gvte-Kali/element-tor/feature/tor-integration/install.ps1 | iex

$ErrorActionPreference = "Stop"

$REPO    = "Gvte-Kali/element-tor"
$API_URL = "https://api.github.com/repos/$REPO/releases/latest"
$APP_NAME = "element-tor"

function Write-Info    { param($msg) Write-Host "[element-tor] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[element-tor] $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[element-tor] $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[element-tor] ERROR: $msg" -ForegroundColor Red; exit 1 }

# ── Detect architecture ───────────────────────────────────────────────────────

$arch = (Get-WmiObject Win32_OperatingSystem).OSArchitecture
if ($arch -notmatch "64") {
    Write-Err "Only 64-bit Windows is supported."
}

Write-Info "Platform: windows-x64"

# ── Fetch latest release ──────────────────────────────────────────────────────

Write-Info "Fetching latest release info..."

try {
    $release = Invoke-RestMethod -Uri $API_URL -Headers @{ "User-Agent" = "element-tor-installer" }
} catch {
    Write-Err "Failed to fetch release info: $_"
}

$asset = $release.assets | Where-Object { $_.name -match "Setup.*\.exe$" -or $_.name -match "win.*x64.*\.exe$" } | Select-Object -First 1

if (-not $asset) {
    Write-Err "No Windows installer found in latest release. Check https://github.com/$REPO/releases"
}

$downloadUrl = $asset.browser_download_url
$filename    = $asset.name
$tmpPath     = Join-Path $env:TEMP $filename

# ── Download ──────────────────────────────────────────────────────────────────

Write-Info "Downloading $filename..."

$webClient = New-Object System.Net.WebClient
$webClient.DownloadFile($downloadUrl, $tmpPath)

Write-Info "Download complete."

# ── Install ───────────────────────────────────────────────────────────────────

Write-Info "Running installer (silent install)..."

$process = Start-Process -FilePath $tmpPath -ArgumentList "/S" -Wait -PassThru

if ($process.ExitCode -ne 0) {
    Write-Err "Installer exited with code $($process.ExitCode)"
}

Remove-Item $tmpPath -Force

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Success "element-tor installed successfully!"
Write-Info "Launch from the Start menu or desktop shortcut."