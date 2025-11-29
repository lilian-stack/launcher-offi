import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { addGameToSupabase } from '../../electron/supabase-games-service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FILE_PATH = 'C:\\Users\\lilia\\Pictures\\Nouveau dossier\\jeux_steam.txt'
const BATCH_SIZE = 35
const DELAY_BETWEEN_REQUESTS = 2000 // 2 secondes entre chaque requête Steam

// Fonction pour vérifier si une ligne est déjà traitée
function isLineProcessed(line) {
  return line.includes('✓') || line.includes('✅') || line.includes('[TRAITÉ]') || line.includes('[AJOUTÉ]')
}

// Fonction pour marquer une ligne comme traitée
function markLineAsProcessed(line) {
  if (isLineProcessed(line)) {
    return line
  }
  const trimmed = line.trim()
  if (trimmed && trimmed.includes('|')) {
    return line.trimEnd() + ' [AJOUTÉ] ✓'
  }
  return line
}

// Fonction pour extraire l'ID Steam depuis l'URL
function extractSteamAppId(url) {
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/)
  return match ? match[1] : null
}

// Fonction pour extraire les informations d'une ligne
function parseLine(line) {
  const match = line.match(/^\s*(\d+)\.\s+(.+?)\s+\|\s+(https?:\/\/[^\s]+)/)
  if (match) {
    const url = match[3].trim()
    const appId = extractSteamAppId(url)
    if (appId) {
      return {
        number: parseInt(match[1]),
        name: match[2].trim(),
        url: url,
        appId: appId,
        originalLine: line
      }
    }
  }
  return null
}

import https from 'https'

// Fonction pour récupérer toutes les données Steam (API complète)
async function getFullSteamGameData(appId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'store.steampowered.com',
      path: `/api/appdetails?appids=${appId}&l=french`,
      method: 'GET',
      headers: {
        'User-Agent': 'ACTORIS-Launcher',
      },
    }

    const req = https.request(options, (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          const appData = parsed[appId]
          
          if (!appData || !appData.success) {
            reject(new Error('Jeu non trouvé sur Steam'))
            return
          }

          resolve(appData.data)
        } catch (error) {
          reject(new Error(`Erreur lors du parsing: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

// Fonction pour convertir les données Steam en format de jeu complet
function convertSteamDataToGame(steamData, gameName) {
  // Extraire les genres
  const genres = steamData.genres ? steamData.genres.map(g => g.description || g) : []
  
  // Extraire les screenshots
  const screenshots = steamData.screenshots ? steamData.screenshots.map(s => s.path_full || s) : []
  
  // Extraire la date de sortie
  const releaseDate = steamData.release_date ? steamData.release_date.date : null
  
  // Extraire les développeurs et éditeurs
  const developers = steamData.developers || []
  const publishers = steamData.publishers || []
  
  // Extraire la vidéo (prioriser mp4)
  let videoUrl = null
  if (steamData.movies && steamData.movies.length > 0) {
    const sortedMovies = [...steamData.movies].sort((a, b) => {
      if (a.highlight && !b.highlight) return -1
      if (!a.highlight && b.highlight) return 1
      return 0
    })
    
    for (const movie of sortedMovies) {
      if (movie.mp4?.max) {
        videoUrl = movie.mp4.max
        break
      } else if (movie.mp4?.['480']) {
        videoUrl = movie.mp4['480']
        break
      } else if (movie.webm?.max) {
        videoUrl = movie.webm.max
        break
      } else if (movie.webm?.['480']) {
        videoUrl = movie.webm['480']
        break
      }
    }
  }
  
  // Limiter la description courte
  let shortDescription = steamData.short_description || ''
  if (shortDescription) {
    const textOnly = shortDescription.replace(/<[^>]*>/g, '')
    if (textOnly.length > 200) {
      shortDescription = textOnly.substring(0, 200) + '...'
    }
  }
  
  // Construire le jeu complet
  const game = {
    id: String(steamData.steam_appid || steamData.id),
    title: steamData.name || gameName,
    name: steamData.name || gameName,
    description: steamData.detailed_description || steamData.short_description || '',
    short_description: shortDescription,
    genre: genres,
    coverImage: steamData.header_image || '',
    header_image: steamData.header_image || '',
    background_image: steamData.background || '',
    screenshots: screenshots,
    video: videoUrl,
    releaseDate: releaseDate,
    developer: developers.join(', ') || '',
    publisher: publishers.join(', ') || '',
    systemRequirements: steamData.pc_requirements || null,
    // Ne pas inclure downloadUrl si vide (sera ajouté manuellement plus tard)
    // downloadUrl: '', // À remplir manuellement plus tard
    fileSize: 'Non spécifié',
    isVipOnly: false,
    rating: 0
    // Ne pas mettre de catégorie par défaut - les jeux iront dans "Sans lien"
    // La catégorie "Pas trouvé" sera ajoutée manuellement via le bouton dans l'interface
    // category n'est pas défini, donc les jeux apparaîtront dans "Sans lien"
  }
  
  return game
}

// Fonction principale pour traiter un lot de jeux
async function processBatch(batch, lines, filePath) {
  const results = {
    success: [],
    errors: [],
    skipped: []
  }
  
  console.log(`\n🎮 Traitement de ${batch.length} jeux...`)
  console.log('='.repeat(80))
  
  for (let i = 0; i < batch.length; i++) {
    const item = batch[i]
    console.log(`\n[${i + 1}/${batch.length}] ${item.data.name}`)
    console.log(`   App ID: ${item.data.appId}`)
    console.log(`   URL: ${item.data.url}`)
    
    try {
      // Récupérer les données Steam
      console.log('   📥 Récupération des données Steam...')
      const steamData = await getFullSteamGameData(item.data.appId)
      
      // Convertir en format de jeu
      const gameData = convertSteamDataToGame(steamData, item.data.name)
      
      // Vérifier si le jeu existe déjà dans Supabase pour préserver la catégorie
      // Si le jeu a déjà un downloadUrl, ne pas mettre la catégorie "Pas trouvé"
      try {
        const { getGamesFromSupabase } = await import('../../electron/supabase-games-service.js')
        const existingGames = await getGamesFromSupabase()
        const existingGame = existingGames.games.find(g => g.id === gameData.id)
        
        if (existingGame && existingGame.downloadUrl) {
          // Le jeu existe et a déjà un lien, ne pas mettre "Pas trouvé"
          delete gameData.category
          console.log('   ℹ️  Jeu existe déjà avec un lien de téléchargement, catégorie préservée')
        } else if (!gameData.downloadUrl || gameData.downloadUrl === '') {
          // Le jeu n'a pas de lien, mettre la catégorie "Pas trouvé"
          gameData.category = 'Pas trouvé'
          console.log('   📝 Catégorie "Pas trouvé" ajoutée (aucun lien de téléchargement)')
        }
      } catch (error) {
        // En cas d'erreur, continuer avec la catégorie par défaut
        console.log('   ⚠️  Impossible de vérifier le jeu existant, utilisation de la catégorie par défaut')
      }
      
      // Ajouter à Supabase
      console.log('   💾 Ajout à Supabase...')
      const result = await addGameToSupabase(gameData)
      
      if (result.success) {
        console.log(`   ✅ ${result.updated ? 'Mis à jour' : 'Ajouté'} avec succès !`)
        results.success.push({
          name: item.data.name,
          appId: item.data.appId,
          updated: result.updated
        })
        
        // Marquer la ligne comme traitée
        lines[item.index] = markLineAsProcessed(item.originalLine)
      } else {
        throw new Error('Échec de l\'ajout à Supabase')
      }
      
      // Attendre entre les requêtes pour éviter de surcharger l'API Steam
      if (i < batch.length - 1) {
        console.log(`   ⏳ Attente de ${DELAY_BETWEEN_REQUESTS / 1000}s avant le prochain...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS))
      }
      
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}`)
      results.errors.push({
        name: item.data.name,
        appId: item.data.appId,
        error: error.message
      })
    }
  }
  
  // Sauvegarder le fichier avec les lignes marquées
  const newContent = lines.join('\n')
  fs.writeFileSync(filePath, newContent, 'utf8')
  
  return results
}

// Fonction principale
async function processNextBatch() {
  try {
    // Lire le fichier
    const content = fs.readFileSync(FILE_PATH, 'utf8')
    const lines = content.split('\n')
    
    // Trouver les lignes non traitées
    const unprocessedLines = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const parsed = parseLine(line)
      
      if (parsed && !isLineProcessed(line)) {
        unprocessedLines.push({
          index: i,
          data: parsed,
          originalLine: line
        })
      }
    }
    
    console.log(`\n📊 Statistiques:`)
    console.log(`   Total de lignes dans le fichier: ${lines.length}`)
    console.log(`   Lignes non traitées: ${unprocessedLines.length}`)
    console.log(`   Lignes déjà traitées: ${lines.length - unprocessedLines.length - 4}`)
    
    if (unprocessedLines.length === 0) {
      console.log('\n✅ Tous les jeux ont déjà été traités !')
      return
    }
    
    // Prendre les 10 premiers
    const batch = unprocessedLines.slice(0, BATCH_SIZE)
    
    console.log(`\n🎯 Traitement du lot de ${batch.length} jeux:`)
    console.log('='.repeat(80))
    
    // Afficher les jeux à traiter
    batch.forEach((item, idx) => {
      console.log(`\n${idx + 1}. ${item.data.name}`)
      console.log(`   App ID: ${item.data.appId}`)
      console.log(`   URL: ${item.data.url}`)
    })
    
    // Traiter le lot
    const results = await processBatch(batch, lines, FILE_PATH)
    
    // Afficher le résumé
    console.log('\n' + '='.repeat(80))
    console.log('\n📋 Résumé du traitement:')
    console.log(`   ✅ Ajoutés/Mis à jour: ${results.success.length}`)
    console.log(`   ❌ Erreurs: ${results.errors.length}`)
    
    if (results.success.length > 0) {
      console.log('\n✅ Jeux ajoutés/mis à jour:')
      results.success.forEach(item => {
        console.log(`   - ${item.name} (${item.updated ? 'mis à jour' : 'ajouté'})`)
      })
    }
    
    if (results.errors.length > 0) {
      console.log('\n❌ Erreurs:')
      results.errors.forEach(item => {
        console.log(`   - ${item.name}: ${item.error}`)
      })
    }
    
    console.log(`\n📝 Progression: ${unprocessedLines.length - batch.length} jeux restants à traiter`)
    console.log(`\n💡 Relancez le script pour traiter les ${Math.min(BATCH_SIZE, unprocessedLines.length - batch.length)} prochains jeux`)
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Exécuter
processNextBatch()

