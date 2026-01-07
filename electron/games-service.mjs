// Utilisation de Supabase pour stocker les jeux
import { getGamesFromSupabase, addGameToSupabase, updateGameOnSupabase, deleteGameFromSupabase } from './supabase-games-service.mjs'

/**
 * Récupère les jeux depuis Supabase
 */
// Cache pour éviter les appels répétés
let gamesCache = null
let gamesCacheTimestamp = 0
const GAMES_CACHE_DURATION = 30000 // 30 secondes

// Forcer l'invalidation du cache au démarrage pour charger les nouveaux is_online
export function forceInvalidateCache() {
  gamesCache = null
  gamesCacheTimestamp = 0
  // Logs désactivés
}

export async function getGamesFromGitHub(forceRefresh = false) {
  try {
    const now = Date.now()
    
    // Utiliser le cache si disponible et récent, SAUF si on force le refresh
    if (!forceRefresh && gamesCache && (now - gamesCacheTimestamp) < GAMES_CACHE_DURATION) {
      return gamesCache
    }
    
    // Si forceRefresh, invalider le cache d'abord
    if (forceRefresh) {
      console.log('[games-service] 🔄 Force refresh: invalidation du cache')
      gamesCache = null
      gamesCacheTimestamp = 0
    }
    
    const result = await getGamesFromSupabase()
    
    // S'assurer qu'on retourne toujours un objet avec games
    const games = result && result.games ? result : { games: [] }
        
    // Mettre à jour le cache
    gamesCache = games
    gamesCacheTimestamp = now
    
    return games
  } catch (error) {
    console.error('[games-service] ❌ Erreur dans getGamesFromGitHub:', error.message)
    console.error('[games-service] ❌ Stack:', error.stack)
    
    // En cas d'erreur, retourner le cache si disponible
    if (gamesCache) {
      console.log('[games-service] ⚠️ Retour du cache existant en cas d\'erreur:', gamesCache.games?.length || 0, 'jeux')
      return gamesCache
    }
    // Retourner un tableau vide au lieu de throw pour éviter de bloquer l'application
    console.error('[games-service] ❌ Aucun cache disponible, retour de tableau vide')
    return { games: [] }
  }
}

/**
 * Invalide le cache des jeux
 */
export function invalidateGamesCache() {
  gamesCache = null
  gamesCacheTimestamp = 0
}

/**
 * Ajoute un jeu à la liste ou le met à jour s'il existe déjà
 */
export async function addGame(gameData) {
  try {
    const result = await addGameToSupabase(gameData)
    // Invalider le cache après ajout
    invalidateGamesCache()
    return result
  } catch (error) {
    // Logs désactivés
    throw error
  }
}

/**
 * Met à jour un jeu
 */
export async function updateGame(gameId, updates) {
  try {
    const result = await updateGameOnSupabase(gameId, updates)
    // Invalider le cache après mise à jour
    invalidateGamesCache()
    return result
  } catch (error) {
    // Logs désactivés
    throw error
  }
}

/**
 * Supprime un jeu
 */
export async function deleteGame(gameId) {
  try {
    const result = await deleteGameFromSupabase(gameId)
    // Invalider le cache après suppression
    invalidateGamesCache()
    return result
  } catch (error) {
    console.error('[games-service] Error deleting game from Supabase:', error)
    throw error
  }
}

