/**
 * Script pour vérifier l'utilisation de l'espace Supabase
 * Usage: node scripts/check-supabase-usage.js
 */

import { getGamesFromSupabase } from '../../electron/supabase-games-service.js'
import { SUPABASE_CONFIG } from '../../electron/supabase-config.js'

async function checkUsage() {
  try {
    console.log('📊 Vérification de l\'utilisation Supabase...')
    console.log('')
    
    // Récupérer tous les jeux
    const result = await getGamesFromSupabase()
    const games = result.games || []
    
    console.log(`🎮 Nombre de jeux: ${games.length}`)
    console.log('')
    
    // Estimer la taille des données
    let totalSize = 0
    const gameSizes = []
    
    games.forEach(game => {
      // Convertir le jeu en JSON pour estimer la taille
      const gameJson = JSON.stringify(game)
      const gameSize = Buffer.byteLength(gameJson, 'utf8')
      gameSizes.push(gameSize)
      totalSize += gameSize
    })
    
    // Convertir en MB
    const totalSizeMB = totalSize / (1024 * 1024)
    const averageSizeKB = games.length > 0 ? (totalSize / games.length) / 1024 : 0
    
    console.log('💾 Estimation de l\'espace utilisé:')
    console.log(`   - Taille totale: ${totalSizeMB.toFixed(2)} MB`)
    console.log(`   - Taille moyenne par jeu: ${averageSizeKB.toFixed(2)} KB`)
    console.log('')
    
    // Limite du plan gratuit
    const freeLimitMB = 500
    const usedPercent = (totalSizeMB / freeLimitMB) * 100
    const remainingMB = freeLimitMB - totalSizeMB
    
    console.log('📈 Utilisation du plan gratuit (500 MB):')
    console.log(`   - Utilisé: ${totalSizeMB.toFixed(2)} MB (${usedPercent.toFixed(2)}%)`)
    console.log(`   - Restant: ${remainingMB > 0 ? remainingMB.toFixed(2) : '0'} MB`)
    console.log('')
    
    // Estimation du nombre de jeux possibles
    if (averageSizeKB > 0) {
      const maxGames = Math.floor((freeLimitMB * 1024) / averageSizeKB)
      console.log(`📊 Estimation: ~${maxGames} jeux possibles au total`)
      console.log(`   (basé sur la taille moyenne actuelle)`)
      console.log('')
    }
    
    // Avertissement si proche de la limite
    if (usedPercent > 80) {
      console.log('⚠️  ATTENTION: Vous approchez de la limite (80%+)')
    } else if (usedPercent > 50) {
      console.log('ℹ️  Vous avez utilisé plus de 50% de votre quota')
    } else {
      console.log('✅ Vous avez encore beaucoup d\'espace disponible')
    }
    
    console.log('')
    console.log('💡 Note: Cette estimation est approximative.')
    console.log('   Pour une mesure exacte, consultez votre dashboard Supabase:')
    console.log('   https://supabase.com/dashboard/project/' + SUPABASE_CONFIG.URL.split('//')[1].split('.')[0])
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message)
    process.exit(1)
  }
}

checkUsage()

