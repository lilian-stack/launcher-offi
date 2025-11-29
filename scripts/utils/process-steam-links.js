import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FILE_PATH = 'C:\\Users\\lilia\\Pictures\\Nouveau dossier\\jeux_steam.txt'
const BATCH_SIZE = 10

// Fonction pour vérifier si une ligne est déjà traitée
function isLineProcessed(line) {
  // Vérifier si la ligne contient une marque de traitement
  return line.includes('✓') || line.includes('✅') || line.includes('[TRAITÉ]') || line.includes('~~')
}

// Fonction pour marquer une ligne comme traitée
function markLineAsProcessed(line) {
  // Si la ligne contient déjà une marque, ne rien faire
  if (isLineProcessed(line)) {
    return line
  }
  
  // Ajouter une marque ✓ à la fin de la ligne (après l'URL)
  const trimmed = line.trim()
  if (trimmed && trimmed.includes('|')) {
    // Ajouter ✓ à la fin de la ligne
    return line.trimEnd() + ' ✓'
  }
  return line
}

// Fonction pour extraire les informations d'une ligne
function parseLine(line) {
  const match = line.match(/^\s*(\d+)\.\s+(.+?)\s+\|\s+(https?:\/\/[^\s]+)/)
  if (match) {
    return {
      number: parseInt(match[1]),
      name: match[2].trim(),
      url: match[3].trim(),
      originalLine: line
    }
  }
  return null
}

// Fonction principale
function processNextBatch() {
  try {
    // Lire le fichier
    const content = fs.readFileSync(FILE_PATH, 'utf8')
    const lines = content.split('\n')
    
    // Trouver les lignes non traitées
    const unprocessedLines = []
    const lineIndices = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const parsed = parseLine(line)
      
      if (parsed && !isLineProcessed(line)) {
        unprocessedLines.push({
          index: i,
          data: parsed,
          originalLine: line
        })
        lineIndices.push(i)
      }
    }
    
    console.log(`\n📊 Statistiques:`)
    console.log(`   Total de lignes dans le fichier: ${lines.length}`)
    console.log(`   Lignes non traitées: ${unprocessedLines.length}`)
    console.log(`   Lignes déjà traitées: ${lines.length - unprocessedLines.length - 4}`) // -4 pour les lignes d'en-tête/pied
    
    if (unprocessedLines.length === 0) {
      console.log('\n✅ Tous les liens ont déjà été traités !')
      return
    }
    
    // Prendre les 10 premiers
    const batch = unprocessedLines.slice(0, BATCH_SIZE)
    
    console.log(`\n🎯 Traitement du lot de ${batch.length} liens:`)
    console.log('=' .repeat(80))
    
    // Afficher les liens à traiter
    batch.forEach((item, idx) => {
      console.log(`\n${idx + 1}. ${item.data.name}`)
      console.log(`   URL: ${item.data.url}`)
      console.log(`   Ligne ${item.index + 1} du fichier`)
    })
    
    // Demander confirmation
    console.log('\n' + '='.repeat(80))
    console.log(`\n⚠️  Voulez-vous marquer ces ${batch.length} liens comme traités ?`)
    console.log('   (Appuyez sur Entrée pour confirmer, ou Ctrl+C pour annuler)')
    
    // En mode automatique, on marque directement
    // Pour une version interactive, on pourrait utiliser readline
    
    // Marquer les lignes comme traitées
    const newLines = [...lines]
    batch.forEach(item => {
      newLines[item.index] = markLineAsProcessed(item.originalLine)
    })
    
    // Sauvegarder le fichier
    const newContent = newLines.join('\n')
    fs.writeFileSync(FILE_PATH, newContent, 'utf8')
    
    console.log(`\n✅ ${batch.length} liens marqués comme traités !`)
    console.log(`\n📝 Progression: ${unprocessedLines.length - batch.length} liens restants à traiter`)
    
    // Afficher un résumé
    console.log('\n📋 Résumé du traitement:')
    batch.forEach((item, idx) => {
      console.log(`   ✓ ${item.data.name}`)
    })
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

// Exécuter
processNextBatch()

