/**
 * Service de persistance pour les jeux installés
 * Utilise SimpleStore (remplace electron-store) pour sauvegarder les données de manière persistante
 */
class InstalledGamesStore {
  constructor() {
    this.store = null
    this.storePromise = null
  }

  /**
   * Charger SimpleStore de manière asynchrone (import dynamique)
   */
  async ensureStore() {
    if (this.store) {
      return this.store
    }
    if (this.storePromise) {
      return await this.storePromise
    }
    
    this.storePromise = (async () => {
      const path = require('path')
      const { pathToFileURL } = require('url')
      const { app } = require('electron')
      const isDev = !app.isPackaged
      
      let storePath = './simple-store.mjs'
      if (!isDev) {
        // En production, chercher simple-store.mjs dans app.asar
        const appPath = app.getAppPath()
        const storeModulePath = path.join(appPath, 'electron', 'simple-store.mjs')
        storePath = pathToFileURL(storeModulePath).href
      }
      
      const SimpleStore = (await import(storePath)).default
      this.store = new SimpleStore({
        name: 'installed-games',
        defaults: {
          games: {} // { gameId: { path, gameName, installedAt, exePath, launcherId, ... } }
        }
      })
      return this.store
    })()
    
    return await this.storePromise
  }

  /**
   * Sauvegarder un jeu installé
   * @param {string} gameId - ID du jeu
   * @param {Object} gameData - Données du jeu installé
   */
  async saveInstalledGame(gameId, gameData) {
    if (!gameId) {
      console.error('[InstalledGamesStore] ❌ gameId manquant')
      return false
    }

    const store = await this.ensureStore()
    const games = store.get('games', {})
    games[gameId] = {
      ...gameData,
      installedAt: gameData.installedAt || Date.now(),
      lastVerified: Date.now()
    }
    
    store.set('games', games)
    return true
  }

  /**
   * Récupérer un jeu installé
   * @param {string} gameId - ID du jeu
   * @returns {Object|null} Données du jeu ou null
   */
  async getInstalledGame(gameId) {
    if (!gameId) return null
    const store = await this.ensureStore()
    const games = store.get('games', {})
    return games[gameId] || null
  }

  /**
   * Récupérer tous les jeux installés
   * @returns {Object} Objet avec tous les jeux installés
   */
  async getAllInstalledGames() {
    const store = await this.ensureStore()
    return store.get('games', {})
  }

  /**
   * Vérifier si un jeu est installé
   * @param {string} gameId - ID du jeu
   * @returns {boolean}
   */
  async isGameInstalled(gameId) {
    const game = await this.getInstalledGame(gameId)
    return game !== null
  }

  /**
   * Supprimer un jeu installé
   * @param {string} gameId - ID du jeu
   */
  async removeInstalledGame(gameId) {
    if (!gameId) return false
    
    const store = await this.ensureStore()
    const games = store.get('games', {})
    if (games[gameId]) {
      delete games[gameId]
      store.set('games', games)
      return true
    }
    return false
  }

  /**
   * Vérifier que les dossiers des jeux installés existent toujours
   * Nettoie les jeux dont les dossiers n'existent plus
   * @param {Function} fsExistsSync - Fonction fs.existsSync
   * @returns {Object} Jeux valides (dossiers existants)
   */
  async verifyInstalledGames(fsExistsSync) {
    const store = await this.ensureStore()
    const games = store.get('games', {})
    const validGames = {}
    let removedCount = 0

    for (const [gameId, gameData] of Object.entries(games)) {
      const gamePath = gameData.path || gameData.gamePath || gameData.installFolder
      
      if (gamePath && fsExistsSync(gamePath)) {
        // Le dossier existe, mettre à jour la date de vérification
        validGames[gameId] = {
          ...gameData,
          lastVerified: Date.now()
        }
      } else {
        // Le dossier n'existe plus, supprimer le jeu
        removedCount++
      }
    }

    if (removedCount > 0) {
      store.set('games', validGames)
    }

    return validGames
  }

  /**
   * Sauvegarder plusieurs jeux à la fois (après un scan)
   * @param {Array} installedGames - Liste des jeux installés détectés
   */
  async saveInstalledGamesFromScan(installedGames) {
    if (!Array.isArray(installedGames)) return

    const store = await this.ensureStore()
    const games = store.get('games', {})
    let updatedCount = 0

    for (const game of installedGames) {
      // Priorité: gameId du catalogue (catalogGameId), puis gameId, puis launcherId
      const catalogGameId = game.catalogGameId
      const gameId = catalogGameId || game.gameId || game.id || game.launcherId
      const gameName = game.name || game.gameName || game.title
      const gamePath = game.path || game.gamePath || game.installFolder
      const launcherId = game.launcherId

      if (gamePath && gameId) {
        // Sauvegarder avec le gameId du catalogue comme clé principale
        const storeKey = String(gameId) // Convertir en string pour cohérence
        
        // Si le jeu existe déjà avec un autre ID, le mettre à jour avec le bon ID
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
            lastVerified: Date.now()
          }
          updatedCount++
          
          // Si on a un launcherId différent du gameId, aussi sauvegarder avec le launcherId comme référence
          if (launcherId && launcherId !== storeKey && !games[launcherId]) {
            games[launcherId] = {
              ...games[storeKey],
              gameId: storeKey, // Garder le gameId du catalogue comme référence principale
              launcherId: launcherId
            }
          }
        } else {
          // Mettre à jour seulement la date de vérification
          games[storeKey].lastVerified = Date.now()
        }
      }
    }

    if (updatedCount > 0) {
      store.set('games', games)
    }
  }

  /**
   * Fusionner les jeux sauvegardés avec les jeux détectés par scan
   * @param {Array} scannedGames - Jeux détectés par scan
   * @returns {Array} Liste fusionnée
   */
  async mergeWithScannedGames(scannedGames) {
    const savedGames = await this.getAllInstalledGames()
    const merged = [...scannedGames]

    // Ajouter les jeux sauvegardés qui ne sont pas dans le scan
    for (const [gameId, savedGame] of Object.entries(savedGames)) {
      const gamePath = savedGame.path || savedGame.gamePath
      
      // Vérifier si le jeu n'est pas déjà dans la liste scannée
      const alreadyInScan = scannedGames.some(scanned => {
        const scannedPath = scanned.path || scanned.gamePath
        return scannedPath === gamePath || scanned.gameId === gameId
      })

      if (!alreadyInScan && gamePath) {
        // Ajouter le jeu sauvegardé à la liste
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
}

// Export singleton
const installedGamesStore = new InstalledGamesStore()

module.exports = { installedGamesStore }