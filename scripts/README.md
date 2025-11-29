# Scripts Actoris

## Structure

### 🔄 Migrations
Scripts de migration de base de données et de données
- `migrations/` : Scripts de migration Supabase, SQL, etc.

### 🚀 Déploiement
Scripts de build et de déploiement
- `deploy/` : Scripts PowerShell et shell pour le déploiement

### 🛠️ Utilitaires
Scripts utilitaires et de maintenance
- `utils/` : Scripts de test, calcul, recherche, etc.

### 💾 Backups
Fichiers de sauvegarde
- `backups/` : Backups JSON et autres fichiers de sauvegarde

## Utilisation

### Migration
```bash
node scripts/migrations/migrate-to-supabase.js
```

### Déploiement
```powershell
.\scripts\deploy\quick-deploy.ps1 -Version "1.0.22"
```

### Utilitaires
```bash
node scripts/utils/check-supabase-usage.js
```

