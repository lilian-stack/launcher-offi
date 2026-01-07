/**
 * Bibliothèque de jeux par utilisateur Discord
 * Stocke les jeux installés séparément pour chaque utilisateur Discord
 * Migration automatique des jeux existants vers le système multi-utilisateur
 */

import { installedGamesStore } from './installed-games-store.js'

class UserGamesLibrary {
  constructor() {
    this.currentUserId = null
    this.migrated = false
  }

  /**
   * Récupérer l'utilisateur Discord actuel depuis le localStorage
   * @returns {string|null} Discord ID de l'utilisateur ou null
   */
  getCurrentDiscordId() {
    try {
      // Le frontend stocke l'utilisateur dans localStorage
      // On peut le récupérer via IPC ou en lisant le fichier de store
      // Pour l'instant, on utilise une méthode hybride
      
      // Méthode 1: Vérifier si on a déjà l'ID en cache (via IPC)
      if (this.currentUserId) {
        return this.currentUserId
      }
      
      // Méthode 2: Fallback - les jeux seront stockés globalement si pas d'utilisateur
      return null
    } catch (error) {
      console.warn('[UserGamesLibrary] Impossible de récupérer l\'ID Discord:', error)
      return null
    }
  }

  /**
   * Définir l'utilisateur Discord actuel (appelé depuis IPC)
   * @param {string} discordId - ID Discord de l'utilisateur
   */
  setCurrentUser(discordId) {
    this.currentUserId = discordId
    console.log('[UserGamesLibrary] Utilisateur défini:', discordId)
    
    // Migrer les jeux existants si nécessaire
    this.migrateLegacyGames().catch(err => {
      console.warn('[UserGamesLibrary] Erreur lors de la migration:', err)
    })
  }

  /**
   * Migrer les jeux de l'ancien système (global) vers le nouveau (par utilisateur)
   */
  async migrateLegacyGames() {
    if (this.migrated || !this.currentUserId) return
    
    try {
      const store = await installedGamesStore.ensureStore()
      const legacyGames = store.get('games', {})
      
      // Vérifier s'il y a des jeux à migrer
      if (Object.keys(legacyGames).length === 0) {
        this.migrated = true
        return
      }
      
      // Vérifier si on a déjà des jeux pour cet utilisateur
      const userGames = store.get(`users.${this.currentUserId}.games`, {})
      
      if (Object.keys(userGames).length === 0 && Object.keys(legacyGames).length > 0) {
        console.log('[UserGamesLibrary] Migration des jeux existants vers l\'utilisateur:', this.currentUserId)
        
        // Migrer les jeux
        store.set(`users.${this.currentUserId}.games`, legacyGames)
        
        // Sauvegarder les jeux globaux comme backup (au cas où)
        store.set('users._legacy.games', legacyGames)
        
        console.log('[UserGamesLibrary] ✅ Migration terminée:', Object.keys(legacyGames).length, 'jeux')
      }
      
      this.migrated = true
    } catch (error) {
      console.error('[UserGamesLibrary] Erreur lors de la migration:', error)
    }
  }

  /**
   * Obtenir le chemin de stockage pour les jeux de l'utilisateur actuel
   * @param {string|null} userId - ID Discord (optionnel, utilise currentUserId si non fourni)
   * @returns {string} Chemin de stockage
   */
  getUserGamesPath(userId = null) {
    const discordId = userId || this.getCurrentDiscordId()
    
    if (discordId) {
      return `users.${discordId}.games`
    }
    
    // Fallback: stockage global si pas d'utilisateur connecté
    return 'games'
  }

  /**
   * Sauvegarder un jeu installé pour l'utilisateur actuel
   * @param {string} gameId - ID du jeu
   * @param {Object} gameData - Données du jeu
   */
  async saveInstalledGame(gameId, gameData) {
    if (!gameId) {
      console.error('[UserGamesLibrary] ❌ gameId manquant')
      return false
    }

    const store = await installedGamesStore.ensureStore()
    const gamesPath = this.getUserGamesPath()
    const games = store.get(gamesPath, {})
    
    games[gameId] = {
      ...gameData,
      installedAt: gameData.installedAt || Date.now(),
      lastVerified: Date.now(),
      userId: this.getCurrentDiscordId() // Ajouter l'ID utilisateur pour traçabilité
    }
    
    store.set(gamesPath, games)
    
    // Mettre à jour aussi le profil utilisateur
    const userId = this.getCurrentDiscordId()
    if (userId) {
      const profilePath = `users.${userId}.profile`
      const profile = store.get(profilePath, {})
      store.set(profilePath, {
        ...profile,
        lastGameUpdate: Date.now()
      })
    }
    
    return true
  }

  /**
   * Récupérer un jeu installé pour l'utilisateur actuel
   * @param {string} gameId - ID du jeu
   * @returns {Object|null} Données du jeu ou null
   */
  async getInstalledGame(gameId) {
    if (!gameId) return null
    
    const store = await installedGamesStore.ensureStore()
    const gamesPath = this.getUserGamesPath()
    const games = store.get(gamesPath, {})
    
    return games[gameId] || null
  }

  /**
   * Récupérer tous les jeux installés pour l'utilisateur actuel
   * @param {string|null} userId - ID Discord (optionnel)
   * @returns {Object} Objet avec tous les jeux installés
   */
  async getAllInstalledGames(userId = null) {
    const store = await installedGamesStore.ensureStore()
    const gamesPath = this.getUserGamesPath(userId)
    return store.get(gamesPath, {})
  }

  /**
   * Vérifier si un jeu est installé pour l'utilisateur actuel
   * @param {string} gameId - ID du jeu
   * @returns {boolean}
   */
  async isGameInstalled(gameId) {
    const game = await this.getInstalledGame(gameId)
    return game !== null
  }

  /**
   * Supprimer un jeu installé pour l'utilisateur actuel
   * @param {string} gameId - ID du jeu
   */
  async removeInstalledGame(gameId) {
    if (!gameId) return false
    
    const store = await installedGamesStore.ensureStore()
    const gamesPath = this.getUserGamesPath()
    const games = store.get(gamesPath, {})
    
    if (games[gameId]) {
      delete games[gameId]
      store.set(gamesPath, games)
      return true
    }
    
    return false
  }

  /**
   * Sauvegarder plusieurs jeux à la fois (après un scan)
   * @param {Array} installedGames - Liste des jeux installés détectés
   */
  async saveInstalledGamesFromScan(installedGames) {
    if (!Array.isArray(installedGames)) return

    const store = await installedGamesStore.ensureStore()
    const gamesPath = this.getUserGamesPath()
    const games = store.get(gamesPath, {})
    let updatedCount = 0

    for (const game of installedGames) {
      const catalogGameId = game.catalogGameId
      const gameId = catalogGameId || game.gameId || game.id || game.launcherId
      const gameName = game.name || game.gameName || game.title
      const gamePath = game.path || game.gamePath || game.installFolder
      const launcherId = game.launcherId

      if (gamePath && gameId) {
        const storeKey = String(gameId)
        
        if (!games[storeKey] || games[storeKey].path !== gamePath) {
          games[storeKey] = {
            gameId: storeKey,
            gameName,
            name: gameName,
            path: gamePath,
            gamePath: gamePath,
            exePath: game.exePath,
            launcherId: launcherId || storeKey,
            installedAt: games[storeKey]?.installedAt || Date.now(),
            lastVerified: Date.now(),
            userId: this.getCurrentDiscordId()
          }
          updatedCount++
        } else {
          games[storeKey].lastVerified = Date.now()
        }
      }
    }

    if (updatedCount > 0) {
      store.set(gamesPath, games)
    }
    
    return updatedCount
  }

  /**
   * Vérifier que les dossiers des jeux installés existent toujours
   * @param {Function} fsExistsSync - Fonction fs.existsSync
   * @returns {Object} Jeux valides
   */
  async verifyInstalledGames(fsExistsSync) {
    const store = await installedGamesStore.ensureStore()
    const gamesPath = this.getUserGamesPath()
    const games = store.get(gamesPath, {})
    const validGames = {}
    let removedCount = 0

    for (const [gameId, gameData] of Object.entries(games)) {
      const gamePath = gameData.path || gameData.gamePath || gameData.installFolder
      
      if (gamePath && fsExistsSync(gamePath)) {
        validGames[gameId] = {
          ...gameData,
          lastVerified: Date.now()
        }
      } else {
        removedCount++
      }
    }

    if (removedCount > 0) {
      store.set(gamesPath, validGames)
    }

    return validGames
  }

  /**
   * Fusionner les jeux sauvegardés avec les jeux détectés par scan
   * @param {Array} scannedGames - Jeux détectés par scan
   * @returns {Array} Liste fusionnée
   */
  async mergeWithScannedGames(scannedGames) {
    const savedGames = await this.getAllInstalledGames()
    const merged = [...scannedGames]

    for (const [gameId, savedGame] of Object.entries(savedGames)) {
      const gamePath = savedGame.path || savedGame.gamePath
      
      const alreadyInScan = scannedGames.some(scanned => {
        const scannedPath = scanned.path || scanned.gamePath
        return scannedPath === gamePath || scanned.gameId === gameId
      })

      if (!alreadyInScan && gamePath) {
        merged.push({
          gameId: savedGame.gameId || gameId,
          name: savedGame.gameName || savedGame.name,
          gameName: savedGame.gameName || savedGame.name,
          path: savedGame.path || savedGame.gamePath,
          gamePath: savedGame.path || savedGame.gamePath,
          exePath: savedGame.exePath,
          launcherId: savedGame.launcherId,
          installDate: savedGame.installedAt,
          installedVersion: savedGame.version
        })
      }
    }

    return merged
  }

  /**
   * Obtenir les statistiques des jeux pour tous les utilisateurs
   * @returns {Object} Statistiques par utilisateur
   */
  async getStatistics() {
    const store = await installedGamesStore.ensureStore()
    const users = store.get('users', {})
    const stats = {}

    for (const [userId, userData] of Object.entries(users)) {
      if (userId === '_legacy') continue // Ignorer les données legacy
      
      const games = userData.games || {}
      stats[userId] = {
        gameCount: Object.keys(games).length,
        lastUpdate: userData.profile?.lastGameUpdate || null
      }
    }

    return stats
  }
}

// Export singleton
export const userGamesLibrary = new UserGamesLibrary()

