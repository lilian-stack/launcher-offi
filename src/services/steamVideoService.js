/**
 * Service pour récupérer les vidéos de jeux depuis Steam API
 */

// Cache pour éviter les appels répétés
const videoCache = new Map()

/**
 * Récupère la vidéo d'un jeu depuis Steam
 * @param {string|number} steamId - ID Steam du jeu
 * @returns {Promise<string|null>} - URL de la vidéo, ou null
 */
export async function getSteamVideo(steamId) {
  if (!steamId) {
    console.warn('[Steam Video] ⚠️ Pas de Steam ID fourni')
    return null
  }

  // Vérifier le cache
  const cacheKey = `steam_video_${steamId}`
  if (videoCache.has(cacheKey)) {
    return videoCache.get(cacheKey)
  }

  try {
    // Utiliser le proxy Electron pour éviter les problèmes CORS
    if (window.electron?.steam?.getGameData) {
      const steamData = await window.electron.steam.getGameData(steamId)
      
      if (steamData) {
        // Steam retourne soit `video` soit `movies`
        const videoUrl = steamData.video || steamData.movies
        
        if (videoUrl) {
          videoCache.set(cacheKey, videoUrl)
          return videoUrl
        }
      }
      
      videoCache.set(cacheKey, null)
      return null
    }
    
    return null
    
  } catch (error) {
    console.error('[Steam Video] ❌ Erreur:', error.message)
    videoCache.set(cacheKey, null)
    return null
  }
}

/**
 * Vide le cache des vidéos
 */
export function clearVideoCache() {
  videoCache.clear()
}
