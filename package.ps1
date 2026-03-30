$ErrorActionPreference = "Stop"

Write-Output "[AI Prompt Broadcaster] Building dist package..."

if (-not (Test-Path "package.json")) {
  throw "package.json not found."
}

npm run build | Out-Host

$manifestPath = Join-Path (Get-Location) "dist\\manifest.json"
if (-not (Test-Path $manifestPath)) {
  throw "dist\\manifest.json was not generated."
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = [string]$manifest.version

if ([string]::IsNullOrWhiteSpace($version)) {
  throw "dist\\manifest.json does not contain a valid version."
}

$zipName = "prompt-broadcaster-v$version.zip"
$zipPath = Join-Path (Get-Location) $zipName

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path (Get-Location) "dist\\*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Version: $version"
Write-Output "Created: $zipName"
