/**
 * Script pour mettre à jour TOUS les casiers Lockr avec la nouvelle URL Vercel
 * Usage: node scripts/utils/update-all-lockr-casiers.js
 */

import { getGamesFromSupabase, updateGameOnSupabase } from '../../electron/supabase-games-service.js'
import { createLocker, updateLocker, extractLockerId } from '../../electron/lockr-service.js'
import { getRedirectUrl } from '../../electron/vercel-config.js'

const NEW_VERCEL_URL = 'https://vercel-deploy-cv8wkd51t-boyka47348-glitchs-projects.vercel.app'

async function updateAllLockrCasiers() {
  try {
    console.log('='.repeat(60))
    console.log('🔄 MISE À JOUR DE TOUS LES CASIERS LOCKR')
    console.log('='.repeat(60))
    console.log(`🔗 Nouvelle URL Vercel: ${NEW_VERCEL_URL}`)
    console.log('')
    
    // Récupérer tous les jeux depuis Supabase
    console.log('📥 Récupération de tous les jeux depuis Supabase...')
    const gamesResult = await getGamesFromSupabase()
    // getGamesFromSupabase retourne un tableau directement ou un objet avec {games: [...]}
    let games = []
    if (Array.isArray(gamesResult)) {
      games = gamesResult
    } else if (gamesResult && gamesResult.games && Array.isArray(gamesResult.games)) {
      games = gamesResult.games
    } else if (gamesResult && typeof gamesResult === 'object') {
      // Si c'est un objet mais pas de propriété games, essayer de convertir en tableau
      games = Object.values(gamesResult).filter(Array.isArray)[0] || []
    }
    console.log(`✅ ${games.length} jeux récupérés`)
    console.log('')
    
    // Statistiques
    const stats = {
      total: games.length,
      withLocker: 0,
      withoutLocker: 0,
      updated: 0,
      created: 0,
      failed: 0,
      skipped: 0
    }
    
    const results = {
      updated: [],
      created: [],
      failed: [],
      skipped: []
    }
    
    console.log('🚀 Début du traitement...')
    console.log('')
    
    let processed = 0
    for (const game of games) {
      processed++
      const gameName = game.title || game.name || 'Game'
      const gameId = game.id
      
      console.log(`[${processed}/${games.length}] 🎮 ${gameName} (ID: ${gameId})`)
      
      if (!gameId) {
        console.log(`  ⚠️ Jeu sans ID ignoré`)
        stats.skipped++
        results.skipped.push({ gameName, gameId, reason: 'Jeu sans ID' })
        continue
      }
      
      // Vérifier si le jeu a déjà un casier Lockr
      const existingUrl = game.lockrUrl || game.LockrUrl || game.lockr_url
      
      if (existingUrl) {
        stats.withLocker++
        console.log(`  📦 Casier existant: ${existingUrl}`)
        
        // Vérifier si l'URL pointe déjà vers la nouvelle URL Vercel
        if (existingUrl.includes(NEW_VERCEL_URL)) {
          console.log(`  ✅ Déjà à jour (nouvelle URL Vercel)`)
          stats.skipped++
          results.skipped.push({ 
            gameName, 
            gameId, 
            lockerUrl: existingUrl,
            reason: 'Déjà à jour' 
          })
          continue
        }
        
        // Extraire l'ID du casier existant
        const lockerId = extractLockerId(existingUrl)
        
        if (!lockerId) {
          console.log(`  ⚠️ Impossible d'extraire l'ID du casier, création d'un nouveau...`)
          // Créer un nouveau casier
          await createNewLocker(game, gameName, gameId, stats, results)
          continue
        }
        
        // Mettre à jour le casier existant
        console.log(`  🔄 Mise à jour du casier (ID: ${lockerId})...`)
        
        try {
          // Construire la nouvelle URL Vercel
          const newUrl = getRedirectUrl(gameName, gameId)
          console.log(`  🔗 Nouvelle URL: ${newUrl}`)
          
          // Mettre à jour le casier Lockr
          const updateResult = await updateLocker(lockerId, newUrl, gameName)
          
          if (updateResult.success && updateResult.lockerUrl) {
            console.log(`  ✅ Casier mis à jour: ${updateResult.lockerUrl}`)
            
            // Mettre à jour dans Supabase
            try {
              await updateGameOnSupabase(gameId, { lockr_url: updateResult.lockerUrl })
              console.log(`  ✅ Jeu mis à jour dans Supabase`)
              
              stats.updated++
              results.updated.push({ 
                gameName, 
                gameId, 
                oldUrl: existingUrl,
                newUrl: updateResult.lockerUrl 
              })
            } catch (supabaseErr) {
              console.error(`  ❌ Erreur Supabase: ${supabaseErr.message}`)
              stats.failed++
              results.failed.push({ 
                gameName, 
                gameId, 
                error: `Casier mis à jour mais erreur Supabase: ${supabaseErr.message}`,
                lockerUrl: updateResult.lockerUrl
              })
            }
          } else {
            console.error(`  ❌ Échec de la mise à jour: ${updateResult.error || 'Erreur inconnue'}`)
            console.log(`  🔄 Tentative de création d'un nouveau casier...`)
            
            // Si la mise à jour échoue, créer un nouveau casier
            await createNewLocker(game, gameName, gameId, stats, results)
          }
        } catch (updateErr) {
          console.error(`  ❌ Erreur lors de la mise à jour: ${updateErr.message}`)
          console.log(`  🔄 Tentative de création d'un nouveau casier...`)
          
          // Si la mise à jour échoue, créer un nouveau casier
          await createNewLocker(game, gameName, gameId, stats, results)
        }
      } else {
        stats.withoutLocker++
        console.log(`  📭 Pas de casier existant`)
        
        // Créer un nouveau casier
        await createNewLocker(game, gameName, gameId, stats, results)
      }
      
      // Délai pour éviter de surcharger l'API Lockr
      if (processed < games.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      console.log('')
    }
    
    // Afficher les résultats
    console.log('='.repeat(60))
    console.log('📊 RÉSULTATS FINAUX')
    console.log('='.repeat(60))
    console.log(`📦 Total de jeux: ${stats.total}`)
    console.log(`  • Avec casier: ${stats.withLocker}`)
    console.log(`  • Sans casier: ${stats.withoutLocker}`)
    console.log('')
    console.log(`✅ Mis à jour: ${stats.updated}`)
    console.log(`🆕 Créés: ${stats.created}`)
    console.log(`⏩ Ignorés: ${stats.skipped}`)
    console.log(`❌ Échecs: ${stats.failed}`)
    console.log('')
    
    // Détails des mises à jour
    if (results.updated.length > 0) {
      console.log('✅ Casiers mis à jour:')
      results.updated.slice(0, 10).forEach(r => {
        console.log(`  • ${r.gameName} (ID: ${r.gameId})`)
        console.log(`    Ancien: ${r.oldUrl}`)
        console.log(`    Nouveau: ${r.newUrl}`)
      })
      if (results.updated.length > 10) {
        console.log(`  ... et ${results.updated.length - 10} autres`)
      }
      console.log('')
    }
    
    // Détails des créations
    if (results.created.length > 0) {
      console.log('🆕 Nouveaux casiers créés:')
      results.created.slice(0, 10).forEach(r => {
        console.log(`  • ${r.gameName} (ID: ${r.gameId}): ${r.lockerUrl}`)
      })
      if (results.created.length > 10) {
        console.log(`  ... et ${results.created.length - 10} autres`)
      }
      console.log('')
    }
    
    // Détails des échecs
    if (results.failed.length > 0) {
      console.log('❌ Échecs:')
      results.failed.slice(0, 10).forEach(r => {
        console.log(`  • ${r.gameName} (ID: ${r.gameId || 'N/A'}): ${r.error}`)
      })
      if (results.failed.length > 10) {
        console.log(`  ... et ${results.failed.length - 10} autres`)
      }
      console.log('')
    }
    
    // Détails des ignorés
    if (results.skipped.length > 0) {
      console.log('⏩ Ignorés:')
      results.skipped.slice(0, 10).forEach(r => {
        console.log(`  • ${r.gameName} (ID: ${r.gameId || 'N/A'}): ${r.reason}`)
      })
      if (results.skipped.length > 10) {
        console.log(`  ... et ${results.skipped.length - 10} autres`)
      }
      console.log('')
    }
    
    console.log('='.repeat(60))
    console.log('🎉 Traitement terminé!')
    console.log('='.repeat(60))
    
  } catch (error) {
    console.error('')
    console.error('='.repeat(60))
    console.error('❌ ERREUR CRITIQUE')
    console.error('='.repeat(60))
    console.error('Message:', error.message)
    console.error('Stack:', error.stack)
    console.error('='.repeat(60))
    process.exit(1)
  }
}

/**
 * Créer un nouveau casier Lockr pour un jeu
 */
async function createNewLocker(game, gameName, gameId, stats, results) {
  try {
    console.log(`  🔄 Création d'un nouveau casier...`)
    
    // Construire la nouvelle URL Vercel
    const newUrl = getRedirectUrl(gameName, gameId)
    console.log(`  🔗 URL: ${newUrl}`)
    
    // Vérifier si le titre est trop long (limite Lockr: 60 caractères)
    let title = gameName
    if (title.length > 60) {
      title = title.substring(0, 57) + '...'
      console.log(`  📝 Titre tronqué à 60 caractères: ${title}`)
    }
    
    // Créer le casier Lockr
    const createResult = await createLocker(newUrl, title)
    
    if (createResult.success && createResult.lockerUrl) {
      console.log(`  ✅ Casier créé: ${createResult.lockerUrl}`)
      
      // Mettre à jour dans Supabase
      try {
        await updateGameOnSupabase(gameId, { lockr_url: createResult.lockerUrl })
        console.log(`  ✅ Jeu mis à jour dans Supabase`)
        
        stats.created++
        results.created.push({ 
          gameName, 
          gameId, 
          lockerUrl: createResult.lockerUrl 
        })
      } catch (supabaseErr) {
        console.error(`  ❌ Erreur Supabase: ${supabaseErr.message}`)
        stats.failed++
        results.failed.push({ 
          gameName, 
          gameId, 
          error: `Casier créé mais erreur Supabase: ${supabaseErr.message}`,
          lockerUrl: createResult.lockerUrl
        })
      }
    } else {
      console.error(`  ❌ Échec de la création: ${createResult.error || 'Erreur inconnue'}`)
      stats.failed++
      results.failed.push({ 
        gameName, 
        gameId, 
        error: createResult.error || 'Erreur inconnue lors de la création'
      })
    }
  } catch (err) {
    console.error(`  ❌ Erreur: ${err.message}`)
    stats.failed++
    results.failed.push({ 
      gameName, 
      gameId, 
      error: err.message
    })
  }
}

// Exécuter le script
updateAllLockrCasiers()

