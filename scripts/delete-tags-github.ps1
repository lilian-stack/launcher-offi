# Script pour supprimer tous les tags jusqu'à v1.0.57 sur GitHub

# Liste de tous les tags à supprimer (de 1.0.1 à 1.0.57)
$tagsToDelete = @(
    "v1.0.1", "1.0.1",
    "v1.0.4", "1.0.4",
    "v1.0.5", "1.0.5",
    "v1.0.6", "1.0.6",
    "v1.0.7", "1.0.7",
    "v1.0.8", "1.0.8",
    "v1.0.9", "1.0.9",
    "v1.0.10", "1.0.10",
    "v1.0.11", "1.0.11",
    "v1.0.12", "1.0.12",
    "v1.0.13", "1.0.13",
    "v1.0.14", "1.0.14",
    "v1.0.15", "1.0.15",
    "v1.0.16", "1.0.16",
    "v1.0.17", "1.0.17",
    "v1.0.18", "1.0.18",
    "v1.0.19", "1.0.19",
    "v1.0.20", "1.0.20",
    "v1.0.21", "1.0.21",
    "v1.0.22", "1.0.22",
    "v1.0.23", "1.0.23",
    "v1.0.24", "1.0.24",
    "v1.0.25", "1.0.25",
    "v1.0.26", "1.0.26",
    "v1.0.27", "1.0.27",
    "v1.0.28", "1.0.28",
    "v1.0.29", "1.0.29",
    "v1.0.30", "1.0.30",
    "v1.0.32", "1.0.32",
    "v1.0.33", "1.0.33",
    "v1.0.35", "1.0.35",
    "v1.0.36", "1.0.36",
    "v1.0.37", "1.0.37",
    "v1.0.38", "1.0.38",
    "v1.0.39", "1.0.39",
    "v1.0.40", "1.0.40",
    "v1.0.41", "1.0.41",
    "v1.0.42", "1.0.42",
    "v1.0.43", "1.0.43",
    "v1.0.44", "1.0.44",
    "v1.0.45", "1.0.45",
    "v1.0.46", "1.0.46",
    "v1.0.47", "1.0.47",
    "v1.0.48", "1.0.48",
    "v1.0.49", "1.0.49",
    "v1.0.50", "1.0.50",
    "v1.0.51", "1.0.51",
    "v1.0.52", "1.0.52",
    "v1.0.53", "1.0.53",
    "v1.0.54", "1.0.54",
    "v1.0.55", "1.0.55",
    "v1.0.56", "1.0.56",
    "v1.0.57", "1.0.57"
)

Write-Host "🗑️  Suppression de $($tagsToDelete.Count) tags sur GitHub..." -ForegroundColor Cyan
Write-Host "✅ La version 1.0.58 sera conservée" -ForegroundColor Green
Write-Host ""

$successCount = 0
$errorCount = 0

foreach ($tag in $tagsToDelete) {
    Write-Host "Suppression de $tag..." -NoNewline
    $result = git push origin --delete $tag 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅" -ForegroundColor Green
        $successCount++
    } else {
        # Vérifier si c'est parce que le tag n'existe pas
        if ($result -like "*does not exist*" -or $result -like "*not found*") {
            Write-Host " ⚠️  (n'existe pas)" -ForegroundColor Yellow
        } else {
            Write-Host " ❌ Erreur" -ForegroundColor Red
            Write-Host "   $result" -ForegroundColor Red
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "Termine!" -ForegroundColor Green
Write-Host "   Succes: $successCount" -ForegroundColor Green
$errorColor = if ($errorCount -eq 0) { "Green" } else { "Red" }
Write-Host "   Erreurs: $errorCount" -ForegroundColor $errorColor
Write-Host ""
Write-Host "Verifiez sur GitHub: https://github.com/lilian-stack/launcher-offi/releases" -ForegroundColor Cyan

