/**
 * Script pour mettre à jour le lockrUrl de Geometry Dash
 * Usage: node scripts/utils/update-geometry-dash-lockr.js
 */

import { getGamesFromSupabase, updateGameOnSupabase } from '../../electron/supabase-games-service.js'

async function updateGeometryDashLockr() {
  try {
    const gameName = 'Geometry Dash'
    const lockrUrl = 'https://lockr.so/UrTcRHgio'
    
    console.log(`[Script] 🔄 Mise à jour du lockrUrl pour "${gameName}"...`)
    console.log(`[Script] 🔗 Nouveau lockrUrl: ${lockrUrl}`)
    
    // Récupérer tous les jeux
    const gamesResult = await getGamesFromSupabase()
    const games = gamesResult?.games || []
    
    console.log(`[Script] 📋 Nombre de jeux trouvés: ${games.length}`)
    
    // Chercher le jeu par nom (insensible à la casse)
    const normalizedGameName = gameName.toLowerCase().trim()
    const game = games.find(g => {
      const gameTitle = (g.title || g.name || '').toLowerCase().trim()
      return gameTitle === normalizedGameName || 
             gameTitle.includes(normalizedGameName) || 
             normalizedGameName.includes(gameTitle)
    })
    
    if (!game) {
      console.error(`[Script] ❌ Jeu "${gameName}" non trouvé`)
      console.log('[Script] 📋 Jeux disponibles (premiers 10):')
      games.slice(0, 10).forEach(g => {
        console.log(`  - ${g.title || g.name} (ID: ${g.id})`)
      })
      process.exit(1)
    }
    
    console.log(`[Script] ✅ Jeu trouvé: ${game.title || game.name} (ID: ${game.id})`)
    console.log(`[Script] 🔗 Ancien lockrUrl: ${game.lockrUrl || 'Aucun'}`)
    
    // Mettre à jour le jeu avec le nouveau lockrUrl
    await updateGameOnSupabase(game.id, { lockrUrl: lockrUrl })
    console.log(`[Script] ✅ Jeu mis à jour avec succès!`)
    console.log(`[Script] 🔗 Nouveau lockrUrl: ${lockrUrl}`)
    
    process.exit(0)
  } catch (error) {
    console.error('[Script] ❌ Erreur:', error)
    process.exit(1)
  }
}

updateGeometryDashLockr()

