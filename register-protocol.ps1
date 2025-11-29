# Script PowerShell pour enregistrer le protocole actoris:// manuellement
# Doit être exécuté en tant qu'administrateur

Write-Host "Enregistrement du protocole actoris://..." -ForegroundColor Cyan

# Obtenir le chemin de l'exécutable
$appPath = $PSScriptRoot
$exePath = Join-Path $appPath "Actoris.exe"

# Si l'exécutable n'existe pas dans le dossier actuel, chercher dans les emplacements standards
if (-not (Test-Path $exePath)) {
    $possiblePaths = @(
        "$env:LOCALAPPDATA\Programs\actoris-launcher\Actoris.exe",
        "$env:ProgramFiles\Actoris\Actoris.exe",
        "$env:ProgramFiles(x86)\Actoris\Actoris.exe"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $exePath = $path
            break
        }
    }
}

if (-not (Test-Path $exePath)) {
    Write-Host "ERREUR: Impossible de trouver Actoris.exe" -ForegroundColor Red
    Write-Host "Veuillez spécifier le chemin complet vers Actoris.exe" -ForegroundColor Yellow
    $exePath = Read-Host "Chemin vers Actoris.exe"
    
    if (-not (Test-Path $exePath)) {
        Write-Host "ERREUR: Le fichier spécifié n'existe pas" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Exécutable trouvé: $exePath" -ForegroundColor Green

# Enregistrer le protocole
$regPath = "HKCU:\Software\Classes\actoris"
$command = "`"$exePath`" `"%1`""

try {
    # Créer la clé principale
    New-Item -Path $regPath -Force | Out-Null
    Set-ItemProperty -Path $regPath -Name "(Default)" -Value "URL:Actoris Launcher Protocol" -Force
    Set-ItemProperty -Path $regPath -Name "URL Protocol" -Value "" -Force
    
    # Créer la clé shell\open\command
    $commandPath = Join-Path $regPath "shell\open\command"
    New-Item -Path $commandPath -Force | Out-Null
    Set-ItemProperty -Path $commandPath -Name "(Default)" -Value $command -Force
    
    Write-Host "✅ Protocole actoris:// enregistré avec succès!" -ForegroundColor Green
    Write-Host "Vous pouvez maintenant fermer et rouvrir votre navigateur." -ForegroundColor Yellow
} catch {
    Write-Host "ERREUR lors de l'enregistrement: $_" -ForegroundColor Red
    exit 1
}

