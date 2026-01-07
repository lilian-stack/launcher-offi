/**
 * Handlers IPC pour les téléchargements
 */

import { app, dialog, BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { 
  setActiveDownload, 
  getActiveDownload, 
  setDownloadDestinationPath,
  getDownloadDestinationPath 
} from '../services/state.js'
import { detectProvider } from '../utils/download-helpers.js'
import { getHiddenWindow } from '../services/window-manager.js'

// Import lazy des providers
let downloadProviders = null
async function getDownloadProviders() {
  if (!downloadProviders) {
    downloadProviders = await import('../services/download-providers/index.js')
  }
  return downloadProviders
}

// Import lazy des services
let getGamesService = null
function injectGetGamesService(fn) {
  getGamesService = fn
}

// Import lazy de universalDownload
let universalDownloadFn = null
function injectUniversalDownload(fn) {
  universalDownloadFn = fn
}

/**
 * Injecte les dépendances (pour éviter les imports circulaires)
 */
export function injectDependencies(deps) {
  if (deps.getGamesService) injectGetGamesService(deps.getGamesService)
  if (deps.universalDownload) injectUniversalDownload(deps.universalDownload)
}

/**
 * Handler principal pour télécharger un jeu
 */
export async function handleDownloadGame(event, url, destinationPath = null, options = {}) {
  const gameName = options.gameName || 'Game'
  const userStatus = options.userStatus || { isAdmin: false, isVip: false, isBoost: false }
  
  // Logs (seront injectés depuis main.js)
  const log = options._log || (() => {})
  const errorLog = options._errorLog || (() => {})
  
  log('[Download] ============================================')
  log('[Download] 🚀 NOUVEAU TÉLÉCHARGEMENT')
  log('[Download] URL:', url)
  log('[Download] Jeu:', gameName)
  log('[Download] Dossier:', destinationPath)
  const statusText = userStatus.isAdmin ? 'ADMIN' : (userStatus.isVip ? 'VIP' : (userStatus.isBoost ? 'BOOST' : 'GRATUIT'))
  log('[Download] Statut utilisateur:', statusText)
  log('[Download] ============================================')
  
  // Vérifier le statut utilisateur et utiliser le lien Lockr si nécessaire
  let finalUrl = url
  const lockrCompleted = options.lockrCompleted || false
  
  const discordUsername = userStatus?.username || null
  if (discordUsername) {
    log('[Download] 👤 Username Discord récupéré:', discordUsername)
  }
  
  if (!userStatus.isAdmin && !userStatus.isVip && !userStatus.isBoost && !lockrCompleted) {
    // Utilisateur gratuit : utiliser le lien Lockr
    let lockrUrl = null
    
    if (options.gameId && getGamesService) {
      try {
        const service = await getGamesService()
        const gamesResult = await service.getGamesFromGitHub()
        const games = gamesResult.games || []
        const game = games.find(g => g.id === options.gameId)
        
        if (game && game.lockrUrl) {
          lockrUrl = game.lockrUrl
          log('[Download] 🔒 Lien Lockr spécifique trouvé pour le jeu:', lockrUrl)
        }
      } catch (err) {
        errorLog('[Download] ⚠️ Erreur lors de la récupération du lien Lockr:', err)
      }
    }
    
    if (!lockrUrl) {
      errorLog('[Download] ❌ Aucun lien Lockr configuré pour ce jeu:', gameName)
      throw new Error(`Aucun lien Lockr configuré pour "${gameName}". Veuillez contacter un administrateur.`)
    }
    
    finalUrl = lockrUrl
    log('[Download] 🔒 Utilisation du lien Lockr spécifique au jeu:', lockrUrl)
  } else if (lockrCompleted) {
    log('[Download] ✅ Pubs Lockr déjà complétées, utilisation du lien direct fourni')
  } else {
    log('[Download] ✅ Utilisateur ADMIN/VIP/BOOST, lien direct utilisé')
  }
  
  // S'assurer que destinationPath est valide
  let finalDestinationPath = destinationPath
  if (finalDestinationPath && typeof finalDestinationPath !== 'string') {
    errorLog('[Download] ⚠️ destinationPath n\'est pas une string, utilisation du dossier par défaut')
    finalDestinationPath = null
  }
  
  const destFolder = path.resolve(finalDestinationPath || app.getPath('downloads'))
  
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true })
    log('[Download] Dossier créé:', destFolder)
  }
  
  // Définir le téléchargement actif
  setActiveDownload({
    gameId: options.gameId || null,
    gameName: gameName,
    folder: destFolder,
    url: finalUrl,
    originalUrl: url,
    timestamp: Date.now(),
    isMultiPart: options.isMultiPart || false,
    currentPart: options.currentPart || null,
    totalParts: options.totalParts || null,
    redirectUrl: options.redirectUrl || null
  })
  
  setDownloadDestinationPath(destFolder)
  
  log('[Download] ✅ activeDownload configuré')
  log('[Download]   - gameId:', options.gameId)
  log('[Download]   - gameName:', gameName)
  log('[Download]   - folder:', destFolder)
  log('[Download]   - url:', finalUrl)
  log('[Download]   - redirectUrl:', options.redirectUrl)
  
  try {
    // Utiliser universalDownload si disponible
    if (universalDownloadFn) {
      log('[Download] Utilisation de universalDownload...')
      const result = await universalDownloadFn(finalUrl, destFolder, log, errorLog)
      return { success: true, ...result }
    } else {
      // Fallback : utiliser session.defaultSession.downloadURL
      const { session } = await import('electron')
      session.defaultSession.downloadURL(finalUrl)
      return { success: true, method: 'default_download' }
    }
  } catch (error) {
    errorLog('[Download] ❌ Erreur lors du téléchargement:', error)
    setActiveDownload(null)
    throw error
  }
}

/**
 * Handler pour sélectionner un dossier
 */
export async function handleSelectFolder() {
  try {
    const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Choisir le dossier de téléchargement'
    })
    if (result.canceled || !result.filePaths || !result.filePaths.length) {
      return { success: false, canceled: true }
    }
    return { success: true, folderPath: result.filePaths[0] }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/**
 * Handler pour mettre en pause un téléchargement
 */
export async function handlePauseDownload(event, gameId) {
  try {
    const activeDownload = getActiveDownload()
    if (activeDownload && activeDownload.downloadItem) {
      if (!activeDownload.downloadItem.isPaused()) {
        activeDownload.downloadItem.pause()
        return { success: true, paused: true }
      }
      return { success: true, paused: false, message: 'Déjà en pause' }
    }
    return { success: false, error: 'Aucun téléchargement actif' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Handler pour reprendre un téléchargement
 */
export async function handleResumeDownload(event, gameId) {
  try {
    const activeDownload = getActiveDownload()
    if (activeDownload && activeDownload.downloadItem) {
      if (activeDownload.downloadItem.isPaused()) {
        activeDownload.downloadItem.resume()
        return { success: true, resumed: true }
      }
      return { success: true, resumed: false, message: 'Pas en pause' }
    }
    return { success: false, error: 'Aucun téléchargement actif' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Handler pour annuler un téléchargement
 */
export async function handleCancelDownload(event, gameId) {
  try {
    const activeDownload = getActiveDownload()
    if (activeDownload && activeDownload.downloadItem) {
      activeDownload.downloadItem.cancel()
      setActiveDownload(null)
      return { success: true, canceled: true }
    }
    setActiveDownload(null)
    return { success: false, error: 'Aucun téléchargement actif' }
  } catch (err) {
    setActiveDownload(null)
    return { success: false, error: err.message }
  }
}

/**
 * Export des handlers pour enregistrement dans main.js
 */
export const downloadHandlers = {
  'download-game': handleDownloadGame,
  'download:selectFolder': handleSelectFolder,
  'download:pause': handlePauseDownload,
  'download:resume': handleResumeDownload,
  'download:cancel': handleCancelDownload
}
