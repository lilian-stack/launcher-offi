/**
 * Script pour scanner les jeux du catalogue et identifier ceux avec des IDs Steam
 */

const { gamesCacheService } = require('../src/services/gamesCache.js')
const { steamVideoService } = require('../src/services/steamVideoService.js')
const { hasSteamVideo } = require('../src/services/steamVideoDatabase.js')

async function scanGamesForSteamIds() {
  console.log('🔍 Scan des jeux du catalogue pour les IDs Steam...\n')
  
  try {
    // Charger tous les jeux du catalogue
    const games = await gamesCacheService.getGames()
    console.log(`📊 ${games.length} jeux chargés depuis le catalogue\n`)
    
    const gamesWithSteamId = []
    const gamesWithSteamVideo = []
    const gamesWithoutSteamId = []
    
    games.forEach(game => {
      const steamId = steamVideoService.extractSteamId(game)
      
      if (steamId) {
        gamesWithSteamId.push({
          name: game.name || game.title,
          id: game.id,
          steamId: steamId,
          hasVideo: hasSteamVideo(steamId)
        })
        
        if (hasSteamVideo(steamId)) {
          gamesWithSteamVideo.push({
            name: game.name || game.title,
            id: game.id,
            steamId: steamId
          })
        }
      } else {
        gamesWithoutSteamId.push({
          name: game.name || game.title,
          id: game.id
        })
      }
    })
    
    // Afficher les résultats
    console.log('📈 RÉSULTATS DU SCAN:')
    console.log(`   ✅ Jeux avec ID Steam: ${gamesWithSteamId.length}`)
    console.log(`   🎬 Jeux avec vidéo Steam: ${gamesWithSteamVideo.length}`)
    console.log(`   ❌ Jeux sans ID Steam: ${gamesWithoutSteamId.length}`)
    console.log('')
    
    // Afficher les jeux avec vidéos Steam disponibles
    if (gamesWithSteamVideo.length > 0) {
      console.log('🎬 JEUX AVEC VIDÉOS STEAM DISPONIBLES:')
      gamesWithSteamVideo.forEach(game => {
        console.log(`   ✅ ${game.name} (Steam ID: ${game.steamId})`)
      })
      console.log('')
    }
    
    // Afficher les jeux avec ID Steam mais sans vidéo
    const gamesWithSteamIdButNoVideo = gamesWithSteamId.filter(game => !game.hasVideo)
    if (gamesWithSteamIdButNoVideo.length > 0) {
      console.log('🎮 JEUX AVEC ID STEAM MAIS SANS VIDÉO (candidats pour ajout):')
      gamesWithSteamIdButNoVideo.slice(0, 20).forEach(game => {
        console.log(`   🔍 ${game.name} (Steam ID: ${game.steamId})`)
        console.log(`      URL Steam: https://store.steampowered.com/app/${game.steamId}/`)
      })
      
      if (gamesWithSteamIdButNoVideo.length > 20) {
        console.log(`   ... et ${gamesWithSteamIdButNoVideo.length - 20} autres`)
      }
      console.log('')
    }
    
    // Afficher quelques jeux populaires sans ID Steam
    const popularGamesWithoutSteam = gamesWithoutSteamId
      .filter(game => {
        const name = game.name.toLowerCase()
        return name.includes('call of duty') || 
               name.includes('assassin') || 
               name.includes('fifa') || 
               name.includes('battlefield') || 
               name.includes('mortal kombat') ||
               name.includes('street fighter') ||
               name.includes('resident evil') ||
               name.includes('final fantasy')
      })
      .slice(0, 10)
    
    if (popularGamesWithoutSteam.length > 0) {
      console.log('🎯 JEUX POPULAIRES SANS ID STEAM (à vérifier manuellement):')
      popularGamesWithoutSteam.forEach(game => {
        console.log(`   ❓ ${game.name}`)
      })
      console.log('')
    }
    
    // Statistiques finales
    const steamCoverage = ((gamesWithSteamId.length / games.length) * 100).toFixed(1)
    const videoCoverage = ((gamesWithSteamVideo.length / games.length) * 100).toFixed(1)
    
    console.log('📊 STATISTIQUES:')
    console.log(`   🎮 Couverture Steam ID: ${steamCoverage}% (${gamesWithSteamId.length}/${games.length})`)
    console.log(`   🎬 Couverture vidéo Steam: ${videoCoverage}% (${gamesWithSteamVideo.length}/${games.length})`)
    console.log('')
    
    // Suggestions d'amélioration
    console.log('💡 SUGGESTIONS:')
    console.log(`   1. Ajouter des vidéos pour ${gamesWithSteamIdButNoVideo.length} jeux avec ID Steam`)
    console.log(`   2. Rechercher des IDs Steam pour ${popularGamesWithoutSteam.length} jeux populaires`)
    console.log(`   3. Utiliser le script add-steam-video.js pour ajouter de nouvelles vidéos`)
    
  } catch (error) {
    console.error('❌ Erreur lors du scan:', error)
  }
}

// Fonction pour tester les vidéos existantes
async function testExistingVideos() {
  console.log('🧪 Test des vidéos Steam existantes...\n')
  
  try {
    const games = await gamesCacheService.getGames()
    const gamesWithVideo = games.filter(game => {
      const steamId = steamVideoService.extractSteamId(game)
      return steamId && hasSteamVideo(steamId)
    })
    
    console.log(`🎬 Test de ${gamesWithVideo.length} jeux avec vidéos Steam...\n`)
    
    for (const game of gamesWithVideo) {
      const steamId = steamVideoService.extractSteamId(game)
      console.log(`🎮 ${game.name || game.title}`)
      
      try {
        const videoUrl = await steamVideoService.getVideoUrlForGame(game)
        if (videoUrl) {
          const isAccessible = await steamVideoService.testVideoUrl(videoUrl)
          console.log(`   ${isAccessible ? '✅' : '❌'} ${videoUrl}`)
        } else {
          console.log(`   ❌ Aucune URL générée`)
        }
      } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

// Interface en ligne de commande
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--test') || args.includes('-t')) {
    await testExistingVideos()
  } else {
    await scanGamesForSteamIds()
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main()
}

module.exports = { scanGamesForSteamIds, testExistingVideos }