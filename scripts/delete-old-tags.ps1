# Script pour supprimer tous les tags jusqu'à v1.0.57 (garder uniquement v1.0.58)

Write-Host "🔍 Récupération de tous les tags..." -ForegroundColor Cyan
$allTags = git tag --list

Write-Host "📋 Tags trouvés: $($allTags.Count)" -ForegroundColor Yellow

# Tags à garder (ne pas supprimer)
$keepTags = @("v1.0.58", "1.0.58")

# Liste des tags à supprimer
$tagsToDelete = @()

foreach ($tag in $allTags) {
    # Ignorer les tags à garder
    if ($keepTags -contains $tag) {
        Write-Host "✅ Garde: $tag" -ForegroundColor Green
        continue
    }
    
    # Ignorer les tags "untagged-*"
    if ($tag -like "untagged-*") {
        continue
    }
    
    # Extraire le numéro de version
    $versionMatch = $tag -match "v?1\.0\.(\d+)"
    if ($versionMatch) {
        $versionNumber = [int]$matches[1]
        
        # Supprimer si version <= 57
        if ($versionNumber -le 57) {
            $tagsToDelete += $tag
        }
    }
}

Write-Host "`n🗑️  Tags à supprimer: $($tagsToDelete.Count)" -ForegroundColor Red
$tagsToDelete | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }

Write-Host "`n❓ Confirmer la suppression de ces tags sur GitHub?" -ForegroundColor Yellow
$confirm = Read-Host "Tapez 'oui' pour confirmer"
if ($confirm -ne "oui") {
    Write-Host "❌ Annulé" -ForegroundColor Red
    exit
}

Write-Host "`n🚀 Suppression des tags sur GitHub..." -ForegroundColor Cyan
foreach ($tag in $tagsToDelete) {
    Write-Host "Suppression de $tag..." -ForegroundColor Yellow
    git push origin --delete $tag 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ $tag supprimé" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Erreur pour $tag (peut-être déjà supprimé)" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ Suppression terminée!" -ForegroundColor Green
Write-Host "📋 Tags restants:" -ForegroundColor Cyan
git tag --list | Where-Object { $_ -like "v1.0.58" -or $_ -like "1.0.58" }

