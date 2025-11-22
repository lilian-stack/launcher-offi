param(
  [Parameter(Mandatory=$true)][string]$Version,
  [string]$Owner = "lilian-stack",
  [string]$Repo  = "launcher-offi",
  [string]$Token = $env:GITHUB_TOKEN,
  [switch]$Zip = $true
)

$ErrorActionPreference = 'Stop'

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

Push-Location (Split-Path $MyInvocation.MyCommand.Path -Parent) | Out-Null
Set-Location ..

if ([string]::IsNullOrWhiteSpace($Token)) { Fail "GitHub token missing. Set env GITHUB_TOKEN or pass -Token." }

# 1) Bump version
$pkgPath = "package.json"
$pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkgJson.version = $Version
$pkgJson | ConvertTo-Json -Depth 10 | Out-File -Encoding UTF8 $pkgPath
Write-Host "Version set to $Version"

# 2) Patch notes
$notesFile = "PATCH_NOTES_$Version.md"
if (!(Test-Path $notesFile)) {
  "Version $Version - Corrections et améliorations." | Out-File -Encoding UTF8 $notesFile
}

# 3) Build setup
Write-Host "Building setup $Version..."
npm run make:win | Out-Host

$exePath = "release\\Actoris-Setup-$Version.exe"
if (!(Test-Path $exePath)) { Fail "Asset not found: $exePath" }

$assetPath = $exePath
if ($Zip) {
  $zipPath = "release\\Actoris-Setup-$Version.zip"
  Write-Host "Compressing asset to $zipPath ..."
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path $exePath -DestinationPath $zipPath -Force
  $assetPath = $zipPath
}

# 4) Publish release (uses gh if present, else API)
& powershell -ExecutionPolicy Bypass -File scripts\\release.ps1 -Version $Version -NotesPath $notesFile -AssetPath $assetPath -Owner $Owner -Repo $Repo -Token $Token

Pop-Location | Out-Null


