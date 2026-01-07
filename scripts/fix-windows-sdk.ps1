# Script pour detecter et configurer le Windows SDK correct pour better-sqlite3
# Resout l'erreur MSB8036: le kit SDK Windows version X est introuvable

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
    Write-Host "`n[i] Solution : Installer le Windows SDK" -ForegroundColor Yellow
    Write-Host "`nOption 1 - Visual Studio Installer (recommande):" -ForegroundColor Cyan
    Write-Host "  1. Ouvrir Visual Studio Installer" -ForegroundColor White
    Write-Host "  2. Cliquer sur 'Modifier' pour Build Tools" -ForegroundColor White
    Write-Host "  3. Aller dans 'Composants individuels'" -ForegroundColor White
    Write-Host "  4. Cocher 'Windows 10 SDK (10.0.22621.0 ou plus recent)'" -ForegroundColor White
    Write-Host "  5. Installer" -ForegroundColor White
    Write-Host "`nOption 2 - Installation directe:" -ForegroundColor Cyan
    Write-Host "  Telecharger depuis: https://developer.microsoft.com/windows/downloads/windows-sdk/" -ForegroundColor White
    exit 1
}

Write-Host "[+] Windows SDK trouves:" -ForegroundColor Green
foreach ($sdk in $installedSdks | Sort-Object -Descending) {
    Write-Host "   - $sdk" -ForegroundColor Gray
}

# Selectionner le SDK le plus recent
$latestSdk = $installedSdks | Sort-Object -Descending | Select-Object -First 1
Write-Host "`n[*] SDK selectionne: $latestSdk" -ForegroundColor Cyan

# Configurer les variables d environnement pour node-gyp
Write-Host "`n[*] Configuration de node-gyp..." -ForegroundColor Cyan

# Creer/mettre a jour le fichier .npmrc avec la version du SDK
$npmrcPath = ".npmrc"
$npmrcContent = @"
msvs_version=2022
msbuild_path=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe
target=$latestSdk
"@

Set-Content -Path $npmrcPath -Value $npmrcContent -Force
Write-Host "[+] Fichier .npmrc cree avec SDK $latestSdk" -ForegroundColor Green

# Alternative: definir les variables d environnement
$env:GYP_MSVS_VERSION = "2022"
$env:npm_config_msvs_version = "2022"

Write-Host "`n[*] Tentative de rebuild avec le SDK $latestSdk..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Gray

# Nettoyer d abord
if (Test-Path "node_modules\better-sqlite3\build") {
    Write-Host "[*] Nettoyage du build precedent..." -ForegroundColor Yellow
    Remove-Item -Path "node_modules\better-sqlite3\build" -Recurse -Force -ErrorAction SilentlyContinue
}

# Rebuild
npx electron-rebuild -f -w better-sqlite3 --force-abi

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Gray
    Write-Host "[+] Rebuild reussi avec le SDK $latestSdk !" -ForegroundColor Green
    
    # Verifier le fichier .node
    $nodePath = "node_modules\better-sqlite3\build\Release\better_sqlite3.node"
    if (Test-Path $nodePath) {
        Write-Host "[+] Fichier better_sqlite3.node cree" -ForegroundColor Green
        $fileSize = (Get-Item $nodePath).Length / 1MB
        Write-Host "   Taille: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray
        
        Write-Host "`n[!] SQLite est maintenant pret a etre utilise !" -ForegroundColor Green
        Write-Host "`n[i] Vous pouvez maintenant demarrer l application:" -ForegroundColor Cyan
        Write-Host "   npm run start" -ForegroundColor White
    } else {
        Write-Host "[!] Le fichier .node n a pas ete trouve (rebuild peut avoir echoue)" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n========================================" -ForegroundColor Gray
    Write-Host "[!] Le rebuild a echoue" -ForegroundColor Red
    
    Write-Host "`n[i] Solutions possibles:" -ForegroundColor Yellow
    Write-Host "`n1. Installer un Windows SDK plus recent:" -ForegroundColor Cyan
    Write-Host "   - Ouvrir Visual Studio Installer" -ForegroundColor White
    Write-Host "   - Modifier Build Tools 2022" -ForegroundColor White
    Write-Host "   - Composants individuels -> Cocher 'Windows 10 SDK (derniere version)'" -ForegroundColor White
    Write-Host "   - Installer" -ForegroundColor White
    
    Write-Host "`n2. Ou utiliser JSON en fallback (aucune action requise):" -ForegroundColor Cyan
    Write-Host "   L application fonctionne deja, mais sans SQLite" -ForegroundColor White
    
    Write-Host "`n3. Voir la documentation complete:" -ForegroundColor Cyan
    Write-Host "   docs\SQLITE_TROUBLESHOOTING.md" -ForegroundColor White
    
    exit 1
}
