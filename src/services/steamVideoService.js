/**
 * Service pour récupérer les URLs de vidéos Steam
 * Exemple: https://video.akamai.steamstatic.com/store_trailers/257093509/movie_max.mp4?t=1738262051
 */

import { getSteamVideoData, generateSteamVideoUrl, hasSteamVideo } from './steamVideoDatabase.js'

class SteamVideoService {
  constructor() {
    this.cache = new Map()
    this.baseUrl = 'https://video.akamai.steamstatic.com/store_trailers'
  }

  /**
   * Récupère l'URL de la vidéo Steam pour un jeu
   * @param {string|number} steamAppId - L'ID Steam du jeu
   * @param {string} quality - Qualité de la vidéo ('max', '480', etc.)
   * @returns {string|null} URL de la vidéo ou null si non trouvée
   */
  getSteamVideoUrl(steamAppId, quality = 'max') {
    if (!steamAppId) return null

    const cacheKey = `${steamAppId}_${quality}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      // Générer un timestamp pour éviter le cache
      const timestamp = Math.floor(Date.now() / 1000)
      
      // Format de l'URL Steam: https://video.akamai.steamstatic.com/store_trailers/{TRAILER_ID}/movie_{quality}.mp4?t={timestamp}
      // Le TRAILER_ID est généralement différent de l'APP_ID Steam
      // Pour l'instant, on utilise l'APP_ID comme fallback
      const videoUrl = `${this.baseUrl}/${steamAppId}/movie_${quality}.mp4?t=${timestamp}`
      
      this.cache.set(cacheKey, videoUrl)
      return videoUrl
    } catch (error) {
      console.error('[SteamVideoService] Erreur génération URL:', error)
      return null
    }
  }

  /**
   * Récupère les informations de vidéo depuis l'API Steam Store
   * @param {string|number} steamAppId - L'ID Steam du jeu
   * @returns {Promise<Object|null>} Informations de la vidéo ou null
   */
  async getSteamVideoInfo(steamAppId) {
    if (!steamAppId) return null

    try {
      // API Steam Store pour récupérer les détails du jeu
      const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${steamAppId}&l=french`)
      
      if (!response.ok) {
        console.warn('[SteamVideoService] Réponse API Steam non OK:', response.status)
        return null
      }

      const data = await response.json()
      const gameData = data[steamAppId]

      if (!gameData || !gameData.success || !gameData.data) {
        console.warn('[SteamVideoService] Données Steam invalides pour:', steamAppId)
        return null
      }

      const movies = gameData.data.movies
      if (!movies || !Array.isArray(movies) || movies.length === 0) {
        console.warn('[SteamVideoService] Aucune vidéo trouvée pour:', steamAppId)
        return null
      }

      // Prendre la première vidéo (généralement le trailer principal)
      const firstMovie = movies[0]
      
      return {
        id: firstMovie.id,
        name: firstMovie.name,
        thumbnail: firstMovie.thumbnail,
        webm: firstMovie.webm,
        mp4: firstMovie.mp4,
        highlight: firstMovie.highlight || false
      }
    } catch (error) {
      console.error('[SteamVideoService] Erreur API Steam:', error)
      return null
    }
  }

  /**
   * Récupère l'URL de vidéo optimale depuis l'API Steam
   * @param {string|number} steamAppId - L'ID Steam du jeu
   * @param {string} format - Format préféré ('mp4' ou 'webm')
   * @param {string} quality - Qualité préférée ('max', '480')
   * @returns {Promise<string|null>} URL de la vidéo ou null
   */
  async getSteamVideoUrlFromAPI(steamAppId, format = 'mp4', quality = 'max') {
    const videoInfo = await this.getSteamVideoInfo(steamAppId)
    
    if (!videoInfo) return null

    try {
      // Priorité au format demandé
      const formatData = videoInfo[format]
      if (formatData && formatData[quality]) {
        return formatData[quality]
      }

      // Fallback sur d'autres qualités du même format
      if (formatData) {
        if (formatData['480']) return formatData['480']
        if (formatData['max']) return formatData['max']
      }

      // Fallback sur l'autre format
      const otherFormat = format === 'mp4' ? 'webm' : 'mp4'
      const otherFormatData = videoInfo[otherFormat]
      if (otherFormatData) {
        if (otherFormatData[quality]) return otherFormatData[quality]
        if (otherFormatData['480']) return otherFormatData['480']
        if (otherFormatData['max']) return otherFormatData['max']
      }

      return null
    } catch (error) {
      console.error('[SteamVideoService] Erreur extraction URL:', error)
      return null
    }
  }

  /**
   * Extrait l'ID Steam depuis différents formats d'URL ou de données
   * @param {Object} game - Objet jeu avec potentiellement des données Steam
   * @returns {string|null} ID Steam ou null
   */
  extractSteamId(game) {
    if (!game) return null

    // Vérifier les champs directs
    if (game.steam_id) return String(game.steam_id)
    if (game.steamId) return String(game.steamId)
    if (game.steam_app_id) return String(game.steam_app_id)
    if (game.steamAppId) return String(game.steamAppId)

    // Vérifier dans les URLs Steam
    const steamUrlFields = [
      game.steam_url,
      game.steamUrl,
      game.store_url,
      game.storeUrl,
      game.url
    ]

    for (const url of steamUrlFields) {
      if (url && typeof url === 'string') {
        const steamId = this.extractSteamIdFromUrl(url)
        if (steamId) return steamId
      }
    }

    return null
  }

  /**
   * Extrait l'ID Steam depuis une URL Steam
   * @param {string} url - URL Steam
   * @returns {string|null} ID Steam ou null
   */
  extractSteamIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null

    try {
      // Patterns pour les URLs Steam
      const patterns = [
        /store\.steampowered\.com\/app\/(\d+)/,
        /steamcommunity\.com\/app\/(\d+)/,
        /steam:\/\/store\/(\d+)/
      ]

      for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match && match[1]) {
          return match[1]
        }
      }

      return null
    } catch (error) {
      console.error('[SteamVideoService] Erreur extraction ID depuis URL:', error)
      return null
    }
  }

  /**
   * Récupère l'URL de vidéo pour un jeu (méthode principale)
   * @param {Object} game - Objet jeu
   * @param {Object} options - Options de récupération
   * @returns {Promise<string|null>} URL de la vidéo ou null
   */
  async getVideoUrlForGame(game, options = {}) {
    const {
      format = 'mp4',
      quality = 'max',
      useAPI = false, // Désactivé par défaut à cause des restrictions CORS
      fallbackToGenerated = true,
      useDatabase = true // Nouvelle option pour utiliser la base de données
    } = options

    const steamId = this.extractSteamId(game)
    if (!steamId) {
      console.warn('[SteamVideoService] Aucun ID Steam trouvé pour:', game.name || game.title)
      return null
    }

    console.log('[SteamVideoService] ID Steam trouvé:', steamId, 'pour', game.name || game.title)

    // Méthode 1: Utiliser la base de données de correspondances (plus fiable)
    if (useDatabase) {
      try {
        const videoData = getSteamVideoData(steamId)
        if (videoData) {
          console.log('[SteamVideoService] ✅ Vidéo trouvée dans la base de données:', videoData.videoUrlWithTimestamp)
          return videoData.videoUrlWithTimestamp
        }
      } catch (error) {
        console.warn('[SteamVideoService] Erreur base de données, fallback vers API:', error)
      }
    }

    // Méthode 2: Utiliser l'API Steam (désactivé par défaut à cause de CORS)
    if (useAPI) {
      try {
        const apiUrl = await this.getSteamVideoUrlFromAPI(steamId, format, quality)
        if (apiUrl) {
          console.log('[SteamVideoService] ✅ URL vidéo trouvée via API:', apiUrl)
          return apiUrl
        }
      } catch (error) {
        console.warn('[SteamVideoService] Erreur API, fallback vers génération:', error)
      }
    }

    // Méthode 3: Générer l'URL (moins fiable mais plus rapide)
    if (fallbackToGenerated) {
      const generatedUrl = this.getSteamVideoUrl(steamId, quality)
      if (generatedUrl) {
        console.log('[SteamVideoService] ⚡ URL vidéo générée:', generatedUrl)
        return generatedUrl
      }
    }

    return null
  }

  /**
   * Vérifie si un jeu a une vidéo Steam disponible
   * @param {Object} game - Objet jeu
   * @returns {boolean} true si une vidéo est disponible
   */
  hasVideoForGame(game) {
    const steamId = this.extractSteamId(game)
    if (!steamId) return false
    
    return hasSteamVideo(steamId)
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Teste si une URL de vidéo est accessible
   * @param {string} videoUrl - URL de la vidéo à tester
   * @returns {Promise<boolean>} true si accessible, false sinon
   */
  async testVideoUrl(videoUrl) {
    if (!videoUrl) return false

    try {
      const response = await fetch(videoUrl, { method: 'HEAD' })
      return response.ok
    } catch (error) {
      console.warn('[SteamVideoService] URL vidéo non accessible:', videoUrl)
      return false
    }
  }
}

// Instance singleton
const steamVideoService = new SteamVideoService()

export { steamVideoService }
export default steamVideoService