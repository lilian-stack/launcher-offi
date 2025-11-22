## v1.0.6

### 🔧 Corrections de bugs
- **Correction de l'erreur "require is not defined"** : Remplacement des appels `require()` par des imports ES6 dans `main.js` pour la désinstallation des jeux
- **Correction des caractères parasites** : Suppression des caractères 'z' erronés dans `game-extractor.js`
- **Correction de la connexion Discord** : Résolution de l'erreur de conversion d'URL lors de l'authentification Discord OAuth2

### ✨ Nouvelles fonctionnalités
- **Scan automatique des jeux installés** : 
  - Scan automatique au lancement du launcher
  - Scan automatique lors de la navigation vers les pages Accueil, Bibliothèque et Catalogue
  - Mise à jour automatique de la page GameDetails quand un jeu est détecté
  - Le bouton passe automatiquement de "Télécharger" à "Lancer" quand un jeu est installé

### 🎯 Améliorations
- **Meilleure synchronisation des jeux installés** : La page GameDetails se met à jour automatiquement sans rechargement
- **Scan forcé pour éviter le cache** : Les scans automatiques forcent le rafraîchissement pour avoir les données à jour
- **Gestion améliorée des erreurs Discord** : Meilleure gestion des erreurs lors de la connexion Discord avec validation des URLs

