/**
 * Service pour récupérer les trailers de jeux depuis YouTube
 */

// Clé API YouTube (à configurer dans les variables d'environnement)
const YOUTUBE_API_KEY = 'AIzaSyDIzwRgM-gzjgzJ6URQriaOOwMReNxWjjI' // Clé API directe

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search'

// Cache des vidéos par jeu
const videoCache = new Map()

/**
 * Récupère l'URL de la vidéo YouTube pour un jeu
 * @param {string} gameName - Nom du jeu
 * @returns {Promise<string|null>} - ID de la vidéo YouTube ou null
 */
export async function getYouTubeTrailer(gameName) {
  if (!gameName) return null

  // Vérifier le cache
  if (videoCache.has(gameName)) {
    return videoCache.get(gameName)
  }

  try {
    // Rechercher d'abord en français
    let videoId = await searchYouTubeVideo(gameName, 'fr')
    
    // Si pas trouvé en français, chercher en anglais
    if (!videoId) {
      videoId = await searchYouTubeVideo(gameName, 'en')
    }

    if (videoId) {
      videoCache.set(gameName, videoId)
      return videoId
    }

    videoCache.set(gameName, null)
    return null
  } catch (error) {
    console.error('[YouTube] ❌ Erreur:', error.message)
    return null
  }
}

/**
 * Recherche une vidéo YouTube pour un jeu dans une langue donnée
 * @param {string} gameName - Nom du jeu
 * @param {string} language - Code langue (fr, en, etc.)
 * @returns {Promise<string|null>} - ID de la vidéo YouTube ou null
 */
async function searchYouTubeVideo(gameName, language = 'fr') {
  try {
    // Construire la requête de recherche selon la langue
    const searchQuery = language === 'fr' 
      ? `${gameName} bande annonce officielle`
      : `${gameName} official trailer`

    const params = new URLSearchParams({
      part: 'snippet',
      q: searchQuery,
      type: 'video',
      maxResults: 3, // Récupérer les 3 premiers résultats
      key: YOUTUBE_API_KEY,
      relevanceLanguage: language,
      safeSearch: 'none',
      videoEmbeddable: 'true', // Uniquement les vidéos embarquables
      order: 'relevance'
    })

    const url = `${YOUTUBE_API_URL}?${params.toString()}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('[YouTube] ❌ API Error:', response.status)
      return null
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return null
    }

    // Filtrer pour trouver le meilleur trailer
    const trailer = findBestTrailer(data.items, gameName)
    
    if (trailer) {
      return trailer.id.videoId
    }

    return null
  } catch (error) {
    console.error('[YouTube] ❌ Erreur:', error.message)
    return null
  }
}

/**
 * Trouve le meilleur trailer parmi les résultats
 * @param {Array} items - Résultats de recherche YouTube
 * @param {string} gameName - Nom du jeu
 * @returns {Object|null} - Meilleur résultat ou null
 */
function findBestTrailer(items, gameName) {
  if (!items || items.length === 0) return null

  // Mots-clés prioritaires (par ordre de priorité)
  const keywords = {
    officialTrailer: ['official trailer', 'bande annonce officielle', 'trailer officiel'],
    announcement: ['announcement trailer', 'reveal trailer', 'teaser'],
    gameplay: ['gameplay trailer', 'trailer de gameplay']
  }

  // Nettoyer le nom du jeu pour la comparaison
  const cleanGameName = gameName.toLowerCase().replace(/[®™©]/g, '').trim()

  // 1. Chercher un trailer officiel
  for (const item of items) {
    const title = item.snippet.title.toLowerCase()
    const channelTitle = item.snippet.channelTitle.toLowerCase()
    
    // Vérifier si le titre contient le nom du jeu
    if (!title.includes(cleanGameName)) continue

    // Priorité 1: Official trailer
    for (const keyword of keywords.officialTrailer) {
      if (title.includes(keyword)) {
        return item
      }
    }
  }

  // 2. Chercher un trailer d'annonce
  for (const item of items) {
    const title = item.snippet.title.toLowerCase()
    
    if (!title.includes(cleanGameName)) continue

    for (const keyword of keywords.announcement) {
      if (title.includes(keyword)) {
        return item
      }
    }
  }

  // 3. Chercher un trailer de gameplay
  for (const item of items) {
    const title = item.snippet.title.toLowerCase()
    
    if (!title.includes(cleanGameName)) continue

    for (const keyword of keywords.gameplay) {
      if (title.includes(keyword)) {
        return item
      }
    }
  }

  // 4. Si aucun résultat prioritaire, prendre le premier qui contient le nom du jeu
  for (const item of items) {
    const title = item.snippet.title.toLowerCase()
    if (title.includes(cleanGameName)) {
      return item
    }
  }

  // 5. En dernier recours, prendre le premier résultat
  return items[0]
}

/**
 * Nettoie le cache des vidéos
 */
export function clearYouTubeCache() {
  videoCache.clear()
}
