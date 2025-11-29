param(
  [string]$Owner = "lilian-stack",
  [string]$Repo  = "launcher-offi",
  [string]$Token = $env:GITHUB_TOKEN
)

$ErrorActionPreference = 'Stop'

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

Push-Location (Split-Path $MyInvocation.MyCommand.Path -Parent) | Out-Null
Set-Location ..

$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$version = $pkg.version
$notesPath = "PATCH_NOTES_$version.md"
$assetPath = "release\\Actoris-Setup-$version.exe"

Write-Host "Building setup $version..."
npm run make:win | Out-Host

if (!(Test-Path $assetPath)) { Fail "Asset not found: $assetPath" }
if (!(Test-Path $notesPath)) {
  Write-Host "Patch notes not found, generating a minimal file..."
  "Version $version - Corrections et améliorations." | Out-File -Encoding UTF8 $notesPath
}

Write-Host "Publishing release..."
& powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version $version -NotesPath $notesPath -AssetPath $assetPath -Owner $Owner -Repo $Repo -Token $Token

Pop-Location | Out-Null


