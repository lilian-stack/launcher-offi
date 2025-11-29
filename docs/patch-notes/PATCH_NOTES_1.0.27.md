# Version 1.0.27 - Corrections critiques et améliorations

**Date** : 2024-12-20

## 🎯 Objectif
Corriger les problèmes critiques d'extraction et améliorer l'installation silencieuse des mises à jour.

## 🐛 Corrections de Bugs Critiques

### Extraction de Jeux
- ✅ **Erreur 7za.exe introuvable** : Correction du problème où `7za.exe` n'était pas accessible dans `app.asar`
- ✅ **Déballage automatique** : `7zip-bin` est maintenant automatiquement déballé de `app.asar` vers `app.asar.unpacked`
- ✅ **Résolution de chemin** : Ajout d'une fonction pour résoudre correctement le chemin de `7za.exe` même dans une application packagée
- ✅ **Gestion d'erreur améliorée** : Messages d'erreur plus clairs si `7za.exe` n'est pas trouvé

### Installation de Mises à Jour
- ✅ **Installation silencieuse** : Les mises à jour s'installent maintenant en mode silencieux sans afficher l'installateur NSIS
- ✅ **Fermeture automatique** : Tous les processus Actoris sont automatiquement fermés avant l'installation
- ✅ **Pas d'interruption** : L'utilisateur n'a plus besoin de fermer manuellement le launcher dans le gestionnaire de tâches

## 🔧 Améliorations Techniques

### Configuration Electron Builder
- ✅ **asarUnpack** : Configuration pour déballer `7zip-bin` de l'archive `app.asar`
- ✅ **Résolution de chemin** : Fonction `get7zipPath()` pour gérer correctement les chemins dans les applications packagées

### Gestion des Processus
- ✅ **Fermeture intelligente** : La fonction `killAllActorisProcesses()` ferme tous les processus sauf le processus actuel
- ✅ **Détection de PID** : Utilisation de `taskkill /PID` pour fermer les processus spécifiques
- ✅ **Attente de fermeture** : Délai de 1 seconde pour s'assurer que tous les processus sont fermés

### Auto-Updater
- ✅ **Mode silencieux** : `quitAndInstall(true, true)` pour une installation complètement silencieuse
- ✅ **Handler IPC** : Nouveau handler `updates:install` pour déclencher l'installation manuellement
- ✅ **Fermeture des fenêtres** : Toutes les fenêtres sont fermées avant l'installation

## 📝 Notes Techniques

### Fichiers Modifiés
- `package.json` : Ajout de `asarUnpack` pour `7zip-bin`
- `electron/game-extractor.js` : Ajout de `get7zipPath()` et correction de la résolution de chemin
- `electron/main.js` : Amélioration de `killAllActorisProcesses()` et ajout de `updates:install`
- `electron/preload.cjs` : Ajout de `updates.install()` dans l'API exposée

### Configuration asarUnpack
```json
"asarUnpack": [
  "node_modules/7zip-bin/**/*"
]
```

### Fonction get7zipPath()
- Détecte si le chemin contient `app.asar`
- Remplace `app.asar` par `app.asar.unpacked` si nécessaire
- Vérifie que le fichier existe avant de l'utiliser
- Retourne une erreur claire si le fichier n'est pas trouvé

## 🚀 Prochaines Étapes

### Court Terme
- Tester le fichier `Actoris-Setup-1.0.27.exe` dans le dossier `release/`
- Vérifier que l'extraction fonctionne correctement
- Vérifier que les mises à jour s'installent en mode silencieux
- Distribuer la mise à jour aux utilisateurs

### Moyen Terme
- Continuer l'amélioration de la gestion des erreurs
- Optimiser les performances d'extraction
- Ajouter plus de formats d'archive supportés

