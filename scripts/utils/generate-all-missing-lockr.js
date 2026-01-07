/**
 * Script pour générer tous les casiers Lockr manquants pour les jeux
 * Usage: node scripts/utils/generate-all-missing-lockr.js
 */

import { getGamesFromSupabase, updateGameOnSupabase } from '../../electron/supabase-games-service.js'
import { createLocker } from '../../electron/lockr-service.js'
import { getRedirectUrl } from '../../electron/vercel-config.js'

async function generateAllMissingLockr() {
  try {
    console.log('[Script] 🚀 Génération des casiers Lockr manquants pour tous les jeux...')
    console.log('[Script] 🔗 URL de redirection:', REDIRECT_URL)
    
    // Récupérer tous les jeux
    const gamesResult = await getGamesFromSupabase()
    const games = gamesResult?.games || []
    
    console.log(`[Script] 📋 Nombre total de jeux trouvés: ${games.length}`)
    
    const results = {
      success: [],
      skipped: [],
      failed: []
    }
    
    let processed = 0
    for (const game of games) {
      processed++
      const gameName = game.title || game.name || 'Game'
      const gameId = game.id
      
      console.log(`\n[Script] [${processed}/${games.length}] Traitement: ${gameName} (ID: ${gameId})`)
      
      // 🎯 NOUVEAU : Toujours créer/mettre à jour avec la nouvelle URL Vercel
      // Même si un casier existe déjà, on le met à jour
      const hasExistingLocker = !!game.lockrUrl
      
      if (hasExistingLocker) {
        console.log(`[Script] ⚠️ Jeu a déjà un casier Lockr: ${game.lockrUrl}`)
        console.log(`[Script] 🔄 Mise à jour avec la nouvelle URL Vercel...`)
        
        // Extraire l'ID du casier existant
        const { extractLockerId } = await import('../../electron/lockr-service.js')
        const existingLockerId = extractLockerId(game.lockrUrl)
        
        if (existingLockerId) {
          // Mettre à jour le casier existant
          const { getRedirectUrl } = await import('../../electron/vercel-config.js')
          const baseUrl = getRedirectUrl(gameName, gameId)
          
          const { updateLocker } = await import('../../electron/lockr-service.js')
          const updateResult = await updateLocker(existingLockerId, baseUrl, gameName)
          
          if (updateResult.success) {
            console.log(`[Script] ✅ Casier mis à jour: ${updateResult.lockerUrl}`)
            
            // Mettre à jour dans Supabase
            try {
              await updateGameOnSupabase(gameId, { lockr_url: updateResult.lockerUrl })
              results.success.push({ gameName, gameId, lockerUrl: updateResult.lockerUrl, updated: true })
              continue
            } catch (updateErr) {
              console.error(`[Script] ❌ Erreur Supabase:`, updateErr.message)
              // Continuer pour créer un nouveau casier
            }
          }
        }
        
        // Si la mise à jour a échoué, créer un nouveau casier
        console.log(`[Script] 🔄 Création d'un nouveau casier...`)
      }
      
      if (!gameId) {
        console.log(`[Script] ⚠️ Jeu sans ID ignoré: ${gameName}`)
        results.failed.push({ gameName, gameId, error: 'Jeu sans ID' })
        continue
      }
      
      try {
        // Générer un token via l'API Vercel pour un lien sécurisé
        // Note: En production, le token sera généré dynamiquement à chaque téléchargement
        // Ici, on génère un token pour créer le casier Lockr initial
        const { generateRedirectToken } = await import('../../electron/vercel-token-service.js')
        console.log(`[Script] 🔄 Génération d'un token via l'API Vercel...`)
        
        const tokenResult = await generateRedirectToken(gameId, gameName)
        
        if (!tokenResult.success) {
          console.error(`[Script] ❌ Échec de la génération du token: ${tokenResult.error}`)
          results.failed.push({ gameName, gameId, error: tokenResult.error })
          continue
        }
        
        // Utiliser l'URL de redirection avec token
        const targetUrl = tokenResult.redirectUrl
        console.log(`[Script] 🔗 URL cible (avec token): ${targetUrl}`)
        
        // Créer le casier Lockr avec l'URL contenant le token
        console.log(`[Script] 🔄 Création du casier Lockr...`)
        const createResult = await createLocker(targetUrl, gameName)
        
        if (createResult.success) {
          console.log(`[Script] ✅ Casier créé: ${createResult.lockerUrl}`)
          
          // Mettre à jour le jeu dans Supabase
          try {
            await updateGameOnSupabase(gameId, { lockrUrl: createResult.lockerUrl })
            console.log(`[Script] ✅ Jeu mis à jour dans Supabase`)
            results.success.push({ gameName, gameId, lockerUrl: createResult.lockerUrl })
          } catch (updateErr) {
            console.error(`[Script] ❌ Erreur lors de la mise à jour dans Supabase:`, updateErr.message)
            results.failed.push({ gameName, gameId, error: `Casier créé mais erreur Supabase: ${updateErr.message}`, lockerUrl: createResult.lockerUrl })
          }
        } else {
          console.error(`[Script] ❌ Échec de la création: ${createResult.error}`)
          results.failed.push({ gameName, gameId, error: createResult.error })
        }
        
        // Délai pour éviter de surcharger l'API
        if (processed < games.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error(`[Script] ❌ Erreur inattendue pour ${gameName}:`, error.message)
        results.failed.push({ gameName, gameId, error: error.message })
      }
    }
    
    console.log(`\n[Script] 🎉 Génération terminée!`)
    console.log(`[Script] ✅ Réussis: ${results.success.length}`)
    console.log(`[Script] ⏩ Ignorés (déjà configurés): ${results.skipped.length}`)
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
    
  } catch (error) {
    console.error('[Script] ❌ Erreur critique:', error)
    throw error
  }
}

generateAllMissingLockr()

