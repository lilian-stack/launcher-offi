## v1.0.7

### 🔧 Corrections de bugs critiques
- **Correction du chargement de l'application** : Résolution du problème "Not allowed to load local resource: index.htm" qui empêchait le launcher de démarrer correctement
  - Utilisation de `app.getAppPath()` au lieu de `__dirname` pour gérer correctement les archives asar en production
  - Ajout de vérifications et de logs pour diagnostiquer les problèmes de chargement
  - Configuration améliorée d'electron-builder pour un packaging correct

### 🎯 Améliorations
- **Configuration electron-builder** : Ajout d'une configuration complète dans `package.json` pour garantir un packaging correct des fichiers
- **Meilleure gestion des chemins** : Amélioration de la détection et du chargement des fichiers en environnement packagé

