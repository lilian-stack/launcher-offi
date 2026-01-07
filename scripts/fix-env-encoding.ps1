# Script PowerShell pour diagnostiquer et corriger le .env
# Exécuter avec: powershell -ExecutionPolicy Bypass -File scripts/fix-env-encoding.ps1

$envPath = Join-Path $env:APPDATA "actoris-launcher\.env"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Diagnostic du fichier .env" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Fichier analysé: $envPath" -ForegroundColor Gray
Write-Host ""

if (-Not (Test-Path $envPath)) {
    Write-Host "❌ Fichier .env introuvable!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Créez d'abord le fichier avec setup-secrets.ps1" -ForegroundColor Yellow
    Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Lire le fichier en bytes pour vérifier l'encodage
$bytes = [System.IO.File]::ReadAllBytes($envPath)
$size = $bytes.Length

Write-Host "📊 Analyse du fichier:" -ForegroundColor Cyan
Write-Host "   Taille: $size octets" -ForegroundColor White

# Détecter le BOM
$hasUtf8Bom = ($bytes.Length -ge 3) -and ($bytes[0] -eq 0xEF) -and ($bytes[1] -eq 0xBB) -and ($bytes[2] -eq 0xBF)
$hasUtf16LeBom = ($bytes.Length -ge 2) -and ($bytes[0] -eq 0xFF) -and ($bytes[1] -eq 0xFE)
$hasUtf16BeBom = ($bytes.Length -ge 2) -and ($bytes[0] -eq 0xFE) -and ($bytes[1] -eq 0xFF)

Write-Host "   UTF-8 BOM: $(if ($hasUtf8Bom) { '⚠️  OUI (problème!)' } else { '✅ NON' })" -ForegroundColor $(if ($hasUtf8Bom) { "Yellow" } else { "Green" })
Write-Host "   UTF-16 LE BOM: $(if ($hasUtf16LeBom) { '❌ OUI (PROBLÈME!)' } else { '✅ NON' })" -ForegroundColor $(if ($hasUtf16LeBom) { "Red" } else { "Green" })
Write-Host "   UTF-16 BE BOM: $(if ($hasUtf16BeBom) { '❌ OUI (PROBLÈME!)' } else { '✅ NON' })" -ForegroundColor $(if ($hasUtf16BeBom) { "Red" } else { "Green" })

# Lire le contenu avec différents encodages
$contentUtf8 = [System.IO.File]::ReadAllText($envPath, [System.Text.Encoding]::UTF8)
$lines = $contentUtf8 -split "`n"
$lineCount = $lines.Count

Write-Host "   Lignes: $lineCount" -ForegroundColor White
Write-Host ""

# Parser les variables
Write-Host "🔍 Variables détectées:" -ForegroundColor Cyan
$vars = @{}
$emptyVars = @()
$hasIssues = $false

foreach ($line in $lines) {
    $trimmed = $line.Trim()
    
    if ($trimmed -and -not $trimmed.StartsWith('#') -and $trimmed.Contains('=')) {
        if ($trimmed -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            
            # Enlever les guillemets si présents
            $value = $value -replace '^["'']|["'']$', ''
            
            $vars[$key] = $value
            
            # Afficher
            $display = $value
            if ($key -match 'SECRET|TOKEN') {
                if ([string]::IsNullOrWhiteSpace($value)) {
                    $display = "❌ VIDE"
                    $emptyVars += $key
                    $hasIssues = $true
                } else {
                    $display = "✅ ***masqué*** ($($value.Length) chars)"
                }
            } elseif ([string]::IsNullOrWhiteSpace($value)) {
                $display = "⚠️  VIDE"
            } else {
                $display = "✅ $value"
            }
            
            Write-Host "   $key = $display" -ForegroundColor $(if ($value) { "Green" } else { "Red" })
        }
    }
}

Write-Host ""

# Vérifier les variables critiques
$criticalVars = @('DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_TOKEN', 'DISCORD_GUILD_ID')
$missingCritical = @()

Write-Host "🔐 Variables critiques:" -ForegroundColor Cyan
foreach ($varName in $criticalVars) {
    $exists = $vars.ContainsKey($varName) -and -not [string]::IsNullOrWhiteSpace($vars[$varName])
    
    if ($exists) {
        Write-Host "   ✅ $varName" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $varName MANQUANT" -ForegroundColor Red
        $missingCritical += $varName
        $hasIssues = $true
    }
}

Write-Host ""

# Afficher un aperçu du contenu brut
Write-Host "📄 Aperçu du contenu (100 premiers caractères):" -ForegroundColor Cyan
$preview = $contentUtf8.Substring(0, [Math]::Min(100, $contentUtf8.Length)).Replace("`n", "↵`n   ")
Write-Host "   $preview" -ForegroundColor Gray
Write-Host ""

# Proposer une correction si nécessaire
if ($hasUtf8Bom -or $hasUtf16LeBom -or $hasUtf16BeBom -or $hasIssues) {
    Write-Host "⚠️  PROBLÈMES DÉTECTÉS!" -ForegroundColor Yellow
    Write-Host ""
    
    if ($hasUtf8Bom -or $hasUtf16LeBom -or $hasUtf16BeBom) {
        Write-Host "   • Encodage incorrect (BOM détecté)" -ForegroundColor Yellow
    }
    
    if ($emptyVars.Count -gt 0) {
        Write-Host "   • Variables vides: $($emptyVars -join ', ')" -ForegroundColor Yellow
    }
    
    if ($missingCritical.Count -gt 0) {
        Write-Host "   • Variables critiques manquantes: $($missingCritical -join ', ')" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Voulez-vous corriger automatiquement l'encodage? (O/N)" -ForegroundColor Cyan
    $response = Read-Host ">"
    
    if ($response -eq "O" -or $response -eq "o") {
        Write-Host ""
        Write-Host "🔧 Correction en cours..." -ForegroundColor Cyan
        
        # Créer un backup
        $backupPath = "$envPath.backup"
        Copy-Item $envPath $backupPath -Force
        Write-Host "   💾 Backup créée: $backupPath" -ForegroundColor Green
        
        # Nettoyer le contenu
        $cleanContent = $contentUtf8
        
        # Enlever le BOM UTF-8
        if ($cleanContent.StartsWith([char]0xFEFF)) {
            $cleanContent = $cleanContent.Substring(1)
        }
        
        # Réécrire en UTF-8 sans BOM
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($envPath, $cleanContent, $utf8NoBom)
        
        Write-Host "   ✅ Fichier réécrit en UTF-8 sans BOM" -ForegroundColor Green
        Write-Host ""
        
        # Re-vérifier
        $newBytes = [System.IO.File]::ReadAllBytes($envPath)
        $newHasUtf8Bom = ($newBytes.Length -ge 3) -and ($newBytes[0] -eq 0xEF) -and ($newBytes[1] -eq 0xBB) -and ($newBytes[2] -eq 0xBF)
        
        if (-not $newHasUtf8Bom) {
            Write-Host "   ✅ Vérification: BOM supprimé avec succès!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Vérification: BOM toujours présent" -ForegroundColor Yellow
        }
    }
    
    if ($emptyVars.Count -gt 0 -or $missingCritical.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠️  ATTENTION: Des secrets sont manquants!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Pour les remplir:" -ForegroundColor Cyan
        Write-Host "   1. Ouvrez le fichier: notepad `"$envPath`"" -ForegroundColor White
        Write-Host "   2. Remplissez les valeurs manquantes" -ForegroundColor White
        Write-Host "   3. Sauvegardez et relancez Actoris" -ForegroundColor White
        Write-Host ""
        Write-Host "Ou utilisez setup-secrets.ps1 pour tout reconfigurer" -ForegroundColor Cyan
    }
} else {
    Write-Host "✅ Aucun problème détecté!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le fichier .env semble correct." -ForegroundColor White
    Write-Host "Si Actoris ne fonctionne toujours pas, vérifiez:" -ForegroundColor Cyan
    Write-Host "   • Que les secrets sont bien remplis" -ForegroundColor White
    Write-Host "   • Que vous avez bien redémarré Actoris" -ForegroundColor White
    Write-Host "   • Les logs du serveur backend" -ForegroundColor White
}

Write-Host ""
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

