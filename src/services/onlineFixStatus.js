// Service pour vérifier si un jeu est disponible sur online-fix.me

let onlineFixMap = null
let onlineFixGamesList = null
let isLoaded = false

// Fonction pour normaliser un nom de jeu (pour comparaison)
function normalizeGameName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Enlever la ponctuation
    .replace(/\s+/g, ' ') // Espaces multiples -> un seul
    .replace(/^(the|a|an|le|la|les|un|une|des)\s+/i, '') // Enlever les articles
    .trim()
}

// Fonction pour comparer deux noms de jeux (tolérance aux variations)
function gamesMatch(gameName1, gameName2) {
  const norm1 = normalizeGameName(gameName1)
  const norm2 = normalizeGameName(gameName2)
  
  // Correspondance exacte
  if (norm1 === norm2) return true
  
  // Correspondance partielle (un nom contient l'autre)
  if (norm1.length > 5 && norm2.length > 5) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return true
    }
  }
  
  // Correspondance par mots-clés (au moins 2 mots en commun)
  const words1 = norm1.split(/\s+/).filter(w => w.length > 2)
  const words2 = norm2.split(/\s+/).filter(w => w.length > 2)
  
  if (words1.length > 0 && words2.length > 0) {
    const commonWords = words1.filter(w => words2.includes(w))
    if (commonWords.length >= 2) {
      return true
    }
  }
  
  return false
}

// Charger le mapping depuis le fichier JSON
async function loadOnlineFixMapping() {
  if (isLoaded && onlineFixMap) {
    return onlineFixMap
  }

  try {
    // Le fichier doit être accessible depuis le renderer process
    // On va utiliser fetch pour charger le fichier depuis le dossier public
    const response = await fetch('/games-online-status.json', {
      cache: 'no-cache' // Toujours recharger pour avoir la dernière version
    })
    
    if (!response.ok) {
      return null
    }

    const mapping = await response.json()
    onlineFixMap = new Map(Object.entries(mapping.normalizedMap || {}))
    onlineFixGamesList = mapping.gamesList || []
    isLoaded = true
    
    return onlineFixMap
  } catch (error) {
    return null
  }
}

// Vérifier si un jeu est disponible sur online-fix.me
// Maintenant on lit directement depuis le champ isOnline du jeu (Supabase)
export async function isGameOnline(game) {
  // Si le jeu a déjà le champ isOnline depuis Supabase, l'utiliser directement
  if (game && typeof game.isOnline === 'boolean') {
    return game.isOnline
  }
  
  // Fallback: vérifier avec le mapping si le champ n'est pas disponible
  if (!game || typeof game === 'string') {
    // Compatibilité avec l'ancienne API (gameName en string)
    const gameName = game || ''
    if (!gameName) return false

    const map = await loadOnlineFixMapping()
    if (!map) return false

    const normalized = normalizeGameName(gameName)

    if (map.has(normalized)) {
      return true
    }

    if (onlineFixGamesList) {
      for (const onlineGame of onlineFixGamesList) {
        if (gamesMatch(gameName, onlineGame)) {
          return true
        }
      }
    }

    return false
  }

  return false
}

// Obtenir le statut en ligne de manière synchrone (si déjà chargé)
export function isGameOnlineSync(gameName) {
  if (!gameName || !onlineFixMap) return false

  const normalized = normalizeGameName(gameName)

  // Vérification exacte
  if (onlineFixMap.has(normalized)) {
    return true
  }

  // Vérification partielle
  if (onlineFixGamesList) {
    for (const onlineGame of onlineFixGamesList) {
      if (gamesMatch(gameName, onlineGame)) {
        return true
      }
    }
  }

  return false
}

// Précharger le mapping au démarrage
if (typeof window !== 'undefined') {
  // Charger de manière asynchrone sans bloquer
  setTimeout(() => {
    loadOnlineFixMapping().catch(() => {
      // Ignorer les erreurs silencieusement
    })
  }, 1000)
}

