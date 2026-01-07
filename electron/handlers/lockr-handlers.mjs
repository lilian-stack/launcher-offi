/**
 * Handlers IPC pour Lockr
 */
import electron from 'electron';
const { ipcMain } = electron
import { getLockrService, getGamesService } from '../utils/services-loader.mjs'
import { log, errorLog } from '../utils/logger.mjs'

let dependencies = {}

export function injectDependencies(deps) {
  dependencies = { ...deps }
}

export function registerLockrHandlers() {
  ipcMain.handle('lockr:createLocker', async (event, gameId, gameName, targetUrl) => {
    try {
      log('[Lockr] Création d\'un casier Lockr pour:', gameName, 'ID:', gameId)
      
      const lockrService = await getLockrService()
      const result = await lockrService.createLocker(targetUrl, gameName)
      
      if (result.success) {
        log('[Lockr] ✅ Casier créé avec succès:', result.lockerUrl)
        return { success: true, lockerUrl: result.lockerUrl }
      } else {
        errorLog('[Lockr] ❌ Erreur lors de la création:', result.error)
        return { success: false, error: result.error }
      }
    } catch (err) {
      errorLog('[Lockr] ❌ Erreur:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('lockr:getLockerInfo', async (event, lockerId) => {
    try {
      log('[Lockr] Récupération des infos d\'un casier Lockr, ID:', lockerId)
      
      const lockrService = await getLockrService()
      const result = await lockrService.getLockerInfo(lockerId)
      
      if (result.success) {
        log('[Lockr] ✅ Infos récupérées:', result.title)
        return { success: true, title: result.title, target: result.target }
      } else {
        errorLog('[Lockr] ❌ Erreur lors de la récupération:', result.error)
        return { success: false, error: result.error }
      }
    } catch (err) {
      errorLog('[Lockr] ❌ Erreur:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('lockr:updateLocker', async (event, lockerId, targetUrl, title) => {
    try {
      log('[Lockr] Mise à jour d\'un casier Lockr, ID:', lockerId)
      
      const lockrService = await getLockrService()
      const result = await lockrService.updateLocker(lockerId, targetUrl, title)
      
      if (result.success) {
        log('[Lockr] ✅ Casier mis à jour avec succès:', result.lockerUrl)
        return { success: true, lockerUrl: result.lockerUrl }
      } else {
        errorLog('[Lockr] ❌ Erreur lors de la mise à jour:', result.error)
        return { success: false, error: result.error }
      }
    } catch (err) {
      errorLog('[Lockr] ❌ Erreur:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('lockr:updateGameLockrUrl', async (event, gameName, lockrUrl) => {
    try {
      log('[Lockr] Mise à jour du lockrUrl pour le jeu:', gameName)
      log('[Lockr] Nouveau lockrUrl:', lockrUrl)
      
      const service = await getGamesService()
      const gamesResult = await service.getGamesFromGitHub()
      const games = gamesResult.games || []
      
      const normalizedGameName = gameName.toLowerCase().trim()
      const game = games.find(g => {
        const gameTitle = (g.title || g.name || '').toLowerCase().trim()
        return gameTitle === normalizedGameName || gameTitle.includes(normalizedGameName) || normalizedGameName.includes(gameTitle)
      })
      
      if (!game) {
        errorLog('[Lockr] ❌ Jeu non trouvé:', gameName)
        return { success: false, error: `Jeu "${gameName}" non trouvé` }
      }
      
      log('[Lockr] ✅ Jeu trouvé:', game.title || game.name, '(ID:', game.id + ')')
      
      await service.updateGame(game.id, { lockrUrl: lockrUrl })
      log('[Lockr] ✅ Jeu mis à jour avec succès dans la base de données')
      
      return { success: true, gameId: game.id, gameName: game.title || game.name, lockrUrl: lockrUrl }
    } catch (err) {
      errorLog('[Lockr] ❌ Erreur lors de la mise à jour du lockrUrl:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('lockr:generateLockersForAllGames', async (event) => {
    try {
      log('[Lockr] ============================================')
      log('[Lockr] 🚀 DÉBUT DE LA GÉNÉRATION DES CASIERS LOCKR')
      log('[Lockr] ============================================')
      
      const service = await getGamesService()
      const gamesResult = await service.getGamesFromGitHub()
      const games = gamesResult.games || []
      
      log('[Lockr] 📋 Nombre total de jeux trouvés:', games.length)
      
      const results = []
      const lockrService = await getLockrService()
      
      const { getRedirectUrl: getVercelRedirectUrl } = await import('../vercel-config.mjs')
      log('[Lockr] 🔗 Configuration Vercel chargée')
      
      let currentIndex = 0
      for (const game of games) {
        currentIndex++
        try {
          const gameName = game.title || game.name || 'Game'
          const gameId = game.id
          
          log('[Lockr] ────────────────────────────────────────────')
          log(`[Lockr] [${currentIndex}/${games.length}] Traitement du jeu:`, gameName)
          log('[Lockr] ID du jeu:', gameId)
          
          const hasExistingLocker = !!game.lockrUrl
          
          if (hasExistingLocker) {
            log('[Lockr] ⚠️ Le jeu a déjà un lien Lockr:', game.lockrUrl)
            log('[Lockr] 🔄 Mise à jour du casier avec la nouvelle URL Vercel...')
            
            const { extractLockerId } = await import('../lockr-service.mjs')
            const existingLockerId = extractLockerId(game.lockrUrl)
            
            if (existingLockerId) {
              const baseUrl = getVercelRedirectUrl(gameName, gameId)
              log('[Lockr] 🔄 Mise à jour du casier existant (ID:', existingLockerId, ') avec:', baseUrl)
              
              const updateResult = await lockrService.updateLocker(existingLockerId, baseUrl, gameName)
              
              if (updateResult.success && updateResult.lockerUrl) {
                log('[Lockr] ✅ Casier mis à jour avec succès:', updateResult.lockerUrl)
                
                try {
                  const updateData = { lockr_url: updateResult.lockerUrl }
                  await service.updateGame(gameId, updateData)
                  log('[Lockr] ✅ Jeu mis à jour dans Supabase')
                  
                  results.push({
                    gameId,
                    gameName,
                    success: true,
                    lockerUrl: updateResult.lockerUrl,
                    updated: true,
                    reason: 'Casier existant mis à jour avec nouvelle URL'
                  })
                  continue
                } catch (updateErr) {
                  errorLog('[Lockr] ❌ Erreur lors de la mise à jour:', updateErr)
                }
              } else {
                log('[Lockr] ⚠️ Échec de la mise à jour, création d\'un nouveau casier...')
              }
            } else {
              log('[Lockr] ⚠️ Impossible d\'extraire l\'ID du casier, création d\'un nouveau...')
            }
          }
          
          const baseUrl = getVercelRedirectUrl(gameName, gameId)
          log('[Lockr] 🔗 URL de base pour le nouveau casier (nouvelle URL Vercel):', baseUrl)
          
          log('[Lockr] 🔄 Création d\'un nouveau casier Lockr...')
          const createResult = await lockrService.createLocker(baseUrl, gameName)
          
          if (!createResult.success || !createResult.lockerUrl) {
            log('[Lockr] ❌ Échec de la création du casier:', createResult.error)
            results.push({
              gameId,
              gameName,
              success: false,
              error: createResult.error
            })
            continue
          }
          
          const lockerUrl = createResult.lockerUrl
          log('[Lockr] ✅ Casier Lockr créé avec succès!')
          log('[Lockr] 🔗 URL du casier:', lockerUrl)
          
          try {
            log('[Lockr] 💾 Mise à jour du jeu dans la base de données...')
            
            const updateData = {
              lockr_url: lockerUrl
            }
            
            await service.updateGame(gameId, updateData)
            log('[Lockr] ✅ Jeu mis à jour avec succès dans la base de données')
            
            const verifyResult = await service.getGamesFromGitHub(true)
            const updatedGame = verifyResult.games?.find(g => g.id === gameId)
            if (updatedGame) {
              log('[Lockr] ✅ Vérification: jeu trouvé après mise à jour')
              log('[Lockr] ✅ lockrUrl:', updatedGame.lockrUrl || updatedGame.LockrUrl || updatedGame.lockr_url)
            } else {
              errorLog('[Lockr] ⚠️ Vérification: jeu non trouvé après mise à jour')
            }
          } catch (updateErr) {
            errorLog('[Lockr] ❌ Erreur lors de la mise à jour du jeu dans la base de données:', updateErr)
            errorLog('[Lockr] ⚠️ Le casier a été créé mais n\'a pas pu être sauvegardé')
          }
          
          results.push({
            gameId,
            gameName,
            success: true,
            lockerUrl: lockerUrl
          })
          
          log('[Lockr] ✅ Jeu traité avec succès:', gameName)
          
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (err) {
          errorLog('[Lockr] ❌ ERREUR CRITIQUE pour le jeu:', game.id)
          errorLog('[Lockr] ❌ Nom du jeu:', game.title || game.name || 'Sans nom')
          errorLog('[Lockr] ❌ Détails de l\'erreur:', err.message)
          results.push({
            gameId: game.id,
            gameName: game.title || game.name || 'Game',
            success: false,
            error: err.message
          })
        }
      }
      
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      log('[Lockr] ============================================')
      log('[Lockr] 📊 RÉSUMÉ DE LA GÉNÉRATION')
      log('[Lockr] ============================================')
      log('[Lockr] 📋 Total de jeux traités:', games.length)
      log('[Lockr] ✅ Succès:', successCount)
      log('[Lockr] ❌ Échecs:', failCount)
      log('[Lockr] ============================================')
      
      try {
        const gamesService = await getGamesService()
        gamesService.invalidateGamesCache()
        log('[Lockr] ✅ Cache des jeux invalidé')
      } catch (cacheErr) {
        errorLog('[Lockr] ⚠️ Erreur lors de l\'invalidation du cache:', cacheErr)
      }
      
      return {
        success: true,
        total: games.length,
        successCount,
        failCount,
        results
      }
    } catch (err) {
      errorLog('[Lockr] ============================================')
      errorLog('[Lockr] ❌ ERREUR CRITIQUE LORS DE LA GÉNÉRATION')
      errorLog('[Lockr] ============================================')
      errorLog('[Lockr] ❌ Message:', err.message)
      errorLog('[Lockr] ❌ Stack trace:', err.stack)
      return { success: false, error: err.message }
    }
  })
}
