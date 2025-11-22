## v1.0.8

### ⚡ Optimisations
- **Réduction de la taille de l'installateur** : Optimisation maximale de la compression
  - Taille réduite de 99 MB à 84 MB (réduction de ~15%)
  - Compression maximale NSIS activée
  - Optimisation avancée du code JavaScript avec Terser (3 passes)
  - Suppression des scripts et mots-clés inutiles du package

### 🔧 Corrections de bugs critiques
- **Correction du téléchargement des mises à jour** : Le téléchargement des mises à jour affiche maintenant la progression en temps réel
  - Ajout d'une barre de progression visuelle pendant le téléchargement
  - Affichage de la taille téléchargée et totale
  - Timeout augmenté à 2 minutes pour les gros fichiers

### ✨ Nouvelles fonctionnalités
- **Installation automatique après téléchargement** : 
  - Bouton "Installer maintenant" dans les patch notes après téléchargement
  - Le launcher se ferme automatiquement après avoir lancé l'installateur
  - Possibilité de reporter l'installation à plus tard

### 🎯 Améliorations
- **Configuration electron-builder** : 
  - Suppression automatique des données de l'application lors de la désinstallation
  - Meilleure gestion des mises à jour pour éviter les installations multiples
- **Meilleure expérience utilisateur** : 
  - Progression du téléchargement visible en temps réel
  - Messages d'état plus clairs pendant le téléchargement

