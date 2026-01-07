// Service de cache partagé pour les jeux (utilisé par Catalog, Library, Favorites)
import { gamesMetadataService } from './gamesMetadata.js'

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

    // ✅ FIX RACE CONDITION : Si une requête est déjà en cours, attendre sa résolution
    if (pendingRequest) {
      if (forceRefresh) {
        // Si on force le refresh, on annule l'ancienne requête et on continue
        pendingRequest = null
      } else {
        // Sinon, on attend la requête en cours
        return await pendingRequest
      }
    }

    // ⚡ CRITICAL FIX : Créer un placeholder AVANT l'async pour bloquer les autres appels
    let resolveRequest
    let rejectRequest
    pendingRequest = new Promise((resolve, reject) => {
      resolveRequest = resolve
      rejectRequest = reject
    })

    // Exécuter la vraie requête
    try {
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const data = await window.electron.games.getGames(forceRefresh)
        const games = data.games || []
        
        // ✅ NETTOYER LES JEUX DU CACHE : Réinitialiser tous les champs d'installation
        const cleanedGames = games.map(game => {
          const { isInstalled, hasCrkFile, launcherId, installFolder, executable, executableName, installDate, installedVersion, ...cleanGame } = game
          return {
            ...cleanGame,
            isInstalled: false,
            hasCrkFile: false,
            launcherId: null,
            installFolder: null,
            executable: null,
            executableName: null,
            installDate: null,
            installedVersion: null
          }
        })
        
        // 🎬 ENRICHIR AVEC LES MÉTADONNÉES (vidéos, genres, catégories)
        const enrichedGames = gamesMetadataService.enrichGames(cleanedGames)
        
        // Mettre à jour le cache avec les jeux enrichis
        gamesCache = enrichedGames
        gamesCacheTimestamp = Date.now()
        
        // Résoudre la promesse pour tous les appels en attente
        resolveRequest(enrichedGames)
        pendingRequest = null
        
        return enrichedGames
      }
      
      resolveRequest([])
      pendingRequest = null
      return []
    } catch (err) {
      console.error('[gamesCache] Erreur lors du chargement:', err)
      const fallback = gamesCache || []
      rejectRequest(err)
      pendingRequest = null
      return fallback
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
    pendingRequest = null
  },

  // Vérifier si le cache est valide
  isCacheValid() {
    const now = Date.now()
    return gamesCache && (now - gamesCacheTimestamp) < CACHE_DURATION
  }
}

