/**
 * Handlers IPC pour la gestion des jeux
 * Extraits de main.js pour améliorer la maintenabilité
 */

import electron from 'electron';
const { ipcMain } = electron
import electron from 'electron';
const { app, shell, dialog } = electron
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'

// Services lazy-loaded (injectés)
let getGamesService = null
let getGameExtractor = null
let getLockrService = null
let getAdsService = null
let getDiscordRPCService = null
let installedGamesStore = null

// State (injecté)
let mainWindow = null
let scanCache = null
let uninstallingGames = null
let BrowserWindow = null

// Helpers (injectés)
let killGameProcesses = null
let forceDeleteFolder = null
let countFilesRecursive = null
let deleteDirectoryWithProgress = null

// Logging (injecté)
let log = null
let errorLog = null

/**
 * Injecter les dépendances nécessaires
 */
export function injectDependencies(dependencies) {
  getGamesService = dependencies.getGamesService
  getGameExtractor = dependencies.getGameExtractor
  getLockrService = dependencies.getLockrService
  getAdsService = dependencies.getAdsService
  getDiscordRPCService = dependencies.getDiscordRPCService
  installedGamesStore = dependencies.installedGamesStore
  mainWindow = dependencies.mainWindow
  scanCache = dependencies.scanCache
  uninstallingGames = dependencies.uninstallingGames
  BrowserWindow = dependencies.BrowserWindow
  killGameProcesses = dependencies.killGameProcesses
  forceDeleteFolder = dependencies.forceDeleteFolder
  countFilesRecursive = dependencies.countFilesRecursive
  deleteDirectoryWithProgress = dependencies.deleteDirectoryWithProgress
  log = dependencies.log
  errorLog = dependencies.errorLog
}

/**
 * Enregistrer tous les handlers de jeux
 */
export function registerGamesHandlers() {
  // Handlers pour la gestion des jeux
  ipcMain.handle('games:addGame', async (event, gameData) => {
    try {
      log('games:addGame called')
      const service = await getGamesService()
      const result = await service.addGame(gameData)
      
      // Envoyer une notification Discord si l'ajout a réussi
      if (result && (result.success !== false)) {
        try {
          log('[Discord Webhook] 📤 Envoi de la notification pour le nouveau jeu...')
          const { notifyGameAdded } = await import('../discord-webhook-service.mjs')
          const webhookResult = await notifyGameAdded(gameData)
          if (webhookResult.success) {
            log('[Discord Webhook] ✅ Notification Discord envoyée avec succès')
          } else {
            log('[Discord Webhook] ⚠️ Échec de l\'envoi (non bloquant):', webhookResult.error)
          }
        } catch (webhookError) {
          // Ne pas faire échouer l'ajout du jeu si le webhook échoue
          errorLog('[Discord Webhook] ⚠️ Erreur lors de l\'envoi (non bloquant):', webhookError.message)
        }
      }
      
      return result
    } catch (err) {
      errorLog('games:addGame error', err)
      throw err
    }
  })

  ipcMain.handle('games:deleteGame', async (event, gameId) => {
    try {
      log('games:deleteGame called with gameId:', gameId)
      const service = await getGamesService()
      const result = await service.deleteGame(gameId)
      log('games:deleteGame success')
      return result
    } catch (err) {
      errorLog('games:deleteGame error', err)
      throw err
    }
  })

  ipcMain.handle('games:updateGame', async (event, gameId, updates) => {
    try {
      log('games:updateGame called with gameId:', gameId)
      const service = await getGamesService()
      const result = await service.updateGame(gameId, updates)
      log('games:updateGame success')
      return result
    } catch (err) {
      errorLog('games:updateGame error', err)
      throw err
    }
  })

  // Handler pour obtenir les jeux installés
  ipcMain.handle('games:getInstalled', async () => {
    try {
      // FORCER UN SCAN si le cache est vide ou trop ancien (plus de 5 secondes)
      const now = Date.now()
      const cacheAge = scanCache.lastScan > 0 ? (now - scanCache.lastScan) : Infinity
      
      if (!scanCache.games || scanCache.games.length === 0 || cacheAge > 5000) {
        log('[getInstalled] 🔍 Cache vide ou expiré, scan forcé...')
        // Forcer un nouveau scan en appelant directement la logique de scan
        const foldersToScan = []
        foldersToScan.push(app.getPath('downloads'))
        foldersToScan.push(app.getPath('documents'))
        foldersToScan.push(app.getPath('pictures'))
        foldersToScan.push(app.getPath('videos'))
        foldersToScan.push(path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'))
        foldersToScan.push(path.join(app.getPath('documents'), 'Games'))
        foldersToScan.push(path.join(app.getPath('documents'), 'My Games'))
        foldersToScan.push(path.join(app.getPath('userData'), 'Games'))
        
        try {
          const userProfile = process.env.USERPROFILE || process.env.HOME
          if (userProfile) {
            foldersToScan.push(path.join(userProfile, 'Games'))
            foldersToScan.push(path.join(userProfile, 'Downloads', 'Games'))
            foldersToScan.push(path.join(userProfile, 'Desktop', 'Games'))
          }
        } catch (err) {
          // Ignorer les erreurs
        }
        
        // ✅ ÉTAPE 1 : VIDER LE CACHE AVANT LE SCAN
        log('[getInstalled] 🗑️ Vidage du cache avant le scan')
        scanCache.games = []
        
        // ✅ ÉTAPE 2 : CRÉER UNE NOUVELLE LISTE VIDE
        const allInstalledGames = []
        
        // ✅ ÉTAPE 3 : SCANNER LES DISQUES
        for (const folder of foldersToScan) {
          if (fs.existsSync(folder)) {
            const extractor = await getGameExtractor()
            const games = extractor.scanInstalledGames(folder)
            // Ajouter les jeux trouvés (éviter les doublons basés sur le chemin)
            for (const game of games) {
              const gamePath = (game.path || game.gamePath || '').toLowerCase()
              const isDuplicate = allInstalledGames.some(existing => 
                (existing.path || existing.gamePath || '').toLowerCase() === gamePath
              )
              if (!isDuplicate) {
                allInstalledGames.push(game)
              }
            }
          }
        }
        
        // ✅ ÉTAPE 4 : METTRE À JOUR LE CACHE AVEC SEULEMENT LES JEUX DÉTECTÉS
        scanCache.games = allInstalledGames
        scanCache.lastScan = now
        log('[getInstalled] ✅ Scan terminé,', allInstalledGames.length, 'jeux trouvés')
      }
      
      // Utiliser le cache de scan
      if (scanCache && scanCache.games && scanCache.games.length > 0) {
        return scanCache.games.map(game => ({
          id: game.id || game.gameId,
          name: game.gameName || game.name || game.title,
          path: game.path || game.gamePath,
          exePath: game.exePath,
          installed: true
        }))
      }
      
      // Si pas de cache, retourner un tableau vide
      return []
    } catch (err) {
      errorLog('[IPC] games:getInstalled error', err)
      return []
    }
  })

  // Handler pour scanner les jeux installés
  ipcMain.handle('scan-installed-games', async (event, gamesFolder = null, forceRefresh = false) => {
    try {
      // Si forceRefresh, ignorer le cache et forcer un nouveau scan
      const now = Date.now()
      if (!forceRefresh && scanCache.lastScan > 0 && (now - scanCache.lastScan) < scanCache.cacheDuration) {
        // Log réduit pour éviter le spam
        log('[Scan] 📦 Utilisation du cache (', scanCache.games.length, 'jeux)')
        return { success: true, games: scanCache.games }
      }
      
      // ✅ ÉTAPE 1 : VIDER LE CACHE AVANT LE SCAN
      log('[Scan] 🗑️ ÉTAPE 1 : Vidage du cache avant le scan')
      scanCache.games = []
      scanCache.lastScan = 0
      
      // Log uniquement si scan forcé
      if (forceRefresh) {
        log('[Scan] 🔍 Scan forcé - recherche de tous les fichiers .crklauncheur...')
      }
      
      // Si aucun dossier spécifié, scanner TOUS les emplacements possibles
      const foldersToScan = []
      
      if (gamesFolder) {
        foldersToScan.push(gamesFolder)
      } else {
        // Scanner TOUS les emplacements par défaut (comme Steam/Epic)
        foldersToScan.push(app.getPath('downloads'))
        foldersToScan.push(app.getPath('documents'))
        foldersToScan.push(app.getPath('pictures'))
        foldersToScan.push(app.getPath('videos'))
        foldersToScan.push(path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'))
        foldersToScan.push(path.join(app.getPath('documents'), 'Games'))
        foldersToScan.push(path.join(app.getPath('documents'), 'My Games'))
        foldersToScan.push(path.join(app.getPath('userData'), 'Games'))
        
        // Scanner aussi dans les dossiers communs
        try {
          const userProfile = process.env.USERPROFILE || process.env.HOME
          if (userProfile) {
            foldersToScan.push(path.join(userProfile, 'Games'))
            foldersToScan.push(path.join(userProfile, 'Downloads', 'Games'))
            foldersToScan.push(path.join(userProfile, 'Desktop', 'Games'))
          }
        } catch (err) {
          // Ignorer les erreurs
        }
      }
      
      const allInstalledGames = []
      const seenGames = new Set() // Pour éviter les doublons
      
      for (const folder of foldersToScan) {
        if (fs.existsSync(folder)) {
          const extractor = await getGameExtractor()
          const games = extractor.scanInstalledGames(folder)
          
          // Éviter les doublons basés sur le chemin du jeu
          for (const game of games) {
            const gameKey = (game.path || game.gamePath || '').toLowerCase()
            if (gameKey && !seenGames.has(gameKey)) {
              seenGames.add(gameKey)
              allInstalledGames.push(game)
            }
          }
        }
      }
      
      // 🔍 ENRICHIR LES JEUX SCANNÉS AVEC LE gameId DU CATALOGUE
      try {
        const gamesService = await getGamesService()
        const catalogResult = await gamesService.getGamesFromGitHub(false) // Utiliser le cache
        const catalogGames = catalogResult?.games || []
        
        for (const scannedGame of allInstalledGames) {
          const gameName = (scannedGame.name || scannedGame.gameName || '').toLowerCase().trim()
          
          if (gameName) {
            // Chercher dans le catalogue par nom
            const catalogMatch = catalogGames.find(catalogGame => {
              const catalogName = (catalogGame.name || catalogGame.title || '').toLowerCase().trim()
              return catalogName === gameName || 
                     (catalogName.length > 0 && gameName.length > 0 &&
                      (catalogName.includes(gameName) || gameName.includes(catalogName)))
            })
            
            if (catalogMatch) {
              // Enrichir le jeu scanné avec le gameId du catalogue
              const catalogGameId = catalogMatch.id || catalogMatch.gameId
              scannedGame.catalogGameId = catalogGameId
              scannedGame.gameId = catalogGameId || scannedGame.gameId || scannedGame.launcherId
              
              // Les données du jeu sont maintenant stockées dans SimpleStore/SQLite, pas dans des fichiers .crklauncher
              
            } else {
              // Si pas trouvé dans le catalogue, utiliser le launcherId
              scannedGame.gameId = scannedGame.gameId || scannedGame.launcherId
              console.log('[Scan] ⚠️ Jeu non trouvé dans le catalogue, utilisation du launcherId:', gameName)
            }
          } else {
            scannedGame.gameId = scannedGame.gameId || scannedGame.launcherId
          }
        }
      } catch (catalogError) {
        errorLog('[Scan] ⚠️ Erreur lors de la recherche dans le catalogue:', catalogError)
        // En cas d'erreur, utiliser le launcherId
        for (const scannedGame of allInstalledGames) {
          scannedGame.gameId = scannedGame.gameId || scannedGame.launcherId
        }
      }
      
      // 💾 SAUVEGARDER LES JEUX DÉTECTÉS DANS LE STORE (avec le gameId du catalogue si trouvé)
      try {
        installedGamesStore.saveInstalledGamesFromScan(allInstalledGames)
      } catch (storeError) {
        errorLog('[Scan] ⚠️ Erreur lors de la sauvegarde dans le store:', storeError)
      }
      
      // 🔄 FUSIONNER AVEC LES JEUX SAUVEGARDÉS (pour récupérer les jeux dont les dossiers existent toujours)
      const savedGames = installedGamesStore.verifyInstalledGames(fs.existsSync)
      const mergedGames = installedGamesStore.mergeWithScannedGames(allInstalledGames)
      
      // Mettre à jour le cache avec les jeux fusionnés
      scanCache.games = mergedGames
      scanCache.lastScan = now
      
      // Log uniquement si des jeux ont été trouvés ou si scan forcé
      if (mergedGames.length > 0 || forceRefresh) {
        log('[Scan] ✅', mergedGames.length, 'jeux trouvés (', allInstalledGames.length, 'scannés,', Object.keys(savedGames).length, 'sauvegardés)')
      }
      return { success: true, games: mergedGames }
    } catch (error) {
      errorLog('[Scan] Erreur lors du scan:', error)
      return { success: false, error: error.message, games: [] }
    }
  })

  // Handler pour vérifier si un fichier existe
  ipcMain.handle('games:checkFileExists', async (event, filePath) => {
    try {
      if (!filePath) return { success: false, exists: false }
      const exists = fs.existsSync(filePath)
      return { success: true, exists }
    } catch (error) {
      errorLog('[Games] Erreur lors de la vérification du fichier:', error)
      return { success: false, exists: false }
    }
  })

  // Handler pour vérifier si un jeu est installé
  ipcMain.handle('games:isGameInstalled', async (event, gameId) => {
    try {
      if (!installedGamesStore) {
        errorLog('[isGameInstalled] ❌ installedGamesStore non initialisé')
        return { installed: false, path: null, gameData: null, error: 'Store non initialisé' }
      }

      if (!gameId) {
        console.log('[isGameInstalled] ⚠️ gameId manquant')
        return { installed: false, path: null, gameData: null }
      }

      
      // Obtenir tous les jeux installés
      const allInstalled = installedGamesStore.getAllInstalledGames()
      
      // Vérifier dans le store de persistance avec l'ID exact
      let savedGame = installedGamesStore.getInstalledGame(gameId)
      
      // Si pas trouvé, essayer des variantes d'ID (lowercase, slug, etc.)
      if (!savedGame) {
        const gameIdLower = String(gameId).toLowerCase()
        const gameIdSlug = gameIdLower.replace(/\s+/g, '-')
        
        // Essayer avec toutes les clés disponibles
        for (const [key, value] of Object.entries(allInstalled)) {
          const keyLower = String(key).toLowerCase()
          const keySlug = keyLower.replace(/\s+/g, '-')
          
          if (keyLower === gameIdLower || keySlug === gameIdSlug || key === gameId) {
            savedGame = value
            break
          }
        }
      }
      
      // Si toujours pas trouvé, vérifier dans le cache de scan
      if (!savedGame && scanCache && scanCache.games) {
        const scannedGame = scanCache.games.find(g => {
          const gId = String(g.gameId || g.id || '').toLowerCase()
          const gName = (g.name || g.gameName || '').toLowerCase()
          const searchId = String(gameId).toLowerCase()
          return gId === searchId || gName === searchId
        })
        
        if (scannedGame) {
          savedGame = {
            gameId: scannedGame.gameId || scannedGame.id,
            gameName: scannedGame.name || scannedGame.gameName,
            path: scannedGame.path || scannedGame.gamePath,
            exePath: scannedGame.exePath,
            installed: true
          }
        }
      }
      
      if (savedGame) {
        const gamePath = savedGame.path || savedGame.gamePath
        const exists = gamePath ? fs.existsSync(gamePath) : false
        
        if (exists) {
          return {
            installed: true,
            path: gamePath,
            gameData: savedGame
          }
        } else {
          console.log('[isGameInstalled] ⚠️ Jeu trouvé dans le store mais dossier inexistant:', gamePath)
          // Le jeu est dans le store mais le dossier n'existe plus
          // On peut considérer qu'il n'est plus installé
          return { installed: false, path: null, gameData: savedGame }
        }
      }
      
      console.log('[isGameInstalled] ❌ Jeu non trouvé pour gameId:', gameId)
      return { installed: false, path: null, gameData: null }
    } catch (err) {
      errorLog('[isGameInstalled] Erreur:', err)
      return { installed: false, path: null, gameData: null, error: err.message }
    }
  })

  // Handler pour trouver l'exécutable d'un jeu
  ipcMain.handle('games:findGameExe', async (event, gameFolder, gameName) => {
    try {
      if (!gameFolder || !fs.existsSync(gameFolder)) {
        return { success: false, exePath: null, error: 'Dossier du jeu introuvable' }
      }

      const extractor = await getGameExtractor()
      const exePath = extractor.findGameExe(gameFolder, gameName)
      
      if (exePath) {
        return { success: true, exePath }
      } else {
        return { success: false, exePath: null, error: 'Exécutable non trouvé' }
      }
    } catch (error) {
      errorLog('[Games] Erreur lors de la recherche de l\'exécutable:', error)
      return { success: false, exePath: null, error: error.message }
    }
  })

  // Handler pour lancer un jeu avec publicités
  ipcMain.handle('games:launchGameWithAds', async (event, exePath, gameName, userStatus, gameId = null) => {
    try {
      log('[Launch] 🚀 Lancement du jeu avec publicités:', gameName, 'gameId:', gameId)
      
      // Vérifier le statut utilisateur pour déterminer si on affiche des pubs
      const isVip = userStatus === 'VIP' || userStatus === 'ADMIN' || userStatus === 'BOOST'
      
      if (!isVip) {
        // Afficher une publicité avant de lancer le jeu
        try {
          const adsService = await getAdsService()
          if (adsService && adsService.showAdBeforeGame) {
            await adsService.showAdBeforeGame(gameName)
          }
        } catch (adsError) {
          // Ne pas bloquer le lancement si les pubs échouent
          errorLog('[Launch] ⚠️ Erreur lors de l\'affichage de la pub:', adsError)
        }
      }
      
      // Lancer le jeu avec tracking
      return await launchGameDirectly(exePath, gameName, gameId)
    } catch (error) {
      errorLog('[Launch] Erreur lors du lancement avec pubs:', error)
      throw error
    }
  })

  // Handler pour lancer un jeu
  ipcMain.handle('games:launchGame', async (event, exePath, gameName = null, gameId = null) => {
    try {
      log('[Launch] 🚀 Lancement du jeu:', gameName, 'gameId:', gameId)
      return await launchGameDirectly(exePath, gameName, gameId)
    } catch (error) {
      errorLog('[Launch] Erreur lors du lancement:', error)
      throw error
    }
  })

  // Handler pour désinstaller un jeu
  ipcMain.handle('games:uninstallGame', async (event, gameName, gameFolderPath = null) => {
    try {
      log('[Uninstall] ════════════════════════════════════════════════════════')
      log('[Uninstall] 🗑️ DÉBUT DE LA DÉSINSTALLATION')
      log('[Uninstall] 📋 Paramètres reçus:')
      log('[Uninstall]   - gameName:', gameName)
      log('[Uninstall]   - gameFolderPath:', gameFolderPath || '(non fourni)')
      log('[Uninstall]   - gameFolderPath existe?', gameFolderPath ? fs.existsSync(gameFolderPath) : 'N/A')
      
      // 🔒 Vérifier si une désinstallation est déjà en cours pour ce jeu
      if (uninstallingGames.has(gameName)) {
        log('[Uninstall] ⚠️ Désinstallation déjà en cours pour:', gameName)
        return { success: false, error: 'Une désinstallation est déjà en cours pour ce jeu' }
      }
      
      // Ajouter le jeu à la liste des désinstallations en cours
      uninstallingGames.add(gameName)
      
      try {
        let gameFolder = null
        
        // ✅ Si un chemin est fourni directement, l'utiliser en priorité
        if (gameFolderPath) {
          if (fs.existsSync(gameFolderPath)) {
            gameFolder = gameFolderPath
            log('[Uninstall] ✅ Chemin fourni directement et valide:', gameFolder)
          } else {
            log('[Uninstall] ⚠️ Chemin fourni n\'existe pas, recherche alternative:', gameFolderPath)
            log('[Uninstall]   - Vérification fs.existsSync:', fs.existsSync(gameFolderPath))
          }
        } else {
          log('[Uninstall] ℹ️ Aucun chemin fourni, recherche par nom du jeu...')
        }
      
        // Fonction de normalisation pour supprimer les caractères spéciaux
        const normalizeName = (name) => {
          if (!name) return ''
          return name
            .toLowerCase()
            .trim()
            .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '')
            .replace(/[^\x20-\x7E]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/[^a-z0-9\s]/g, '')
            .trim()
        }
        
        // 🔍 MÉTHODE 1 : Chercher dans le cache de scan
        if (!gameFolder && scanCache.games && scanCache.games.length > 0) {
          log('[Uninstall] 🔍 MÉTHODE 1: Recherche dans le cache de scan...')
          const normalizedGameName = normalizeName(gameName)
          
          for (const installedGame of scanCache.games) {
            const installedGameName = normalizeName(installedGame.gameName || installedGame.name || '')
            
            if ((installedGameName === normalizedGameName || 
                 installedGameName.includes(normalizedGameName) ||
                 normalizedGameName.includes(installedGameName)) && 
                (installedGame.gameFolder || installedGame.folder || installedGame.path || installedGame.gamePath)) {
              gameFolder = installedGame.gameFolder || installedGame.folder || installedGame.path || installedGame.gamePath
              log('[Uninstall] ✅ Jeu trouvé dans le cache:', gameFolder)
              break
            }
          }
        }
        
        // 🔍 MÉTHODE 2 : Si pas trouvé dans le cache, chercher dans les dossiers
        if (!gameFolder) {
          log('[Uninstall] 🔍 MÉTHODE 2: Recherche dans les dossiers...')
          const normalizedName = gameName.replace(/-AnkerGames?$/i, '').trim()
          const nameVariants = [gameName, normalizedName]
          
          const foldersToScan = [
            app.getPath('downloads'),
            app.getPath('documents'),
            app.getPath('pictures'),
            path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'),
            path.join(app.getPath('documents'), 'Games')
          ]
          
          for (const folder of foldersToScan) {
            if (!fs.existsSync(folder)) continue
            
            for (const nameVariant of nameVariants) {
              const gamePath = path.join(folder, nameVariant)
              const markerPath1 = path.join(gamePath, `${nameVariant}.crklauncheur`)
              const markerPath2 = path.join(gamePath, '.crklauncheur')
              // Les données du jeu sont maintenant stockées dans SimpleStore/SQLite, pas dans des fichiers .crklauncher
              const markerPath = fs.existsSync(markerPath1) ? markerPath1 : 
                               (fs.existsSync(markerPath2) ? markerPath2 : markerPath3)
              
              if (fs.existsSync(markerPath)) {
                try {
                  const gameData = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
                  const markerGameName = normalizeName(gameData.gameName || '')
                  const searchGameName = normalizeName(gameName)
                  
                  if (markerGameName === searchGameName ||
                      markerGameName.includes(searchGameName) ||
                      searchGameName.includes(markerGameName)) {
                    gameFolder = gamePath
                    log('[Uninstall] 📁 Jeu trouvé:', gameFolder)
                    break
                  }
                } catch (err) {
                  // Ignorer les erreurs de lecture
                }
              }
            }
            
            if (gameFolder) break
          }
        }
        
        // ✅ VÉRIFICATION CRITIQUE : Si un chemin a été fourni directement, l'utiliser en PRIORITÉ ABSOLUE
        if (gameFolderPath && fs.existsSync(gameFolderPath)) {
          gameFolder = gameFolderPath
          log('[Uninstall] ✅ Chemin fourni directement et valide - UTILISATION PRIORITAIRE:', gameFolder)
        }
        
        if (!gameFolder) {
          log('[Uninstall] ❌ Aucun dossier trouvé pour le jeu')
          return { success: false, error: `Dossier du jeu non trouvé pour "${gameName}"` }
        }
        
        // ✅ VÉRIFICATION FINALE : S'assurer que le dossier existe AVANT de continuer
        if (!fs.existsSync(gameFolder)) {
          log('[Uninstall] ⚠️ Le dossier n\'existe pas:', gameFolder)
          
          if (gameFolderPath && gameFolder === gameFolderPath) {
            log('[Uninstall] ❌ ERREUR: Le chemin fourni n\'existe pas:', gameFolderPath)
            return { success: false, error: `Le dossier fourni n'existe pas: ${gameFolderPath}` }
          }
          
          const normalizeNameForCheck = (name) => {
            if (!name) return ''
            return name.toLowerCase().trim()
              .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '')
              .replace(/[^\x20-\x7E]/g, '')
              .replace(/\s+/g, ' ')
              .replace(/[^a-z0-9\s]/g, '')
              .trim()
          }
          
          const wasInCache = scanCache.games && scanCache.games.some(g => {
            const normalizedCacheName = normalizeNameForCheck(g.gameName || g.name || '')
            const normalizedSearchName = normalizeNameForCheck(gameName)
            return normalizedCacheName === normalizedSearchName ||
                   normalizedCacheName.includes(normalizedSearchName) ||
                   normalizedSearchName.includes(normalizedCacheName)
          })
          
          if (wasInCache) {
            log('[Uninstall] ℹ️ Le jeu était dans le cache mais le dossier n\'existe plus - déjà supprimé')
            scanCache.lastScan = 0
            const allWindows = BrowserWindow.getAllWindows()
            allWindows.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('game-uninstalled', { gameName: gameName })
                log('[Uninstall] 📤 Événement game-uninstalled envoyé')
              }
            })
            return { success: true, message: `${gameName} a déjà été désinstallé` }
          }
          
          return { success: false, error: `Le dossier du jeu n'existe pas: ${gameFolder}` }
        }
        
        log('[Uninstall] ✅ Dossier confirmé, début de la suppression...')
        
        // 🗑️ Supprimer le fichier .crklauncheur AVANT la suppression du dossier
        try {
          const launcherFilePaths = [
            path.join(gameFolder, `${gameName}.crklauncheur`),
            path.join(gameFolder, `.${gameName}.crklauncheur`),
            path.join(gameFolder, `.crklauncheur`)
          ]
          
          let foundLauncherFile = null
          for (const launcherFilePath of launcherFilePaths) {
            if (fs.existsSync(launcherFilePath)) {
              foundLauncherFile = launcherFilePath
              break
            }
          }
          
          if (!foundLauncherFile) {
            try {
              const files = fs.readdirSync(gameFolder)
              for (const file of files) {
                if (file.endsWith('.crklauncheur')) {
                  foundLauncherFile = path.join(gameFolder, file)
                  break
                }
              }
            } catch (err) {
              // Ignorer
            }
          }
          
          if (foundLauncherFile) {
            log('[Uninstall] 🗑️ Suppression du fichier .crklauncheur:', foundLauncherFile)
            fs.unlinkSync(foundLauncherFile)
            log('[Uninstall] ✅ Fichier .crklauncheur supprimé avec succès')
          }
        } catch (launcherFileErr) {
          log('[Uninstall] ⚠️ Erreur lors de la suppression du fichier .crklauncheur:', launcherFileErr.message)
        }
        
        // 🔒 Fermer tous les processus liés au jeu
        log('[Uninstall] 🔒 Fermeture des processus liés au jeu...')
        await killGameProcesses(gameFolder)
        log('[Uninstall] ✅ Processus fermés')
        
        // ⏳ Attendre un peu que les fichiers se déverrouillent
        log('[Uninstall] ⏳ Attente pour libérer les fichiers...')
        
        if (event && event.sender && !event.sender.isDestroyed()) {
          event.sender.send('uninstall:progress', {
            progress: 0,
            step: 'Arrêt des processus...',
            deletedFiles: 0,
            totalFiles: 0
          })
        }
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // 🗑️ Supprimer le dossier avec progression
        log('[Uninstall] 🗑️ Suppression du dossier du jeu:', gameFolder)
        
        if (!fs.existsSync(gameFolder)) {
          log('[Uninstall] ⚠️ Le dossier n\'existe plus, considéré comme déjà supprimé')
          if (event && event.sender && !event.sender.isDestroyed()) {
            event.sender.send('uninstall:progress', {
              progress: 100,
              step: 'Finalisation...',
              deletedFiles: 0,
              totalFiles: 0
            })
          }
        } else {
          try {
            const totalFiles = countFilesRecursive(gameFolder)
            log('[Uninstall] 📊 Total fichiers à supprimer:', totalFiles)
            
            if (totalFiles === 0) {
              log('[Uninstall] 📁 Dossier vide détecté, suppression directe...')
              let deleted = false
              
              try {
                await fsPromises.rm(gameFolder, { recursive: true, force: true })
                await new Promise(resolve => setTimeout(resolve, 200))
                if (!fs.existsSync(gameFolder)) {
                  log('[Uninstall] ✅ Dossier vide supprimé')
                  deleted = true
                }
              } catch (rmError) {
                try {
                  await fsPromises.rmdir(gameFolder)
                  await new Promise(resolve => setTimeout(resolve, 200))
                  if (!fs.existsSync(gameFolder)) {
                    deleted = true
                  }
                } catch (rmdirError) {
                  try {
                    fs.rmSync(gameFolder, { recursive: true, force: true })
                    await new Promise(resolve => setTimeout(resolve, 200))
                    if (!fs.existsSync(gameFolder)) {
                      deleted = true
                    }
                  } catch (syncError) {
                    errorLog('[Uninstall] ⚠️ rmSync échoué:', syncError.message)
                  }
                }
              }
              
              if (!deleted && fs.existsSync(gameFolder)) {
                try {
                  await forceDeleteFolder(gameFolder)
                  await new Promise(resolve => setTimeout(resolve, 500))
                  if (!fs.existsSync(gameFolder)) {
                    deleted = true
                  }
                } catch (forceErr) {
                  errorLog('[Uninstall] ⚠️ forceDeleteFolder échoué:', forceErr.message)
                }
              }
              
              if (event && event.sender && !event.sender.isDestroyed()) {
                event.sender.send('uninstall:progress', {
                  progress: 100,
                  step: 'Finalisation...',
                  deletedFiles: 0,
                  totalFiles: 0
                })
              }
            } else {
              await deleteDirectoryWithProgress(gameFolder, event, totalFiles)
              log('[Uninstall] ✅ Dossier supprimé')
            }
            
            // Vérifier que le dossier a bien été supprimé
            let folderStillExists = fs.existsSync(gameFolder)
            if (folderStillExists) {
              log('[Uninstall] ⏳ Le dossier existe encore, tentatives de nettoyage...')
              
              for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                  await new Promise(resolve => setTimeout(resolve, 300 * attempt))
                  
                  if (fs.existsSync(gameFolder)) {
                    fs.rmSync(gameFolder, { recursive: true, force: true })
                    log(`[Uninstall] ✅ Dossier supprimé avec fs.rmSync (tentative ${attempt})`)
                    await new Promise(resolve => setTimeout(resolve, 200))
                  }
                  
                  folderStillExists = fs.existsSync(gameFolder)
                  if (!folderStillExists) {
                    log('[Uninstall] ✅ Dossier confirmé supprimé')
                    break
                  }
                } catch (syncErr) {
                  log(`[Uninstall] ⚠️ Tentative ${attempt} échouée:`, syncErr.message)
                  
                  if (attempt === 3 && fs.existsSync(gameFolder)) {
                    try {
                      log('[Uninstall] 🔨 Dernière tentative avec forceDeleteFolder...')
                      await forceDeleteFolder(gameFolder)
                      await new Promise(resolve => setTimeout(resolve, 500))
                      
                      folderStillExists = fs.existsSync(gameFolder)
                      if (!folderStillExists) {
                        log('[Uninstall] ✅ Dossier supprimé avec forceDeleteFolder')
                      } else {
                        errorLog('[Uninstall] ❌ Le dossier existe toujours')
                      }
                    } catch (forceErr) {
                      errorLog('[Uninstall] ❌ Erreur avec forceDeleteFolder:', forceErr)
                    }
                  }
                }
              }
              
              if (fs.existsSync(gameFolder)) {
                errorLog('[Uninstall] ⚠️ ATTENTION: Le dossier existe toujours:', gameFolder)
              }
            }
          } catch (deleteError) {
            errorLog('[Uninstall] ❌ Erreur lors de la suppression:', deleteError)
            
            // Fallback avec fs.rmSync
            try {
              let deleted = false
              for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                  await new Promise(resolve => setTimeout(resolve, 500 * attempt))
                  
                  if (fs.existsSync(gameFolder)) {
                    fs.rmSync(gameFolder, { recursive: true, force: true })
                    await new Promise(resolve => setTimeout(resolve, 300))
                    
                    if (!fs.existsSync(gameFolder)) {
                      log(`[Uninstall] ✅ Dossier supprimé avec fs.rmSync (fallback, tentative ${attempt})`)
                      deleted = true
                      break
                    }
                  } else {
                    deleted = true
                    break
                  }
                } catch (attemptErr) {
                  log(`[Uninstall] ⚠️ Tentative ${attempt}/3 du fallback échouée:`, attemptErr.message)
                  
                  if (attempt === 3) {
                    try {
                      await forceDeleteFolder(gameFolder)
                      await new Promise(resolve => setTimeout(resolve, 500))
                      if (!fs.existsSync(gameFolder)) {
                        deleted = true
                      }
                    } catch (forceErr) {
                      // Ignorer
                    }
                  }
                }
              }
              
              if (!deleted && fs.existsSync(gameFolder)) {
                throw new Error('Le dossier existe toujours après toutes les tentatives de fallback')
              }
            } catch (rmErr) {
              errorLog('[Uninstall] ❌ Erreur avec fs.rmSync aussi:', rmErr)
              throw new Error(`Impossible de supprimer le dossier "${gameFolder}". Le dossier est peut-être ouvert dans l'Explorateur ou utilisé par un autre programme.`)
            }
          }
        }
        
        const deleted = !fs.existsSync(gameFolder)
        
        if (deleted) {
          log('[Uninstall] ✅ Suppression confirmée')
          
          // 💾 SUPPRIMER LE JEU DU STORE
          try {
            let gameIdToRemove = null
            if (scanCache.games && scanCache.games.length > 0) {
              const normalizedGameName = normalizeName(gameName)
              for (const installedGame of scanCache.games) {
                const installedGameName = normalizeName(installedGame.gameName || installedGame.name || '')
                if (installedGameName === normalizedGameName || 
                    installedGameName.includes(normalizedGameName) ||
                    normalizedGameName.includes(installedGameName)) {
                  gameIdToRemove = installedGame.gameId || installedGame.id
                  break
                }
              }
            }
            
            if (gameIdToRemove) {
              installedGamesStore.removeInstalledGame(gameIdToRemove)
              log('[Uninstall] 💾 Jeu supprimé du store:', gameIdToRemove)
              
              // 💾 Supprimer aussi de SQLite
              try {
                console.log('[Uninstall] 🗄️ Suppression du jeu de SQLite:', gameIdToRemove)
                const { gamesLibrarySQLite } = await import('../games-library-sqlite.mjs')
                await gamesLibrarySQLite.removeInstalledGame(gameIdToRemove)
                console.log('[Uninstall] ✅ Jeu supprimé de SQLite')
              } catch (sqliteError) {
                console.log('[Uninstall] ⚠️ Erreur lors de la suppression de SQLite:', sqliteError.message)
              }
            } else {
              const allSavedGames = installedGamesStore.getAllInstalledGames()
              for (const [savedGameId, savedGame] of Object.entries(allSavedGames)) {
                const savedPath = savedGame.path || savedGame.gamePath
                if (savedPath === gameFolder || savedPath === gameFolderPath) {
                  installedGamesStore.removeInstalledGame(savedGameId)
                  log('[Uninstall] 💾 Jeu supprimé du store par chemin:', savedGameId)
                  
                  // 💾 Supprimer aussi de SQLite
                  try {
                    console.log('[Uninstall] 🗄️ Suppression du jeu de SQLite par chemin:', savedGameId)
                    const { gamesLibrarySQLite } = await import('../games-library-sqlite.mjs')
                    await gamesLibrarySQLite.removeInstalledGame(savedGameId)
                    console.log('[Uninstall] ✅ Jeu supprimé de SQLite')
                  } catch (sqliteError) {
                    console.log('[Uninstall] ⚠️ Erreur lors de la suppression de SQLite:', sqliteError.message)
                  }
                  break
                }
              }
            }
          } catch (storeError) {
            errorLog('[Uninstall] ⚠️ Erreur lors de la suppression du store:', storeError)
          }
          
          // 🗑️ Supprimer le raccourci sur le bureau
          try {
            const desktopPath = app.getPath('desktop')
            const shortcutPath = path.join(desktopPath, `${gameName}.lnk`)
            
            if (fs.existsSync(shortcutPath)) {
              fs.unlinkSync(shortcutPath)
              log('[Uninstall] 🗑️ Raccourci supprimé du bureau')
            }
          } catch (shortcutErr) {
            log('[Uninstall] ⚠️ Erreur lors de la suppression du raccourci:', shortcutErr.message)
          }
          
          // Invalider le cache
          scanCache.lastScan = 0
          
          // Envoyer l'événement
          const allWindows = BrowserWindow.getAllWindows()
          allWindows.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('game-uninstalled', { gameName: gameName })
              log('[Uninstall] 📤 Événement game-uninstalled envoyé')
            }
          })
          
          // Forcer un scan en arrière-plan
          try {
            log('[Uninstall] 🔄 Déclenchement du scan...')
            const foldersToScan = [
              app.getPath('downloads'),
              app.getPath('documents'),
              app.getPath('pictures'),
              path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'),
              path.join(app.getPath('documents'), 'Games')
            ]
            
            const allInstalledGames = []
            for (const folder of foldersToScan) {
              if (fs.existsSync(folder)) {
                const extractor = await getGameExtractor()
                const games = extractor.scanInstalledGames(folder)
                allInstalledGames.push(...games)
              }
            }
            
            scanCache.games = allInstalledGames
            scanCache.lastScan = Date.now()
            log('[Uninstall] ✅ Scan terminé,', allInstalledGames.length, 'jeux trouvés')
          } catch (scanErr) {
            log('[Uninstall] ⚠️ Erreur lors du scan:', scanErr.message)
          }
          
          return { success: true, message: `${gameName} a été désinstallé avec succès` }
        } else {
          throw new Error('Impossible de supprimer le dossier. Le dossier est peut-être ouvert dans l\'Explorateur ou utilisé par un autre programme.')
        }
      } finally {
        uninstallingGames.delete(gameName)
        log('[Uninstall] 🔓 Désinstallation terminée pour:', gameName)
      }
    } catch (err) {
      errorLog('[Uninstall] ❌ Erreur:', err)
      uninstallingGames.delete(gameName)
      return { success: false, error: err.message }
    }
  })

  // Handler pour ouvrir le dossier d'un jeu
  ipcMain.handle('games:openGameFolder', async (event, gameName) => {
    try {
      if (!installedGamesStore) {
        throw new Error('installedGamesStore non initialisé')
      }

      const game = installedGamesStore.getInstalledGame(gameName)
      if (!game || !game.path) {
        throw new Error('Jeu non trouvé ou chemin introuvable')
      }

      const gamePath = game.path || game.gamePath
      if (!fs.existsSync(gamePath)) {
        throw new Error('Le dossier du jeu n\'existe plus')
      }

      shell.openPath(gamePath)
      return { success: true }
    } catch (error) {
      errorLog('[Games] Erreur lors de l\'ouverture du dossier:', error)
      return { success: false, error: error.message }
    }
  })

  // Handler pour créer un raccourci bureau
  ipcMain.handle('games:createDesktopShortcut', async (event, gameName, exePath) => {
    try {
      if (!exePath || !fs.existsSync(exePath)) {
        throw new Error('Exécutable introuvable')
      }

      const desktopPath = app.getPath('desktop')
      const shortcutPath = path.join(desktopPath, `${gameName}.lnk`)

      // Utiliser PowerShell pour créer le raccourci sur Windows
      const execPromise = promisify(exec)
      const command = `$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut("${shortcutPath}"); $Shortcut.TargetPath = "${exePath}"; $Shortcut.Save()`
      
      await execPromise(`powershell -Command "${command}"`)
      
      log('[Shortcut] ✅ Raccourci créé:', shortcutPath)
      return { success: true, path: shortcutPath }
    } catch (error) {
      errorLog('[Shortcut] Erreur lors de la création:', error)
      return { success: false, error: error.message }
    }
  })

  // Handler pour vérifier si un raccourci existe
  ipcMain.handle('games:checkShortcutExists', async (event, gameName) => {
    try {
      const desktopPath = app.getPath('desktop')
      const shortcutPath = path.join(desktopPath, `${gameName}.lnk`)
      const exists = fs.existsSync(shortcutPath)
      return { success: true, exists }
    } catch (error) {
      errorLog('[Shortcut] Erreur lors de la vérification:', error)
      return { success: false, exists: false }
    }
  })
}

/**
 * Fonction helper pour lancer un jeu directement
 * Note: Cette fonction utilise spawn qui doit être importé
 */
async function launchGameDirectly(exePath, gameName = null, gameId = null) {
  try {
    if (!exePath || !fs.existsSync(exePath)) {
      throw new Error('Exécutable introuvable: ' + exePath)
    }

    log('[Launch] 🚀 Lancement du jeu:', exePath)
    
    // Enregistrer le début de la session de jeu
    const startTime = Date.now()
    
    // Mettre à jour "last_played" dans SQLite
    if (gameId) {
      try {
        const { gamesLibrarySQLite } = await import('../games-library-sqlite.mjs')
        await gamesLibrarySQLite.updateLastPlayed(gameId)
        log('[Launch] ⏱️ Début de tracking pour:', gameId)
      } catch (sqlError) {
        log('[Launch] ⚠️ SQLite tracking non disponible:', sqlError.message)
      }
    }
    
    // Initialiser Discord RPC si disponible
    try {
      const rpcService = await getDiscordRPCService()
      if (gameName) {
        await rpcService.setGamePresence(gameName, null)
      }
    } catch (rpcError) {
      // Ne pas bloquer le lancement si RPC échoue
      log('[Launch] ⚠️ Discord RPC non disponible:', rpcError.message)
    }

    // Lancer le processus
    const { spawn } = await import('node:child_process')
    const gameProcess = spawn(exePath, [], {
      detached: false, // Ne pas détacher pour pouvoir surveiller
      stdio: 'ignore'
    })
    
    // Surveiller la fermeture du jeu pour calculer le temps de jeu
    gameProcess.on('exit', async () => {
      const endTime = Date.now()
      const playTimeMinutes = Math.round((endTime - startTime) / 60000)
      
      log(`[Launch] 🛑 Jeu fermé après ${playTimeMinutes} minutes`)
      
      // Sauvegarder le temps de jeu dans SQLite
      if (gameId && playTimeMinutes > 0) {
        try {
          const { gamesLibrarySQLite } = await import('../games-library-sqlite.mjs')
          await gamesLibrarySQLite.incrementPlayTime(gameId, playTimeMinutes)
          log(`[Launch] ✅ Temps de jeu sauvegardé: +${playTimeMinutes} minutes`)
        } catch (sqlError) {
          errorLog('[Launch] ❌ Erreur sauvegarde temps:', sqlError)
        }
      }
      
      // Nettoyer Discord RPC
      try {
        const rpcService = await getDiscordRPCService()
        await rpcService.clearPresence()
      } catch (rpcError) {
        // Ignorer les erreurs RPC
      }
    })
    
    log('[Launch] ✅ Jeu lancé avec succès, PID:', gameProcess.pid)
    return { success: true, pid: gameProcess.pid }
  } catch (error) {
    errorLog('[Launch] Erreur lors du lancement:', error)
    throw error
  }
}
