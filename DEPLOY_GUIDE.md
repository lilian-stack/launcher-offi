# Guide de déploiement - Version 1.0.6

## 📋 Prérequis

1. **Token GitHub** : Vous devez avoir un token GitHub avec les permissions `repo` pour créer des releases.
   - Créez un token sur : https://github.com/settings/tokens
   - Définissez la variable d'environnement : `$env:GITHUB_TOKEN = "votre_token"`

2. **GitHub CLI (optionnel mais recommandé)** : Si vous avez `gh` installé, le script l'utilisera automatiquement.
   - Installation : https://cli.github.com/

## 🚀 Déploiement rapide

### Option 1 : Script automatique (recommandé)

```powershell
# Définir le token GitHub
$env:GITHUB_TOKEN = "votre_token_github"

# Lancer le déploiement
.\scripts\deploy-release.ps1 -Version "1.0.6"
```

### Option 2 : Déploiement manuel

1. **Construire l'application** :
   ```powershell
   npm run make:win
   ```

2. **Créer la release GitHub** :
   ```powershell
   .\scripts\release.ps1 -Version "1.0.6" -NotesPath "PATCH_NOTES_1.0.6.md" -AssetPath "release\Actoris-Setup-1.0.6.exe"
   ```

## 📝 Patch Notes

Les patch notes sont disponibles dans `PATCH_NOTES_1.0.6.md` et incluent :

- ✅ Correction de l'erreur "require is not defined"
- ✅ Correction de la connexion Discord
- ✅ Scan automatique des jeux installés
- ✅ Mise à jour automatique de GameDetails

## 🔧 Options du script

```powershell
.\scripts\deploy-release.ps1 `
    -Version "1.0.6" `                    # Version à déployer
    -Owner "lilian-stack" `               # Propriétaire du repo GitHub
    -Repo "launcher-offi" `              # Nom du repository
    -Token "votre_token" `                # Token GitHub (ou via $env:GITHUB_TOKEN)
    -SkipBuild                            # Ignorer la construction (si déjà faite)
```

## ✅ Vérification

Après le déploiement, vérifiez la release sur :
https://github.com/lilian-stack/launcher-offi/releases/tag/v1.0.6

