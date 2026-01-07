/**
 * Bibliothèque de jeux par utilisateur Discord avec SQLite
 * Remplace SimpleStore par SQLite pour de meilleures performances et statistiques
 */

import path from 'path'
import fs from 'fs'
import { app } from 'electron'

/**
 * Calculer la taille d'un dossier récursivement
 */
function calculateDirectorySize(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0
    
    const stats = fs.statSync(dirPath)
    if (!stats.isDirectory()) return stats.size
    
    let totalSize = 0
    const files = fs.readdirSync(dirPath)
    
    for (const file of files) {
      const filePath = path.join(dirPath, file)
      try {
        const fileStats = fs.statSync(filePath)
        if (fileStats.isDirectory()) {
          totalSize += calculateDirectorySize(filePath)
        } else {
          totalSize += fileStats.size
        }
      } catch (err) {
        // Ignorer les erreurs d'accès
      }
    }
    
    return totalSize
  } catch (error) {
    return 0
  }
}

let Database = null
let db = null
let currentUserId = null
let dbInitialized = false
let initPromise = null // Pour éviter les initialisations concurrentes

/**
 * Initialiser SQLite
 */
async function initDatabase() {
  // Si déjà initialisé, retourner immédiatement
  if (dbInitialized && db) {
    return db
  }

  // Si une initialisation est en cours, attendre qu'elle se termine
  if (initPromise) {
    console.log('[GamesLibrarySQLite] ⏳ Initialisation déjà en cours, attente...')
    return await initPromise
  }

  // Créer la promesse d'initialisation
  initPromise = (async () => {
  try {
    // Charger better-sqlite3
    if (!Database) {
      // Essayer de charger depuis node_modules
      try {
        const sqliteModule = await import('better-sqlite3')
        Database = sqliteModule.default
      } catch (error) {
        // Détecter les erreurs de bindings natifs (non compilé pour Electron)
        const isBindingError = 
          error.code === 'ERR_DLOPEN_FAILED' ||
          error.message?.includes('NODE_MODULE_VERSION') ||
          error.message?.includes('Could not locate the bindings file') ||
          error.message?.includes('better_sqlite3.node')
        
        if (isBindingError) {
          console.warn('[GamesLibrarySQLite] ⚠️ better-sqlite3 n\'est pas compilé pour cette version d\'Electron')
          console.warn('[GamesLibrarySQLite] 💡 Exécutez: npm run rebuild:electron')
          console.warn('[GamesLibrarySQLite] 💡 Ou: npx electron-rebuild -f -w better-sqlite3')
          console.warn('[GamesLibrarySQLite] 💡 Le système utilisera SimpleStore (JSON) en fallback')
          throw new Error('SQLite non disponible, utilisation de JSON')
        }
        console.error('[GamesLibrarySQLite] ❌ better-sqlite3 non installé:', error.message)
        console.error('[GamesLibrarySQLite] 💡 Installez-le avec: npm install better-sqlite3')
        throw new Error('better-sqlite3 non installé. Exécutez: npm install better-sqlite3')
      }
    }

    // Chemin de la base de données
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'games-library.db')

    // Créer la base de données (peut aussi échouer si les bindings ne sont pas compilés)
    try {
    db = new Database(dbPath)
    } catch (error) {
      // Si l'instanciation échoue à cause des bindings
      if (error.message?.includes('Could not locate the bindings file') ||
          error.message?.includes('better_sqlite3.node')) {
        console.warn('[GamesLibrarySQLite] ⚠️ better-sqlite3 n\'est pas compilé pour cette version d\'Electron')
        console.warn('[GamesLibrarySQLite] 💡 Exécutez: npm run rebuild:electron')
        console.warn('[GamesLibrarySQLite] 💡 Ou: npx electron-rebuild -f -w better-sqlite3')
        console.warn('[GamesLibrarySQLite] 💡 Le système utilisera SimpleStore (JSON) en fallback')
        throw new Error('SQLite non disponible, utilisation de JSON')
      }
      throw error
    }
    db.pragma('journal_mode = WAL') // Améliore les performances
    db.pragma('foreign_keys = ON') // Active les clés étrangères

    // Créer les tables
    createTables()

    // Migrer les données depuis SimpleStore si nécessaire
    await migrateFromSimpleStore()

    dbInitialized = true
    console.log('[GamesLibrarySQLite] ✅ Base de données initialisée:', dbPath)
    
    return db
  } catch (error) {
    console.error('[GamesLibrarySQLite] ❌ Erreur lors de l\'initialisation:', error)
      dbInitialized = false
    throw error
    } finally {
      initPromise = null
  }
  })()
  
  return await initPromise
}

/**
 * Créer les tables
 */
function createTables() {
  // Table des utilisateurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      discriminator TEXT,
      avatar TEXT,
      avatar_url TEXT,
      last_login TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_vip INTEGER DEFAULT 0,
      is_boost INTEGER DEFAULT 0
    )
  `)
  
  // Migration : ajouter avatar_url si la colonne n'existe pas
  try {
    db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`)
    console.log('[GamesLibrarySQLite] ✅ Colonne avatar_url ajoutée')
  } catch (err) {
    // La colonne existe déjà, ignorer l'erreur
    if (!err.message.includes('duplicate column')) {
      console.warn('[GamesLibrarySQLite] ⚠️ Erreur lors de l\'ajout de avatar_url:', err.message)
    }
  }

  // Table des jeux installés
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      version TEXT,
      size INTEGER DEFAULT 0,
      exe_path TEXT,
      launcher_id TEXT,
      install_date TEXT NOT NULL,
      last_verified TEXT,
      last_played TEXT,
      play_time INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(discord_id) ON DELETE CASCADE,
      UNIQUE(user_id, game_id)
    )
  `)

  // Index pour améliorer les performances
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id)
  `)
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id)
  `)
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_user_game ON games(user_id, game_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_last_played ON games(last_played)
  `)

  console.log('[GamesLibrarySQLite] ✅ Tables créées')
}

/**
 * Migrer les données depuis SimpleStore (si existe)
 */
async function migrateFromSimpleStore() {
  try {
    const { installedGamesStore } = await import('./installed-games-store.js')
    const store = await installedGamesStore.ensureStore()
    
    // Vérifier si la migration a déjà été faite
    const migrationDone = store.get('_migrationDone', false)
    if (migrationDone) {
      console.log('[GamesLibrarySQLite] ℹ️  Migration déjà effectuée')
      return
    }
    
    const legacyGames = store.get('games', {})
    
    if (Object.keys(legacyGames).length === 0) {
      console.log('[GamesLibrarySQLite] ℹ️  Aucun jeu à migrer depuis SimpleStore')
      return // Pas de données à migrer
    }

    console.log('[GamesLibrarySQLite] 🔄 Migration automatique des jeux depuis SimpleStore...')
    console.log(`[GamesLibrarySQLite] 📊 ${Object.keys(legacyGames).length} jeux trouvés`)
    
    // Détecter les doublons (même nom de jeu, même chemin)
    const uniqueGames = {}
    const duplicates = []
    
    for (const [gameId, gameData] of Object.entries(legacyGames)) {
      const gamePath = gameData.path || gameData.gamePath || ''
      const gameName = gameData.gameName || gameData.name || 'Jeu inconnu'
      const key = `${gameName}|${gamePath}`.toLowerCase()
      
      if (uniqueGames[key]) {
        // Doublon détecté - garder celui avec launcherId ou le premier
        duplicates.push(gameId)
        console.log(`[GamesLibrarySQLite] 🔍 Doublon détecté: ${gameName} (${gameId}) - ignoré`)
      } else {
        uniqueGames[key] = { gameId, gameData }
      }
    }
    
    console.log(`[GamesLibrarySQLite] 📊 ${Object.keys(uniqueGames).length} jeux uniques après dédoublonnage`)
    
    // Désactiver temporairement les contraintes de clé étrangère pour la migration
    db.pragma('foreign_keys = OFF')
    
    // Compter les jeux migrés
    let migratedCount = 0
    
    // Créer l'utilisateur _legacy si nécessaire
    const insertLegacyUser = db.prepare(`
      INSERT OR IGNORE INTO users 
      (discord_id, username, discriminator, avatar, last_login, created_at, is_admin, is_vip, is_boost)
      VALUES ('_legacy', 'Legacy User', '0000', NULL, ?, ?, 0, 0, 0)
    `)
    const now = new Date().toISOString()
    insertLegacyUser.run(now, now)
    
    // Migrer les jeux uniques
    const insertGame = db.prepare(`
      INSERT OR REPLACE INTO games 
      (user_id, game_id, name, path, version, size, exe_path, launcher_id, install_date, last_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const transaction = db.transaction((gamesMap) => {
      for (const [key, { gameId, gameData }] of Object.entries(gamesMap)) {
        // Si pas d'utilisateur, on utilise '_legacy' comme user_id temporaire
        const userId = gameData.userId || '_legacy'
        
        console.log(`[GamesLibrarySQLite] 📦 Migration: ${gameData.gameName || gameData.name || gameId}`)
        
        // Calculer la taille du jeu si elle n'existe pas
        const gamePath = gameData.path || gameData.gamePath || ''
        let gameSize = parseInt(gameData.size) || 0
        
        if (gameSize === 0 && gamePath && fs.existsSync(gamePath)) {
          console.log(`[GamesLibrarySQLite] 📏 Calcul de la taille de: ${gamePath}`)
          gameSize = calculateDirectorySize(gamePath)
          console.log(`[GamesLibrarySQLite] 📊 Taille calculée: ${(gameSize / 1024 / 1024).toFixed(2)} MB`)
        }
        
        try {
          const result = insertGame.run(
          userId,
          gameId,
          gameData.gameName || gameData.name || 'Jeu inconnu',
            gamePath,
          gameData.version || '1.0',
            gameSize,
          gameData.exePath || null,
          gameData.launcherId || gameId,
          new Date(gameData.installedAt || Date.now()).toISOString(),
          gameData.lastVerified ? new Date(gameData.lastVerified).toISOString() : null
        )
          console.log(`[GamesLibrarySQLite] ✅ Jeu inséré, changes:`, result.changes)
        migratedCount++
        } catch (err) {
          console.error(`[GamesLibrarySQLite] ❌ Erreur insertion jeu ${gameId}:`, err.message)
        }
      }
    })
    
    transaction(uniqueGames)
    
    // Vérifier immédiatement après la transaction
    const countAfterMigration = db.prepare('SELECT COUNT(*) as count FROM games').get()
    console.log(`[GamesLibrarySQLite] 📊 Jeux en BDD après migration:`, countAfterMigration.count)
    
    // Réactiver les contraintes de clé étrangère
    db.pragma('foreign_keys = ON')
    
    console.log(`[GamesLibrarySQLite] ✅ ${migratedCount} jeux migrés avec succès depuis SimpleStore`)
    
    // Marquer la migration comme terminée pour ne pas la refaire
    store.set('_migrationDone', true)
    
    // Sauvegarder les jeux legacy dans SimpleStore comme backup
    store.set('_legacyBackup', legacyGames)
    
  } catch (error) {
    console.error('[GamesLibrarySQLite] ❌ Erreur lors de la migration:', error)
    console.error('[GamesLibrarySQLite] Stack:', error.stack)
  }
}

/**
 * Définir l'utilisateur Discord actuel
 */
async function setCurrentUser(discordId, userData = null) {
  await ensureDatabase()
  
  if (!discordId) {
    currentUserId = null
    return
  }

  // Si on a les données utilisateur, les sauvegarder
  if (userData) {
    const now = new Date().toISOString()
    
    // Vérifier si l'utilisateur existe déjà
    const userExists = db.prepare('SELECT discord_id FROM users WHERE discord_id = ?').get(discordId)
    
    // L'API Discord retourne déjà l'URL complète dans userData.avatar
    // Sinon, construire l'URL complète de l'avatar Discord
    let avatarUrl = null
    if (userData.avatar) {
      // Si c'est déjà une URL complète (commence par http), l'utiliser directement
      if (userData.avatar.startsWith('http')) {
        avatarUrl = userData.avatar
      } else {
        // Sinon, c'est un hash, construire l'URL
        avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${userData.avatar}.png`
      }
    } else if (userData.avatar_url) {
      avatarUrl = userData.avatar_url
    }
    
    if (userExists) {
      // Mettre à jour l'utilisateur existant (ne déclenche PAS ON DELETE CASCADE)
      const updateUser = db.prepare(`
        UPDATE users 
        SET username = ?, discriminator = ?, avatar = ?, avatar_url = ?, last_login = ?, is_admin = ?, is_vip = ?, is_boost = ?
        WHERE discord_id = ?
      `)
      
      updateUser.run(
        userData.username || '',
        userData.discriminator || null,
        userData.avatar || null,
        avatarUrl,
        now,
        userData.isAdmin ? 1 : 0,
        userData.isVip ? 1 : 0,
        userData.isBoost ? 1 : 0,
        discordId
      )
      console.log('[GamesLibrarySQLite] ✅ Utilisateur mis à jour (UPDATE):', discordId)
    } else {
      // Insérer un nouvel utilisateur
    const insertUser = db.prepare(`
        INSERT INTO users 
      (discord_id, username, discriminator, avatar, avatar_url, last_login, created_at, is_admin, is_vip, is_boost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertUser.run(
      discordId,
      userData.username || '',
      userData.discriminator || null,
      userData.avatar || null,
      avatarUrl,
      now,
      now,
      userData.isAdmin ? 1 : 0,
      userData.isVip ? 1 : 0,
      userData.isBoost ? 1 : 0
    )
      console.log('[GamesLibrarySQLite] ✅ Nouvel utilisateur créé (INSERT):', discordId)
    }
  }

  currentUserId = discordId
  console.log('[GamesLibrarySQLite] ✅ Utilisateur défini:', discordId)
  
  // Migrer les jeux legacy vers cet utilisateur
  await migrateLegacyGamesToUser(discordId)
}

/**
 * Migrer les jeux legacy vers un utilisateur spécifique
 */
async function migrateLegacyGamesToUser(userId) {
  await ensureDatabase()
  
  try {
    // Vérifier d'abord combien de jeux legacy existent
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM games WHERE user_id = ?').get('_legacy')
    console.log(`[GamesLibrarySQLite] 🔍 Jeux legacy avant migration:`, countBefore.count)
    
    const countUser = db.prepare('SELECT COUNT(*) as count FROM games WHERE user_id = ?').get(userId)
    console.log(`[GamesLibrarySQLite] 🔍 Jeux utilisateur avant migration:`, countUser.count)
    
    const updateLegacy = db.prepare(`
      UPDATE games 
      SET user_id = ? 
      WHERE user_id = '_legacy' AND game_id NOT IN (
        SELECT game_id FROM games WHERE user_id = ?
      )
    `)
    
    const result = updateLegacy.run(userId, userId)
    
    console.log(`[GamesLibrarySQLite] 🔍 Résultat UPDATE: changes=${result.changes}`)
    
    // Vérifier après
    const countAfter = db.prepare('SELECT COUNT(*) as count FROM games WHERE user_id = ?').get('_legacy')
    console.log(`[GamesLibrarySQLite] 🔍 Jeux legacy après migration:`, countAfter.count)
    
    const countUserAfter = db.prepare('SELECT COUNT(*) as count FROM games WHERE user_id = ?').get(userId)
    console.log(`[GamesLibrarySQLite] 🔍 Jeux utilisateur après migration:`, countUserAfter.count)
    
    if (result.changes > 0) {
      console.log(`[GamesLibrarySQLite] ✅ ${result.changes} jeux legacy migrés vers l'utilisateur ${userId}`)
    } else {
      console.log(`[GamesLibrarySQLite] ℹ️  Aucun jeu legacy à migrer (déjà migrés ou aucun jeu)`)
    }
  } catch (error) {
    console.warn('[GamesLibrarySQLite] ⚠️  Erreur lors de la migration legacy:', error.message)
    console.error('[GamesLibrarySQLite] Stack:', error.stack)
  }
}

/**
 * S'assurer que la base de données est initialisée
 */
async function ensureDatabase() {
  if (!dbInitialized || !db) {
    await initDatabase()
  }
  return db
}

/**
 * Obtenir l'utilisateur actuel
 */
function getCurrentUserId() {
  return currentUserId
}

/**
 * Charger un utilisateur depuis la base
 */
async function loadUser(discordId) {
  await ensureDatabase()
  
  const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId)
  
  if (user) {
    currentUserId = user.discord_id
    return {
      id: user.discord_id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      isAdmin: user.is_admin === 1,
      isVip: user.is_vip === 1,
      isBoost: user.is_boost === 1
    }
  }
  
  return null
}

/**
 * Sauvegarder un jeu installé
 */
async function saveInstalledGame(gameId, gameData) {
  await ensureDatabase()
  
  if (!currentUserId) {
    throw new Error('Aucun utilisateur connecté')
  }

  if (!gameId) {
    throw new Error('gameId manquant')
  }

  const insertGame = db.prepare(`
    INSERT OR REPLACE INTO games 
    (user_id, game_id, name, path, version, size, exe_path, launcher_id, install_date, last_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  
  insertGame.run(
    currentUserId,
    gameId,
    gameData.name || gameData.gameName || 'Jeu inconnu',
    gameData.path || gameData.gamePath || '',
    gameData.version || '1.0',
    gameData.size || 0,
    gameData.exePath || gameData.exe_path || null,
    gameData.launcherId || gameData.launcher_id || gameId,
    gameData.installedAt ? new Date(gameData.installedAt).toISOString() : now,
    now
  )

  return true
}

/**
 * Récupérer un jeu installé
 */
async function getInstalledGame(gameId) {
  await ensureDatabase()
  
  if (!currentUserId || !gameId) {
    return null
  }

  const game = db.prepare(`
    SELECT * FROM games 
    WHERE user_id = ? AND game_id = ?
  `).get(currentUserId, gameId)

  if (!game) return null

  return {
    gameId: game.game_id,
    gameName: game.name,
    name: game.name,
    path: game.path,
    gamePath: game.path,
    exePath: game.exe_path,
    launcherId: game.launcher_id,
    version: game.version,
    size: game.size,
    installedAt: game.install_date,
    lastVerified: game.last_verified,
    lastPlayed: game.last_played,
    playTime: game.play_time
  }
}

/**
 * Récupérer tous les jeux installés pour l'utilisateur actuel
 */
async function getAllInstalledGames(userId = null) {
  await ensureDatabase()
  
  const targetUserId = userId || currentUserId
  
  if (!targetUserId) {
    return []
  }

  const games = db.prepare(`
    SELECT * FROM games 
    WHERE user_id = ?
    ORDER BY install_date DESC
  `).all(targetUserId)

  return games.map(game => ({
    gameId: game.game_id,
    gameName: game.name,
    name: game.name,
    path: game.path,
    gamePath: game.path,
    exePath: game.exe_path,
    launcherId: game.launcher_id,
    version: game.version,
    size: game.size,
    installedAt: game.install_date,
    lastVerified: game.last_verified,
    lastPlayed: game.last_played,
    playTime: game.play_time
  }))
}

/**
 * Vérifier si un jeu est installé
 */
async function isGameInstalled(gameId) {
  await ensureDatabase()
  
  if (!currentUserId || !gameId) {
    return false
  }

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM games 
    WHERE user_id = ? AND game_id = ?
  `).get(currentUserId, gameId)

  return result.count > 0
}

/**
 * Supprimer un jeu installé
 */
async function removeInstalledGame(gameId, userId = null) {
  await ensureDatabase()
  
  if (!gameId) {
    console.log('[GamesLibrarySQLite] ❌ removeInstalledGame: gameId manquant')
    return false
  }

  const useUserId = userId || currentUserId

  console.log('[GamesLibrarySQLite] 🗑️ Suppression du jeu:', gameId, 'userId:', useUserId || 'TOUS')

  // Si on a un userId, supprimer seulement pour cet utilisateur
  // Sinon supprimer pour tous (au cas où currentUserId n'est pas défini)
  let result
  if (useUserId) {
    result = db.prepare(`
    DELETE FROM games 
      WHERE user_id = ? AND (launcher_id = ? OR game_id = ?)
    `).run(useUserId, String(gameId), String(gameId))
  } else {
    // Pas de userId disponible, supprimer par launcher_id/game_id uniquement
    result = db.prepare(`
      DELETE FROM games 
      WHERE launcher_id = ? OR game_id = ?
    `).run(String(gameId), String(gameId))
  }

  console.log('[GamesLibrarySQLite] 📊 Lignes supprimées:', result.changes)
  return result.changes > 0
}

/**
 * Sauvegarder plusieurs jeux (après un scan)
 */
async function saveInstalledGamesFromScan(installedGames) {
  await ensureDatabase()
  
  if (!currentUserId || !Array.isArray(installedGames)) {
    return 0
  }

  const insertGame = db.prepare(`
    INSERT OR REPLACE INTO games 
    (user_id, game_id, name, path, version, size, exe_path, launcher_id, install_date, last_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  let updatedCount = 0

  const transaction = db.transaction((games) => {
    for (const game of games) {
      const catalogGameId = game.catalogGameId
      const gameId = catalogGameId || game.gameId || game.id || game.launcherId
      const gameName = game.name || game.gameName || game.title
      const gamePath = game.path || game.gamePath || game.installFolder
      const launcherId = game.launcherId

      if (gamePath && gameId) {
        // Vérifier si le jeu existe déjà
        const existing = db.prepare(`
          SELECT install_date FROM games 
          WHERE user_id = ? AND game_id = ?
        `).get(currentUserId, String(gameId))

        insertGame.run(
          currentUserId,
          String(gameId),
          gameName,
          gamePath,
          game.version || '1.0',
          game.size || 0,
          game.exePath || null,
          launcherId || gameId,
          existing ? existing.install_date : now,
          now
        )
        
        updatedCount++
      }
    }
  })

  transaction(installedGames)

  return updatedCount
}

/**
 * Vérifier que les jeux installés existent toujours sur le disque
 */
async function verifyInstalledGames(fsExistsSync) {
  await ensureDatabase()
  
  if (!currentUserId) {
    return []
  }

  const games = db.prepare(`
    SELECT * FROM games WHERE user_id = ?
  `).all(currentUserId)

  const validGames = []
  const now = new Date().toISOString()

  const deleteInvalid = db.prepare(`
    DELETE FROM games WHERE user_id = ? AND game_id = ?
  `)

  const updateVerified = db.prepare(`
    UPDATE games SET last_verified = ? WHERE user_id = ? AND game_id = ?
  `)

  const transaction = db.transaction(() => {
    for (const game of games) {
      const gamePath = game.path
      
      if (gamePath && fsExistsSync(gamePath)) {
        updateVerified.run(now, currentUserId, game.game_id)
        validGames.push({
          gameId: game.game_id,
          gameName: game.name,
          name: game.name,
          path: game.path,
          gamePath: game.path,
          exePath: game.exe_path,
          launcherId: game.launcher_id,
          version: game.version,
          size: game.size,
          installedAt: game.install_date,
          lastVerified: now
        })
      } else {
        deleteInvalid.run(currentUserId, game.game_id)
      }
    }
  })

  transaction()

  return validGames
}

/**
 * Statistiques pour l'utilisateur actuel
 */
async function getStatistics(userId = null) {
  await ensureDatabase()
  
  const targetUserId = userId || currentUserId
  
  console.log('[GamesLibrarySQLite] getStatistics appelée avec userId:', userId, 'currentUserId:', currentUserId, 'targetUserId:', targetUserId)
  
  if (!targetUserId) {
    console.warn('[GamesLibrarySQLite] Aucun userId fourni, retour des stats globales')
    // Si pas d'userId, retourner les stats globales
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_games,
        SUM(size) as total_size,
        SUM(play_time) as total_play_time,
        AVG(size) as avg_game_size,
        MAX(install_date) as last_install_date
      FROM games
    `).get()

    console.log('[GamesLibrarySQLite] Stats globales:', stats)
    
    return {
      totalGames: stats.total_games || 0,
      totalSize: stats.total_size || 0,
      totalPlayTime: stats.total_play_time || 0,
      avgGameSize: stats.avg_game_size || 0,
      lastInstallDate: stats.last_install_date
    }
  }

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_games,
      SUM(size) as total_size,
      SUM(play_time) as total_play_time,
      AVG(size) as avg_game_size,
      MAX(install_date) as last_install_date
    FROM games 
    WHERE user_id = ?
  `).get(targetUserId)

  console.log('[GamesLibrarySQLite] Stats pour userId', targetUserId, ':', stats)

  return {
    totalGames: stats.total_games || 0,
    totalSize: stats.total_size || 0,
    totalPlayTime: stats.total_play_time || 0,
    avgGameSize: stats.avg_game_size || 0,
    lastInstallDate: stats.last_install_date
  }
}

/**
 * Jeux les plus joués
 */
async function getMostPlayedGames(limit = 10, userId = null) {
  await ensureDatabase()
  
  const targetUserId = userId || currentUserId
  
  if (!targetUserId) {
    return []
  }

  return db.prepare(`
    SELECT * FROM games 
    WHERE user_id = ? AND play_time > 0
    ORDER BY play_time DESC
    LIMIT ?
  `).all(targetUserId, limit)
}

/**
 * Jeux récemment joués
 */
async function getRecentlyPlayed(limit = 10, userId = null) {
  await ensureDatabase()
  
  const targetUserId = userId || currentUserId
  
  if (!targetUserId) {
    return []
  }

  return db.prepare(`
    SELECT * FROM games 
    WHERE user_id = ? AND last_played IS NOT NULL
    ORDER BY last_played DESC
    LIMIT ?
  `).all(targetUserId, limit)
}

/**
 * Rechercher des jeux
 */
async function searchGames(query, userId = null) {
  await ensureDatabase()
  
  const targetUserId = userId || currentUserId
  
  if (!targetUserId) {
    return []
  }

  return db.prepare(`
    SELECT * FROM games 
    WHERE user_id = ? AND name LIKE ?
    ORDER BY name
  `).all(targetUserId, `%${query}%`)
}

/**
 * Mettre à jour la dernière fois joué
 */
async function updateLastPlayed(gameId) {
  await ensureDatabase()
  
  if (!currentUserId || !gameId) {
    return false
  }

  const result = db.prepare(`
    UPDATE games 
    SET last_played = ? 
    WHERE user_id = ? AND game_id = ?
  `).run(new Date().toISOString(), currentUserId, gameId)

  return result.changes > 0
}

/**
 * Incrémenter le temps de jeu
 */
async function incrementPlayTime(gameId, minutes) {
  await ensureDatabase()
  
  console.log('[GamesLibrarySQLite] 💾 incrementPlayTime appelé:', { gameId, minutes, currentUserId })
  
  if (!currentUserId || !gameId) {
    console.log('[GamesLibrarySQLite] ❌ Paramètres manquants')
    return false
  }

  // Vérifier d'abord si le jeu existe
  const game = db.prepare(`
    SELECT id, name, play_time, launcher_id, game_id 
    FROM games 
    WHERE user_id = ? AND (launcher_id = ? OR game_id = ?)
  `).get(currentUserId, gameId, gameId)
  
  console.log('[GamesLibrarySQLite] 🔍 Jeu trouvé:', game)

  if (!game) {
    console.log('[GamesLibrarySQLite] ❌ Jeu non trouvé dans la base')
    return false
  }

  // Mettre à jour par launcher_id (plus fiable)
  const result = db.prepare(`
    UPDATE games 
    SET play_time = play_time + ? 
    WHERE user_id = ? AND launcher_id = ?
  `).run(minutes, currentUserId, gameId)

  console.log('[GamesLibrarySQLite] ✅ Mise à jour play_time:', { 
    changes: result.changes, 
    oldPlayTime: game.play_time, 
    newPlayTime: game.play_time + minutes 
  })

  return result.changes > 0
}

/**
 * Obtenir les statistiques globales
 */
async function getGlobalStatistics() {
  await ensureDatabase()
  
  const stats = {
    totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    totalGames: db.prepare('SELECT COUNT(*) as count FROM games').get().count,
    totalPlayTime: db.prepare('SELECT SUM(play_time) as total FROM games').get().total || 0
  }

  // Taille de la base de données
  try {
    const dbPath = path.join(app.getPath('userData'), 'games-library.db')
    const fileStats = fs.statSync(dbPath)
    stats.dbSize = fileStats.size
  } catch (error) {
    stats.dbSize = 0
  }

  return stats
}

/**
 * Optimiser la base de données
 */
async function vacuum() {
  await ensureDatabase()
  
  db.exec('VACUUM')
  console.log('[GamesLibrarySQLite] ✅ Base de données optimisée')
}

/**
 * Créer un backup
 */
async function backup(backupPath) {
  await ensureDatabase()
  
  const dbPath = path.join(app.getPath('userData'), 'games-library.db')
  fs.copyFileSync(dbPath, backupPath)
  console.log('[GamesLibrarySQLite] ✅ Backup créé:', backupPath)
}

/**
 * Fermer la base de données
 */
function close() {
  if (db) {
    db.close()
    db = null
    dbInitialized = false
    console.log('[GamesLibrarySQLite] ✅ Base de données fermée')
  }
}

/**
 * FONCTION DE DÉBOGAGE TEMPORAIRE
 * Interroge directement la base de données pour voir son contenu
 */
async function debugDatabase() {
  await ensureDatabase()
  
  const users = db.prepare('SELECT discord_id, username FROM users').all()
  const games = db.prepare('SELECT user_id, game_id, name FROM games').all()
  const gamesCount = db.prepare('SELECT user_id, COUNT(*) as count FROM games GROUP BY user_id').all()
  
  console.log('[GamesLibrarySQLite] === DEBUG DATABASE ===')
  console.log('[GamesLibrarySQLite] Users:', JSON.stringify(users, null, 2))
  console.log('[GamesLibrarySQLite] Games:', JSON.stringify(games, null, 2))
  console.log('[GamesLibrarySQLite] Games count by user:', JSON.stringify(gamesCount, null, 2))
  console.log('[GamesLibrarySQLite] Current user ID:', currentUserId)
  
  return {
    users,
    games,
    gamesCount,
    currentUserId
  }
}

/**
 * Récupérer tous les utilisateurs
 */
async function getAllUsers() {
  await ensureDatabase()
  
  const users = db.prepare(`
    SELECT 
      discord_id as id,
      username,
      discriminator,
      avatar,
      avatar_url,
      last_login,
      created_at,
      is_admin,
      is_vip,
      is_boost
    FROM users
    ORDER BY last_login DESC
  `).all()
  
  // Convertir les données SQLite en format JavaScript
  return users.map(user => {
    // Construire l'URL de l'avatar de manière sécurisée
    let avatarUrl = null
    if (user.avatar_url) {
      // Si avatar_url existe et est déjà une URL complète, l'utiliser directement
      if (user.avatar_url.startsWith('http')) {
        // Nettoyer l'URL : supprimer les doubles extensions .png.png
        avatarUrl = user.avatar_url.replace(/\.png\.png$/, '.png').replace(/\.jpg\.jpg$/, '.jpg').replace(/\.gif\.gif$/, '.gif').replace(/\.webp\.webp$/, '.webp')
      } else {
        // Si c'est juste un hash sans http, construire l'URL
        // Nettoyer le hash : supprimer .png s'il est déjà présent
        const cleanHash = user.avatar_url.replace(/\.(png|jpg|gif|webp)$/, '')
        avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${cleanHash}.png`
      }
    } else if (user.avatar) {
      // Si pas d'avatar_url mais un hash avatar, construire l'URL
      // Nettoyer le hash : supprimer .png s'il est déjà présent
      const cleanHash = user.avatar.replace(/\.(png|jpg|gif|webp)$/, '')
      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${cleanHash}.png`
    }
    
    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      avatarUrl: avatarUrl,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      isAdmin: user.is_admin === 1,
      isVip: user.is_vip === 1,
      isBoost: user.is_boost === 1
    }
  })
}

/**
 * Supprimer un utilisateur
 */
async function deleteUser(discordId) {
  await ensureDatabase()
  
  const deleteUserStmt = db.prepare('DELETE FROM users WHERE discord_id = ?')
  const result = deleteUserStmt.run(discordId)
  
  console.log('[GamesLibrarySQLite] ✅ Utilisateur supprimé:', discordId)
  return result.changes > 0
}

// Export
export const gamesLibrarySQLite = {
  initDatabase,
  setCurrentUser,
  getCurrentUserId,
  loadUser,
  getAllUsers,
  deleteUser,
  saveInstalledGame,
  getInstalledGame,
  getAllInstalledGames,
  isGameInstalled,
  removeInstalledGame,
  saveInstalledGamesFromScan,
  verifyInstalledGames,
  getStatistics,
  getMostPlayedGames,
  getRecentlyPlayed,
  searchGames,
  updateLastPlayed,
  incrementPlayTime,
  getGlobalStatistics,
  vacuum,
  backup,
  debugDatabase,
  close
}

