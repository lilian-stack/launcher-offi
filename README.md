# Actoris

Launcher de jeux Electron pour la plateforme Actoris.

**Version** : 1.0.23  
**Statut** : 🟢 Production Ready

## 📁 Structure du projet

```
launcher/
├── electron/          # Code Electron (main process)
├── src/              # Code React (renderer process)
├── public/           # Assets publics
├── scripts/          # Scripts utilitaires
│   ├── deploy/       # Scripts de déploiement
│   ├── migrations/   # Scripts de migration
│   ├── utils/        # Scripts utilitaires
│   └── backups/      # Fichiers de sauvegarde
├── docs/             # Documentation
│   ├── patch-notes/  # Notes de version
│   └── guides/       # Guides de configuration
├── archive/          # Fichiers obsolètes
└── release/          # Builds compilés
```

## 🚀 Démarrage rapide

### Développement
```bash
npm install
npm start
```

### Build
```bash
npm run build
npm run make:win
```

### Déploiement
```bash
npm run release
# ou
.\scripts\deploy\quick-deploy.ps1 -Version "1.0.23"
```

## 📚 Documentation

- **Patch Notes** : `docs/patch-notes/` (dernières versions uniquement)
- **Audit Complet** : `docs/AUDIT_COMPLET.md` (audit complet du projet)
- **Scripts** : `scripts/README.md`
- **Guides** : `docs/guides/` (guides essentiels uniquement)

## 🛠️ Technologies

- **Electron** : Framework desktop
- **React** : Interface utilisateur
- **Vite** : Build tool
- **Tailwind CSS** : Styling
- **Supabase** : Base de données

## 📝 Notes

- Les fichiers de backup sont dans `scripts/backups/`
- Les fichiers obsolètes sont dans `archive/`
- La documentation est organisée dans `docs/`
