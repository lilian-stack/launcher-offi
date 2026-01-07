/**
 * Script pour vérifier les jeux sans lien Lockr et créer les casiers manquants
 * Usage: node scripts/utils/check-and-create-missing-lockr.js
 */

import { getGamesFromSupabase, updateGameOnSupabase } from '../../electron/supabase-games-service.js'
import { createLocker } from '../../electron/lockr-service.js'
import { getRedirectUrl } from '../../electron/vercel-config.js'

async function checkAndCreateMissingLockr() {
  try {
    console.log('[Script] 🔍 Vérification des jeux sans lien Lockr...')
    
    // Récupérer tous les jeux
    const gamesResult = await getGamesFromSupabase()
    const games = gamesResult?.games || []
    
    console.log(`[Script] 📋 Nombre total de jeux: ${games.length}`)
    
    // Filtrer les jeux sans lockrUrl
    const gamesWithoutLockr = games.filter(game => !game.lockrUrl)
    
    console.log(`[Script] ⚠️ Jeux sans lien Lockr: ${gamesWithoutLockr.length}`)
    
    if (gamesWithoutLockr.length === 0) {
      console.log('[Script] ✅ Tous les jeux ont un lien Lockr configuré!')
      return
    }
    
    console.log(`\n[Script] 📝 Liste des jeux sans lien Lockr:`)
    gamesWithoutLockr.slice(0, 20).forEach((game, index) => {
      const gameName = game.title || game.name || 'Sans nom'
      const gameId = game.id || 'N/A'
      console.log(`  ${index + 1}. ${gameName} (ID: ${gameId})`)
    })
    if (gamesWithoutLockr.length > 20) {
      console.log(`  ... et ${gamesWithoutLockr.length - 20} autres jeux`)
    }
    
    console.log(`\n[Script] 🚀 Création des casiers Lockr manquants...`)
    console.log(`[Script] 🔗 Configuration Vercel chargée`)
    
    const results = {
      success: [],
      failed: [],
      skipped: []
    }
    
    let processed = 0
    for (const game of gamesWithoutLockr) {
      processed++
      const gameName = game.title || game.name || 'Game'
      const gameId = game.id
      
      console.log(`\n[Script] [${processed}/${gamesWithoutLockr.length}] Traitement: ${gameName} (ID: ${gameId})`)
      
      if (!gameId) {
        console.log(`[Script] ⚠️ Jeu sans ID ignoré: ${gameName}`)
        results.skipped.push({ gameName, gameId, reason: 'Jeu sans ID' })
        continue
      }
      
      // Vérifier si le titre est trop long (limite Lockr: 60 caractères)
      if (gameName.length > 60) {
        console.log(`[Script] ⚠️ Titre trop long (${gameName.length} caractères, max 60): ${gameName}`)
        // Utiliser un titre tronqué
        const truncatedTitle = gameName.substring(0, 57) + '...'
        console.log(`[Script] 📝 Utilisation du titre tronqué: ${truncatedTitle}`)
        await createLockerForGame(game, truncatedTitle, results)
      } else {
        await createLockerForGame(game, gameName, results)
      }
      
      // Délai pour éviter de surcharger l'API
      if (processed < games.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`\n[Script] 🎉 Traitement terminé!`)
    console.log(`[Script] ✅ Réussis: ${results.success.length}`)
    console.log(`[Script] ⏩ Ignorés: ${results.skipped.length}`)
    console.log(`[Script] ❌ Échecs: ${results.failed.length}`)
    
    if (results.success.length > 0) {
      console.log(`\n[Script] ✅ Casiers créés avec succès:`)
      results.success.slice(0, 10).forEach(r => {
        console.log(`  - ${r.gameName}: ${r.lockerUrl}`)
      })
      if (results.success.length > 10) {
        console.log(`  ... et ${results.success.length - 10} autres`)
      }
    }
    
    if (results.failed.length > 0) {
      console.log(`\n[Script] ❌ Échecs:`)
      results.failed.slice(0, 10).forEach(r => {
        console.log(`  - ${r.gameName} (ID: ${r.gameId || 'N/A'}): ${r.error}`)
      })
      if (results.failed.length > 10) {
        console.log(`  ... et ${results.failed.length - 10} autres échecs`)
      }
    }
    
    if (results.skipped.length > 0) {
      console.log(`\n[Script] ⏩ Ignorés:`)
      results.skipped.slice(0, 10).forEach(r => {
        console.log(`  - ${r.gameName} (ID: ${r.gameId || 'N/A'}): ${r.reason}`)
      })
      if (results.skipped.length > 10) {
        console.log(`  ... et ${results.skipped.length - 10} autres`)
      }
    }
    
  } catch (error) {
    console.error('[Script] ❌ Erreur critique:', error)
    throw error
  }
}

async function createLockerForGame(game, title, results) {
  const gameName = game.title || game.name || 'Game'
  const gameId = game.id
  
  try {
    // 🎯 NOUVEAU : Utiliser la nouvelle URL Vercel (sans token, le token sera généré dynamiquement)
    // L'URL pointe vers redirect.html qui générera un token à chaque téléchargement
    const { getRedirectUrl } = await import('../../electron/vercel-config.js')
    const baseUrl = getRedirectUrl(gameName, gameId)
    console.log(`[Script] 🔗 URL de base (nouvelle URL Vercel): ${baseUrl}`)
    
    // Vérifier si le jeu a déjà un casier Lockr
    const hasExistingLocker = game.lockrUrl || game.LockrUrl || game.lockr_url
    
    if (hasExistingLocker) {
      const existingUrl = game.lockrUrl || game.LockrUrl || game.lockr_url
      console.log(`[Script] ⚠️ Jeu a déjà un casier: ${existingUrl}`)
      console.log(`[Script] 🔄 Mise à jour avec la nouvelle URL Vercel...`)
      
      // Extraire l'ID du casier existant
      const { extractLockerId } = await import('../../electron/lockr-service.js')
      const existingLockerId = extractLockerId(existingUrl)
      
      if (existingLockerId) {
        // Mettre à jour le casier existant
        const { updateLocker } = await import('../../electron/lockr-service.js')
        const updateResult = await updateLocker(existingLockerId, baseUrl, title)
        
        if (updateResult.success) {
          console.log(`[Script] ✅ Casier mis à jour: ${updateResult.lockerUrl}`)
          
          // Mettre à jour dans Supabase
          try {
            await updateGameOnSupabase(gameId, { lockr_url: updateResult.lockerUrl })
            console.log(`[Script] ✅ Jeu mis à jour dans Supabase`)
            results.success.push({ gameName, gameId, lockerUrl: updateResult.lockerUrl, updated: true })
            return
          } catch (updateErr) {
            console.error(`[Script] ❌ Erreur Supabase:`, updateErr.message)
            // Continuer pour créer un nouveau casier
          }
        } else {
          console.log(`[Script] ⚠️ Échec de la mise à jour, création d'un nouveau casier...`)
        }
      } else {
        console.log(`[Script] ⚠️ Impossible d'extraire l'ID, création d'un nouveau casier...`)
      }
    }
    
    // Créer un nouveau casier avec la nouvelle URL Vercel
    console.log(`[Script] 🔄 Création d'un nouveau casier Lockr...`)
    const createResult = await createLocker(baseUrl, title)
    
    if (createResult.success) {
      console.log(`[Script] ✅ Casier créé: ${createResult.lockerUrl}`)
      
      // Mettre à jour le jeu dans Supabase
      try {
        await updateGameOnSupabase(gameId, { lockrUrl: createResult.lockerUrl })
        console.log(`[Script] ✅ Jeu mis à jour dans Supabase`)
        results.success.push({ gameName, gameId, lockerUrl: createResult.lockerUrl })
      } catch (updateErr) {
        console.error(`[Script] ❌ Erreur lors de la mise à jour dans Supabase:`, updateErr.message)
        results.failed.push({ 
          gameName, 
          gameId, 
          error: `Casier créé mais erreur Supabase: ${updateErr.message}`, 
          lockerUrl: createResult.lockerUrl 
        })
      }
    } else {
      console.error(`[Script] ❌ Échec de la création: ${createResult.error}`)
      results.failed.push({ gameName, gameId, error: createResult.error })
    }
  } catch (error) {
    console.error(`[Script] ❌ Erreur inattendue pour ${gameName}:`, error.message)
    results.failed.push({ gameName, gameId, error: error.message })
  }
}

checkAndCreateMissingLockr()

