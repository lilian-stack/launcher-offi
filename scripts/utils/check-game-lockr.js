/**
 * Script pour vérifier le lien Lockr d'un jeu spécifique
 * Usage: node scripts/utils/check-game-lockr.js "Geometry Dash"
 */

import { getGamesFromSupabase } from '../../electron/supabase-games-service.js'

const gameName = process.argv[2] || 'Geometry Dash'

async function checkGameLockr() {
  try {
    console.log(`[Script] 🔍 Vérification du lien Lockr pour: "${gameName}"`)
    
    // Récupérer tous les jeux
    const gamesResult = await getGamesFromSupabase()
    const games = gamesResult?.games || []
    
    // Chercher le jeu par nom
    const normalizedGameName = gameName.toLowerCase().trim()
    const game = games.find(g => {
      const gameTitle = (g.title || g.name || '').toLowerCase().trim()
      return gameTitle === normalizedGameName || gameTitle.includes(normalizedGameName)
    })
    
    if (!game) {
      console.log(`[Script] ❌ Jeu "${gameName}" non trouvé dans la base de données`)
      return
    }
    
    console.log(`[Script] ✅ Jeu trouvé:`)
    console.log(`  - ID: ${game.id}`)
    console.log(`  - Nom: ${game.title || game.name}`)
    console.log(`  - lockrUrl: ${game.lockrUrl || 'NON CONFIGURÉ'}`)
    console.log(`  - lockr_url: ${game.lockr_url || 'NON CONFIGURÉ'}`)
    
    if (game.lockrUrl || game.lockr_url) {
      console.log(`[Script] ✅ Le jeu a un lien Lockr configuré`)
    } else {
      console.log(`[Script] ❌ Le jeu n'a pas de lien Lockr configuré`)
    }
    
  } catch (error) {
    console.error('[Script] ❌ Erreur:', error)
    throw error
  }
}

checkGameLockr()

