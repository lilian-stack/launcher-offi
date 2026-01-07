// Service de cache partagé pour les jeux (utilisé par Catalog, Library, Favorites)
let gamesCache = null
let gamesCacheTimestamp = 0
const CACHE_DURATION = 300000 // 5 minutes (augmenté pour réduire les appels)
let pendingRequest = null // Requête en cours pour éviter les appels multiples

export const gamesCacheService = {
  // Obtenir les jeux depuis le cache ou charger depuis l'API
  async getGames(forceRefresh = false) {
    const now = Date.now()
    
    // Si le cache est valide et qu'on ne force pas le refresh
    if (!forceRefresh && gamesCache && (now - gamesCacheTimestamp) < CACHE_DURATION) {
      return gamesCache
    }

    // Si une requête est déjà en cours, attendre sa résolution
    if (pendingRequest && !forceRefresh) {
      return await pendingRequest
    }

    // Créer une nouvelle requête
    pendingRequest = (async () => {
      try {
        if (window.electron && window.electron.games && window.electron.games.getGames) {
          const data = await window.electron.games.getGames(forceRefresh)
          const games = data.games || []
          
          
          // Mettre à jour le cache
          gamesCache = games
          gamesCacheTimestamp = Date.now()
          
          // Réinitialiser la requête en cours
          pendingRequest = null
          
          return games
        }
        pendingRequest = null
        return []
      } catch (err) {
        console.error('[gamesCache] Erreur lors du chargement:', err)
        // Réinitialiser la requête en cours
        pendingRequest = null
        // Retourner le cache existant en cas d'erreur
        return gamesCache || []
      }
    })()

    return await pendingRequest
  },

  // Obtenir le cache actuel sans faire de requête
  getCachedGames() {
    return gamesCache || []
  },

  // Vider le cache
  clearCache() {
    gamesCache = null
    gamesCacheTimestamp = 0
    pendingRequest = null
  },

  // Vérifier si le cache est valide
  isCacheValid() {
    const now = Date.now()
    return gamesCache && (now - gamesCacheTimestamp) < CACHE_DURATION
  }
}

