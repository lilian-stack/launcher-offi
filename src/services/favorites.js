// Service de gestion des favoris
const FAVORITES_STORAGE_KEY = 'actoris_favorites'

export const favoritesService = {
  // Récupérer tous les favoris
  getFavorites() {
    try {
      const favoritesStr = localStorage.getItem(FAVORITES_STORAGE_KEY)
      return favoritesStr ? JSON.parse(favoritesStr) : []
    } catch {
      return []
    }
  },

  // Vérifier si un jeu est dans les favoris
  isFavorite(gameId) {
    const favorites = this.getFavorites()
    return favorites.includes(gameId)
  },

  // Ajouter un jeu aux favoris
  addFavorite(gameId) {
    try {
      const favorites = this.getFavorites()
      if (!favorites.includes(gameId)) {
        favorites.push(gameId)
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  // Retirer un jeu des favoris
  removeFavorite(gameId) {
    try {
      const favorites = this.getFavorites()
      const index = favorites.indexOf(gameId)
      if (index > -1) {
        favorites.splice(index, 1)
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  // Toggle favori (ajouter si absent, retirer si présent)
  toggleFavorite(gameId) {
    if (this.isFavorite(gameId)) {
      return this.removeFavorite(gameId)
    } else {
      return this.addFavorite(gameId)
    }
  },
}

