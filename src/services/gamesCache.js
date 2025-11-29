// Service de cache partagé pour les jeux (utilisé par Catalog, Library, Favorites)
let gamesCache = null
let gamesCacheTimestamp = 0
const CACHE_DURATION = 60000 // 60 secondes

export const gamesCacheService = {
  // Obtenir les jeux depuis le cache ou charger depuis l'API
  async getGames(forceRefresh = false) {
    const now = Date.now()
    
    // Si le cache est valide et qu'on ne force pas le refresh
    if (!forceRefresh && gamesCache && (now - gamesCacheTimestamp) < CACHE_DURATION) {
      return gamesCache
    }

    // Charger depuis l'API
    try {
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const data = await window.electron.games.getGames()
        const games = data.games || []
        
        // Mettre à jour le cache
        gamesCache = games
        gamesCacheTimestamp = now
        
        return games
      }
      return []
    } catch (err) {
      console.error('[gamesCache] Erreur lors du chargement:', err)
      // Retourner le cache existant en cas d'erreur
      return gamesCache || []
    }
  },

  // Obtenir le cache actuel sans faire de requête
  getCachedGames() {
    return gamesCache || []
  },

  // Vider le cache
  clearCache() {
    gamesCache = null
    gamesCacheTimestamp = 0
  },

  // Vérifier si le cache est valide
  isCacheValid() {
    const now = Date.now()
    return gamesCache && (now - gamesCacheTimestamp) < CACHE_DURATION
  }
}

