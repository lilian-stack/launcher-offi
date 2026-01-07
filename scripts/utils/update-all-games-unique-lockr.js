/**
 * Script pour mettre à jour tous les jeux dans Supabase avec le lien Lockr unique
 * Usage: node scripts/utils/update-all-games-unique-lockr.js
 */

import { getGamesFromSupabase, updateGameOnSupabase } from '../../electron/supabase-games-service.js'

// Configuration : Lien Lockr unique pour tous les jeux
const UNIQUE_LOCKR_URL = 'https://lockr.net/7dhjn5m8'

async function updateAllGamesWithUniqueLockr() {
  try {
    console.log('═══════════════════════════════════════════════════════')
    console.log('🔄 MISE À JOUR DE TOUS LES JEUX AVEC LE LIEN LOCKR UNIQUE')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    console.log(`🔗 Lien Lockr unique: ${UNIQUE_LOCKR_URL}`)
    console.log('')
    
    // Récupérer tous les jeux depuis Supabase
    console.log('📥 Récupération des jeux depuis Supabase...')
    const gamesResult = await getGamesFromSupabase()
    const games = gamesResult?.games || []
    
    if (!games || games.length === 0) {
      console.log('⚠️  Aucun jeu trouvé dans Supabase')
      return
    }
    
    console.log(`✅ ${games.length} jeux trouvés`)
    console.log('')
    
    const results = {
      success: [],
      failed: [],
      skipped: []
    }
    
    let currentIndex = 0
    
    for (const game of games) {
      currentIndex++
      const gameName = game.title || game.name || 'Game'
      const gameId = game.id
      const currentLockrUrl = game.lockrUrl || game.lockr_url
      
      // Vérifier si le jeu a déjà le bon lien
      if (currentLockrUrl === UNIQUE_LOCKR_URL) {
        console.log(`[${currentIndex}/${games.length}] ⏩ "${gameName}" a déjà le bon lien Lockr`)
        results.skipped.push({ gameName, gameId })
        continue
      }
      
      if (!gameId) {
        console.log(`[${currentIndex}/${games.length}] ⚠️  "${gameName}" ignoré (pas d'ID)`)
        results.skipped.push({ gameName, gameId: null, reason: 'Pas d\'ID' })
        continue
      }
      
      try {
        console.log(`[${currentIndex}/${games.length}] 🔄 Mise à jour de "${gameName}" (ID: ${gameId})...`)
        
        if (currentLockrUrl) {
          console.log(`    Ancien lien: ${currentLockrUrl}`)
        } else {
          console.log('    Aucun lien Lockr existant')
        }
        
        // Mettre à jour le jeu avec le nouveau lien Lockr unique
        const updateResult = await updateGameOnSupabase(gameId, {
          lockrUrl: UNIQUE_LOCKR_URL
        })
        
        if (updateResult.success) {
          console.log(`    ✅ Nouveau lien: ${UNIQUE_LOCKR_URL}`)
          results.success.push({ gameName, gameId, oldLockrUrl: currentLockrUrl })
        } else {
          console.error(`    ❌ Échec de la mise à jour`)
          results.failed.push({ gameName, gameId, error: 'Échec de la mise à jour' })
        }
        
        // Petit délai pour éviter de surcharger l'API Supabase
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`    ❌ Erreur: ${error.message}`)
        results.failed.push({ gameName, gameId, error: error.message })
      }
      
      console.log('')
    }
    
    // Afficher le résumé
    console.log('═══════════════════════════════════════════════════════')
    console.log('📊 RÉSUMÉ DE LA MISE À JOUR')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`📋 Total de jeux traités: ${games.length}`)
    console.log(`✅ Mis à jour avec succès: ${results.success.length}`)
    console.log(`⏩ Ignorés (déjà à jour): ${results.skipped.length}`)
    console.log(`❌ Échecs: ${results.failed.length}`)
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    
    if (results.success.length > 0) {
      console.log('✅ Jeux mis à jour avec succès:')
      results.success.slice(0, 10).forEach(item => {
        console.log(`   - ${item.gameName} (ID: ${item.gameId})`)
      })
      if (results.success.length > 10) {
        console.log(`   ... et ${results.success.length - 10} autres`)
      }
      console.log('')
    }
    
    if (results.skipped.length > 0) {
      console.log('⏩ Jeux ignorés (déjà à jour):')
      results.skipped.slice(0, 5).forEach(item => {
        console.log(`   - ${item.gameName}`)
      })
      if (results.skipped.length > 5) {
        console.log(`   ... et ${results.skipped.length - 5} autres`)
      }
      console.log('')
    }
    
    if (results.failed.length > 0) {
      console.log('❌ Échecs:')
      results.failed.forEach(item => {
        console.log(`   - ${item.gameName} (ID: ${item.gameId || 'N/A'}): ${item.error}`)
      })
      console.log('')
    }
    
    console.log('✅ Script terminé!')
    console.log('')
    console.log('💡 Tous les jeux utilisent maintenant le lien Lockr unique:')
    console.log(`   ${UNIQUE_LOCKR_URL}`)
    console.log('')
    
    return results
    
  } catch (error) {
    console.error('❌ Erreur critique:', error)
    throw error
  }
}

// Exécuter le script
updateAllGamesWithUniqueLockr()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  })
