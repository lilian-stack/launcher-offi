/**
 * Script pour ajouter de nouvelles vidéos Steam à la base de données
 * Usage: node scripts/add-steam-video.js <steamAppId> <trailerId> <gameName>
 */

const fs = require('fs')
const path = require('path')

function addSteamVideoToDatabase(steamAppId, trailerId, gameName) {
  const databasePath = path.join(__dirname, '../src/services/steamVideoDatabase.js')
  
  try {
    // Lire le fichier actuel
    let content = fs.readFileSync(databasePath, 'utf8')
    
    // Créer la nouvelle entrée
    const newEntry = `  
  // ${gameName}
  '${steamAppId}': {
    trailerId: '${trailerId}',
    name: '${gameName}',
    videoUrl: 'https://video.akamai.steamstatic.com/store_trailers/${trailerId}/movie_max.mp4'
  },`
    
    // Trouver la position où insérer (avant la fermeture de l'objet)
    const insertPosition = content.lastIndexOf('}')
    const beforeClosing = content.substring(0, insertPosition)
    const afterClosing = content.substring(insertPosition)
    
    // Insérer la nouvelle entrée
    const updatedContent = beforeClosing + newEntry + '\n' + afterClosing
    
    // Écrire le fichier mis à jour
    fs.writeFileSync(databasePath, updatedContent, 'utf8')
    
    console.log(`✅ Vidéo ajoutée avec succès:`)
    console.log(`   Jeu: ${gameName}`)
    console.log(`   Steam App ID: ${steamAppId}`)
    console.log(`   Trailer ID: ${trailerId}`)
    console.log(`   URL: https://video.akamai.steamstatic.com/store_trailers/${trailerId}/movie_max.mp4`)
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout:', error.message)
  }
}

// Fonction pour extraire l'ID de trailer depuis une URL Steam complète
function extractTrailerIdFromUrl(videoUrl) {
  const match = videoUrl.match(/store_trailers\/(\d+)\//)
  return match ? match[1] : null
}

// Fonction pour valider une URL de vidéo Steam
async function validateSteamVideoUrl(trailerId) {
  const testUrl = `https://video.akamai.steamstatic.com/store_trailers/${trailerId}/movie_max.mp4`
  
  try {
    const response = await fetch(testUrl, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    return false
  }
}

// Interface en ligne de commande
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 3) {
    console.log('Usage: node scripts/add-steam-video.js <steamAppId> <trailerId> <gameName>')
    console.log('Ou: node scripts/add-steam-video.js <steamAppId> <videoUrl> <gameName>')
    console.log('')
    console.log('Exemples:')
    console.log('  node scripts/add-steam-video.js 2166980 257093509 "Spider-Man 2"')
    console.log('  node scripts/add-steam-video.js 1091500 "https://video.akamai.steamstatic.com/store_trailers/256694498/movie_max.mp4" "Cyberpunk 2077"')
    process.exit(1)
  }
  
  const steamAppId = args[0]
  let trailerId = args[1]
  const gameName = args[2]
  
  // Si le deuxième argument est une URL, extraire l'ID
  if (trailerId.startsWith('http')) {
    const extractedId = extractTrailerIdFromUrl(trailerId)
    if (!extractedId) {
      console.error('❌ Impossible d\'extraire l\'ID de trailer depuis l\'URL:', trailerId)
      process.exit(1)
    }
    trailerId = extractedId
    console.log(`🔍 ID de trailer extrait: ${trailerId}`)
  }
  
  // Valider l'URL
  console.log('🔍 Validation de l\'URL...')
  const isValid = await validateSteamVideoUrl(trailerId)
  
  if (!isValid) {
    console.warn('⚠️  L\'URL ne semble pas accessible, mais on continue quand même...')
  } else {
    console.log('✅ URL validée avec succès!')
  }
  
  // Ajouter à la base de données
  addSteamVideoToDatabase(steamAppId, trailerId, gameName)
}

// Fonction pour lister les jeux populaires sans vidéo (pour aide)
function listPopularGamesWithoutVideo() {
  console.log('🎮 Jeux populaires qui pourraient avoir des vidéos Steam:')
  console.log('')
  
  const suggestions = [
    { name: 'Baldur\'s Gate 3', steamId: '1086940' },
    { name: 'Hogwarts Legacy', steamId: '990080' },
    { name: 'Starfield', steamId: '1716740' },
    { name: 'Palworld', steamId: '1623730' },
    { name: 'Counter-Strike 2', steamId: '730' },
    { name: 'Dota 2', steamId: '570' },
    { name: 'Apex Legends', steamId: '1172470' },
    { name: 'Forza Horizon 5', steamId: '1551360' },
    { name: 'FIFA 24', steamId: '2195250' },
    { name: 'Mortal Kombat 1', steamId: '1971870' }
  ]
  
  suggestions.forEach(game => {
    console.log(`  ${game.name} (Steam ID: ${game.steamId})`)
    console.log(`    URL Steam: https://store.steampowered.com/app/${game.steamId}/`)
  })
  
  console.log('')
  console.log('💡 Pour trouver l\'ID de trailer:')
  console.log('   1. Aller sur la page Steam du jeu')
  console.log('   2. Regarder la vidéo de présentation')
  console.log('   3. Inspecter l\'élément vidéo pour trouver l\'URL')
  console.log('   4. Extraire l\'ID depuis l\'URL du type: store_trailers/XXXXXX/movie_max.mp4')
}

// Exécuter selon les arguments
if (require.main === module) {
  if (process.argv.includes('--list') || process.argv.includes('-l')) {
    listPopularGamesWithoutVideo()
  } else {
    main()
  }
}

module.exports = { addSteamVideoToDatabase, extractTrailerIdFromUrl, validateSteamVideoUrl }