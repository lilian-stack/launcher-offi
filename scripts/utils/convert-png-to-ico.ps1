# Script pour convertir PNG en ICO pour Windows
# Utilise ImageMagick si disponible, sinon utilise un outil en ligne

param(
    [string]$PngPath = "..\..\public\actoris-logo.png",
    [string]$IcoPath = "..\..\build\icon.ico"
)

Write-Host "Conversion PNG vers ICO..." -ForegroundColor Cyan
Write-Host "PNG: $PngPath" -ForegroundColor Yellow
Write-Host "ICO: $IcoPath" -ForegroundColor Yellow

# Vérifier si ImageMagick est installé
$magick = Get-Command magick -ErrorAction SilentlyContinue

if ($magick) {
    Write-Host "ImageMagick trouvé, conversion en cours..." -ForegroundColor Green
    & magick "$PngPath" -define icon:auto-resize=256,128,64,48,32,16 "$IcoPath"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conversion réussie!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de la conversion" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ ImageMagick non trouvé" -ForegroundColor Yellow
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "1. Installer ImageMagick: choco install imagemagick" -ForegroundColor White
    Write-Host "2. Utiliser un outil en ligne: https://convertio.co/png-ico/" -ForegroundColor White
    Write-Host "3. Copier le PNG vers build/icon.png (electron-builder peut l'utiliser)" -ForegroundColor White
    
    # Copier le PNG comme fallback
    if (Test-Path $PngPath) {
        $icoDir = Split-Path $IcoPath -Parent
        if (-not (Test-Path $icoDir)) {
            New-Item -ItemType Directory -Path $icoDir -Force | Out-Null
        }
        Copy-Item $PngPath -Destination ($IcoPath -replace '\.ico$', '.png') -Force
        Write-Host "✅ PNG copié vers build/icon.png" -ForegroundColor Green
    }
}

