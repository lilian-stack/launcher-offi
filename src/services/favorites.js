// Service de gestion des favoris
const FAVORITES_STORAGE_KEY = 'actoris_favorites'

export const favoritesService = {
  // Récupérer tous les favoris (normalisés en string)
  getFavorites() {
    try {
      const favoritesStr = localStorage.getItem(FAVORITES_STORAGE_KEY)
      const favorites = favoritesStr ? JSON.parse(favoritesStr) : []
      // Normaliser tous les IDs en string et supprimer les doublons
      const normalizedFavorites = [...new Set(favorites.map(id => String(id)))]
      
      // Si la normalisation a changé quelque chose, sauvegarder
      if (JSON.stringify(favorites) !== JSON.stringify(normalizedFavorites)) {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalizedFavorites))
      }
      
      return normalizedFavorites
    } catch {
      return []
    }
  },

  // Vérifier si un jeu est dans les favoris
  isFavorite(gameId) {
    const favorites = this.getFavorites()
    return favorites.includes(String(gameId))
  },

  // Ajouter un jeu aux favoris
  addFavorite(gameId) {
    try {
      const normalizedId = String(gameId)
      const favorites = this.getFavorites()
      if (!favorites.includes(normalizedId)) {
        favorites.push(normalizedId)
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
        console.log('[Favorites] ✅ Ajouté:', normalizedId)
        return true
      }
      console.log('[Favorites] ℹ️ Déjà en favori:', normalizedId)
      return false
    } catch (error) {
      console.error('[Favorites] ❌ Erreur ajout:', error)
      return false
    }
  },

  // Retirer un jeu des favoris
  removeFavorite(gameId) {
    try {
      const normalizedId = String(gameId)
      const favorites = this.getFavorites()
      const index = favorites.indexOf(normalizedId)
      if (index > -1) {
        favorites.splice(index, 1)
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
        console.log('[Favorites] ❌ Supprimé:', normalizedId)
        return true
      }
      console.log('[Favorites] ℹ️ Pas en favori:', normalizedId)
      return false
    } catch (error) {
      console.error('[Favorites] ❌ Erreur suppression:', error)
      return false
    }
  },

  // Toggle favori (ajouter si absent, retirer si présent)
  toggleFavorite(gameId) {
    const normalizedId = String(gameId)
    console.log('[Favorites] 🔄 Toggle pour:', normalizedId)
    
    if (this.isFavorite(normalizedId)) {
      return this.removeFavorite(normalizedId)
    } else {
      return this.addFavorite(normalizedId)
    }
  },

  // Nettoyer les favoris (supprimer doublons et normaliser)
  cleanup() {
    try {
      const favorites = this.getFavorites() // Cela normalise déjà
      console.log('[Favorites] 🧹 Nettoyage terminé, favoris:', favorites.length)
      return favorites
    } catch (error) {
      console.error('[Favorites] ❌ Erreur nettoyage:', error)
      return []
    }
  }
}

