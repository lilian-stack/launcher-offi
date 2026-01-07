# Script de rebuild automatique pour better-sqlite3
# Recompile better-sqlite3 pour la version d'Electron utilisée

Write-Host "`n🔧 Rebuild de better-sqlite3 pour Electron`n" -ForegroundColor Cyan

# Vérifier que nous sommes dans le bon dossier
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur: package.json non trouvé" -ForegroundColor Red
    Write-Host "   Assurez-vous d'exécuter ce script depuis la racine du projet" -ForegroundColor Yellow
    exit 1
}

# Vérifier que better-sqlite3 est installé
if (-not (Test-Path "node_modules\better-sqlite3")) {
    Write-Host "⚠️  better-sqlite3 n'est pas installé" -ForegroundColor Yellow
    Write-Host "   Installation en cours..." -ForegroundColor Cyan
    npm install better-sqlite3
}

Write-Host "📊 Informations système:" -ForegroundColor Cyan
Write-Host "   Node.js: " -NoNewline
node --version
Write-Host "   Electron: " -NoNewline
node -p "require('electron/package.json').version"
Write-Host ""

# Rebuild better-sqlite3
Write-Host "🔨 Compilation de better-sqlite3..." -ForegroundColor Cyan
npx electron-rebuild -f -w better-sqlite3

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Rebuild réussi!" -ForegroundColor Green
    
    # Vérifier que le fichier .node existe
    $nodePath = "node_modules\better-sqlite3\build\Release\better_sqlite3.node"
    if (Test-Path $nodePath) {
        Write-Host "✅ Fichier better_sqlite3.node trouvé" -ForegroundColor Green
        Write-Host "   Emplacement: $nodePath" -ForegroundColor Gray
        
        # Afficher la taille du fichier
        $fileSize = (Get-Item $nodePath).Length / 1MB
        Write-Host "   Taille: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Fichier better_sqlite3.node non trouvé" -ForegroundColor Yellow
        Write-Host "   Le rebuild a peut-être échoué silencieusement" -ForegroundColor Yellow
    }
    
    Write-Host "`n💡 Vous pouvez maintenant démarrer l'application:" -ForegroundColor Cyan
    Write-Host "   npm run start" -ForegroundColor White
} else {
    Write-Host "`n❌ Erreur lors du rebuild" -ForegroundColor Red
    Write-Host "`n💡 Solutions possibles:" -ForegroundColor Yellow
    Write-Host "   1. Installer les outils de build Windows:" -ForegroundColor White
    Write-Host "      npm install --global windows-build-tools" -ForegroundColor Gray
    Write-Host "`n   2. Ou installer Visual Studio Build Tools:" -ForegroundColor White
    Write-Host "      https://visualstudio.microsoft.com/downloads/" -ForegroundColor Gray
    Write-Host "      (Sélectionner 'Desktop development with C++')" -ForegroundColor Gray
    Write-Host "`n   3. Réessayer après installation des outils" -ForegroundColor White
    Write-Host "`n   4. Utiliser le fallback JSON (aucune action requise)" -ForegroundColor White
    Write-Host "      L'application fonctionnera sans SQLite" -ForegroundColor Gray
    
    exit 1
}
