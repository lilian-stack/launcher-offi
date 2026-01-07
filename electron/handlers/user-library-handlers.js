/**
 * Handlers IPC pour la bibliothèque de jeux par utilisateur Discord
 */

import { ipcMain } from 'electron'
import { userGamesLibrary } from '../user-games-library.mjs'

let log = null
let errorLog = null

/**
 * Injecter les dépendances
 */
export function injectDependencies(dependencies) {
  log = dependencies.log || console.log
  errorLog = dependencies.errorLog || console.error
}

/**
 * Enregistrer tous les handlers pour la bibliothèque utilisateur
 */
export function registerUserLibraryHandlers() {
  // Définir l'utilisateur Discord actuel
  ipcMain.handle('user-library:setUser', async (event, discordId) => {
    try {
      if (!discordId) {
        return { success: false, error: 'ID Discord manquant' }
      }
      
      userGamesLibrary.setCurrentUser(discordId)
      log('[UserLibrary] Utilisateur défini:', discordId)
      
      return { success: true }
    } catch (error) {
      errorLog('[UserLibrary] Erreur lors de la définition de l\'utilisateur:', error)
      return { success: false, error: error.message }
    }
  })

  // Récupérer les jeux de l'utilisateur actuel
  ipcMain.handle('user-library:getGames', async (event, userId = null) => {
    try {
      const games = await userGamesLibrary.getAllInstalledGames(userId)
      return { success: true, games }
    } catch (error) {
      errorLog('[UserLibrary] Erreur lors de la récupération des jeux:', error)
      return { success: false, games: {}, error: error.message }
    }
  })

  // Obtenir les statistiques
  ipcMain.handle('user-library:getStatistics', async () => {
    try {
      const stats = await userGamesLibrary.getStatistics()
      return { success: true, statistics: stats }
    } catch (error) {
      errorLog('[UserLibrary] Erreur lors de la récupération des statistiques:', error)
      return { success: false, statistics: {}, error: error.message }
    }
  })
}

