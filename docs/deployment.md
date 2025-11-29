# Guide de Déploiement

Ce guide explique comment déployer automatiquement les mises à jour du launcher sur GitHub.

## 🚀 Déploiement Automatique

Le script de release (`npm run release`) effectue automatiquement :

1. **Build du frontend** (Vite)
2. **Build Electron** (Windows installer)
3. **Publication sur GitHub** (création de release + upload du .exe)

## 📋 Prérequis

### Token GitHub

Pour publier sur GitHub, vous devez avoir un token d'accès GitHub avec les permissions suivantes :
- `repo` (accès complet aux repositories)

#### Créer un token GitHub

1. Allez sur https://github.com/settings/tokens
2. Cliquez sur "Generate new token" → "Generate new token (classic)"
3. Donnez un nom au token (ex: "Actoris Launcher Releases")
4. Sélectionnez la permission `repo`
5. Cliquez sur "Generate token"
6. **Copiez le token** (il ne sera affiché qu'une seule fois)

#### Configurer le token

**Option 1 : Variable d'environnement (recommandé)**

Windows (PowerShell) :
```powershell
$env:GITHUB_TOKEN="votre_token_ici"
```

Windows (CMD) :
```cmd
set GITHUB_TOKEN=votre_token_ici
```

Linux/Mac :
```bash
export GITHUB_TOKEN="votre_token_ici"
```

**Option 2 : Fichier de configuration**

Modifiez `electron/github-config.js` et ajoutez votre token :
```javascript
export const GITHUB_CONFIG = {
  TOKEN: 'votre_token_ici',
  // ...
}
```

⚠️ **Attention** : Ne commitez jamais le token dans le repository ! Utilisez une variable d'environnement ou un fichier `.env` (qui est dans `.gitignore`).

### Repository GitHub

Par défaut, le script publie sur `lilian-stack/launcher`. 

Pour changer le repository, définissez la variable d'environnement `GITHUB_REPO` :

```bash
export GITHUB_REPO="nom-du-repo"
```

## 📦 Utilisation

### Créer une nouvelle release

```bash
npm run release
```

Le script va :
1. Incrémenter la version dans `package.json` (si nécessaire)
2. Builder le frontend
3. Créer l'installer Windows
4. Publier sur GitHub avec les patch notes

### Étapes manuelles

Si vous préférez faire les étapes séparément :

```bash
# 1. Build frontend
npm run build

# 2. Build Electron
npm run make:win

# 3. Publier sur GitHub (optionnel)
node scripts/deploy/github-release.js 1.0.24 release/Actoris-Setup-1.0.24.exe
```

## 📝 Patch Notes

Les patch notes sont automatiquement chargées depuis `docs/patch-notes/PATCH_NOTES_<VERSION>.md` et incluses dans la release GitHub.

Si le fichier n'existe pas, un message par défaut sera utilisé.

## 🔍 Dépannage

### Erreur : "GITHUB_TOKEN n'est pas défini"

➡️ Configurez le token GitHub (voir section "Prérequis")

### Erreur : "Repository not found"

➡️ Vérifiez que :
- Le repository existe sur GitHub
- Le token a les permissions `repo`
- Le nom du repository est correct (variable `GITHUB_REPO`)

### Erreur : "Aucun fichier .exe trouvé"

➡️ Vérifiez que le build Electron s'est terminé correctement et que le fichier .exe est dans le dossier `release/`

## ✅ Vérification

Après le déploiement, vérifiez :

1. **GitHub Releases** : https://github.com/lilian-stack/launcher/releases
2. **Fichier .exe** : Le fichier doit être téléchargeable depuis la release
3. **Patch Notes** : Les notes doivent être affichées dans la description de la release

## 🔒 Sécurité

- ⚠️ Ne commitez jamais les tokens dans le code
- ✅ Utilisez des variables d'environnement
- ✅ Utilisez des tokens avec des permissions minimales nécessaires
- ✅ Régénérez les tokens régulièrement

