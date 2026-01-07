# Script PowerShell pour configurer les secrets Discord dans le fichier .env
# Exécuter avec: powershell -ExecutionPolicy Bypass -File scripts/setup-secrets.ps1

$envPath = Join-Path $env:APPDATA "actoris-launcher\.env"
$envDir = Split-Path $envPath -Parent

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration des secrets Discord" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Fichier .env: $envPath" -ForegroundColor Gray
Write-Host ""

# Créer le répertoire s'il n'existe pas
if (-Not (Test-Path $envDir)) {
    Write-Host "📁 Création du répertoire..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $envDir -Force | Out-Null
    Write-Host "✅ Répertoire créé: $envDir" -ForegroundColor Green
}

# Template par défaut
$envTemplate = @"
# Configuration Discord (SERVEUR UNIQUEMENT - JAMAIS dans le client)
# ⚠️ IMPORTANT : Remplir ces valeurs depuis votre serveur Discord
DISCORD_TOKEN=
DISCORD_CLIENT_ID=1398485031189483642
DISCORD_CLIENT_SECRET=
DISCORD_GUILD_ID=1332072935682478202

# Rôles Discord
DISCORD_ROLE_MEMBER=1332077241722605700
DISCORD_ROLE_VIP=1351995593383350302
DISCORD_ROLE_BOOST=1332111013205770282
DISCORD_ROLE_ADMIN=1332076547422683268

# Configuration serveur
PORT=3001
WS_PORT=8080

# URLs
DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
API_URL=http://127.0.0.1:3001
WS_URL=ws://127.0.0.1:8080

# Configuration générale
NODE_ENV=production
"@

# Charger le fichier existant s'il existe
$existingContent = $null
$existingVars = @{}

if (Test-Path $envPath) {
    Write-Host "📂 Fichier .env existant trouvé, chargement..." -ForegroundColor Yellow
    try {
        $existingContent = [System.IO.File]::ReadAllText($envPath, [System.Text.Encoding]::UTF8)
        $lines = $existingContent -split "`n"
        
        foreach ($line in $lines) {
            $trimmed = $line.Trim()
            if ($trimmed -and -not $trimmed.StartsWith('#') -and $trimmed.Contains('=')) {
                if ($trimmed -match '^([^=]+)=(.*)$') {
                    $key = $matches[1].Trim()
                    $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
                    $existingVars[$key] = $value
                }
            }
        }
        
        Write-Host "✅ ${existingVars.Count} variables chargées depuis le fichier existant" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Erreur lors du chargement, utilisation du template par défaut" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Instructions" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour obtenir vos secrets Discord:" -ForegroundColor White
Write-Host "  1. Allez sur https://discord.com/developers/applications" -ForegroundColor Gray
Write-Host "  2. Sélectionnez votre application (Client ID: 1398485031189483642)" -ForegroundColor Gray
Write-Host "  3. Allez dans l'onglet 'OAuth2'" -ForegroundColor Gray
Write-Host "  4. Copiez le 'Client Secret' (cliquez sur 'Reset Secret' si nécessaire)" -ForegroundColor Gray
Write-Host "  5. Allez dans l'onglet 'Bot' et créez un bot si nécessaire" -ForegroundColor Gray
Write-Host "  6. Copiez le 'Token' du bot" -ForegroundColor Gray
Write-Host ""
Write-Host "Appuyez sur ENTRÉE pour continuer..." -ForegroundColor Cyan
$null = Read-Host

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Configuration" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Demander DISCORD_CLIENT_SECRET
$clientSecret = $existingVars['DISCORD_CLIENT_SECRET']
if ($clientSecret) {
    Write-Host "DISCORD_CLIENT_SECRET existe déjà" -ForegroundColor Green
    Write-Host "  (Appuyez sur ENTRÉE pour garder la valeur actuelle)" -ForegroundColor Gray
    Write-Host "  (Ou tapez 'nouveau' pour changer)" -ForegroundColor Gray
    $response = Read-Host ">"
    
    if ($response -and $response.ToLower() -ne 'nouveau') {
        $newSecret = $response.Trim()
        if ($newSecret) {
            $clientSecret = $newSecret
        }
    } else {
        $clientSecret = Read-Host "Nouveau DISCORD_CLIENT_SECRET (sera masqué)" -AsSecureString
        $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($clientSecret))
    }
} else {
    Write-Host "DISCORD_CLIENT_SECRET (sera masqué):" -ForegroundColor Yellow
    $secureSecret = Read-Host "> " -AsSecureString
    $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret))
}

Write-Host ""

# Demander DISCORD_TOKEN
$discordToken = $existingVars['DISCORD_TOKEN']
if ($discordToken) {
    Write-Host "DISCORD_TOKEN existe déjà" -ForegroundColor Green
    Write-Host "  (Appuyez sur ENTRÉE pour garder la valeur actuelle)" -ForegroundColor Gray
    Write-Host "  (Ou tapez 'nouveau' pour changer)" -ForegroundColor Gray
    $response = Read-Host ">"
    
    if ($response -and $response.ToLower() -ne 'nouveau') {
        $newToken = $response.Trim()
        if ($newToken) {
            $discordToken = $newToken
        }
    } else {
        $discordToken = Read-Host "Nouveau DISCORD_TOKEN (sera masqué)" -AsSecureString
        $discordToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($discordToken))
    }
} else {
    Write-Host "DISCORD_TOKEN (sera masqué):" -ForegroundColor Yellow
    $secureToken = Read-Host "> " -AsSecureString
    $discordToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken))
}

Write-Host ""

# Mettre à jour les variables
$existingVars['DISCORD_CLIENT_SECRET'] = $clientSecret.Trim()
$existingVars['DISCORD_TOKEN'] = $discordToken.Trim()

# Construire le nouveau contenu
$newLines = @()
$newLines += "# Configuration Discord (SERVEUR UNIQUEMENT - JAMAIS dans le client)"
$newLines += "# ⚠️ IMPORTANT : Remplir ces valeurs depuis votre serveur Discord"
$newLines += "DISCORD_TOKEN=$($existingVars['DISCORD_TOKEN'])"
$newLines += "DISCORD_CLIENT_ID=$($existingVars['DISCORD_CLIENT_ID'] -or '1398485031189483642')"
$newLines += "DISCORD_CLIENT_SECRET=$($existingVars['DISCORD_CLIENT_SECRET'])"
$newLines += "DISCORD_GUILD_ID=$($existingVars['DISCORD_GUILD_ID'] -or '1332072935682478202')"
$newLines += ""
$newLines += "# Rôles Discord"
$newLines += "DISCORD_ROLE_MEMBER=$($existingVars['DISCORD_ROLE_MEMBER'] -or '1332077241722605700')"
$newLines += "DISCORD_ROLE_VIP=$($existingVars['DISCORD_ROLE_VIP'] -or '1351995593383350302')"
$newLines += "DISCORD_ROLE_BOOST=$($existingVars['DISCORD_ROLE_BOOST'] -or '1332111013205770282')"
$newLines += "DISCORD_ROLE_ADMIN=$($existingVars['DISCORD_ROLE_ADMIN'] -or '1332076547422683268')"
$newLines += ""
$newLines += "# Configuration serveur"
$newLines += "PORT=$($existingVars['PORT'] -or '3001')"
$newLines += "WS_PORT=$($existingVars['WS_PORT'] -or '8080')"
$newLines += ""
$newLines += "# URLs"
$newLines += "DISCORD_REDIRECT_URI=$($existingVars['DISCORD_REDIRECT_URI'] -or 'http://localhost:5173/auth/callback')"
$newLines += "API_URL=$($existingVars['API_URL'] -or 'http://127.0.0.1:3001')"
$newLines += "WS_URL=$($existingVars['WS_URL'] -or 'ws://127.0.0.1:8080')"
$newLines += ""
$newLines += "# Configuration générale"
$newLines += "NODE_ENV=$($existingVars['NODE_ENV'] -or 'production')"

$newContent = $newLines -join "`n"

# Créer un backup
if (Test-Path $envPath) {
    $backupPath = "$envPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $envPath $backupPath -Force
    Write-Host "💾 Backup créé: $backupPath" -ForegroundColor Green
}

# Écrire en UTF-8 SANS BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($envPath, $newContent, $utf8NoBom)

Write-Host ""
Write-Host "✅ Fichier .env mis à jour avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "🔐 Configuration sauvegardée:" -ForegroundColor Cyan
Write-Host "  DISCORD_CLIENT_ID: $($existingVars['DISCORD_CLIENT_ID'] -or '1398485031189483642')" -ForegroundColor White
Write-Host "  DISCORD_CLIENT_SECRET: $(if ($clientSecret) { '✅ Défini (' + $clientSecret.Length + ' caractères)' } else { '❌ MANQUANT' })" -ForegroundColor $(if ($clientSecret) { "Green" } else { "Red" })
Write-Host "  DISCORD_TOKEN: $(if ($discordToken) { '✅ Défini (' + $discordToken.Length + ' caractères)' } else { '❌ MANQUANT' })" -ForegroundColor $(if ($discordToken) { "Green" } else { "Red" })
Write-Host "  DISCORD_GUILD_ID: $($existingVars['DISCORD_GUILD_ID'] -or '1332072935682478202')" -ForegroundColor White
Write-Host ""
Write-Host "📍 Fichier sauvegardé: $envPath" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANT: Redémarrez Actoris pour que les changements prennent effet!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

