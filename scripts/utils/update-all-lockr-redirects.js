/**
 * Script pour mettre à jour tous les casiers Lockr avec la nouvelle URL Vercel
 * et inclure le gameId dans les URLs de redirection
 * Usage: node scripts/utils/update-all-lockr-redirects.js
 */

import { getGamesFromSupabase } from '../../electron/supabase-games-service.js'
import { updateLocker, extractLockerId } from '../../electron/lockr-service.js'
import { getRedirectUrl } from '../../electron/ads-service.js'

async function updateAllLockrRedirects() {
  try {
    console.log('[Script] ============================================')
    console.log('[Script] 🔄 MISE À JOUR DE TOUS LES CASIERS LOCKR')
    console.log('[Script] ============================================')
    console.log('[Script] 🔗 Configuration Vercel chargée')
    console.log('[Script] 📋 Les URLs incluront maintenant le gameId')
    console.log('[Script] ============================================\n')
    
    // Récupérer tous les jeux
    const gamesResult = await getGamesFromSupabase()
    const games = gamesResult?.games || []
    
    console.log(`[Script] 📋 Nombre total de jeux: ${games.length}\n`)
    
    // Filtrer les jeux avec un lien Lockr
    const gamesWithLockr = games.filter(game => game.lockrUrl)
    
    console.log(`[Script] 🔒 Jeux avec lien Lockr: ${gamesWithLockr.length}\n`)
    
    if (gamesWithLockr.length === 0) {
      console.log('[Script] ⚠️ Aucun jeu avec lien Lockr trouvé!')
      return
    }
    
    const results = {
      updated: [],
      failed: [],
      skipped: []
    }
    
    let currentIndex = 0
    for (const game of gamesWithLockr) {
      currentIndex++
      const gameName = game.title || game.name || 'Game'
      const gameId = game.id
      const lockrUrl = game.lockrUrl
      
      console.log(`[Script] ────────────────────────────────────────────`)
      console.log(`[Script] [${currentIndex}/${gamesWithLockr.length}] ${gameName}`)
      console.log(`[Script]    ID du jeu: ${gameId}`)
      console.log(`[Script]    Lien Lockr actuel: ${lockrUrl}`)
      
      // Extraire l'ID du casier
      const lockerId = extractLockerId(lockrUrl)
      if (!lockerId) {
        console.error(`[Script]    ❌ Impossible d'extraire l'ID du casier`)
        results.failed.push({ gameName, gameId, error: 'ID du casier introuvable' })
        continue
      }
      
      console.log(`[Script]    🆔 ID du casier: ${lockerId}`)
      
      // Construire la nouvelle URL cible avec gameId et token de sécurité
      const newTargetUrl = await getRedirectUrl(gameName, null, gameId)
      console.log(`[Script]    🔗 Nouvelle URL cible (avec token): ${newTargetUrl}`)
      
      // Mettre à jour le casier Lockr
      console.log(`[Script]    🔄 Mise à jour du casier...`)
      const updateResult = await updateLocker(lockerId, newTargetUrl, gameName)
      
      if (updateResult.success) {
        console.log(`[Script]    ✅ Casier mis à jour avec succès!`)
        console.log(`[Script]    🔗 Nouveau lien Lockr: ${updateResult.lockerUrl}`)
        results.updated.push({ gameName, gameId, lockerUrl: updateResult.lockerUrl })
      } else {
        console.error(`[Script]    ❌ Erreur: ${updateResult.error}`)
        results.failed.push({ gameName, gameId, error: updateResult.error })
      }
      
      // Petite pause pour éviter de surcharger l'API
      if (currentIndex < gamesWithLockr.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`\n[Script] ============================================`)
    console.log(`[Script] ✅ TERMINÉ`)
    console.log(`[Script] ============================================`)
    console.log(`[Script] ✅ Mis à jour: ${results.updated.length}`)
    console.log(`[Script] ❌ Échecs: ${results.failed.length}`)
    console.log(`[Script] ⏭️ Ignorés: ${results.skipped.length}`)
    console.log(`[Script] ============================================\n`)
    
    if (results.failed.length > 0) {
      console.log(`[Script] ❌ Jeux en échec:`)
      results.failed.forEach(({ gameName, error }) => {
        console.log(`[Script]    - ${gameName}: ${error}`)
      })
    }
    
  } catch (err) {
    console.error('[Script] ❌ Erreur critique:', err)
    console.error('[Script] Stack:', err.stack)
  }
}

updateAllLockrRedirects()

