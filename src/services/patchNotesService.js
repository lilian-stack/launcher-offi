export const patchNotesService = {
  getNotes(version) {
    // Personnalisez vos patch notes ici
    if (version === 'v1.0.2') {
      return [
        "Correctif de lancement: suppression de l'import dupliqué de 'path' dans le process principal.",
        "Setup reconstruit (v1.0.2) avec correctifs appliqués.",
        "Amélioration patch notes: encodage UTF‑8 recommandé pour l'affichage des accents sur GitHub.",
      ]
    }
    if (version === 'v1.0.1') {
      return [
        "Refonte du menu utilisateur (style, alignement, compacité).",
        "Badge VIP recoloré pour se distinguer d'Admin.",
        "Connexion Discord OAuth2 + détection des rôles (Admin/VIP/Boost).",
        "Pop-up de mise à jour avec vérification GitHub Releases.",
        "Correctifs d’affichage (cartes, coeurs favoris, top bar).",
        "Améliorations de performances et stabilité UI.",
      ]
    }
    // Valeur par défaut
    return [
      "Améliorations diverses et corrections de bugs.",
    ]
  }
}


