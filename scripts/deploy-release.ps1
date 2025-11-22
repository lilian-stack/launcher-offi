# Script de déploiement complet pour GitHub Release
param(
    [string]$Version = "1.0.6",
    [string]$Owner = "lilian-stack",
    [string]$Repo = "launcher-offi",
    [string]$Token = $env:GITHUB_TOKEN,
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = 'Stop'

function Fail($msg) { 
    Write-Host "❌ ERREUR: $msg" -ForegroundColor Red
    exit 1 
}

function Success($msg) {
    Write-Host "✅ $msg" -ForegroundColor Green
}

function Info($msg) {
    Write-Host "ℹ️  $msg" -ForegroundColor Cyan
}

# Vérifier le token GitHub
if ([string]::IsNullOrWhiteSpace($Token)) {
    Fail "Token GitHub manquant. Définissez la variable d'environnement GITHUB_TOKEN ou passez -Token."
}

# Aller dans le répertoire racine
$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
Push-Location (Join-Path $scriptDir "..") | Out-Null

try {
    Info "🚀 Déploiement de la version $Version"
    
    # 1. Vérifier que package.json est à jour
    $pkgPath = "package.json"
    if (!(Test-Path $pkgPath)) {
        Fail "package.json introuvable"
    }
    
    $pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
    if ($pkgJson.version -ne $Version) {
        Info "Mise à jour de la version dans package.json vers $Version"
        $pkgJson.version = $Version
        $pkgJson | ConvertTo-Json -Depth 10 | Out-File -Encoding UTF8 $pkgPath
        Success "Version mise à jour dans package.json"
    }
    
    # 2. Vérifier que les patch notes existent
    $notesFile = "PATCH_NOTES_$Version.md"
    if (!(Test-Path $notesFile)) {
        Fail "Fichier de patch notes introuvable: $notesFile"
    }
    $notes = Get-Content $notesFile -Raw
    Success "Patch notes trouvées: $notesFile"
    
    # 3. Build de l'application (si pas skip)
    if (!$SkipBuild) {
        Info "🔨 Construction de l'application..."
        
        # Vérifier si make:win existe dans package.json
        $scripts = $pkgJson.scripts
        if ($scripts.'make:win') {
            npm run make:win
            if ($LASTEXITCODE -ne 0) {
                Fail "Échec de la construction de l'application"
            }
        } else {
            Info "Script make:win non trouvé, construction avec electron-builder..."
            npx electron-builder --win
            if ($LASTEXITCODE -ne 0) {
                Fail "Échec de la construction avec electron-builder"
            }
        }
        Success "Application construite avec succès"
    } else {
        Info "⏭️  Construction ignorée (SkipBuild activé)"
    }
    
    # 4. Vérifier que le fichier de release existe
    $assetPath = "release\Actoris-Setup-$Version.exe"
    if (!(Test-Path $assetPath)) {
        Fail "Fichier de release introuvable: $assetPath. Assurez-vous que l'application a été construite."
    }
    $assetSize = (Get-Item $assetPath).Length / 1MB
    Success "Fichier de release trouvé: $assetPath ($([math]::Round($assetSize, 2)) MB)"
    
    # 5. Créer la release GitHub
    Info "📦 Création de la release GitHub..."
    
    # Vérifier si gh CLI est disponible
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if ($gh) {
        Info "Utilisation de GitHub CLI (gh)..."
        $tag = "v$Version"
        
        # Créer la release avec gh
        & gh release create $tag $assetPath `
            --title $tag `
            --notes-file $notesFile `
            --repo "$Owner/$Repo" `
            --latest
        
        if ($LASTEXITCODE -ne 0) {
            Fail "Échec de la création de la release avec gh CLI"
        }
        
        Success "Release créée avec succès: https://github.com/$Owner/$Repo/releases/tag/$tag"
    } else {
        Info "GitHub CLI non trouvé, utilisation de l'API GitHub..."
        
        $headers = @{
            Authorization = "token $Token"
            Accept        = "application/vnd.github+json"
            'User-Agent'  = 'actoris-launcher-deploy'
        }
        
        $tag = "v$Version"
        
        # Créer la release
        $payload = @{
            tag_name         = $tag
            target_commitish = "main"
            name             = $tag
            body             = $notes
            draft            = $false
            prerelease       = $false
        } | ConvertTo-Json -Depth 10 -Compress
        
        try {
            $release = Invoke-RestMethod `
                -Method POST `
                -Uri "https://api.github.com/repos/$Owner/$Repo/releases" `
                -Headers $headers `
                -ContentType 'application/json; charset=utf-8' `
                -Body $payload
            
            Success "Release créée: $($release.html_url)"
            
            # Uploader l'asset
            Info "📤 Upload de l'asset..."
            $uploadUrl = $release.upload_url -replace "\{.*\}", ""
            $assetName = [System.Web.HttpUtility]::UrlEncode((Split-Path $assetPath -Leaf))
            
            $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $assetPath))
            $fileEnc = [System.Text.Encoding]::GetEncoding('ISO-8859-1').GetString($fileBytes)
            $boundary = [System.Guid]::NewGuid().ToString()
            $LF = "`r`n"
            
            $bodyLines = (
                "--$boundary",
                "Content-Disposition: form-data; name=`"file`"; filename=`"$assetName`"",
                "Content-Type: application/octet-stream$LF",
                $fileEnc,
                "--$boundary--$LF"
            ) -join $LF
            
            $uploadHeaders = @{
                Authorization = "token $Token"
                'User-Agent' = 'actoris-launcher-deploy'
            }
            
            Invoke-RestMethod `
                -Method POST `
                -Uri "$uploadUrl?name=$assetName" `
                -Headers $uploadHeaders `
                -ContentType "multipart/form-data; boundary=$boundary" `
                -Body ([System.Text.Encoding]::GetEncoding('ISO-8859-1').GetBytes($bodyLines))
            
            Success "Asset uploadé avec succès"
            Success "Release disponible: $($release.html_url)"
        } catch {
            Fail "Erreur lors de la création de la release: $_"
        }
    }
    
    Success "🎉 Déploiement terminé avec succès!"
    Info "Release: https://github.com/$Owner/$Repo/releases/tag/v$Version"
    
} catch {
    Fail "Erreur lors du déploiement: $_"
} finally {
    Pop-Location | Out-Null
}

