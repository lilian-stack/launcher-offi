/**
 * Script pour mettre à jour tous les casiers Lockr avec la nouvelle URL Vercel
 * Usage: node scripts/utils/update-all-lockr-urls.js
 */

import { getGamesFromSupabase } from '../../electron/supabase-games-service.js'
import { updateLocker, extractLockerId } from '../../electron/lockr-service.js'
import { getRedirectUrl } from '../../electron/vercel-config.js'

async function updateAllLockrUrls() {
  try {
    console.log('[Script] 🔄 Mise à jour de tous les casiers Lockr avec la nouvelle URL Vercel...')
    console.log('[Script] 🔗 Configuration Vercel chargée')
    
    // Récupérer tous les jeux
    const gamesResult = await getGamesFromSupabase()
    const games = gamesResult?.games || []
    
    console.log(`[Script] 📋 Nombre de jeux trouvés: ${games.length}`)
    
    const results = {
      success: [],
      failed: []
    }
    
    for (const game of games) {
      const gameName = game.title || game.name || 'Game'
      const gameId = game.id
      const lockrUrl = game.lockrUrl
      
      if (!lockrUrl) {
        console.log(`[Script] ⏩ Jeu sans lockrUrl ignoré: ${gameName}`)
        continue
      }
      
      if (!gameId) {
        console.log(`[Script] ⚠️ Jeu sans ID ignoré: ${gameName}`)
        continue
      }
      
      try {
        // Extraire l'ID du casier depuis l'URL Lockr
        const lockerId = extractLockerId(lockrUrl)
        
        if (!lockerId) {
          console.error(`[Script] ❌ Impossible d'extraire l'ID du casier depuis: ${lockrUrl}`)
          results.failed.push({ gameName, gameId, lockrUrl, error: 'ID du casier introuvable' })
          continue
        }
        
        console.log(`[Script] 🔄 Mise à jour du casier pour "${gameName}" (ID: ${lockerId})...`)
        
        // Construire la nouvelle URL cible avec le nom du jeu ET le gameId
        const newTargetUrl = getRedirectUrl(gameName, gameId)
        
        // Mettre à jour le casier Lockr
        const updateResult = await updateLocker(lockerId, newTargetUrl, gameName)
        
        if (updateResult.success) {
          console.log(`[Script] ✅ Casier Lockr mis à jour pour "${gameName}": ${updateResult.lockerUrl}`)
          results.success.push({ gameName, gameId, lockerId, lockerUrl: updateResult.lockerUrl })
        } else {
          console.error(`[Script] ❌ Erreur lors de la mise à jour du casier pour "${gameName}": ${updateResult.error}`)
          results.failed.push({ gameName, gameId, lockerId, error: updateResult.error })
        }
      } catch (error) {
        console.error(`[Script] ❌ Erreur inattendue pour "${gameName}":`, error)
        results.failed.push({ gameName, gameId, error: error.message })
      }
    }
    
    console.log('\n[Script] 🎉 Mise à jour terminée!')
    console.log(`[Script] ✅ Réussis: ${results.success.length}`)
    console.log(`[Script] ❌ Échecs: ${results.failed.length}`)
    
    if (results.success.length > 0) {
      console.log('\n[Script] ✅ Casiers mis à jour avec succès:')
      results.success.forEach(item => {
        console.log(`  - ${item.gameName} (ID: ${item.lockerId})`)
      })
    }
    
    if (results.failed.length > 0) {
      console.log('\n[Script] ❌ Échecs:')
      results.failed.forEach(item => {
        console.log(`  - ${item.gameName} (ID: ${item.gameId || 'N/A'}): ${item.error}`)
      })
    }
    
    return results
  } catch (error) {
    console.error('[Script] ❌ Erreur critique:', error)
    throw error
  }
}

// Exécuter le script
updateAllLockrUrls()
  .then(() => {
    console.log('[Script] ✅ Script terminé avec succès')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Script] ❌ Erreur fatale:', error)
    process.exit(1)
  })

