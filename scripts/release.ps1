param(
  [Parameter(Mandatory=$true)][string]$Version,
  [Parameter(Mandatory=$true)][string]$NotesPath,
  [Parameter(Mandatory=$true)][string]$AssetPath,
  [string]$Owner = "lilian-stack",
  [string]$Repo  = "launcher-offi",
  [string]$Token = $env:GITHUB_TOKEN
)

$ErrorActionPreference = 'Stop'

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

if (!(Test-Path $NotesPath)) { Fail "Notes file not found: $NotesPath" }
if (!(Test-Path $AssetPath)) { Fail "Asset file not found: $AssetPath" }
if ([string]::IsNullOrWhiteSpace($Token)) { Fail "GitHub token missing. Set env GITHUB_TOKEN or pass -Token." }

$notes = Get-Content $NotesPath -Raw

# Try gh CLI first if available
$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  Write-Host "Publishing with GitHub CLI..."
  & gh release create $Version $AssetPath -F $NotesPath -t $Version --latest -R "$Owner/$Repo"
  if ($LASTEXITCODE -ne 0) { Fail "gh release create failed." }
  Write-Host "Release published: https://github.com/$Owner/$Repo/releases/tag/$Version"
  exit 0
}

Write-Host "gh not found. Publishing via GitHub API..."
$headers = @{
  Authorization = "token $Token"
  Accept        = "application/vnd.github+json"
  'User-Agent'  = 'actoris-launcher'
}

$payload = [ordered]@{
  tag_name         = $Version
  target_commitish = "main"
  name             = $Version
  body             = $notes
  draft            = $false
  prerelease       = $false
} | ConvertTo-Json -Depth 10 -Compress

$release = Invoke-RestMethod -Method POST -Uri "https://api.github.com/repos/$Owner/$Repo/releases" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $payload
$uploadUrl = $release.upload_url -replace "\{.*\}",""
$assetName = [System.Web.HttpUtility]::UrlEncode((Split-Path $AssetPath -Leaf))

Invoke-RestMethod -Method POST -Uri "$uploadUrl?name=$assetName" -Headers @{ Authorization = "token $Token"; 'User-Agent'='actoris-launcher'; "Content-Type"="application/octet-stream" } -InFile $AssetPath

Write-Host "Release published: $($release.html_url)"


