param(
  [Parameter(Mandatory=$true)][string]$Version,
  [string]$Notes = "",
  [string]$Owner = "lilian-stack",
  [string]$Repo  = "launcher-offi",
  [string]$Token = $env:GITHUB_TOKEN
)

$ErrorActionPreference = 'Stop'

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

Push-Location (Split-Path $MyInvocation.MyCommand.Path -Parent) | Out-Null
Set-Location ..

if ([string]::IsNullOrWhiteSpace($Token)) {
  Fail "GitHub token missing. Set env GITHUB_TOKEN or pass -Token."
}

# 1) Bump version in package.json
$pkgPath = "package.json"
$pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkgJson.version = $Version
$pkgJson | ConvertTo-Json -Depth 10 | Out-File -Encoding UTF8 $pkgPath
Write-Host "Version updated to $Version"

# 2) Patch notes file
$notesFile = "docs\patch-notes\PATCH_NOTES_$Version.md"
if ([string]::IsNullOrWhiteSpace($Notes)) {
  if (!(Test-Path $notesFile)) {
    "Version $Version - Corrections et améliorations." | Out-File -Encoding UTF8 $notesFile
  }
} else {
  $Notes | Out-File -Encoding UTF8 $notesFile
}

# 3) Build setup
Write-Host "Building setup $Version..."
npm run make:win | Out-Host

$assetPath = "release\\Actoris-Setup-$Version.exe"
if (!(Test-Path $assetPath)) { Fail "Asset not found: $assetPath" }

# 4) Publish release
& powershell -ExecutionPolicy Bypass -File scripts\deploy\release.ps1 -Version $Version -NotesPath $notesFile -AssetPath $assetPath -Owner $Owner -Repo $Repo -Token $Token

Pop-Location | Out-Null


