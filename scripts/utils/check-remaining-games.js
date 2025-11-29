/**
 * Script pour vérifier le nombre de jeux restants à traiter
 */

import fs from 'fs'

const FILE_PATH = 'C:\\Users\\lilia\\Pictures\\Nouveau dossier\\jeux_steam.txt'

// Fonction pour vérifier si une ligne est déjà traitée
function isLineProcessed(line) {
  return line.includes('✓') || line.includes('✅') || line.includes('[TRAITÉ]') || line.includes('[AJOUTÉ]')
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

try {
  // Lire le fichier
  const content = fs.readFileSync(FILE_PATH, 'utf8')
  const lines = content.split('\n')
  
  // Trouver les lignes non traitées
  const unprocessedLines = []
  const processedLines = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const parsed = parseLine(line)
    
    if (parsed) {
      if (isLineProcessed(line)) {
        processedLines.push(parsed)
      } else {
        unprocessedLines.push(parsed)
      }
    }
  }
  
  console.log('\n📊 Statistiques des jeux Steam:')
  console.log('='.repeat(60))
  console.log(`   Total de lignes dans le fichier: ${lines.length}`)
  console.log(`   Jeux valides trouvés: ${unprocessedLines.length + processedLines.length}`)
  console.log(`   ✅ Jeux déjà traités: ${processedLines.length}`)
  console.log(`   ⏳ Jeux restants à traiter: ${unprocessedLines.length}`)
  console.log('')
  
  if (unprocessedLines.length > 0) {
    const BATCH_SIZE = 35
    const batchesNeeded = Math.ceil(unprocessedLines.length / BATCH_SIZE)
    console.log(`📦 Lots de traitement:`)
    console.log(`   Taille d'un lot: ${BATCH_SIZE} jeux`)
    console.log(`   Nombre de lots nécessaires: ${batchesNeeded}`)
    console.log(`   Temps estimé (2s par jeu): ~${Math.round((unprocessedLines.length * 2) / 60)} minutes`)
    console.log('')
    console.log(`💡 Prochains jeux à traiter (${Math.min(10, unprocessedLines.length)} premiers):`)
    unprocessedLines.slice(0, 10).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.name} (App ID: ${item.appId})`)
    })
    if (unprocessedLines.length > 10) {
      console.log(`   ... et ${unprocessedLines.length - 10} autres`)
    }
  } else {
    console.log('✅ Tous les jeux ont déjà été traités !')
  }
  
} catch (error) {
  console.error('❌ Erreur:', error.message)
  process.exit(1)
}

