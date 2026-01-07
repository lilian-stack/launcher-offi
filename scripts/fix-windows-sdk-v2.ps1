# Script corrige pour configurer le Windows SDK pour better-sqlite3
# Version 2: Fix du probleme "Invalid version number"

Write-Host "`n[*] Detection des Windows SDK installes...`n" -ForegroundColor Cyan

# Chemins possibles pour les Windows SDKs
$sdkPaths = @(
    "C:\Program Files (x86)\Windows Kits\10\Include",
    "C:\Program Files\Windows Kits\10\Include"
)

$installedSdks = @()

foreach ($sdkPath in $sdkPaths) {
    if (Test-Path $sdkPath) {
        $versions = Get-ChildItem $sdkPath -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' }
        foreach ($version in $versions) {
            $installedSdks += $version.Name
        }
    }
}

if ($installedSdks.Count -eq 0) {
    Write-Host "[!] Aucun Windows SDK detecte" -ForegroundColor Red
    Write-Host "`n[i] Le SDK devrait etre installe maintenant. Verifiez l installation." -ForegroundColor Yellow
    exit 1
}

Write-Host "[+] Windows SDK trouves:" -ForegroundColor Green
foreach ($sdk in $installedSdks | Sort-Object -Descending) {
    Write-Host "   - $sdk" -ForegroundColor Gray
}

# Selectionner le SDK le plus recent
$latestSdk = $installedSdks | Sort-Object -Descending | Select-Object -First 1
Write-Host "`n[*] SDK selectionne: $latestSdk" -ForegroundColor Cyan

# Configurer les variables d environnement pour la session actuelle
Write-Host "`n[*] Configuration des variables d environnement..." -ForegroundColor Cyan
$env:GYP_MSVS_VERSION = "2022"
$env:npm_config_msvs_version = "2022"

# Supprimer l ancien .npmrc s il existe
if (Test-Path ".npmrc") {
    Write-Host "[*] Suppression de l ancien .npmrc..." -ForegroundColor Yellow
    Remove-Item ".npmrc" -Force
}

Write-Host "[+] Configuration terminee" -ForegroundColor Green
Write-Host "`n[*] Tentative de rebuild avec le SDK $latestSdk..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Gray

# Nettoyer le build precedent
if (Test-Path "node_modules\better-sqlite3\build") {
    Write-Host "[*] Nettoyage du build precedent..." -ForegroundColor Yellow
    Remove-Item -Path "node_modules\better-sqlite3\build" -Recurse -Force -ErrorAction SilentlyContinue
}

# Rebuild avec les bonnes options
# On specifie explicitement la version d Electron et on laisse node-gyp detecter le SDK
Write-Host "[*] Compilation en cours (cela peut prendre 2-3 minutes)...`n" -ForegroundColor Cyan

npx electron-rebuild -f -w better-sqlite3

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Gray
    Write-Host "[+] Rebuild reussi avec le SDK $latestSdk !" -ForegroundColor Green
    
    # Verifier le fichier .node
    $nodePath = "node_modules\better-sqlite3\build\Release\better_sqlite3.node"
    if (Test-Path $nodePath) {
        Write-Host "[+] Fichier better_sqlite3.node cree avec succes" -ForegroundColor Green
        $fileSize = (Get-Item $nodePath).Length / 1MB
        Write-Host "   Emplacement: $nodePath" -ForegroundColor Gray
        Write-Host "   Taille: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray
        
        Write-Host "`n========================================" -ForegroundColor Gray
        Write-Host "[!] SQLite est maintenant pret a etre utilise !" -ForegroundColor Green
        Write-Host "`n[i] Demarrez l application avec:" -ForegroundColor Cyan
        Write-Host "   npm run start" -ForegroundColor White
        Write-Host "`nVous devriez maintenant voir:" -ForegroundColor Cyan
        Write-Host "   [GamesLibrarySQLite] Base de donnees initialisee" -ForegroundColor Green
    } else {
        Write-Host "[!] Le fichier .node n a pas ete trouve" -ForegroundColor Yellow
        Write-Host "   Le rebuild semble avoir echoue silencieusement" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n========================================" -ForegroundColor Gray
    Write-Host "[!] Le rebuild a echoue" -ForegroundColor Red
    
    Write-Host "`n[i] Solutions de secours:" -ForegroundColor Yellow
    
    Write-Host "`n1. Essayer avec npm rebuild (methode alternative):" -ForegroundColor Cyan
    Write-Host "   npm rebuild better-sqlite3 --build-from-source" -ForegroundColor White
    
    Write-Host "`n2. Ou continuer avec JSON (aucune action requise):" -ForegroundColor Cyan
    Write-Host "   L application fonctionne deja avec SimpleStore" -ForegroundColor White
    Write-Host "   Vous n aurez simplement pas les statistiques avancees" -ForegroundColor White
    
    Write-Host "`n3. Redemarrer l ordinateur et reessayer:" -ForegroundColor Cyan
    Write-Host "   Parfois necessaire pour que les variables d environnement soient actives" -ForegroundColor White
    
    exit 1
}
