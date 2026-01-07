/**
 * Script pour ajouter manuellement un jeu à la bibliothèque SQLite
 */

const path = require('path')
const fs = require('fs')

// Simuler le service SQLite
const sqliteService = require('../electron/utils/sqlite-service.js')

async function addGameToLibrary() {
  try {
    console.log('🚀 Initialisation du service SQLite...')
    
    // Initialiser la base de données
    const dbPath = path.join(__dirname, '../electron/data/games-library.db')
    await sqliteService.initDatabase(dbPath)
    
    console.log('✅ Service SQLite initialisé')
    
    // Ajouter Geometry Dash
    const gameData = {
      name: 'Geometry Dash',
      installFolder: 'C:\\Games\\Geometry Dash',
      path: 'C:\\Games\\Geometry Dash',
      executable: 'GeometryDash.exe',
      exe: 'GeometryDash.exe',
      version: '1.0',
      launcherId: 'geometry-dash'
    }
    
    console.log('📦 Ajout de Geometry Dash à la bibliothèque...')
    const result = await sqliteService.saveInstalledGame('geometry-dash', gameData)
    
    if (result.success) {
      console.log('✅ Geometry Dash ajouté avec succès!')
    } else {
      console.error('❌ Erreur lors de l\'ajout:', result.error)
    }
    
    // Vérifier les jeux installés
    console.log('📋 Vérification des jeux installés...')
    const games = await sqliteService.getAllInstalledGames()
    console.log('🎮 Jeux installés:', games.length)
    games.forEach(game => {
      console.log(`  - ${game.name} (${game.id})`)
    })
    
    // Debug du service
    console.log('🔍 Debug du service SQLite...')
    const debug = await sqliteService.debug()
    console.log('Debug info:', JSON.stringify(debug, null, 2))
    
  } catch (error) {
    console.error('❌ Erreur:', error)
  }
}

// Exécuter le script
if (require.main === module) {
  addGameToLibrary()
}

module.exports = { addGameToLibrary }