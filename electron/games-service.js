// Utilisation de Firebase pour stocker les jeux
import { getGamesFromFirebase, addGameToFirebase, updateGameInFirebase, deleteGameFromFirebase } from './firebase-games-service.js'

/**
 * Récupère les jeux depuis Firebase
 */
export async function getGamesFromGitHub() {
  try {
    console.log('[games-service] getGamesFromGitHub called (using Firebase)')
    return await getGamesFromFirebase()
  } catch (error) {
    console.error('[games-service] Error getting games from Firebase:', error)
    throw error
  }
}

/**
 * Ajoute un jeu à la liste ou le met à jour s'il existe déjà
 */
export async function addGame(gameData) {
  try {
    console.log('[games-service] addGame called (using Firebase)')
    return await addGameToFirebase(gameData)
  } catch (error) {
    console.error('[games-service] Error adding game to Firebase:', error)
    throw error
  }
}

/**
 * Met à jour un jeu
 */
export async function updateGame(gameId, updates) {
  try {
    console.log('[games-service] updateGame called (using Firebase)')
    return await updateGameInFirebase(gameId, updates)
  } catch (error) {
    console.error('[games-service] Error updating game in Firebase:', error)
    throw error
  }
}

/**
 * Supprime un jeu
 */
export async function deleteGame(gameId) {
  try {
    console.log('[games-service] deleteGame called (using Firebase)')
    return await deleteGameFromFirebase(gameId)
  } catch (error) {
    console.error('[games-service] Error deleting game from Firebase:', error)
    throw error
  }
}

