/**
 * Script de migration manuelle des jeux depuis SimpleStore (JSON) vers SQLite
 */

import { app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('\n=== MIGRATION DES JEUX VERS SQLITE ===\n')

// Initialiser Electron app pour avoir accès aux chemins
await app.whenReady()

const userDataPath = app.getPath('userData')
console.log('[Migration] userData:', userDataPath)

// Importer les modules nécessaires
const { installedGamesStore } = await import('../electron/installed-games-store.js')
const { gamesLibrarySQLite } = await import('../electron/games-library-sqlite.mjs')

try {
  // 1. Récupérer les jeux depuis SimpleStore
  console.log('\n[1/4] Récupération des jeux depuis SimpleStore (JSON)...')
  const store = await installedGamesStore.ensureStore()
  
  // Essayer différents emplacements possibles
  const allData = store.store || {}
  console.log('[Migration] Clés disponibles:', Object.keys(allData))
  
  let allGames = {}
  
  // Méthode 1: Récupérer depuis 'games' (ancien format)
  const legacyGames = store.get('games', {})
  if (Object.keys(legacyGames).length > 0) {
    console.log(`[Migration] ✅ ${Object.keys(legacyGames).length} jeux trouvés dans 'games'`)
    allGames = { ...allGames, ...legacyGames }
  }
  
  // Méthode 2: Récupérer depuis 'users.{userId}.games'
  const users = store.get('users', {})
  for (const [userId, userData] of Object.entries(users)) {
    if (userData.games) {
      console.log(`[Migration] ✅ ${Object.keys(userData.games).length} jeux trouvés pour l'utilisateur ${userId}`)
      // Ajouter userId à chaque jeu
      for (const [gameId, gameData] of Object.entries(userData.games)) {
        allGames[gameId] = { ...gameData, userId }
      }
    }
  }
  
  const totalGames = Object.keys(allGames).length
  console.log(`\n[Migration] 📊 Total: ${totalGames} jeux à migrer\n`)
  
  if (totalGames === 0) {
    console.log('[Migration] ⚠️  Aucun jeu à migrer')
    console.log('[Migration] Vérifiez que vous avez bien des jeux installés')
    app.quit()
    process.exit(0)
  }
  
  // 2. Initialiser SQLite
  console.log('[2/4] Initialisation de la base de données SQLite...')
  await gamesLibrarySQLite.initDatabase()
  console.log('[Migration] ✅ SQLite initialisé\n')
  
  // 3. Migrer les jeux vers SQLite
  console.log('[3/4] Migration des jeux vers SQLite...')
  let migratedCount = 0
  let errors = []
  
  for (const [gameId, gameData] of Object.entries(allGames)) {
    try {
      const userId = gameData.userId || '_legacy'
      
      // Si c'est un vrai userId Discord, définir l'utilisateur
      if (userId !== '_legacy' && userId.match(/^\d+$/)) {
        await gamesLibrarySQLite.setCurrentUser(userId, {
          username: gameData.username || 'Unknown',
          discriminator: '0000',
          avatar: null,
          isAdmin: false,
          isVip: false,
          isBoost: false
        })
      }
      
      // Ajouter le jeu
      await gamesLibrarySQLite.addGame({
        gameId: gameId,
        name: gameData.gameName || gameData.name || 'Jeu inconnu',
        path: gameData.path || gameData.gamePath || '',
        version: gameData.version || '1.0',
        size: parseInt(gameData.size) || 0,
        exePath: gameData.exePath || null,
        launcherId: gameData.launcherId || gameId
      }, userId !== '_legacy' ? userId : null)
      
      migratedCount++
      console.log(`[Migration] ✅ ${migratedCount}/${totalGames} - ${gameData.gameName || gameId}`)
    } catch (error) {
      errors.push({ gameId, error: error.message })
      console.error(`[Migration] ❌ Erreur pour ${gameId}:`, error.message)
    }
  }
  
  // 4. Résumé
  console.log('\n[4/4] Résumé de la migration:')
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Jeux migrés avec succès: ${migratedCount}`)
  if (errors.length > 0) {
    console.log(`❌ Erreurs: ${errors.length}`)
    errors.forEach(e => console.log(`   - ${e.gameId}: ${e.error}`))
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  
  // Vérifier les jeux dans SQLite
  console.log('[Vérification] Lecture depuis SQLite...')
  const sqliteGames = await gamesLibrarySQLite.getAllInstalledGames()
  console.log(`[Vérification] ✅ ${sqliteGames.length} jeux dans SQLite\n`)
  
  if (sqliteGames.length > 0) {
    console.log('[Vérification] Jeux trouvés:')
    sqliteGames.forEach(game => {
      console.log(`   - ${game.name} (${game.game_id})`)
    })
  }
  
  console.log('\n✅ Migration terminée avec succès!')
  console.log('\n💡 Redémarrez l\'application avec: npm run start\n')
  
} catch (error) {
  console.error('\n❌ Erreur lors de la migration:', error)
  console.error('Stack:', error.stack)
  process.exit(1)
}

app.quit()
process.exit(0)
