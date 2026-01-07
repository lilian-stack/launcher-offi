/**
 * Base de données des vidéos Steam avec correspondances App ID -> Trailer ID
 * Ces IDs sont récupérés manuellement depuis Steam
 */

export const steamVideoDatabase = {
  // Spider-Man 2 - L'exemple que vous avez fourni
  '2166980': {
    trailerId: '257093509',
    name: 'Marvel\'s Spider-Man 2',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/257093509/movie_max.mp4'
  },
  
  // Cyberpunk 2077
  '1091500': {
    trailerId: '256694498',
    name: 'Cyberpunk 2077',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256694498/movie_max.mp4'
  },
  
  // The Witcher 3: Wild Hunt
  '292030': {
    trailerId: '256658589',
    name: 'The Witcher 3: Wild Hunt',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256658589/movie_max.mp4'
  },
  
  // Grand Theft Auto V
  '271590': {
    trailerId: '256658589',
    name: 'Grand Theft Auto V',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256658589/movie_max.mp4'
  },
  
  // Red Dead Redemption 2
  '1174180': {
    trailerId: '256728065',
    name: 'Red Dead Redemption 2',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256728065/movie_max.mp4'
  },
  
  // Elden Ring
  '1245620': {
    trailerId: '256867316',
    name: 'Elden Ring',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256867316/movie_max.mp4'
  },
  
  // God of War
  '1593500': {
    trailerId: '256790956',
    name: 'God of War',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256790956/movie_max.mp4'
  },
  
  // Horizon Zero Dawn
  '1151640': {
    trailerId: '256798983',
    name: 'Horizon Zero Dawn Complete Edition',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256798983/movie_max.mp4'
  },
  
  // Call of Duty: Modern Warfare II
  '1938090': {
    trailerId: '256920264',
    name: 'Call of Duty: Modern Warfare II',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256920264/movie_max.mp4'
  },
  
  // Assassin's Creed Valhalla
  '2208920': {
    trailerId: '256800140',
    name: 'Assassin\'s Creed Valhalla',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/256800140/movie_max.mp4'
  }
}

/**
 * Récupère les informations vidéo pour un App ID Steam
 * @param {string|number} steamAppId - L'ID Steam du jeu
 * @returns {Object|null} Informations de la vidéo ou null
 */
export function getSteamVideoData(steamAppId) {
  if (!steamAppId) return null
  
  const appId = String(steamAppId)
  const videoData = steamVideoDatabase[appId]
  
  if (!videoData) {
    console.warn('[SteamVideoDatabase] Aucune vidéo trouvée pour l\'App ID:', appId)
    return null
  }
  
  return {
    appId: appId,
    trailerId: videoData.trailerId,
    name: videoData.name,
    videoUrl: videoData.videoUrl,
    // Générer les URLs avec timestamp pour éviter le cache
    videoUrlWithTimestamp: `${videoData.videoUrl}?t=${Math.floor(Date.now() / 1000)}`
  }
}

/**
 * Génère une URL de vidéo Steam avec un trailer ID connu
 * @param {string} trailerId - L'ID du trailer Steam
 * @param {string} quality - Qualité de la vidéo ('max', '480')
 * @returns {string} URL de la vidéo
 */
export function generateSteamVideoUrl(trailerId, quality = 'max') {
  const timestamp = Math.floor(Date.now() / 1000)
  return `https://video.akamai.steamstatic.com/store_trailers/${trailerId}/movie_${quality}.mp4?t=${timestamp}`
}

/**
 * Vérifie si un App ID Steam a une vidéo dans la base de données
 * @param {string|number} steamAppId - L'ID Steam du jeu
 * @returns {boolean} true si une vidéo existe
 */
export function hasSteamVideo(steamAppId) {
  if (!steamAppId) return false
  return String(steamAppId) in steamVideoDatabase
}

/**
 * Récupère tous les App IDs disponibles
 * @returns {string[]} Liste des App IDs
 */
export function getAvailableAppIds() {
  return Object.keys(steamVideoDatabase)
}

/**
 * Ajoute une nouvelle entrée à la base de données (pour usage futur)
 * @param {string|number} steamAppId - L'ID Steam du jeu
 * @param {string} trailerId - L'ID du trailer
 * @param {string} name - Nom du jeu
 */
export function addSteamVideoEntry(steamAppId, trailerId, name) {
  const appId = String(steamAppId)
  steamVideoDatabase[appId] = {
    trailerId: trailerId,
    name: name,
    videoUrl: `https://video.akamai.steamstatic.com/store_trailers/${trailerId}/movie_max.mp4`
  }
  console.log('[SteamVideoDatabase] Nouvelle entrée ajoutée:', appId, name)
}