# Script PowerShell pour déployer redirect.html sur Vercel
# Usage: .\scripts\deploy-vercel.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "🚀 DÉPLOIEMENT VERCEL - redirect.html" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si le fichier existe
if (-not (Test-Path "public\redirect.html")) {
    Write-Host "❌ Erreur: public\redirect.html n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier redirect.html trouvé" -ForegroundColor Green
Write-Host ""

# Vérifier si Vercel CLI est installé
Write-Host "🔍 Vérification de Vercel CLI..." -ForegroundColor Yellow
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "⚠️  Vercel CLI n'est pas installé" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Installation de Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host ""
}

Write-Host "✅ Vercel CLI est disponible" -ForegroundColor Green
Write-Host ""

# Instructions pour le déploiement
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📋 INSTRUCTIONS DE DÉPLOIEMENT" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Déploiement automatique (si connecté à GitHub)" -ForegroundColor Yellow
Write-Host "  1. Ouvrez GitHub Desktop ou votre client Git"
Write-Host "  2. Commitez le fichier public/redirect.html"
Write-Host "  3. Poussez vers GitHub"
Write-Host "  4. Vercel déploiera automatiquement"
Write-Host ""
Write-Host "Option 2: Déploiement manuel avec Vercel CLI" -ForegroundColor Yellow
Write-Host "  1. Exécutez: vercel login"
Write-Host "  2. Exécutez: vercel"
Write-Host "  3. Suivez les instructions"
Write-Host ""
Write-Host "Option 3: Upload manuel sur Vercel Dashboard" -ForegroundColor Yellow
Write-Host "  1. Allez sur https://vercel.com"
Write-Host "  2. Ouvrez votre projet"
Write-Host "  3. Uploader public/redirect.html dans le dossier public/"
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Demander si l'utilisateur veut déployer maintenant
$deploy = Read-Host "Voulez-vous déployer maintenant avec Vercel CLI? (O/N)"

if ($deploy -eq "O" -or $deploy -eq "o") {
    Write-Host ""
    Write-Host "🚀 Démarrage du déploiement..." -ForegroundColor Green
    Write-Host ""
    vercel
} else {
    Write-Host ""
    Write-Host "✅ Fichiers prêts pour le déploiement!" -ForegroundColor Green
    Write-Host "   Exécutez 'vercel' quand vous êtes prêt" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✅ TERMINÉ" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

