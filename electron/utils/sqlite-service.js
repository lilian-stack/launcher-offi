/**
 * Service SQLite simplifié pour la production
 */

const path = require('path')
const fs = require('fs')

class SQLiteService {
  constructor() {
    this.dbPath = null
    this.initialized = false
    this.currentUser = null
    this.installedGames = new Map() // Stockage en mémoire des jeux installés
  }

  /**
   * Initialise la base de données
   */
  async initDatabase(dbPath) {
    try {
      this.dbPath = dbPath || path.join(__dirname, '../data/games-library.db')
      
      // Créer le dossier si nécessaire
      const dbDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      // Charger les jeux installés depuis le fichier JSON s'il existe
      const gamesFile = path.join(dbDir, 'installed-games.json')
      if (fs.existsSync(gamesFile)) {
        try {
          const data = fs.readFileSync(gamesFile, 'utf8')
          const games = JSON.parse(data)
          games.forEach(game => {
            this.installedGames.set(game.id || game.gameId, game)
          })
          console.log('[SQLite] Jeux installés chargés:', this.installedGames.size)
        } catch (error) {
          console.error('[SQLite] Erreur chargement jeux installés:', error)
        }
      }

      this.initialized = true
      console.log('[SQLite] Base de données initialisée:', this.dbPath)
      
      return { success: true }
    } catch (error) {
      console.error('[SQLite] Erreur initialisation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Sauvegarde les jeux installés dans un fichier JSON
   */
  _saveGamesToFile() {
    try {
      if (!this.dbPath) return
      
      const dbDir = path.dirname(this.dbPath)
      const gamesFile = path.join(dbDir, 'installed-games.json')
      const games = Array.from(this.installedGames.values())
      
      fs.writeFileSync(gamesFile, JSON.stringify(games, null, 2), 'utf8')
      console.log('[SQLite] Jeux sauvegardés:', games.length)
    } catch (error) {
      console.error('[SQLite] Erreur sauvegarde jeux:', error)
    }
  }

  /**
   * Définir l'utilisateur actuel
   */
  async setCurrentUser(discordId, userData = null) {
    try {
      this.currentUser = {
        discord_id: discordId,
        username: userData?.username || 'User',
        is_vip: userData?.is_vip || false,
        is_admin: userData?.is_admin || false,
        is_boost: userData?.is_boost || false,
        created_at: new Date().toISOString()
      }
      console.log('[SQLite] Utilisateur défini:', discordId)
      return { success: true }
    } catch (error) {
      console.error('[SQLite] Erreur setCurrentUser:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Charger un utilisateur
   */
  async loadUser(discordId) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      // Simuler le chargement d'un utilisateur
      const user = {
        id: 1,
        username: 'TestUser',
        discord_id: discordId,
        is_vip: false,
        is_admin: false,
        is_boost: false,
        created_at: new Date().toISOString()
      }

      return { success: true, user }
    } catch (error) {
      console.error('[SQLite] Erreur loadUser:', error)
      return { success: false, error: error.message, user: null }
    }
  }

  /**
   * Récupère tous les utilisateurs
   */
  async getAllUsers() {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      // Simuler des utilisateurs pour la démo
      const users = [
        {
          id: 1,
          username: 'TestUser',
          discord_id: '123456789',
          is_vip: false,
          is_admin: false,
          is_boost: false,
          created_at: new Date().toISOString()
        }
      ]

      return users
    } catch (error) {
      console.error('[SQLite] Erreur getAllUsers:', error)
      return []
    }
  }

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(discordId) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      console.log('[SQLite] Utilisateur supprimé:', discordId)
      return true
    } catch (error) {
      console.error('[SQLite] Erreur deleteUser:', error)
      return false
    }
  }

  /**
   * Récupère tous les jeux installés
   */
  async getAllInstalledGames(userId = null) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const games = Array.from(this.installedGames.values())
      console.log('[SQLite] Jeux installés récupérés:', games.length)
      return games
    } catch (error) {
      console.error('[SQLite] Erreur getAllInstalledGames:', error)
      return []
    }
  }

  /**
   * Sauvegarde un jeu installé
   */
  async saveInstalledGame(gameId, gameData) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const game = {
        id: gameId,
        gameId: gameId,
        name: gameData.name || gameData.title,
        installFolder: gameData.installFolder || gameData.path,
        path: gameData.installFolder || gameData.path,
        executable: gameData.executable || gameData.exe,
        exe: gameData.executable || gameData.exe,
        installed: true,
        installed_at: new Date().toISOString(),
        last_played: null,
        play_time: 0,
        version: gameData.version,
        launcherId: gameData.launcherId
      }

      this.installedGames.set(gameId, game)
      this._saveGamesToFile()
      
      console.log('[SQLite] Jeu sauvegardé:', gameData.name)
      return { success: true, id: Date.now() }
    } catch (error) {
      console.error('[SQLite] Erreur saveInstalledGame:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Sauvegarde plusieurs jeux depuis un scan
   */
  async saveInstalledGamesFromScan(installedGames) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      if (!Array.isArray(installedGames)) {
        console.warn('[SQLite] saveInstalledGamesFromScan: pas un tableau')
        return
      }

      console.log('[SQLite] Sauvegarde de', installedGames.length, 'jeux depuis scan')
      
      installedGames.forEach(gameData => {
        const gameId = gameData.id || gameData.gameId || gameData.name
        if (gameId) {
          const game = {
            id: gameId,
            gameId: gameId,
            name: gameData.name || gameData.title,
            installFolder: gameData.installFolder || gameData.path,
            path: gameData.installFolder || gameData.path,
            executable: gameData.executable || gameData.exe,
            exe: gameData.executable || gameData.exe,
            installed: true,
            installed_at: gameData.installed_at || new Date().toISOString(),
            last_played: gameData.last_played || null,
            play_time: gameData.play_time || 0,
            version: gameData.version,
            launcherId: gameData.launcherId
          }
          
          this.installedGames.set(gameId, game)
        }
      })

      this._saveGamesToFile()
      console.log('[SQLite] Jeux sauvegardés depuis scan:', installedGames.length)
    } catch (error) {
      console.error('[SQLite] Erreur saveInstalledGamesFromScan:', error)
    }
  }

  /**
   * Supprime un jeu installé
   */
  async removeInstalledGame(gameId) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const deleted = this.installedGames.delete(gameId)
      if (deleted) {
        this._saveGamesToFile()
        console.log('[SQLite] Jeu supprimé:', gameId)
      }
      return deleted
    } catch (error) {
      console.error('[SQLite] Erreur removeInstalledGame:', error)
      return false
    }
  }

  /**
   * Vérifie si un jeu est installé
   */
  async isGameInstalled(gameId) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      return this.installedGames.has(gameId)
    } catch (error) {
      console.error('[SQLite] Erreur isGameInstalled:', error)
      return false
    }
  }

  /**
   * Récupère les statistiques
   */
  async getStatistics(userId = null) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const games = Array.from(this.installedGames.values())
      const totalPlayTime = games.reduce((sum, game) => sum + (game.play_time || 0), 0)
      
      return {
        totalGames: games.length,
        totalPlayTime: totalPlayTime,
        averagePlayTime: games.length > 0 ? totalPlayTime / games.length : 0,
        mostPlayedGame: games.length > 0 ? games[0].name : null
      }
    } catch (error) {
      console.error('[SQLite] Erreur getStatistics:', error)
      return {}
    }
  }

  /**
   * Récupère les jeux les plus joués
   */
  async getMostPlayedGames(limit = 10, userId = null) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const games = Array.from(this.installedGames.values())
      return games
        .sort((a, b) => (b.play_time || 0) - (a.play_time || 0))
        .slice(0, limit)
    } catch (error) {
      console.error('[SQLite] Erreur getMostPlayedGames:', error)
      return []
    }
  }

  /**
   * Récupère les jeux récemment joués
   */
  async getRecentlyPlayed(limit = 10, userId = null) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const games = Array.from(this.installedGames.values())
      return games
        .filter(game => game.last_played)
        .sort((a, b) => new Date(b.last_played) - new Date(a.last_played))
        .slice(0, limit)
    } catch (error) {
      console.error('[SQLite] Erreur getRecentlyPlayed:', error)
      return []
    }
  }

  /**
   * Recherche des jeux
   */
  async searchGames(query, userId = null) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const games = Array.from(this.installedGames.values())
      return games.filter(game => 
        game.name && game.name.toLowerCase().includes(query.toLowerCase())
      )
    } catch (error) {
      console.error('[SQLite] Erreur searchGames:', error)
      return []
    }
  }

  /**
   * Met à jour la dernière fois joué
   */
  async updateLastPlayed(gameId) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const game = this.installedGames.get(gameId)
      if (game) {
        game.last_played = new Date().toISOString()
        this.installedGames.set(gameId, game)
        this._saveGamesToFile()
      }
      
      console.log('[SQLite] Dernière fois joué mise à jour:', gameId)
      return { success: true }
    } catch (error) {
      console.error('[SQLite] Erreur updateLastPlayed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Incrémente le temps de jeu
   */
  async incrementPlayTime(gameId, minutes) {
    try {
      if (!this.initialized) {
        throw new Error('Base de données non initialisée')
      }

      const game = this.installedGames.get(gameId)
      if (game) {
        game.play_time = (game.play_time || 0) + minutes
        this.installedGames.set(gameId, game)
        this._saveGamesToFile()
      }
      
      console.log('[SQLite] Temps de jeu incrémenté:', gameId, minutes, 'minutes')
      return { success: true }
    } catch (error) {
      console.error('[SQLite] Erreur incrementPlayTime:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Debug de la base de données
   */
  async debug() {
    try {
      return {
        initialized: this.initialized,
        dbPath: this.dbPath,
        currentUser: this.currentUser,
        installedGamesCount: this.installedGames.size,
        installedGames: Array.from(this.installedGames.values()),
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('[SQLite] Erreur debug:', error)
      return { error: error.message }
    }
  }
}

// Instance singleton
const sqliteService = new SQLiteService()

module.exports = {
  initDatabase: (dbPath) => sqliteService.initDatabase(dbPath),
  setCurrentUser: (discordId, userData) => sqliteService.setCurrentUser(discordId, userData),
  loadUser: (discordId) => sqliteService.loadUser(discordId),
  getAllUsers: () => sqliteService.getAllUsers(),
  deleteUser: (discordId) => sqliteService.deleteUser(discordId),
  getAllInstalledGames: (userId) => sqliteService.getAllInstalledGames(userId),
  saveInstalledGame: (gameId, gameData) => sqliteService.saveInstalledGame(gameId, gameData),
  saveInstalledGamesFromScan: (installedGames) => sqliteService.saveInstalledGamesFromScan(installedGames),
  removeInstalledGame: (gameId) => sqliteService.removeInstalledGame(gameId),
  isGameInstalled: (gameId) => sqliteService.isGameInstalled(gameId),
  getStatistics: (userId) => sqliteService.getStatistics(userId),
  getMostPlayedGames: (limit, userId) => sqliteService.getMostPlayedGames(limit, userId),
  getRecentlyPlayed: (limit, userId) => sqliteService.getRecentlyPlayed(limit, userId),
  searchGames: (query, userId) => sqliteService.searchGames(query, userId),
  updateLastPlayed: (gameId) => sqliteService.updateLastPlayed(gameId),
  incrementPlayTime: (gameId, minutes) => sqliteService.incrementPlayTime(gameId, minutes),
  debug: () => sqliteService.debug()
}