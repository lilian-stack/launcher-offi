// main.js (corrigé & logs ajoutés)
import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import https from 'node:https'
import http from 'node:http'
import crypto from 'node:crypto'
import { exec, spawn, execSync } from 'node:child_process'
import { promisify } from 'node:util'
// Import lazy de game-extractor.js (contient des modules lourds comme node-7z)
// import { extractAndMarkGame, scanInstalledGames } from './game-extractor.js'

/* --- IMPORTS DE SERVICE (lazy loading pour améliorer les performances) --- */
// Les services seront chargés à la demande pour améliorer le temps de démarrage
let githubService = null
let steamService = null
let gamesService = null
let discordService = null
let websocketService = null
let gameExtractor = null
let lockrService = null
let adsService = null

// Fonction de chargement lazy pour game-extractor
async function getGameExtractor() {
  if (!gameExtractor) {
    gameExtractor = await import('./game-extractor.js')
  }
  return gameExtractor
}

// Fonctions de chargement lazy des services
async function getGithubService() {
  if (!githubService) {
    githubService = await import('./github-service.js')
  }
  return githubService
}

async function getSteamService() {
  if (!steamService) {
    steamService = await import('./steam-service.js')
  }
  return steamService
}

async function getGamesService() {
  if (!gamesService) {
    gamesService = await import('./games-service.js')
  }
  return gamesService
}

async function getDiscordService() {
  if (!discordService) {
    discordService = await import('./discord-service.js')
  }
  return discordService
}

async function getWebsocketService() {
  if (!websocketService) {
    websocketService = await import('./websocket-service.js')
  }
  return websocketService
}

async function getAdsService() {
  if (!adsService) {
    adsService = await import('./ads-service.js')
  }
  return adsService
}

async function getLockrService() {
  if (!lockrService) {
    lockrService = await import('./lockr-service.js')
  }
  return lockrService
}

/* --- Utils chemins --- */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* --- Config dev / API URL --- */
const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER === 'true'
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
let API_URL = process.env.API_URL || 'http://localhost:3001'
try {
  const configPath = path.join(__dirname, '../websocket-config.json')
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (config.apiUrl) API_URL = config.apiUrl
    }
} catch (e) {
  console.warn('[Main] Failed loading websocket-config.json, using default API_URL')
}

/* --- Globals --- */
let mainWindow = null
let hiddenWindow = null
let downloadDestinationPath = null
let pendingGameExtraction = null // { gameName, destFolder, archivePath }
// 🎯 VARIABLE GLOBALE POUR LE TÉLÉCHARGEMENT EN COURS (ne dépend pas de l'URL qui change avec les redirections)
let activeDownload = null
let extractingGames = new Set() // Pour éviter les extractions en double
let activeDownloads = new Set() // Pour éviter les téléchargements en double (par filePath)
let confirmationServer = null // Serveur HTTP pour recevoir les confirmations depuis le site web

/* --- Small logger helper (optimisé pour la production) --- */
function log(...args) {
  if (isDev) {
    console.log('[Main]', ...args)
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('main:log', args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))))
      }
    } catch (e) {}
  }
}
function errorLog(...args) { 
  // Toujours logger les erreurs, même en production
  console.error('[Main]', ...args) 
}

/* ---------------- createWindow ---------------- */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b0b11',
    minWidth: 1200,
    minHeight: 720,
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Masquer la barre de menu
  mainWindow.setMenuBarVisibility(false)

  // Afficher la fenêtre immédiatement
  mainWindow.show()

  // Charger d'abord le splash screen (instantané)
  try {
    const appPath = app.getAppPath()
    const resourcesPath = process.resourcesPath || appPath
    // En production, extraResources est dans resourcesPath
    const splashPath = path.join(resourcesPath, 'splash.html')
    const splashDevPath = path.join(appPath, 'public', 'splash.html')
    const splashFallback = path.join(__dirname, '../public/splash.html')
    
    if (fs.existsSync(splashPath)) {
      await mainWindow.loadFile(splashPath)
    } else if (fs.existsSync(splashDevPath)) {
      await mainWindow.loadFile(splashDevPath)
    } else if (fs.existsSync(splashFallback)) {
      await mainWindow.loadFile(splashFallback)
    } else {
      // Si le splash n'existe pas, continuer directement
      log('Splash screen not found, loading main app directly')
    }
  } catch (e) {
    // Si le splash n'existe pas, continuer
    log('Splash screen error, skipping:', e.message)
  }

  // Charger le contenu principal immédiatement (sans délai pour éviter le blocage)
    if (isDev) {
    log('🔧 [main.js] Mode développement, chargement de:', VITE_DEV_SERVER_URL)
    mainWindow.loadURL(VITE_DEV_SERVER_URL).then(() => {
      log('✅ [main.js] Dev server chargé avec succès')
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }).catch(err => {
      errorLog('❌ [main.js] Error loading dev server:', err)
    })
    } else {
      const appPath = app.getAppPath()
      const indexPath = path.join(appPath, 'dist', 'index.html')
    log('📄 [main.js] Mode production, chargement de:', indexPath)
    log('📄 [main.js] Fichier existe?', fs.existsSync(indexPath))
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(indexPath)) {
      errorLog('❌ [main.js] index.html n\'existe pas à:', indexPath)
        const fallbackPath = path.join(__dirname, '../dist/index.html')
      log('📄 [main.js] Essai du chemin fallback:', fallbackPath)
      log('📄 [main.js] Fallback existe?', fs.existsSync(fallbackPath))
      
      if (fs.existsSync(fallbackPath)) {
        mainWindow.loadFile(fallbackPath).then(() => {
          log('✅ [main.js] Fichier fallback chargé avec succès')
        }).catch(fallbackErr => {
          errorLog('❌ [main.js] Fallback also failed:', fallbackErr)
        })
      } else {
        errorLog('❌ [main.js] Aucun index.html trouvé!')
      }
    } else {
      mainWindow.loadFile(indexPath).then(() => {
        log('✅ [main.js] index.html chargé avec succès')
      }).catch(err => {
        errorLog('❌ [main.js] Error loading index.html:', err)
        // Essayer le fallback
        const fallbackPath = path.join(__dirname, '../dist/index.html')
        log('📄 [main.js] Using fallback path:', fallbackPath)
        mainWindow.loadFile(fallbackPath).catch(fallbackErr => {
          errorLog('❌ [main.js] Fallback also failed:', fallbackErr)
        })
      })
    }
  }
  
  // Écouter les événements de chargement de la page
  mainWindow.webContents.on('did-finish-load', () => {
    log('✅ [main.js] Page chargée (did-finish-load)')
  })
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    errorLog('❌ [main.js] Échec du chargement:', errorCode, errorDescription, validatedURL)
  })
  
  mainWindow.webContents.on('dom-ready', () => {
    log('✅ [main.js] DOM prêt (dom-ready)')
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl)
      const currentUrl = mainWindow.webContents.getURL()
      if (currentUrl && navigationUrl.startsWith('http')) {
        const currentParsed = new URL(currentUrl)
        if (parsedUrl.origin !== currentParsed.origin) {
          event.preventDefault()
          shell.openExternal(navigationUrl)
        }
      }
    } catch (e) {
      log('will-navigate parse error', e)
    }
  })

  log('Main window created')
}

/* ---------------- Enregistrement différé des IPC handlers ---------------- */
let criticalHandlersRegistered = false
let allHandlersRegistered = false

// Enregistrer seulement les handlers critiques au démarrage (login, auth)
function registerCriticalHandlers() {
  if (criticalHandlersRegistered) return
  criticalHandlersRegistered = true
  
  /* ---------------- GitHub IPC handlers (critiques pour login) ---------------- */
  ipcMain.handle('github:loginUser', async (event, email, password) => {
    try {
      log('github:loginUser called with email:', email)
      const service = await getGithubService()
      const result = await service.loginUser(email, password)
      return result
    } catch (err) {
      errorLog('github:loginUser error', err)
      throw err
    }
  })

  ipcMain.handle('github:createUser', async (event, userData) => {
    try {
      log('github:createUser called')
      const service = await getGithubService()
      const result = await service.createUser(userData)
      return result
    } catch (err) {
      errorLog('github:createUser error', err)
      throw err
    }
  })

  ipcMain.handle('github:findUser', async (event, email, username) => {
    try {
      const service = await getGithubService()
      const result = await service.findUser(email, username)
      return result
    } catch (err) {
      errorLog('github:findUser error', err)
      throw err
    }
  })

  /* ---------------- Discord IPC handlers (critiques pour auth) ---------------- */
  ipcMain.handle('discord:getAuthUrl', async () => {
    try {
      log('discord:getAuthUrl called')
      const service = await getDiscordService()
      const result = service.getDiscordAuthUrl()
      log('discord:getAuthUrl success')
      return { url: result }
    } catch (err) {
      errorLog('discord:getAuthUrl error', err)
      throw err
    }
  })

  ipcMain.handle('discord:authenticate', async (event, code) => {
    try {
      log('discord:authenticate called')
      const service = await getDiscordService()
      const result = await service.authenticateWithDiscord(code)
      log('discord:authenticate success')
      return result
    } catch (err) {
      errorLog('discord:authenticate error', err)
      throw err
    }
  })

  ipcMain.handle('discord:openAuthUrl', async (event, url) => {
    try {
      const { DISCORD_CONFIG } = await import('./discord-config.js')
      const redirectUri = DISCORD_CONFIG.REDIRECT_URI
      
      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        modal: true,
        parent: mainWindow || BrowserWindow.getFocusedWindow() || null,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      // Masquer la barre de menu de la fenêtre Discord
      authWindow.setMenuBarVisibility(false)

      const handleCallback = (url) => {
        try {
          const urlObj = new URL(url)
          const redirectUriObj = new URL(redirectUri)
          
          if (urlObj.origin === redirectUriObj.origin) {
            const code = urlObj.searchParams.get('code')
            const error = urlObj.searchParams.get('error')
            
            if (code) {
              const targetWindow = mainWindow || BrowserWindow.getFocusedWindow()
              if (targetWindow) {
                targetWindow.webContents.send('discord:auth-code', { code })
              }
              authWindow.close()
              return true
            } else if (error) {
              const targetWindow = mainWindow || BrowserWindow.getFocusedWindow()
              if (targetWindow) {
                targetWindow.webContents.send('discord:auth-error', { error })
              }
              authWindow.close()
              return true
            }
          }
        } catch (err) {
          log('handleCallback discord error', err)
        }
        return false
      }

      authWindow.webContents.on('will-redirect', (event, navigationUrl) => {
        if (handleCallback(navigationUrl)) event.preventDefault()
      })

      authWindow.webContents.on('did-navigate', (event, navigationUrl) => {
        handleCallback(navigationUrl)
      })

      authWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        if (handleCallback(navigationUrl)) event.preventDefault()
      })

      authWindow.webContents.on('did-get-redirect-request', (event, oldUrl, newUrl) => {
        if (handleCallback(newUrl)) event.preventDefault()
      })

      await authWindow.loadURL(url)
      return { success: true }
    } catch (err) {
      errorLog('discord:openAuthUrl error', err)
      throw new Error(err.message || 'Erreur Discord')
    }
  })

  ipcMain.handle('app:quit', async () => {
    try {
      log('[App] Fermeture de l\'application demandée')
      app.quit()
      return { success: true }
    } catch (err) {
      errorLog('app:quit error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('app:getVersion', async () => {
    try {
      return { success: true, version: app.getVersion() }
    } catch (err) {
      errorLog('app:getVersion error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('app:restart', async () => {
    try {
      log('[App] Redémarrage orchestré demandé')
      app.relaunch()
      app.exit(0)
      return { success: true }
    } catch (err) {
      errorLog('app:restart error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('app:getAutoLaunch', async () => {
    try {
      const settings = app.getLoginItemSettings()
      return { success: true, enabled: settings?.openAtLogin || false }
    } catch (err) {
      errorLog('app:getAutoLaunch error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('app:setAutoLaunch', async (_event, enabled) => {
    try {
      const openAtLogin = !!enabled
      const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath

      app.setLoginItemSettings({
        openAtLogin,
        path: exePath,
        args: [],
      })

      log(`[App] Auto-launch ${openAtLogin ? 'activé' : 'désactivé'}`)
      return { success: true, enabled: openAtLogin }
    } catch (err) {
      errorLog('app:setAutoLaunch error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('file:sha256', async (_event, targetPath) => {
    try {
      if (!targetPath) throw new Error('Chemin de fichier manquant')
      await fs.promises.access(targetPath, fs.constants.R_OK)

      return await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256')
        const stream = fs.createReadStream(targetPath)

        stream.on('data', (chunk) => hash.update(chunk))
        stream.on('end', () => resolve({ success: true, hash: hash.digest('hex') }))
        stream.on('error', (err) => reject(err))
      })
    } catch (err) {
      errorLog('file:sha256 error', err)
      return { success: false, error: err.message }
    }
  })

  log('[Handlers] Handlers critiques enregistrés')
}

// Enregistrer tous les autres handlers après le démarrage
function registerAllHandlers() {
  if (allHandlersRegistered) return
  allHandlersRegistered = true
  
  /* ---------------- GitHub IPC handlers (non-critiques) ---------------- */
  ipcMain.handle('github:getUsers', async () => {
    try {
      log('github:getUsers called')
      const service = await getGithubService()
      const result = await service.getUsersFromGitHub()
      return result
    } catch (err) {
      errorLog('github:getUsers error', err)
      throw err
    }
  })

  ipcMain.handle('github:updateUser', async (event, email, updates) => {
  try {
    const service = await getGithubService()
    const result = await service.updateUser(email, updates)
    return result
  } catch (err) {
    errorLog('github:updateUser error', err)
    throw err
  }
})

ipcMain.handle('github:deleteUser', async (event, email) => {
  try {
    log('github:deleteUser called with email:', email)
    const service = await getGithubService()
    const result = await service.deleteUser(email)
    log('github:deleteUser success, result:', result)
    return result
  } catch (err) {
    errorLog('github:deleteUser error', err)
    throw err
  }
})

/* ---------------- Steam IPC handlers ---------------- */
ipcMain.handle('steam:getGameData', async (event, appId) => {
  try {
    const service = await getSteamService()
    const result = await service.getSteamGameData(appId)
    return result
  } catch (err) {
    errorLog('steam:getGameData error', err)
    throw err
  }
})

/* ---------------- Games IPC handlers ---------------- */
ipcMain.handle('games:getGames', async () => {
  try {
    const service = await getGamesService()
    const result = await service.getGamesFromGitHub()
    return result
  } catch (err) {
    errorLog('games:getGames error', err)
    throw err
  }
})

ipcMain.handle('games:addGame', async (event, gameData) => {
  try {
    log('games:addGame called')
    const service = await getGamesService()
    const result = await service.addGame(gameData)
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

/* ---------------- Discord IPC handlers ---------------- */
  ipcMain.handle('discord:refreshToken', async (event, refreshToken) => {
  try {
    log('discord:refreshToken called')
    const service = await getDiscordService()
    const result = await service.refreshDiscordToken(refreshToken)
    log('discord:refreshToken success')
    return result
  } catch (err) {
    errorLog('discord:refreshToken error', err)
    throw err
  }
})

/* ---------------- Updates IPC handlers ---------------- */
function downloadWithRedirect(url, filePath, redirectCount = 0, onProgress = null) {
  const MAX_REDIRECTS = 5
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const httpModule = isHttps ? https : http

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Actoris-Launcher/1.0.23',
        'Accept': '*/*',
      },
    }

    const request = httpModule.get(options, (response) => {
      const status = response.statusCode || 0

      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume()
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error('Trop de redirections HTTP'))
          return
        }
        const location = response.headers.location
        if (!location) {
          reject(new Error('Redirection sans en-tête Location'))
          return
        }
        const nextUrl = location.startsWith('http') ? location : new URL(location, url).toString()
        log(`Following redirect ${redirectCount + 1}/${MAX_REDIRECTS}:`, nextUrl)
        downloadWithRedirect(nextUrl, filePath, redirectCount + 1, onProgress).then(resolve).catch(reject)
        return
      }

      if (status !== 200) {
        reject(new Error(`HTTP ${status}`))
        return
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      let receivedBytes = 0
      const file = fs.createWriteStream(filePath)
      
      response.on('data', (chunk) => {
        receivedBytes += chunk.length
        if (onProgress && totalBytes > 0) {
          const progress = (receivedBytes / totalBytes) * 100
          onProgress(receivedBytes, totalBytes, progress)
        }
      })
      
      response.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', (err) => {
        fs.unlink(filePath, () => reject(err))
      })
    })

    request.on('error', (err) => reject(err))
    request.setTimeout(120000, () => { // Augmenter le timeout à 2 minutes pour les gros fichiers
      request.destroy()
      reject(new Error('Timeout de téléchargement'))
    })
  })
}

ipcMain.handle('updates:download', async (event, url, filename) => {
  try {
    const downloadsDir = app.getPath('downloads')
    const filePath = path.join(downloadsDir, filename || 'update.bin')
    
    // Fonction de progression pour envoyer les mises à jour au renderer
    const onProgress = (received, total, progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:download-progress', {
          received,
          total,
          progress: Math.round(progress)
        })
      }
    }
    
    log('[Update] Démarrage du téléchargement:', url)
    log('[Update] Destination:', filePath)
    
    await downloadWithRedirect(url, filePath, 0, onProgress)
    
    log('[Update] Téléchargement terminé:', filePath)
    return { success: true, filePath }
  } catch (error) {
    errorLog('[Update] Erreur de téléchargement:', error)
    return { success: false, error: error.message || 'Erreur de téléchargement' }
  }
})

// IPC Handler pour installer la mise à jour (avec fermeture automatique des processus)
ipcMain.handle('updates:install', async (event) => {
  try {
    if (!autoUpdater) {
      throw new Error('Auto-updater non initialisé')
    }
    
    log('[Updater] Installation de la mise à jour demandée...')
    
    // Fermer tous les processus Actoris avant l'installation
    try {
      log('[Updater] Fermeture de tous les processus Actoris...')
      await killAllActorisProcesses()
      log('[Updater] Tous les processus Actoris fermés')
    } catch (err) {
      errorLog('[Updater] Erreur lors de la fermeture des processus:', err)
      // Continuer quand même avec l'installation
    }
    
    // Fermer toutes les fenêtres
    const allWindows = BrowserWindow.getAllWindows()
    for (const win of allWindows) {
      if (win && !win.isDestroyed()) {
        win.close()
      }
    }
    
    // Attendre un peu pour que les fenêtres se ferment
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Installer la mise à jour en mode SILENCIEUX (sans afficher l'installateur)
    // quitAndInstall(isSilent, isForceRunAfter)
    // isSilent = true : Installation silencieuse sans afficher l'installateur
    // isForceRunAfter = true : Relancer l'application après l'installation
    log('[Updater] Lancement de l\'installation en mode silencieux...')
    autoUpdater.quitAndInstall(true, true)
    
    return { success: true }
  } catch (error) {
    errorLog('[Updater] Erreur lors de l\'installation:', error)
    return { success: false, error: error.message || 'Erreur lors de l\'installation' }
  }
})

/* ---------------- WebSocket IPC handlers ---------------- */
ipcMain.handle('websocket:connect', async (event, manualRetry = false) => {
  try {
    log(`websocket:connect called (manualRetry: ${manualRetry})`)
    const service = await getWebsocketService()
    // Le service utilise WS_URL depuis websocket-config.json
    service.connectWebSocket(
      (message) => {
        // Handler pour les messages reçus
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('websocket:message', message)
        }
      },
      (error) => {
        // Handler pour les erreurs
        errorLog('websocket error:', error)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('websocket:error', error)
        }
      },
      () => {
        // Handler pour la connexion
        log('websocket connected')
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('websocket:connected')
        }
      },
      () => {
        // Handler pour la déconnexion
        log('websocket disconnected')
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('websocket:disconnected')
        }
      },
      manualRetry // Passer le flag manualRetry
    )
    return { success: true }
  } catch (err) {
    errorLog('websocket:connect error', err)
    throw err
  }
})

ipcMain.handle('websocket:disconnect', async () => {
  try {
    log('websocket:disconnect called')
    const service = await getWebsocketService()
    service.disconnectWebSocket()
    return { success: true }
  } catch (err) {
    errorLog('websocket:disconnect error', err)
    throw err
  }
})

ipcMain.handle('websocket:send', async (event, message) => {
  try {
    log('websocket:send called')
    const service = await getWebsocketService()
    const success = service.sendWebSocketMessage(message)
    return { success }
  } catch (err) {
    errorLog('websocket:send error', err)
    throw err
  }
})

ipcMain.handle('websocket:isConnected', async () => {
  const service = await getWebsocketService()
  return service.isWebSocketConnected()
})

/* ---------------- Support IPC handlers ---------------- */
ipcMain.handle('support:createTicket', async (event, payload) => {
  try {
    const { discord_id, username, message, category } = payload
    const url = `${API_URL}/create-ticket`
    const body = JSON.stringify({ discord_id, username, message, category })
      const urlObj = new URL(url)
      const isHttps = urlObj.protocol === 'https:'
      const httpModule = isHttps ? https : http
      
    return await new Promise((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'Game-Launcher/1.0.23'
        },
      }
      
      const req = httpModule.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ success: true, ...JSON.parse(data) })
            } catch (e) {
              resolve({ success: true, data })
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          }
        })
      })
      
      req.on('error', reject)
      req.write(body)
      req.end()
    })
  } catch (error) {
    log('support:createTicket error', error)
    return { success: false, error: error.message || 'Erreur lors de la création du ticket' }
  }
})

/* ---------------- Shell IPC handlers ---------------- */
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    if (url && url.startsWith('http')) {
      await shell.openExternal(url)
      return { success: true }
    }
    return { success: false, error: 'URL invalide' }
  } catch (err) {
    errorLog('shell:openExternal error', err)
    return { success: false, error: err.message }
  }
})

  log('[Handlers] Tous les handlers enregistrés')
}

/* ---------------- Universal Download Helpers ---------------- */

/**
 * Détecte le provider à partir de l'URL
 */
function detectProvider(url) {
  if (url.includes('pixeldrain.com')) return 'pixeldrain'
  if (url.includes('buzzheavier.com')) return 'buzzheavier'
  if (url.includes('gofile.io')) return 'gofile'
  if (url.includes('vikingfile.site') || url.includes('vik1ngfile.site')) return 'vikingfile'
  if (url.includes('megadb.net') || url.includes('megadb.org') || url.includes('megadb')) return 'megadb'
  if (url.includes('mega.nz') || url.includes('mega.io')) return 'mega'
  if (url.includes('koyso.to')) return 'koyso'
  return 'unknown'
}

/**
 * Outil générique pour appeler une API JSON
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const httpModule = isHttps ? https : http

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Actoris-Launcher/1.0.23',
        'Accept': 'application/json',
      },
    }

    const req = httpModule.get(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + e.message))
    }
  })
})

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
  })
}

/**
 * Convertit une URL PixelDrain en lien de téléchargement direct
 */
async function convertPixelDrain(url) {
  log('[PixelDrain] Conversion…')
  // Extraire l'ID depuis l'URL (format: pixeldrain.com/u/ID ou pixeldrain.com/f/ID)
  const match = url.match(/pixeldrain\.com\/[uf]\/([A-Za-z0-9]+)/)
  if (match) {
    const id = match[1]
    return `https://pixeldrain.com/api/file/${id}?download`
  }
  // Si c'est déjà une URL API, extraire l'ID
  const apiMatch = url.match(/pixeldrain\.com\/api\/file\/([A-Za-z0-9]+)/)
  if (apiMatch) {
    const id = apiMatch[1]
    return `https://pixeldrain.com/api/file/${id}?download`
  }
  throw new Error('PixelDrain: URL invalide')
}

/**
 * Télécharge depuis BuzzHeavier en utilisant la fenêtre cachée Electron avec clic automatique
 */
async function downloadBuzzHeavierWithElectron(url, destinationPath = null) {
  log('[BuzzHeavier] Lancement avec fenêtre cachée Electron pour télécharger…')

  return new Promise(async (resolve, reject) => {
    try {
      // Créer ou réutiliser la fenêtre cachée
      if (!hiddenWindow || hiddenWindow.isDestroyed()) {
        createHiddenWindow()
      }

      const destFolder = destinationPath || app.getPath('downloads')
      const absoluteDestFolder = path.resolve(destFolder)
      log('[BuzzHeavier] Dossier de destination:', absoluteDestFolder)

      // ✅ Créer le dossier s'il n'existe pas
      if (!fs.existsSync(absoluteDestFolder)) {
        fs.mkdirSync(absoluteDestFolder, { recursive: true })
        log('[BuzzHeavier] Dossier créé:', absoluteDestFolder)
      }

      // 🎯 FORCER le dossier de téléchargement avec CDP
      try {
        // Attacher le debugger si ce n'est pas déjà fait
        if (!hiddenWindow.webContents.debugger.isAttached()) {
          hiddenWindow.webContents.debugger.attach('1.3')
          log('[BuzzHeavier] Debugger CDP attaché')
        }
        
        // Configurer le comportement de téléchargement via CDP
        await hiddenWindow.webContents.debugger.sendCommand('Browser.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: absoluteDestFolder // ✅ Chemin absolu obligatoire
        })
        log('[BuzzHeavier] CDP: Dossier de téléchargement forcé à:', absoluteDestFolder)
      } catch (cdpError) {
        // Si CDP échoue, on continue quand même (le système par défaut gérera)
        log('[BuzzHeavier] CDP non disponible, utilisation du système par défaut:', cdpError.message)
        // Détacher le debugger en cas d'erreur
        try {
          if (hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
          }
        } catch (e) {
          // Ignorer les erreurs de détachement
        }
      }

      // Fonction helper pour détacher le debugger proprement
      const detachDebugger = () => {
        try {
          if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
            log('[BuzzHeavier] Debugger CDP détaché')
          }
        } catch (e) {
          // Ignorer les erreurs de détachement
        }
      }

      // Configurer le contexte de téléchargement
      let downloadDetected = false
      hiddenWindow._pendingDownload = {
        active: true,
        destinationPath: absoluteDestFolder, // Utiliser le chemin absolu
        resolve: (res) => {
          downloadDetected = true
          hiddenWindow._pendingDownload = null
          detachDebugger()
          log('[BuzzHeavier] Téléchargement détecté et lancé')
          resolve(res)
        },
        reject: (err) => {
          hiddenWindow._pendingDownload = null
          detachDebugger()
          reject(err)
        }
      }

      // Charger la page BuzzHeavier
      log('[BuzzHeavier] Accès à la page…')
      await hiddenWindow.loadURL(url, { waitUntil: 'networkidle' })

      // Attendre que la page soit complètement chargée
      await hiddenWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve()
          } else {
            window.addEventListener('load', resolve)
          }
        })
      `, true)

      log('[BuzzHeavier] Recherche du bouton de téléchargement…')

      // Chercher et cliquer sur le bouton de téléchargement
      const buttonFound = await hiddenWindow.webContents.executeJavaScript(`
        (function() {
          // Essayer plusieurs sélecteurs possibles
          const selectors = [
            'a[href*="download"]',
            'a[href*="pixeldrain"]',
            '.btn-download',
            '#download',
            'a.download',
            '[class*="download"]',
            '[id*="download"]',
            'button[class*="download"]',
            'button[id*="download"]'
          ]
          
          for (const selector of selectors) {
            try {
              const element = document.querySelector(selector)
              if (element && (element.href || element.onclick || element.tagName === 'BUTTON' || element.tagName === 'A')) {
                element.click()
                return { found: true, selector: selector, href: element.href || 'N/A' }
              }
            } catch (e) {}
          }
          
          // Chercher les boutons avec le texte "Download" ou "Télécharger"
          const buttons = Array.from(document.querySelectorAll('button, a'))
          for (const button of buttons) {
            const text = (button.textContent || button.innerText || '').toLowerCase()
            if (text.includes('download') || text.includes('télécharger') || text.includes('télécharg')) {
              button.click()
              return { found: true, type: 'text-match', text: text.substring(0, 50) }
            }
          }
          
          // Si aucun bouton trouvé, chercher tous les liens et cliquer sur celui qui contient "download" ou "pixeldrain"
          const links = Array.from(document.querySelectorAll('a[href]'))
          for (const link of links) {
            const href = link.href.toLowerCase()
            if (href.includes('download') || href.includes('pixeldrain')) {
              link.click()
              return { found: true, href: link.href }
            }
          }
          
          return { found: false }
        })()
      `, true)

      if (!buttonFound || !buttonFound.found) {
        // Détacher le debugger
        try {
          if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
          }
        } catch (e) {}
        
        // Fallback: essayer de convertir directement en PixelDrain si on trouve un ID
        const idMatch = url.match(/buzzheavier\.com\/([a-zA-Z0-9]+)/)
        if (idMatch) {
          const fileId = idMatch[1]
          const directLink = `https://pixeldrain.com/api/file/${fileId}?download`
          log('[BuzzHeavier] Bouton non trouvé, conversion directe vers PixelDrain:', directLink)
          hiddenWindow._pendingDownload = null
          downloadDestinationPath = destinationPath || null
          session.defaultSession.downloadURL(directLink)
          return resolve({ success: true, downloadUrl: directLink })
        }
        hiddenWindow._pendingDownload = null
        return reject(new Error('[BuzzHeavier] Bouton de téléchargement introuvable'))
      }

      log('[BuzzHeavier] Bouton trouvé et cliqué:', buttonFound.selector || buttonFound.href)
      log('[BuzzHeavier] Attente de la détection du téléchargement…')

      // Attendre que le téléchargement soit détecté (max 15 secondes)
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        if (downloadDetected) {
          clearInterval(checkInterval)
          return
        }

        if (Date.now() - startTime > 15000) {
          clearInterval(checkInterval)
          try {
            hiddenWindow._pendingDownload = null
          } catch (e) {}
          
          // Détacher le debugger
          try {
            if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
              hiddenWindow.webContents.debugger.detach()
            }
          } catch (e) {}
          
          // Fallback: essayer la conversion directe
          const idMatch = url.match(/buzzheavier\.com\/([a-zA-Z0-9]+)/)
          if (idMatch) {
            const fileId = idMatch[1]
            const directLink = `https://pixeldrain.com/api/file/${fileId}?download`
            log('[BuzzHeavier] Timeout, conversion directe vers PixelDrain:', directLink)
            downloadDestinationPath = destinationPath || null
            session.defaultSession.downloadURL(directLink)
            return resolve({ success: true, downloadUrl: directLink })
          }
          
          reject(new Error('[BuzzHeavier] Timeout: téléchargement non détecté'))
        }
      }, 500)

    } catch (error) {
      try {
        hiddenWindow._pendingDownload = null
      } catch (e) {}
      
      // Détacher le debugger en cas d'erreur
      try {
        if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
          hiddenWindow.webContents.debugger.detach()
        }
      } catch (e) {}
      
      errorLog('[BuzzHeavier] Erreur lors du téléchargement:', error)
        reject(error)
    }
  })
}

/**
 * Télécharge depuis VikingFile en utilisant la fenêtre cachée Electron avec clic automatique
 */
async function downloadVikingFileWithElectron(url, destinationPath = null) {
  log('[VikingFile] Lancement avec fenêtre cachée Electron pour télécharger…')

  return new Promise(async (resolve, reject) => {
    try {
      // Créer ou réutiliser la fenêtre cachée
      if (!hiddenWindow || hiddenWindow.isDestroyed()) {
        createHiddenWindow()
      }

      const destFolder = destinationPath || app.getPath('downloads')
      const absoluteDestFolder = path.resolve(destFolder)
      log('[VikingFile] Dossier de destination:', absoluteDestFolder)

      // ✅ Créer le dossier s'il n'existe pas
      if (!fs.existsSync(absoluteDestFolder)) {
        fs.mkdirSync(absoluteDestFolder, { recursive: true })
        log('[VikingFile] Dossier créé:', absoluteDestFolder)
      }

      // 🎯 FORCER le dossier de téléchargement avec CDP
      try {
        // Attacher le debugger si ce n'est pas déjà fait
        if (!hiddenWindow.webContents.debugger.isAttached()) {
          hiddenWindow.webContents.debugger.attach('1.3')
          log('[VikingFile] Debugger CDP attaché')
        }
        
        // Configurer le comportement de téléchargement via CDP
        await hiddenWindow.webContents.debugger.sendCommand('Browser.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: absoluteDestFolder // ✅ Chemin absolu obligatoire
        })
        log('[VikingFile] CDP: Dossier de téléchargement forcé à:', absoluteDestFolder)
      } catch (cdpError) {
        // Si CDP échoue, on continue quand même (le système par défaut gérera)
        log('[VikingFile] CDP non disponible, utilisation du système par défaut:', cdpError.message)
        // Détacher le debugger en cas d'erreur
        try {
          if (hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
          }
        } catch (e) {
          // Ignorer les erreurs de détachement
        }
      }

      // Fonction helper pour détacher le debugger proprement
      const detachDebugger = () => {
        try {
          if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
            log('[VikingFile] Debugger CDP détaché')
          }
        } catch (e) {
          // Ignorer les erreurs de détachement
        }
      }

      // Configurer le contexte de téléchargement
      let downloadDetected = false
      hiddenWindow._pendingDownload = {
        active: true,
        destinationPath: absoluteDestFolder, // Utiliser le chemin absolu
        resolve: (res) => {
          downloadDetected = true
          hiddenWindow._pendingDownload = null
          detachDebugger()
          log('[VikingFile] Téléchargement détecté et lancé')
          resolve(res)
        },
        reject: (err) => {
          hiddenWindow._pendingDownload = null
          detachDebugger()
          reject(err)
        }
      }

      // Charger la page VikingFile
      log('[VikingFile] Accès à la page…')
      await hiddenWindow.loadURL(url, { waitUntil: 'networkidle' })

      // Attendre que la page soit complètement chargée (plus longtemps pour les scripts/pubs)
      await hiddenWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          if (document.readyState === 'complete') {
            setTimeout(resolve, 5000) // Attendre 5s supplémentaires pour les scripts
          } else {
            window.addEventListener('load', () => setTimeout(resolve, 5000))
          }
        })
      `, true)

      // Attendre encore un peu pour que les scripts se chargent
      await new Promise(resolve => setTimeout(resolve, 10000))

      log('[VikingFile] Recherche du bouton de téléchargement…')

      // Chercher et cliquer sur le bouton de téléchargement
      const buttonFound = await hiddenWindow.webContents.executeJavaScript(`
        (function() {
          // Sélecteurs spécifiques à VikingFile
          const selectors = [
            'a.btn-download',
            'a[download]',
            '#direct_link',
            'a[href*=".zip"]',
            'a[href*=".rar"]',
            'a[href*=".7z"]',
            'button.download',
            '.download-button',
            'a[href*="download"]',
            'button[class*="download"]',
            '[class*="download"]',
            '[id*="download"]',
            'a.btn.btn-primary',
            'button[type="submit"]',
            '#downloadButton',
            '.direct-download'
          ]
          
          for (const selector of selectors) {
            try {
              const element = document.querySelector(selector)
              if (element && (element.href || element.onclick || element.tagName === 'BUTTON' || element.tagName === 'A')) {
                element.click()
                return { found: true, selector: selector, href: element.href || 'N/A' }
              }
            } catch (e) {}
          }
          
          // Chercher les boutons avec le texte "Download" ou "Télécharger"
          const buttons = Array.from(document.querySelectorAll('button, a'))
          for (const button of buttons) {
            const text = (button.textContent || button.innerText || '').toLowerCase()
            if (text.includes('download') || text.includes('télécharger') || text.includes('télécharg') || text.includes('free download')) {
              button.click()
              return { found: true, type: 'text-match', text: text.substring(0, 50) }
            }
          }
          
          // Si aucun bouton trouvé, chercher tous les liens et cliquer sur celui qui contient un fichier
          const links = Array.from(document.querySelectorAll('a[href]'))
          for (const link of links) {
            const href = link.href.toLowerCase()
            if (href.includes('.zip') || href.includes('.rar') || href.includes('.7z') || href.includes('download')) {
              link.click()
              return { found: true, href: link.href }
            }
          }
          
          return { found: false }
        })()
      `, true)

      if (!buttonFound || !buttonFound.found) {
        // Sauvegarder une capture d'écran pour debug
        log('[VikingFile] ⚠️ Bouton introuvable, capture de la page…')
        
        try {
          const screenshot = await hiddenWindow.webContents.capturePage()
          const screenshotPath = path.join(absoluteDestFolder, 'vikingfile-debug.png')
          fs.writeFileSync(screenshotPath, screenshot.toPNG())
          log('[VikingFile] Screenshot sauvegardé:', screenshotPath)
        } catch (err) {
          log('[VikingFile] Erreur screenshot:', err.message)
        }
        
        // Détacher le debugger
        try {
          if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
          }
        } catch (e) {}
        
        hiddenWindow._pendingDownload = null
        return reject(new Error('[VikingFile] Bouton de téléchargement introuvable. Vérifiez le screenshot de debug.'))
      }

      log('[VikingFile] Bouton trouvé et cliqué:', buttonFound.selector || buttonFound.href)
      log('[VikingFile] Attente de la détection du téléchargement…')

      // Attendre que le téléchargement soit détecté (max 20 secondes pour VikingFile)
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        if (downloadDetected) {
          clearInterval(checkInterval)
          return
        }

        if (Date.now() - startTime > 20000) {
          clearInterval(checkInterval)
          try {
            hiddenWindow._pendingDownload = null
          } catch (e) {}
          
          // Détacher le debugger
          try {
            if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
              hiddenWindow.webContents.debugger.detach()
            }
          } catch (e) {}
          
          reject(new Error('[VikingFile] Timeout: téléchargement non détecté'))
        }
      }, 500)

    } catch (error) {
      try {
        hiddenWindow._pendingDownload = null
      } catch (e) {}
      
      // Détacher le debugger en cas d'erreur
      try {
        if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
          hiddenWindow.webContents.debugger.detach()
        }
      } catch (e) {}
      
      errorLog('[VikingFile] Erreur lors du téléchargement:', error)
      reject(error)
    }
  })
}

/**
 * Télécharge depuis MegaDB/Mega en utilisant la fenêtre cachée Electron avec clic automatique
 */
async function downloadMegadbWithElectron(url, destinationPath = null) {
  log('[MegaDB] Lancement avec fenêtre cachée Electron pour télécharger…')

  return new Promise(async (resolve, reject) => {
    try {
      // Créer ou réutiliser la fenêtre cachée
      if (!hiddenWindow || hiddenWindow.isDestroyed()) {
        createHiddenWindow()
      }

      const destFolder = destinationPath || app.getPath('downloads')
      const absoluteDestFolder = path.resolve(destFolder)
      log('[MegaDB] Dossier de destination:', absoluteDestFolder)

      // ✅ Créer le dossier s'il n'existe pas
      if (!fs.existsSync(absoluteDestFolder)) {
        fs.mkdirSync(absoluteDestFolder, { recursive: true })
        log('[MegaDB] Dossier créé:', absoluteDestFolder)
      }

      // 🎯 FORCER le dossier de téléchargement avec CDP
      try {
        // Attacher le debugger si ce n'est pas déjà fait
        if (!hiddenWindow.webContents.debugger.isAttached()) {
          hiddenWindow.webContents.debugger.attach('1.3')
          log('[MegaDB] Debugger CDP attaché')
        }
        
        // Configurer le comportement de téléchargement via CDP
        await hiddenWindow.webContents.debugger.sendCommand('Browser.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: absoluteDestFolder // ✅ Chemin absolu obligatoire
        })
        log('[MegaDB] CDP: Dossier de téléchargement forcé à:', absoluteDestFolder)
      } catch (cdpError) {
        // Si CDP échoue, on continue quand même (le système par défaut gérera)
        log('[MegaDB] CDP non disponible, utilisation du système par défaut:', cdpError.message)
        // Détacher le debugger en cas d'erreur
        try {
          if (hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
          }
        } catch (e) {
          // Ignorer les erreurs de détachement
        }
      }

      // Fonction helper pour détacher le debugger proprement
      const detachDebugger = () => {
        try {
          if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
            log('[MegaDB] Debugger CDP détaché')
          }
        } catch (e) {
          // Ignorer les erreurs de détachement
        }
      }

      // Configurer le contexte de téléchargement
      let downloadDetected = false
      hiddenWindow._pendingDownload = {
        active: true,
        destinationPath: absoluteDestFolder, // Utiliser le chemin absolu
        resolve: (res) => {
          downloadDetected = true
          hiddenWindow._pendingDownload = null
          detachDebugger()
          log('[MegaDB] Téléchargement détecté et lancé')
          resolve(res)
        },
        reject: (err) => {
          hiddenWindow._pendingDownload = null
          detachDebugger()
          reject(err)
        }
      }

      // Charger la page MegaDB/Mega
      log('[MegaDB] Accès à la page…')
      await hiddenWindow.loadURL(url, { waitUntil: 'domcontentloaded' })

      // Attendre que la page soit chargée et que le reCAPTCHA soit résolu (si présent)
      await hiddenWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          const startTime = Date.now()
          
          const checkReady = () => {
            // Vérifier si le reCAPTCHA est résolu (si présent)
            const recaptcha = document.querySelector('.g-recaptcha-response')
            const recaptchaChecked = recaptcha && recaptcha.value && recaptcha.value.length > 0
            
            // Vérifier si le bouton de téléchargement est disponible
            const downloadBtn = document.querySelector('a[href*="download"], button[class*="download"], .download-btn, .btn-download, a.btn.btn-primary, button[type="submit"], #downloadButton, .direct-download, [data-download], a[data-action="download"]')
            
            // Si le bouton est disponible et (pas de reCAPTCHA ou reCAPTCHA résolu), on peut continuer
            if (downloadBtn && (!recaptcha || recaptchaChecked)) {
              resolve()
              return
            }
            
            // Sinon, attendre un peu et réessayer (max 3 secondes)
            if (Date.now() - startTime < 3000) {
              setTimeout(checkReady, 300)
            } else {
              resolve() // Continuer même si le reCAPTCHA n'est pas résolu
            }
          }
          
          if (document.readyState === 'complete') {
            setTimeout(checkReady, 1500) // Attendre 1.5s pour les scripts initiaux
          } else {
            window.addEventListener('load', () => setTimeout(checkReady, 1500))
          }
        })
      `, true)

      log('[MegaDB] Recherche du bouton de téléchargement…')

      // Chercher et cliquer sur le bouton de téléchargement
      const buttonFound = await hiddenWindow.webContents.executeJavaScript(`
        (function() {
          // Sélecteurs possibles pour MegaDB/Mega (prioriser "Free Download")
          const selectors = [
            'button:contains("Free Download")',
            'a:contains("Free Download")',
            'button[class*="download"]',
            'a[href*="download"]',
            '.download-btn',
            '.btn-download',
            'a.btn.btn-primary',
            'button[type="submit"]',
            '#downloadButton',
            '.direct-download',
            '[data-download]',
            'a[data-action="download"]'
          ]
          
          let downloadBtn = null
          
          // Chercher d'abord par texte "Free Download" (le plus commun sur MegaDB)
          const allButtons = Array.from(document.querySelectorAll('a, button'))
          downloadBtn = allButtons.find(el => {
            const text = el.textContent.toLowerCase().trim()
            return text === 'free download' || text === 'télécharger gratuit' || text.includes('free download')
          })
          
          // Si pas trouvé, essayer les sélecteurs
          if (!downloadBtn) {
            for (const selector of selectors) {
              try {
                downloadBtn = document.querySelector(selector)
                if (downloadBtn) {
                  console.log('Bouton trouvé avec sélecteur:', selector)
                  break
                }
              } catch (e) {
                // Ignorer les sélecteurs invalides (comme :contains)
              }
            }
          }
          
          // Chercher aussi par texte générique
          if (!downloadBtn) {
            downloadBtn = allButtons.find(el => {
              const text = el.textContent.toLowerCase()
              return (text.includes('download') || text.includes('télécharger')) && 
                     !text.includes('premium') && 
                     !text.includes('vip')
            })
          }
          
          if (downloadBtn) {
            // Vérifier si le bouton est visible et cliquable
            const style = window.getComputedStyle(downloadBtn)
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
              downloadBtn.click()
              return { found: true, href: downloadBtn.href || null }
            }
          }
          
          console.error('Aucun bouton de téléchargement trouvé ou visible')
          return { found: false }
        })()
      `, true)

      if (!buttonFound || !buttonFound.found) {
        // Sauvegarder une capture d'écran pour debug
        log('[MegaDB] ⚠️ Bouton introuvable, capture de la page…')
        
        try {
          const screenshot = await hiddenWindow.webContents.capturePage()
          const screenshotPath = path.join(absoluteDestFolder, 'megadb-debug.png')
          fs.writeFileSync(screenshotPath, screenshot.toPNG())
          log('[MegaDB] Screenshot sauvegardé:', screenshotPath)
        } catch (err) {
          log('[MegaDB] Erreur screenshot:', err.message)
        }
        
        // Détacher le debugger
        try {
          if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
          }
        } catch (e) {}
        
        hiddenWindow._pendingDownload = null
        return reject(new Error('[MegaDB] Bouton de téléchargement introuvable. Vérifiez le screenshot de debug.'))
      }

      log('[MegaDB] Bouton trouvé et cliqué:', buttonFound.href || 'bouton cliqué')
      log('[MegaDB] Attente de la détection du téléchargement…')

      // Attendre que le téléchargement soit détecté (max 10 secondes)
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        if (downloadDetected) {
          clearInterval(checkInterval)
          return
        }

        if (Date.now() - startTime > 10000) {
          clearInterval(checkInterval)
          try {
            hiddenWindow._pendingDownload = null
          } catch (e) {}
          
          // Détacher le debugger
          try {
            if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
              hiddenWindow.webContents.debugger.detach()
            }
          } catch (e) {}
          
          reject(new Error('[MegaDB] Timeout: téléchargement non détecté'))
        }
      }, 500)

    } catch (error) {
      try {
        hiddenWindow._pendingDownload = null
      } catch (e) {}
      
      // Détacher le debugger en cas d'erreur
      try {
        if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
          hiddenWindow.webContents.debugger.detach()
        }
      } catch (e) {}
      
      errorLog('[MegaDB] Erreur lors du téléchargement:', error)
      reject(error)
    }
  })
}

/**
 * Convertit une URL GoFile en lien de téléchargement direct (ancienne méthode API - peut ne plus fonctionner)
 */
async function convertGofile(url) {
  log('[GoFile] Conversion…')
  const id = url.split('/').pop().split('?')[0]

  const serverRes = await fetchJSON('https://api.gofile.io/getServer')
  const server = serverRes.data.server

  const fileRes = await fetchJSON(
    `https://${server}.gofile.io/getUpload?contentId=${id}`
  )

  if (!fileRes.data || !fileRes.data.contents || !fileRes.data.contents[id]) {
    throw new Error('GoFile: Fichier non trouvé')
  }

  return fileRes.data.contents[id].link
}

/**
 * Télécharge depuis GoFile en utilisant l'API GoFile v2 directement
 */
async function downloadGofileWithElectron(url, destinationPath = null) {
  log('[GoFile] Utilisation de l\'API GoFile v2 pour télécharger…')

  try {
    // Extraire l'ID du contenu depuis l'URL
    const contentIdMatch = url.match(/gofile\.io\/d\/([a-zA-Z0-9]+)/)
    if (!contentIdMatch) {
      throw new Error('[GoFile] URL invalide. Format attendu: https://gofile.io/d/xxxxx')
    }
    
    const contentId = contentIdMatch[1]
    log('[GoFile] Content ID extrait:', contentId)

    const destFolder = destinationPath || app.getPath('downloads')
    const absoluteDestFolder = path.resolve(destFolder)
    log('[GoFile] Dossier de destination:', absoluteDestFolder)

    // ✅ Créer le dossier s'il n'existe pas
    if (!fs.existsSync(absoluteDestFolder)) {
      fs.mkdirSync(absoluteDestFolder, { recursive: true })
      log('[GoFile] Dossier créé:', absoluteDestFolder)
    }

    // Appeler l'API GoFile v2 pour obtenir les fichiers
    const apiUrl = `https://api.gofile.io/contents/${contentId}`
    log('[GoFile] Appel API:', apiUrl)
    
    const apiResponse = await fetchJSON(apiUrl)
    log('[GoFile] Réponse API reçue')
    
    if (!apiResponse || !apiResponse.data) {
      throw new Error('[GoFile] Réponse API invalide')
    }

    // Extraire les fichiers depuis data.children
    const children = apiResponse.data.children
    if (!children || Object.keys(children).length === 0) {
      throw new Error('[GoFile] Aucun fichier trouvé dans la réponse API')
    }

    log('[GoFile] Fichiers trouvés:', Object.keys(children).length)

    // Filtrer les fichiers (type === "file") et extraire les liens
    const downloadLinks = []
    for (const [fileName, fileData] of Object.entries(children)) {
      if (fileData.type === 'file' && fileData.link) {
        downloadLinks.push({
          name: fileName,
          url: fileData.link,
          size: fileData.size || null
        })
        log('[GoFile] Fichier trouvé:', fileName, '->', fileData.link.substring(0, 100))
      }
    }

    if (downloadLinks.length === 0) {
      throw new Error('[GoFile] Aucun lien de téléchargement trouvé dans les fichiers')
    }

    log('[GoFile]', downloadLinks.length, 'fichier(s) à télécharger')

    // Télécharger chaque fichier directement
    const downloadedFiles = []
    for (const file of downloadLinks) {
      try {
        log('[GoFile] Téléchargement de:', file.name)
        const fileName = file.name || path.basename(file.url)
        const filePath = path.join(absoluteDestFolder, fileName)
        
        // Utiliser downloadHttpToFile pour télécharger directement
        await downloadHttpToFile(file.url, filePath, (received, total) => {
          if (total > 0) {
            const percent = Math.round((received / total) * 100)
            log(`[GoFile] ${file.name}: ${percent}%`)
          }
        })
        
        downloadedFiles.push(filePath)
        log('[GoFile] ✅ Téléchargé:', file.name)
      } catch (fileErr) {
        errorLog(`[GoFile] Erreur lors du téléchargement de ${file.name}:`, fileErr)
        throw new Error(`[GoFile] Erreur lors du téléchargement de ${file.name}: ${fileErr.message}`)
      }
    }

    log('[GoFile] ✅ Tous les fichiers téléchargés avec succès')
    return { 
      success: true, 
      downloadUrl: downloadLinks[0].url, 
      provider: 'gofile',
      files: downloadedFiles
    }

  } catch (error) {
    errorLog('[GoFile] Erreur lors du téléchargement:', error)
    throw error
  }
}

/**
 * Télécharge depuis Koyso en utilisant la fenêtre cachée Electron avec clic automatique
 */
async function downloadKoysoWithElectron(url, destinationPath = null) {
  log('[Koyso] 🚀 Lancement avec fenêtre cachée Electron pour télécharger…')
  log('[Koyso] URL:', url)
  log('[Koyso] Destination:', destinationPath)

  return new Promise(async (resolve, reject) => {
    try {
      // Créer ou réutiliser la fenêtre cachée
      if (!hiddenWindow || hiddenWindow.isDestroyed()) {
        log('[Koyso] Création de la fenêtre cachée…')
        createHiddenWindow()
      } else {
        log('[Koyso] Réutilisation de la fenêtre cachée existante')
      }
      
      // S'assurer que le contexte de téléchargement précédent est nettoyé
      if (hiddenWindow._pendingDownload) {
        log('[Koyso] ⚠️ Nettoyage du contexte de téléchargement précédent')
        try {
          hiddenWindow._pendingDownload = null
        } catch (e) {
          log('[Koyso] Erreur lors du nettoyage:', e.message)
        }
      }

      const destFolder = destinationPath || app.getPath('downloads')
      const absoluteDestFolder = path.resolve(destFolder)
      log('[Koyso] Dossier de destination:', absoluteDestFolder)

      // ✅ Créer le dossier s'il n'existe pas
      if (!fs.existsSync(absoluteDestFolder)) {
        fs.mkdirSync(absoluteDestFolder, { recursive: true })
        log('[Koyso] Dossier créé:', absoluteDestFolder)
      }

      // 🎯 FORCER le dossier de téléchargement avec CDP + Masquer l'automatisation
      try {
        // Attacher le debugger si ce n'est pas déjà fait
        if (!hiddenWindow.webContents.debugger.isAttached()) {
          hiddenWindow.webContents.debugger.attach('1.3')
          log('[Koyso] Debugger CDP attaché')
        }
        
        // Configurer le comportement de téléchargement via CDP
        await hiddenWindow.webContents.debugger.sendCommand('Browser.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: absoluteDestFolder // ✅ Chemin absolu obligatoire
        })
        log('[Koyso] CDP: Dossier de téléchargement forcé à:', absoluteDestFolder)
        
        // 🛡️ Masquer les traces d'automatisation (anti-bot)
        // Définir un user-agent réaliste
        await hiddenWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        // Masquer navigator.webdriver et autres propriétés détectables via CDP
        await hiddenWindow.webContents.executeJavaScript(`
          // Masquer les traces d'automatisation
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
          })
          
          // Masquer chrome.runtime
          if (window.chrome && window.chrome.runtime) {
            Object.defineProperty(window.chrome, 'runtime', {
              get: () => undefined
            })
          }
          
          // Ajouter des propriétés pour simuler un navigateur réel
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
          })
          
          Object.defineProperty(navigator, 'languages', {
            get: () => ['fr-FR', 'fr', 'en-US', 'en']
          })
        `, true)
        
        log('[Koyso] 🛡️ Protection anti-bot activée (masquage des traces d\'automatisation)')
      } catch (cdpError) {
        // Si CDP échoue, on continue quand même (le système par défaut gérera)
        log('[Koyso] CDP non disponible, utilisation du système par défaut:', cdpError.message)
        // Détacher le debugger en cas d'erreur
        try {
          if (hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
          }
        } catch (e) {
          // Ignorer les erreurs de détachement
        }
      }

      // Fonction helper pour détacher le debugger proprement
      const detachDebugger = () => {
        try {
          if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
            hiddenWindow.webContents.debugger.detach()
            log('[Koyso] Debugger CDP détaché')
          }
        } catch (e) {
          // Ignorer les erreurs de détachement
        }
      }

      // Configurer le contexte de téléchargement
      let downloadDetected = false
      hiddenWindow._pendingDownload = {
        active: true,
        destinationPath: absoluteDestFolder, // Utiliser le chemin absolu
        resolve: (res) => {
          downloadDetected = true
          hiddenWindow._pendingDownload = null
          detachDebugger()
          log('[Koyso] Téléchargement détecté et lancé')
          resolve(res)
        },
        reject: (err) => {
          hiddenWindow._pendingDownload = null
          detachDebugger()
          reject(err)
        }
      }

      // Charger la page Koyso
      log('[Koyso] 📄 Chargement de la page…')
      await hiddenWindow.loadURL(url, { waitUntil: 'networkidle' })

      // Attendre que la page soit complètement chargée avec délai aléatoire (simulation humaine)
      const randomDelay = 3000 + Math.random() * 3000 // Entre 3 et 6 secondes
      log(`[Koyso] ⏳ Attente du chargement complet (${Math.round(randomDelay/1000)}s, délai aléatoire)…`)
      await new Promise(resolve => setTimeout(resolve, randomDelay))
      
      // Simuler des mouvements de souris pour paraître humain
      try {
        await hiddenWindow.webContents.executeJavaScript(`
          // Simuler un mouvement de souris
          const event = new MouseEvent('mousemove', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: 100 + Math.random() * 200,
            clientY: 100 + Math.random() * 200
          })
          document.dispatchEvent(event)
        `, true)
        log('[Koyso] 🖱️ Mouvement de souris simulé')
      } catch (e) {
        // Ignorer les erreurs
      }

      log('[Koyso] 🖱️ Tentative d\'appel direct de la fonction download()…')

      // Essayer d'abord d'appeler directement la fonction download() de la page
      const directCall = await hiddenWindow.webContents.executeJavaScript(`
        (function() {
          // Appel direct de la fonction download() si elle existe
          if (typeof download === 'function') {
            console.log('[Koyso JS] ✅ Fonction download() trouvée, appel direct...')
            try {
              download()
              return { success: true, method: 'direct_function_call' }
            } catch (e) {
              console.error('[Koyso JS] Erreur lors de l\'appel de download():', e.message)
              return { success: false, error: e.message }
            }
          }
          
          // Si la fonction n'existe pas, chercher le bouton et cliquer dessus
          console.log('[Koyso JS] Fonction download() non trouvée, recherche du bouton...')
          
          // Chercher le bouton "Download" ou "Télécharger"
          const buttons = Array.from(document.querySelectorAll('button, a, .btn, [role="button"]'))
          
          for (const btn of buttons) {
            const text = btn.textContent.trim().toLowerCase()
            const isVisible = btn.offsetParent !== null
            
            // Koyso a un bouton "Download" ou "Télécharger" qui doit être visible
            if ((text === 'download' || text === 'télécharger' || text.includes('download')) && isVisible) {
              console.log('[Koyso JS] ✅ Bouton trouvé:', btn.textContent.trim(), 'visible:', isVisible)
              btn.click()
              return { success: true, text: btn.textContent.trim(), method: 'button_click' }
            }
          }
          
          // Chercher aussi dans div.download_div avec class="button"
          const downloadDiv = document.querySelector('div.download_div')
          if (downloadDiv) {
            const divButton = downloadDiv.querySelector('button.button, button[onclick*="download"]')
            if (divButton && divButton.offsetParent !== null) {
              console.log('[Koyso JS] ✅ Bouton trouvé dans download_div')
              divButton.click()
              return { success: true, text: divButton.textContent.trim(), method: 'download_div_click' }
            }
          }
          
          // Si pas trouvé, essayer avec un sélecteur CSS direct
          const downloadBtn = document.querySelector('button:not([style*="display: none"])')
          if (downloadBtn && downloadBtn.textContent.toLowerCase().includes('download') && downloadBtn.offsetParent !== null) {
            console.log('[Koyso JS] ✅ Bouton trouvé par sélecteur CSS')
            downloadBtn.click()
            return { success: true, text: downloadBtn.textContent.trim(), method: 'css_selector_click' }
          }
          
          console.log('[Koyso JS] ❌ Aucune méthode trouvée')
          return { success: false, method: 'none' }
        })()
      `, true)

      if (!directCall || !directCall.success) {
        // Sauvegarder une capture d'écran pour debug
        try {
          const screenshot = await hiddenWindow.webContents.capturePage()
          const screenshotPath = path.join(absoluteDestFolder, 'koyso-debug.png')
          fs.writeFileSync(screenshotPath, screenshot.toPNG())
          log('[Koyso] Screenshot sauvegardé:', screenshotPath)
        } catch (err) {
          log('[Koyso] Erreur screenshot:', err.message)
        }
        
        detachDebugger()
        hiddenWindow._pendingDownload = null
        return reject(new Error(`[Koyso] ❌ Impossible de déclencher le téléchargement. Méthode: ${directCall?.method || 'unknown'}. Vérifiez le screenshot de debug.`))
      }

      log(`[Koyso] ✅ Téléchargement déclenché via: ${directCall.method}${directCall.text ? ` (bouton: "${directCall.text}")` : ''}`)
      
      // Délai aléatoire avant de vérifier le téléchargement (simulation humaine)
      const randomWait = 8000 + Math.random() * 4000 // Entre 8 et 12 secondes
      log(`[Koyso] ⏳ Attente du démarrage du téléchargement (${Math.round(randomWait/1000)}s, délai aléatoire)…`)
      await new Promise(resolve => setTimeout(resolve, randomWait))

      log('[Koyso] Maintien de la fenêtre ouverte (délai supplémentaire)…')
      // Ne pas fermer tout de suite, laisser le temps au téléchargement de démarrer
      const additionalWait = 3000 + Math.random() * 2000 // Entre 3 et 5 secondes
      await new Promise(resolve => setTimeout(resolve, additionalWait))

      log('[Koyso] ✅ Processus terminé, le fichier sera géré par will-download')
      
      // Le téléchargement sera géré par l'événement will-download
      // Fermer la fenêtre après un délai
      setTimeout(() => {
        try {
          if (hiddenWindow && !hiddenWindow.isDestroyed()) {
            hiddenWindow.close()
          }
        } catch (e) {
          // Ignorer les erreurs de fermeture
        }
      }, 2000)
      
      // Résoudre la promesse - le téléchargement est lancé
      hiddenWindow._pendingDownload = null
      detachDebugger()
      resolve({ success: true, downloadUrl: url, provider: 'koyso' })

    } catch (error) {
      try {
        hiddenWindow._pendingDownload = null
      } catch (e) {}
      
      // Détacher le debugger en cas d'erreur
      try {
        if (hiddenWindow && !hiddenWindow.isDestroyed() && hiddenWindow.webContents.debugger.isAttached()) {
          hiddenWindow.webContents.debugger.detach()
        }
      } catch (e) {}
      
      errorLog('[Koyso] Erreur lors du téléchargement:', error)
      reject(error)
    }
  })
}

/**
 * Téléchargement universel qui détecte et convertit automatiquement le provider
 */
async function universalDownload(url, destinationPath = null) {
  log('[Downloader] URL reçue:', url)

  const provider = detectProvider(url)
  log('[Downloader] Provider détecté:', provider)

  if (provider === 'unknown') {
    throw new Error('Provider non supporté: ' + url)
  }

  try {
    switch (provider) {
      case 'pixeldrain': {
        const directURL = await convertPixelDrain(url)
        log('[Downloader] Lien final à télécharger:', directURL)
        downloadDestinationPath = destinationPath || null
        session.defaultSession.downloadURL(directURL)
        return { success: true, downloadUrl: directURL, provider }
      }

      case 'buzzheavier': {
        // Utiliser la fenêtre cachée Electron avec clic automatique
        return await downloadBuzzHeavierWithElectron(url, destinationPath)
      }

      case 'gofile': {
        // Utiliser la fenêtre cachée Electron avec clic automatique
        return await downloadGofileWithElectron(url, destinationPath)
      }

      case 'vikingfile': {
        // Utiliser la fenêtre cachée Electron avec clic automatique
        return await downloadVikingFileWithElectron(url, destinationPath)
      }

      case 'megadb':
      case 'mega': {
        // Utiliser la fenêtre cachée Electron avec clic automatique
        return await downloadMegadbWithElectron(url, destinationPath)
      }

      case 'koyso': {
        // Utiliser la fenêtre cachée Electron avec clic automatique
        return await downloadKoysoWithElectron(url, destinationPath)
      }

      default:
        throw new Error('Provider non supporté: ' + provider)
    }
  } catch (error) {
    errorLog('[Downloader] Erreur lors de la conversion:', error)
    throw error
  }
}

/* ---------------- download helpers ---------------- */

/**
 * Download helper that follows redirects and writes to disk
 */
function downloadHttpToFile(url, outPath, onProgress) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const client = parsed.protocol === 'https:' ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'Actoris-Launcher/1.0.23' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString()
        log('redirect ->', next)
        return downloadHttpToFile(next, outPath, onProgress).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      const stream = fs.createWriteStream(outPath)
      res.on('data', (chunk) => {
        received += chunk.length
        if (onProgress) onProgress(received, total)
      })
      res.pipe(stream)
      stream.on('finish', () => stream.close(resolve))
      stream.on('error', (err) => { try { fs.unlinkSync(outPath) } catch(e){} reject(err) })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

/**
 * PixelDrain direct downloader (uses API file endpoint)
 */
async function downloadFromPixelDrainUrl(pageUrl, destinationFolder, onProgress) {
  log('PixelDrain: checking', pageUrl)
  const m = pageUrl.match(/pixeldrain\.com\/[uf]\/([A-Za-z0-9]+)/)
  if (!m) throw new Error('PixelDrain: invalid URL')
  const id = m[1]
  const apiUrl = `https://pixeldrain.com/api/file/${id}?download`
  if (!fs.existsSync(destinationFolder)) fs.mkdirSync(destinationFolder, { recursive: true })
  const outPath = path.join(destinationFolder, `${id}.zip`)
  log('PixelDrain: downloading via API', apiUrl, '->', outPath)
  await downloadHttpToFile(apiUrl, outPath, onProgress)
  return outPath
}

/* ---------------- Hidden window + webRequest interceptor ---------------- */

function createHiddenWindow() {
  if (hiddenWindow && !hiddenWindow.isDestroyed()) return hiddenWindow

  hiddenWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    }
  })
  
  // Définir un user-agent réaliste pour éviter la détection anti-bot
  hiddenWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  hiddenWindow._pendingDownload = null

  // will-download on hiddenWindow session handled by defaultSession (we configure setupDefaultSession)
  hiddenWindow.webContents.on('did-fail-load', (e, errorCode, errorDesc, validatedURL) => {
    log('HiddenWindow did-fail-load', errorCode, errorDesc, validatedURL)
  })

      // Attach a global webRequest handler for the hiddenWindow's session.
      try {
        const filter = { urls: ['<all_urls>'] }
        
        // Intercepteur pour les requêtes (détection des fichiers directs)
        hiddenWindow.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
          try {
            const ctx = hiddenWindow && hiddenWindow._pendingDownload
            if (!ctx || !ctx.active) {
              // Ne pas logger les requêtes Discord, Steam, ou autres services externes pour éviter le spam
              const url = details.url || ''
              const isDiscord = url.includes('discord.com') || url.includes('discordapp.com')
              const isSteam = url.includes('steam') || url.includes('steampowered.com')
              const isExternalService = isDiscord || isSteam || url.includes('googleapis.com') || url.includes('gstatic.com')
              
              // Logger uniquement les requêtes potentiellement pertinentes (fichiers, téléchargements)
              if (!isExternalService && (url.match(/\.(zip|rar|7z|exe|iso|dmg|pkg|bin)(\?|$)/i) || url.includes('download') || url.includes('/file/'))) {
                const urlPreview = url.substring(0, 100)
                log('[Hidden webRequest] Potentially relevant request:', urlPreview)
              }
              return callback({ cancel: false })
            }

            const u = details.url
            const lower = u.toLowerCase()
            log('[Hidden webRequest] Checking URL:', u.substring(0, 150))
            
            // Ignorer les URLs de pages koyso.to (elles nécessitent un clic sur un bouton)
            if (lower.includes('koyso.to/download/') && !lower.match(/\.(zip|rar|7z|exe|iso|dmg|pkg)(\?|$)/i)) {
              log('[Hidden webRequest] ⚠️ URL koyso.to ignorée (nécessite un clic sur bouton)')
              return callback({ cancel: false })
            }
            
            const isFile = /\.zip(\?|$)|\.rar(\?|$)|\.7z(\?|$)|\.exe(\?|$)|\.iso(\?|$)|\.dmg(\?|$)|\.pkg(\?|$)/i.test(lower)
            const useful = lower.includes('download') || lower.includes('/file/') || lower.includes('/api/file/') || lower.includes('/files/') || lower.includes('dlproxy') || lower.includes('apophis')
            
            log('[Hidden webRequest] isFile:', isFile, 'useful:', useful)

            if (isFile || useful) {
              // mark handled, store destination and trigger native download
              ctx.active = false
              const downloadUrl = details.url
              downloadDestinationPath = ctx.destinationPath || null
              log('[Hidden webRequest] ✅ DETECTED download URL:', downloadUrl)
              log('[Hidden webRequest] Destination path:', downloadDestinationPath || 'default downloads folder')
              
              // trigger native download on default session; will be handled by setupDefaultSession()
              try {
                session.defaultSession.downloadURL(downloadUrl)
                log('[Hidden webRequest] downloadURL() called successfully')
              } catch (dlErr) {
                errorLog('[Hidden webRequest] Error calling downloadURL:', dlErr)
              }
              
              // resolve waiting promise
              try { 
                ctx.resolve({ success: true, downloadUrl }) 
                log('[Hidden webRequest] Promise resolved')
              } catch (e) {
                errorLog('[Hidden webRequest] Error resolving promise:', e)
              }
              return callback({ cancel: false })
            }
          } catch (e) {
            errorLog('hidden webRequest handler error', e)
          }
          callback({ cancel: false })
        })
        
      } catch (e) {
        errorLog('Failed to register hidden webRequest handler', e)
      }

  log('Hidden window created and webRequest handler attached')
  return hiddenWindow
}

/* ---------------- setupDefaultSession (will-download) ---------------- */
function setupDefaultSession() {
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename()
    const downloadURL = item.getURL()
    
    log('✅ will-download triggered!')
    log('  -> URL:', downloadURL)
    log('  -> Filename:', fileName)
    
    // 🎯 IGNORER LES FICHIERS HTML/HTM (page de redirection)
    const fileExtension = path.extname(fileName).toLowerCase()
    if (['.htm', '.html'].includes(fileExtension)) {
      log('  -> ⚠️ Fichier HTML ignoré (redirection)')
      event.preventDefault() // Annuler le téléchargement
      return
    }
    
    // 🎯 UTILISER L'INFO DU TÉLÉCHARGEMENT ACTIF
    let destFolder = downloadDestinationPath || app.getPath('downloads')
    let gameName = null
    
    if (activeDownload) {
      log('  -> Game Name:', activeDownload.gameName)
      log('  -> Destination:', activeDownload.folder)
      destFolder = activeDownload.folder || destFolder
      gameName = activeDownload.gameName
      
      // Stocker le chemin final pour l'extraction
      activeDownload.filePath = path.join(destFolder, fileName)
      activeDownload.fileName = fileName
      // Stocker l'objet item pour pouvoir le contrôler (pause/annuler)
      activeDownload.downloadItem = item
      log('  -> ✅ activeDownload mis à jour avec le chemin du fichier et l\'objet item')
    } else {
      log('  -> ⚠️ Aucun téléchargement actif, utilisation des valeurs par défaut')
      // Essayer d'extraire le nom du jeu du nom de fichier
      gameName = fileName ? path.basename(fileName, path.extname(fileName)) : 'Jeu'
      log('  -> Nom du jeu déduit:', gameName)
    }
    
    const filePath = path.join(destFolder, fileName)
    log('  -> Full path:', filePath)
    
    // 🛡️ PROTECTION CONTRE LES TÉLÉCHARGEMENTS EN DOUBLE
    if (activeDownloads.has(filePath)) {
      log('  -> ⚠️ Téléchargement déjà en cours pour ce fichier, on ignore cette tentative')
      event.preventDefault() // Annuler ce téléchargement en double
      return
    }
    activeDownloads.add(filePath)
    log('  -> 🔒 Téléchargement verrouillé pour:', filePath)
    
    // Nettoyer le verrou quand le téléchargement est terminé ou annulé
    const cleanup = () => {
      activeDownloads.delete(filePath)
      log('  -> 🔓 Verrou de téléchargement libéré pour:', filePath)
    }
    item.once('done', cleanup)
    
    // Ensure destination folder exists
    try {
      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true })
        log('  -> Created destination folder')
      }
    } catch (e) {
      errorLog('  -> Error creating destination folder:', e)
    }
    
    // 🎯 FORCER le chemin de sauvegarde (même pour les redirections)
    item.setSavePath(filePath)
    log('  -> Save path FORCED successfully')
    
    // reset downloadDestinationPath once used
    downloadDestinationPath = null

    item.on('updated', (e, state) => {
      try {
        if (state === 'interrupted') {
          log('[Download] Interrompu')
          
          // Nettoyer le verrou de téléchargement
          cleanup()

          // 🎯 Quand le téléchargement est interrompu, on le marque tout de suite en erreur côté renderer
          const allWindows = BrowserWindow.getAllWindows()
          const errGameName = (activeDownload && activeDownload.gameName) || gameName || fileName
          const errGameId = (activeDownload && activeDownload.gameId) || null

          allWindows.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('download:error', {
                gameId: errGameId,
                gameName: errGameName,
                error: 'Téléchargement interrompu. Veuillez réessayer.'
              })
            }
          })

          // Réinitialiser l'état de suivi côté main
          if (activeDownload) {
            activeDownload = null
          }

          // S'assurer que le téléchargement est bien stoppé
          try {
            if (!item.isDestroyed()) {
              item.cancel()
            }
          } catch (cancelErr) {
            errorLog('[Download] Erreur lors de l\'annulation après interruption:', cancelErr)
          }
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            log('[Download] Pausé')
          } else {
            const received = item.getReceivedBytes()
            const total = item.getTotalBytes()
            const progress = total > 0 ? (received / total) : 0
            const progressPercent = Math.round(progress * 100)
            
            log(`[Download] Progression: ${progressPercent}% ${received} / ${total}`)
            
            // Calculer une estimation de vitesse locale
            let bytesPerSecond = 0
            let estimatedTime = 0
            const now = Date.now()
            
            // 🎯 VÉRIFIER QUE activeDownload EXISTE AVANT D'ACCÉDER À SES PROPRIÉTÉS
            if (activeDownload) {
              const lastReceived = activeDownload.lastReceivedBytes || 0
              const lastTimestamp = activeDownload.lastProgressTimestamp || activeDownload.timestamp || now
              const bytesDiff = received - lastReceived
              const timeDiff = (now - lastTimestamp) / 1000
              if (bytesDiff > 0 && timeDiff > 0) {
                bytesPerSecond = bytesDiff / timeDiff
              }
              if (bytesPerSecond > 0 && total > 0 && received < total) {
                estimatedTime = (total - received) / bytesPerSecond
              }
              // Mettre à jour les valeurs de suivi
              activeDownload.lastReceivedBytes = received
              activeDownload.lastProgressTimestamp = now
            } else {
              // Si activeDownload n'existe pas, on calcule quand même une vitesse basique
              // en utilisant le temps depuis le début du téléchargement
              if (total > 0 && received > 0) {
                const timeElapsed = (now - (item.startTime || now)) / 1000
                if (timeElapsed > 0) {
                  bytesPerSecond = received / timeElapsed
                  if (received < total) {
                    estimatedTime = (total - received) / bytesPerSecond
                  }
                }
              }
            }

            // 🎯 Envoyer la progression au renderer avec le nom du jeu
            // Envoyer à TOUTES les fenêtres pour être sûr que l'événement arrive
            if (activeDownload && activeDownload.gameName) {
              const allWindows = BrowserWindow.getAllWindows()
              const progressData = {
                gameId: activeDownload.gameId || null,
                gameName: activeDownload.gameName,
                progress: progressPercent,
                received,
                receivedBytes: received,
                downloaded: received,
                total,
                totalBytes: total,
                bytesPerSecond,
                eta: estimatedTime,
                isMultiPart: activeDownload.isMultiPart || false,
                currentPart: activeDownload.currentPart || null,
                totalParts: activeDownload.totalParts || null
              }
              
              allWindows.forEach(win => {
                if (win && !win.isDestroyed()) {
                  win.webContents.send('download:progress', progressData)
                  log(`[Download] 📤 Événement envoyé à la fenêtre: ${progressPercent}%`)
                }
              })
              
              // Aussi envoyer via webContents si disponible
              if (webContents && !webContents.isDestroyed()) {
                webContents.send('download:progress', progressData)
              }
            } else {
              // Si pas de activeDownload, on essaie quand même d'envoyer la progression
              // en utilisant le nom de fichier comme fallback
              const fileName = item.getFilename()
              const allWindows = BrowserWindow.getAllWindows()
              const progressData = {
                gameId: null,
                gameName: fileName || 'Téléchargement',
                progress: progressPercent,
                received,
                receivedBytes: received,
                downloaded: received,
                total,
                totalBytes: total,
                bytesPerSecond,
                eta: estimatedTime
              }
              
              allWindows.forEach(win => {
                if (win && !win.isDestroyed()) {
                  win.webContents.send('download:progress', progressData)
                }
              })
            }
          }
        }
      } catch (e) { 
        errorLog('[Download] Error in updated handler:', e)
      }
    })

    item.once('done', async (e, state) => {
      const filePath = item.getSavePath()
      const fileName = item.getFilename()
      
      // Nettoyer le verrou de téléchargement
      cleanup()
      
      log('[Download] ============================================')
      log('[Download] État:', state)
      log('[Download] Fichier:', filePath)
      
      // 🎯 Si activeDownload est null, essayer de le récupérer ou utiliser des valeurs par défaut
      let gameName = null
      let gameId = null
      let destFolder = path.dirname(filePath)
      
      if (activeDownload) {
        log('[Download] Info récupérée:', activeDownload)
        gameName = activeDownload.gameName
        gameId = activeDownload.gameId
        destFolder = activeDownload.folder || destFolder
      } else {
        log('[Download] ⚠️ Aucune info de téléchargement disponible, utilisation des valeurs par défaut')
        // Essayer d'extraire le nom du jeu du nom de fichier
        gameName = fileName ? path.basename(fileName, path.extname(fileName)) : 'Jeu'
        log('[Download] Nom du jeu déduit:', gameName)
      }
      
      if (state === 'completed') {
        log('[Download] ✅ Téléchargement terminé:', filePath)
        
        // 🎯 VÉRIFIER QUE LE FICHIER EXISTE
        if (!fs.existsSync(filePath)) {
          errorLog('[Download] ❌ Le fichier n\'existe pas après téléchargement:', filePath)
          const allWindows = BrowserWindow.getAllWindows()
          allWindows.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('download:error', {
                gameId: gameId,
                gameName: gameName,
                error: 'Le fichier téléchargé n\'existe pas. Il a peut-être été supprimé.'
              })
            }
          })
          if (activeDownload) activeDownload = null
          return
        }
        
        // 🎯 VÉRIFIER L'INTÉGRITÉ DU FICHIER
        try {
          const fileStats = fs.statSync(filePath)
          const downloadedSize = fileStats.size
          const expectedSize = item.getTotalBytes()
          
          log('[Download] Taille téléchargée:', downloadedSize, 'octets')
          log('[Download] Taille attendue:', expectedSize, 'octets')
          
          if (downloadedSize === 0) {
            errorLog('[Download] ❌ Le fichier est vide !')
            
            const allWindows = BrowserWindow.getAllWindows()
            allWindows.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:error', {
                  gameId: gameId,
                  gameName: gameName,
                  error: 'Le fichier téléchargé est vide. Veuillez réessayer.'
                })
              }
            })
            
            if (activeDownload) activeDownload = null
            return
          }
          
          if (expectedSize > 0 && downloadedSize < expectedSize) {
            errorLog('[Download] ❌ Téléchargement incomplet !')
            errorLog('[Download]   Téléchargé:', downloadedSize, '/ Attendu:', expectedSize)
            
            const allWindows = BrowserWindow.getAllWindows()
            allWindows.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:error', {
                  gameId: gameId,
                  gameName: gameName,
                  error: `Téléchargement incomplet: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(expectedSize / 1024 / 1024).toFixed(2)} MB. Veuillez réessayer.`
                })
              }
            })
            
            if (activeDownload) activeDownload = null
            return
          }
        } catch (statError) {
          errorLog('[Download] ❌ Erreur lors de la vérification du fichier:', statError)
        }
        
        // 🎯 VÉRIFIER L'EXTENSION DU FICHIER
        const fileExtension = path.extname(filePath).toLowerCase()
        log('[Download] Extension détectée:', fileExtension)
        
        const isArchive = ['.rar', '.zip', '.7z', '.tar', '.gz', '.bz2'].includes(fileExtension)
        
        log('[Download] Est une archive?', isArchive)
        log('[Download] Nom du jeu:', gameName)
        log('[Download] Dossier de destination:', destFolder)
        
        if (isArchive && gameName) {
          // 🎯 VÉRIFIER SI C'EST UN TÉLÉCHARGEMENT MULTI-PARTIES
          const isMultiPart = activeDownload ? activeDownload.isMultiPart : false
          const currentPart = activeDownload ? activeDownload.currentPart : null
          const totalParts = activeDownload ? activeDownload.totalParts : null
          const isLastPart = currentPart === totalParts
          
          if (isMultiPart && !isLastPart) {
            // C'est une partie intermédiaire, ne pas extraire maintenant
            log('[Download] 📦 Partie intermédiaire téléchargée (partie ' + currentPart + '/' + totalParts + '), extraction différée')
            
            // Envoyer un événement pour indiquer que cette partie est terminée
            const allWindows = BrowserWindow.getAllWindows()
            allWindows.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:part-completed', {
                  gameId: gameId,
                  gameName: gameName,
                  currentPart: currentPart,
                  totalParts: totalParts,
                  filePath: filePath
                })
                log('[Download] 📤 Événement download:part-completed envoyé')
              }
            })
            
            // Ne pas réinitialiser activeDownload, on attend les autres parties
            return
          }
          
          // C'est soit un téléchargement simple, soit la dernière partie d'un multi-parties
          log('[Extract] 📦 Démarrage de l\'extraction pour:', gameName)
          if (isMultiPart) {
            log('[Extract] 📦 C\'est la dernière partie, extraction de toutes les parties...')
          }
          
          // 🛡️ PROTECTION CONTRE LES EXTRACTIONS EN DOUBLE
          const extractionKey = `${gameName}-${filePath}`
          if (extractingGames.has(extractionKey)) {
            log('[Extract] ⚠️ Extraction déjà en cours pour ce jeu, on ignore cette tentative')
            return
          }
          extractingGames.add(extractionKey)
          log('[Extract] 🔒 Extraction verrouillée pour:', extractionKey)
          
          // ⏳ Attendre un court délai pour s'assurer que le fichier est complètement libéré
          log('[Extract] ⏳ Attente de la libération complète du fichier...')
          await new Promise(resolve => setTimeout(resolve, 1000)) // Augmenter à 1 seconde
          
          // Envoyer notification que l'extraction commence à toutes les fenêtres
          const allWindows = BrowserWindow.getAllWindows()
          allWindows.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('extraction-started', {
                gameId: gameId,
                gameName: gameName
              })
              log('[Extract] 📤 Événement extraction-started envoyé')
            }
          })
          
          try {
            const extractor = await getGameExtractor()
            
            // Extraire l'archive
            const extractResult = await extractor.extractAndMarkGame(
              filePath, 
              destFolder, 
              gameName, 
              webContents || (mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null)
            )
            const gameFolder = extractResult.gameFolder || extractResult // Compatibilité avec ancien format
            const exePath = extractResult.exePath || null
            log('[Extract] ✅ Installation terminée:', gameFolder)
            if (exePath) {
              log('[Extract] ✅ Exécutable trouvé:', exePath)
            }
            
            // Invalider le cache pour forcer un nouveau scan
            scanCache.lastScan = 0
            
            // Notifier le renderer - envoyer à toutes les fenêtres
            const allWindowsComplete = BrowserWindow.getAllWindows()
            allWindowsComplete.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:complete', {
                  gameId: gameId,
                  gameName: gameName,
                  success: true,
                  folder: gameFolder,
                  filePath: filePath,
                  exePath: exePath // Ajouter l'exePath trouvé
                })
                log('[Extract] 📤 Événement download:complete envoyé')
              }
            })
            
            // Réinitialiser
            if (activeDownload) activeDownload = null
            log('[Download] Téléchargement actif réinitialisé')
            
          } catch (extractError) {
            errorLog('[Extract] ❌ Erreur:', extractError)
            
            // Envoyer l'erreur à toutes les fenêtres
            const allWindowsError = BrowserWindow.getAllWindows()
            allWindowsError.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:extraction-failed', {
                  gameId: gameId,
                  gameName: gameName,
                  error: extractError.message || 'Erreur inconnue lors de l\'extraction'
                })
                win.webContents.send('download:error', {
                  gameId: gameId,
                  gameName: gameName,
                  error: `Erreur d'extraction: ${extractError.message || 'Erreur inconnue'}`
                })
                log('[Extract] 📤 Événement download:error envoyé')
              }
            })
            
            // Réinitialiser même en cas d'erreur
            if (activeDownload) activeDownload = null
          } finally {
            // Toujours retirer de la liste des extractions en cours
            extractingGames.delete(extractionKey)
            log('[Extract] 🔓 Verrou d\'extraction libéré pour:', extractionKey)
          }
        } else {
          log('[Download] ⚠️ Fichier non-archive téléchargé, en attente de l\'archive...')
          log('[Download]   - isArchive:', isArchive)
          log('[Download]   - Extension:', fileExtension)
          log('[Download]   - info:', activeDownload)
          // NE PAS réinitialiser activeDownload, on attend le vrai fichier
        }
      } else {
        errorLog('[Download] ❌ Échec:', state)
        
        // Envoyer l'erreur à toutes les fenêtres
        const allWindowsFail = BrowserWindow.getAllWindows()
        allWindowsFail.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:error', {
              gameId: gameId,
              gameName: gameName,
              error: `Téléchargement échoué: ${state}`
            })
            log('[Download] 📤 Événement download:error envoyé')
          }
        })
        
        // Réinitialiser en cas d'échec
        if (activeDownload) activeDownload = null
      }
    })
  })

  log('Default session will-download handler set up')
}

/* ---------------- IPC: select folder ---------------- */
ipcMain.handle('download:selectFolder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
      properties: ['openDirectory'],
      title: 'Choisir le dossier de téléchargement'
    })
    if (result.canceled || !result.filePaths || !result.filePaths.length) return { success: false, canceled: true }
    return { success: true, folderPath: result.filePaths[0] }
  } catch (e) {
    errorLog('download:selectFolder error', e)
    return { success: false, error: e.message }
  }
})

/* ---------------- IPC: download-game (unified) ---------------- */
/**
 * Usage from renderer:
 * ipcRenderer.invoke('download-game', url, destinationPath, { preferPixelDrainApi: true })
 *
 * Behavior:
 * - if pixeldrain URL detected => download directly via API
 * - otherwise => load page in hiddenWindow and wait for webRequest detection (will-download will handle saving)
 */
ipcMain.handle('download-game', async (event, url, destinationPath = null, options = {}) => {
  const gameName = options.gameName || 'Game'
  const userStatus = options.userStatus || { isVip: false, isBoost: false } // Par défaut, utilisateur gratuit
  
  log('[Download] ============================================')
  log('[Download] 🚀 NOUVEAU TÉLÉCHARGEMENT')
  log('[Download] URL:', url)
  log('[Download] Jeu:', gameName)
  log('[Download] Dossier:', destinationPath)
  log('[Download] Statut utilisateur:', userStatus.isVip ? 'VIP' : (userStatus.isBoost ? 'BOOST' : 'GRATUIT'))
  log('[Download] ============================================')
  
  // 🎯 VÉRIFIER LE STATUT UTILISATEUR ET UTILISER LE LIEN LOCKR FIXE SI NÉCESSAIRE
  let finalUrl = url
  if (!userStatus.isVip && !userStatus.isBoost) {
    // Utilisateur gratuit : utiliser le lien Lockr fixe avec publicité
    const LOCKR_PUB_URL = 'https://lockr.net/W78Ec3TTz'
    log('[Download] 🔒 Utilisateur gratuit détecté, utilisation du lien Lockr fixe:', LOCKR_PUB_URL)
    finalUrl = LOCKR_PUB_URL
  } else {
    log('[Download] ✅ Utilisateur VIP/BOOST, lien direct utilisé')
  }
  
  const destFolder = path.resolve(destinationPath || app.getPath('downloads'))
  
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true })
    log('[Download] Dossier créé:', destFolder)
  }
  
  // 🎯 DÉFINIR LE TÉLÉCHARGEMENT ACTIF
  activeDownload = {
    gameId: options.gameId || null,
    gameName: gameName,
    folder: destFolder,
    url: finalUrl, // Utiliser finalUrl (peut être un lien Lockr)
    originalUrl: url, // Conserver l'URL originale pour référence
    timestamp: Date.now(),
    isMultiPart: options.isMultiPart || false,
    currentPart: options.currentPart || null,
    totalParts: options.totalParts || null
  }
  
  log('[Download] Téléchargement actif défini:', activeDownload)
  
  // Essayer d'abord le téléchargement universel (PixelDrain, BuzzHeavier, GoFile, Koyso, etc.)
  // Note: Si c'est un lien Lockr, on passe par le flux générique pour gérer les publicités
  try {
    const provider = detectProvider(finalUrl)
    if (provider !== 'unknown' && finalUrl === url) {
      // Seulement si ce n'est pas un lien Lockr et que le provider est supporté
      log('[Download] Provider supporté détecté:', provider, '- utilisation du téléchargement universel')
      const result = await universalDownload(finalUrl, destinationPath)
      log('[Download] ✅ Téléchargement universel réussi')
      return result
    } else if (finalUrl !== url) {
      log('[Download] 🔒 Lien Lockr détecté, utilisation du flux générique pour gérer les publicités')
    }
  } catch (e) {
    errorLog('[Download] ❌ Téléchargement universel échoué, passage au flux générique:', e.message)
    // Continue avec le flux générique si le téléchargement universel échoue
    // Ne pas réinitialiser activeDownload ici car le téléchargement peut encore démarrer via will-download
  }

  // Generic hidden-window flow (nécessaire pour Lockr qui affiche des publicités)
  return new Promise(async (resolve, reject) => {
    try {
      if (!hiddenWindow || hiddenWindow.isDestroyed()) createHiddenWindow()
      log('Preparing hiddenWindow pending context')

      // mark pending
      hiddenWindow._pendingDownload = {
        active: true,
        destinationPath: destinationPath || null,
        resolve: (res) => {
          try { hiddenWindow._pendingDownload = null } catch(e) {}
          resolve(res)
        },
        reject: (err) => {
          try { hiddenWindow._pendingDownload = null } catch(e) {}
          reject(err)
        }
      }

      // load URL (peut être un lien Lockr avec publicités)
      log('HiddenWindow loading URL (background):', finalUrl)
      await hiddenWindow.loadURL(finalUrl)

      // allow site JS to generate links (small delay)
      log('Waiting for site JS to generate download links...')
      try { 
        await hiddenWindow.webContents.executeJavaScript('new Promise(r=>setTimeout(r,2500))', true) 
        log('Wait completed, checking for download links...')
      } catch(e) { 
        log('executeJavaScript short wait failed', e) 
      }
      
      // Also try to extract download links from the page
      try {
        const pageContent = await hiddenWindow.webContents.executeJavaScript(`
          (function() {
            const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
            const scripts = Array.from(document.scripts).map(s => s.textContent).join(' ');
            return { links: links.slice(0, 20), hasDownloadInScripts: scripts.toLowerCase().includes('download') };
          })()
        `, true)
        log('Page analysis:', JSON.stringify(pageContent, null, 2))
      } catch (e) {
        log('Page analysis failed:', e)
      }

      // wait for detection up to timeoutMs (augmenté pour les sites qui prennent du temps)
      const timeoutMs = options.timeoutMs || 30000
      const start = Date.now()
      const interval = setInterval(() => {
        const ctx = hiddenWindow && hiddenWindow._pendingDownload
        if (!ctx) {
          clearInterval(interval)
          log('Hidden pending context cleared (probably handled)')
          return
        }
        if (!ctx.active) {
          clearInterval(interval)
          log('Hidden pending context marked inactive (handled)')
          return
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval)
          try { ctx.active = false } catch(e) {}
          hiddenWindow._pendingDownload = null
          errorLog('download-game timeout: no download detected automatically')
          // signal renderer to consider visible mode
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download:requires-visible-interaction', { url })
          }
          // Ne PAS réinitialiser activeDownload ici car le téléchargement peut avoir démarré via downloadURL()
          // activeDownload sera réinitialisé dans le handler 'done' du téléchargement
          reject(new Error('Aucun lien de téléchargement détecté (timeout). Essaie avec showWindowForCaptcha = true.'))
        }
      }, 500)

    } catch (err) {
      try { if (hiddenWindow) hiddenWindow._pendingDownload = null } catch(e) {}
      errorLog('download-game generic flow error', err)
      // Ne PAS réinitialiser activeDownload ici car le téléchargement peut avoir démarré via downloadURL()
      // activeDownload sera réinitialisé dans le handler 'done' du téléchargement
      reject(err)
    }
  })
})

/* ---------------- IPC: pause/resume/cancel download ---------------- */
ipcMain.handle('download:pause', async (event, gameId) => {
  try {
    if (activeDownload && activeDownload.downloadItem) {
      const item = activeDownload.downloadItem
      if (!item.isDestroyed() && !item.isPaused()) {
        item.pause()
        log('[Download] Téléchargement mis en pause pour:', activeDownload.gameName)
        return { success: true }
      }
    }
    return { success: false, error: 'Aucun téléchargement actif ou déjà en pause' }
  } catch (err) {
    errorLog('download:pause error', err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('download:resume', async (event, gameId) => {
  try {
    if (activeDownload && activeDownload.downloadItem) {
      const item = activeDownload.downloadItem
      if (!item.isDestroyed() && item.isPaused()) {
        item.resume()
        log('[Download] Téléchargement repris pour:', activeDownload.gameName)
        return { success: true }
      }
    }
    return { success: false, error: 'Aucun téléchargement actif ou pas en pause' }
  } catch (err) {
    errorLog('download:resume error', err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('download:cancel', async (event, gameId) => {
  try {
    if (activeDownload && activeDownload.downloadItem) {
      const item = activeDownload.downloadItem
      if (!item.isDestroyed()) {
        item.cancel()
        log('[Download] Téléchargement annulé pour:', activeDownload.gameName)
        
        // Notifier toutes les fenêtres
        const allWindows = BrowserWindow.getAllWindows()
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:cancelled', {
              gameId: activeDownload.gameId,
              gameName: activeDownload.gameName
            })
          }
        })
        
        // Réinitialiser activeDownload
        activeDownload = null
        return { success: true }
      }
    }
    return { success: false, error: 'Aucun téléchargement actif' }
  } catch (err) {
    errorLog('download:cancel error', err)
    return { success: false, error: err.message }
  }
})

// Cache pour éviter les scans trop fréquents
let scanCache = {
  games: [],
  lastScan: 0,
  cacheDuration: 5000 // Cache de 5 secondes
}

/* ---------------- IPC: scan installed games ---------------- */
ipcMain.handle('scan-installed-games', async (event, gamesFolder = null, forceRefresh = false) => {
  try {
    // Vérifier le cache pour éviter les scans trop fréquents (sauf si forceRefresh)
    const now = Date.now()
    if (!forceRefresh && scanCache.lastScan > 0 && (now - scanCache.lastScan) < scanCache.cacheDuration) {
      // Log réduit pour éviter le spam
      return { success: true, games: scanCache.games }
    }
    
    // Log uniquement si scan forcé
    if (forceRefresh) {
      log('[Scan] 🔍 Scan forcé')
    }
    
    // Si aucun dossier spécifié, scanner plusieurs emplacements possibles
    const foldersToScan = []
    
    if (gamesFolder) {
      foldersToScan.push(gamesFolder)
    } else {
      // Scanner les emplacements par défaut
      foldersToScan.push(app.getPath('downloads'))
      foldersToScan.push(app.getPath('documents')) // Scanner Documents directement aussi
      foldersToScan.push(app.getPath('pictures')) // Scanner Pictures aussi (certains jeux peuvent être installés là)
      foldersToScan.push(path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'))
      foldersToScan.push(path.join(app.getPath('documents'), 'Games'))
    }
    
    const allInstalledGames = []
    
    for (const folder of foldersToScan) {
      if (fs.existsSync(folder)) {
        const extractor = await getGameExtractor()
        const games = extractor.scanInstalledGames(folder)
        allInstalledGames.push(...games)
      }
    }
    
    // Mettre à jour le cache
    scanCache.games = allInstalledGames
    scanCache.lastScan = now
    
    // Log uniquement si des jeux ont été trouvés ou si scan forcé
    if (allInstalledGames.length > 0 || forceRefresh) {
      log('[Scan] ✅', allInstalledGames.length, 'jeux trouvés')
    }
    return { success: true, games: allInstalledGames }
  } catch (error) {
    errorLog('[Scan] Erreur lors du scan:', error)
    return { success: false, error: error.message, games: [] }
  }
})

/* ---------------- IPC: check file exists ---------------- */
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

/* ---------------- IPC: find game exe ---------------- */
ipcMain.handle('games:findGameExe', async (event, gameFolder, gameName) => {
  try {
    log('[Games] Recherche du .exe pour:', gameName, 'dans:', gameFolder)
    
    if (!fs.existsSync(gameFolder)) {
      return { success: false, error: 'Dossier du jeu introuvable' }
    }

    // 🎯 D'abord, vérifier si l'exécutable est stocké dans le marqueur
    const markerPath = path.join(gameFolder, '.crklauncher')
    if (fs.existsSync(markerPath)) {
      try {
        const gameData = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
        if (gameData.executable && fs.existsSync(gameData.executable)) {
          log('[Games] .exe trouvé dans le marqueur:', gameData.executable)
          return { success: true, exePath: gameData.executable }
        }
      } catch (markerError) {
        log('[Games] Erreur lecture marqueur, recherche manuelle...')
      }
    }

    // Si pas dans le marqueur, chercher manuellement
    const files = fs.readdirSync(gameFolder, { withFileTypes: true })
    
    // Chercher un .exe avec le nom du jeu ou un nom générique
    const exeFiles = files
      .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.exe'))
      .map(f => path.join(gameFolder, f.name))
    
    // Priorité: nom du jeu, puis noms génériques
    const gameNameLower = gameName.toLowerCase().replace(/\s+/g, '')
    let exePath = null
    
    // 1. Chercher un .exe avec le nom du jeu
    exePath = exeFiles.find(exe => {
      const exeName = path.basename(exe, '.exe').toLowerCase().replace(/\s+/g, '')
      return exeName === gameNameLower || exeName.includes(gameNameLower) || gameNameLower.includes(exeName)
    })
    
    // 2. Si pas trouvé, chercher des noms génériques
    if (!exePath) {
      const genericNames = ['game', 'launcher', 'start', 'run', 'play']
      exePath = exeFiles.find(exe => {
        const exeName = path.basename(exe, '.exe').toLowerCase()
        return genericNames.some(gen => exeName.includes(gen))
      })
    }
    
    // 3. Si toujours pas trouvé, prendre le premier .exe (sauf ceux à ignorer)
    if (!exePath && exeFiles.length > 0) {
      const ignored = ['uninstall', 'setup', 'installer', 'updater', 'crashhandler', 'crashreporter']
      exePath = exeFiles.find(exe => {
        const exeName = path.basename(exe, '.exe').toLowerCase()
        return !ignored.some(ign => exeName.includes(ign))
      }) || exeFiles[0]
    }
    
    if (exePath) {
      log('[Games] .exe trouvé:', exePath)
      return { success: true, exePath }
    } else {
      log('[Games] Aucun .exe trouvé dans:', gameFolder)
      return { success: false, error: 'Aucun fichier .exe trouvé' }
    }
  } catch (error) {
    errorLog('[Games] Erreur lors de la recherche du .exe:', error)
    return { success: false, error: error.message }
  }
})

/* ---------------- IPC: launch game with ads check ---------------- */
ipcMain.handle('games:launchGameWithAds', async (event, exePath, gameName, userStatus) => {
  try {
    log('[Games] 🚀 Lancement du jeu avec vérification pub:', exePath, gameName)
    
    // Charger le service de publicités
    const adsService = await getAdsService()
    
    // Vérifier le statut utilisateur
    const userStatusObj = userStatus || { isVip: false, isBoost: false }
    const shouldShowAds = adsService.shouldShowAds(userStatusObj)
    
    log('[Games] Statut utilisateur:', userStatusObj.isVip ? 'VIP' : (userStatusObj.isBoost ? 'BOOST' : 'MEMBRE'))
    log('[Games] Afficher pub?', shouldShowAds)
    
    if (shouldShowAds) {
      // Utilisateur membre → afficher la pub
      log('[Games] 📺 Ouverture de la publicité...')
      const adsUrl = adsService.getAdsUrl(gameName)
      shell.openExternal(adsUrl)
      
      // Vérifier périodiquement si la pub est validée
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
          try {
            const userId = userStatusObj?.id || null
            const isValidated = await adsService.checkAdsValidation(userId)
            
            if (isValidated) {
              clearInterval(checkInterval)
              log('[Games] ✅ Publicité validée, ouverture de la page de redirection...')
              
              // Ouvrir la page de redirection (utilise le protocole personnalisé actoris://)
              // Essayer de trouver le gameId depuis le cache de scan ou les jeux installés
              let gameIdForRedirect = null
              if (scanCache.games && scanCache.games.length > 0) {
                const foundGame = scanCache.games.find(g => {
                  const normalizeName = (name) => name ? name.toLowerCase().trim().replace(/\s+/g, ' ') : ''
                  const normalizedGameName = normalizeName(gameName)
                  const normalizedInstalledName = normalizeName(g.gameName || g.name || '')
                  return normalizedInstalledName === normalizedGameName || 
                         normalizedInstalledName.includes(normalizedGameName) ||
                         normalizedGameName.includes(normalizedInstalledName)
                })
                if (foundGame && foundGame.launcherId) {
                  gameIdForRedirect = foundGame.launcherId
                  log('[Games] ✅ gameId trouvé depuis le cache:', gameIdForRedirect)
                }
              }
              const redirectUrl = adsService.getRedirectUrl(gameName, exePath, gameIdForRedirect)
              
              // Si c'est un protocole personnalisé, l'utiliser directement
              if (redirectUrl.startsWith('actoris://')) {
                handleProtocolUrl(redirectUrl)
              } else {
                // Sinon, ouvrir dans le navigateur (pour les fichiers locaux)
                shell.openExternal(redirectUrl)
              }
              
              // Lancer le jeu après un court délai
              setTimeout(async () => {
                try {
                  await launchGameDirectly(exePath)
                  resolve({ success: true, message: 'Jeu lancé après validation de la pub' })
                } catch (err) {
                  reject(err)
                }
              }, 2000) // Attendre 2 secondes avant de lancer le jeu
            }
          } catch (err) {
            errorLog('[Games] Erreur lors de la vérification de validation:', err)
            // Ne pas rejeter, continuer à vérifier
          }
        }, 3000) // Vérifier toutes les 3 secondes
        
        // Timeout après 5 minutes (300 secondes)
        setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('Timeout: La publicité n\'a pas été validée dans les temps'))
        }, 300000) // 5 minutes
      })
    } else {
      // Utilisateur VIP ou Boost → lancer directement
      log('[Games] ✅ Utilisateur VIP/Boost, lancement direct')
      return await launchGameDirectly(exePath)
    }
  } catch (error) {
    errorLog('[Games] Erreur lors du lancement avec pub:', error)
    throw error
  }
})

/**
 * Fonction utilitaire pour lancer un jeu directement
 * @param {string} exePath - Chemin de l'exécutable
 * @returns {Promise<object>}
 */
async function launchGameDirectly(exePath) {
  if (!exePath) {
    throw new Error('Le chemin de l\'exécutable est vide')
  }
  
  if (!fs.existsSync(exePath)) {
    throw new Error('Le fichier exécutable est introuvable: ' + exePath)
  }
  
  // Obtenir le répertoire de travail (dossier contenant l'exe)
  const workingDirectory = path.dirname(exePath)
  const exeName = path.basename(exePath)
  
  log('[Games] 📁 Répertoire de travail:', workingDirectory)
  log('[Games] 📄 Exécutable:', exeName)
  
  // Utiliser spawn avec le bon working directory pour éviter l'erreur 0xc0000142
  // S'assurer que les chemins sont absolus et normalisés
  const absoluteExePath = path.resolve(exePath)
  const absoluteWorkingDir = path.resolve(workingDirectory)
  
  log('[Games] 🔍 Chemin absolu exe:', absoluteExePath)
  log('[Games] 🔍 Chemin absolu working dir:', absoluteWorkingDir)
  
  // Vérifier que le fichier existe toujours avec le chemin absolu
  if (!fs.existsSync(absoluteExePath)) {
    throw new Error('Le fichier exécutable est introuvable: ' + absoluteExePath)
  }
  
  // Vérifier que le working directory existe
  if (!fs.existsSync(absoluteWorkingDir)) {
    throw new Error('Le répertoire de travail est introuvable: ' + absoluteWorkingDir)
  }
  
  // Utiliser spawn directement avec le bon working directory
  return new Promise((resolve, reject) => {
    log('[Games] 🚀 Lancement avec spawn...')
    
    const gameProcess = spawn(absoluteExePath, [], {
      cwd: absoluteWorkingDir, // Définir le working directory
      detached: true, // Permettre au processus de continuer après la fermeture de l'app
      stdio: 'ignore', // Ignorer stdin, stdout, stderr
      shell: false // Ne pas utiliser le shell
    })
    
    // Vérifier si le processus a démarré correctement
    gameProcess.on('error', (error) => {
      errorLog('[Games] ❌ Erreur lors du lancement:', error)
      reject(error)
    })
    
    // Le processus a démarré, on considère que c'est un succès
    gameProcess.on('spawn', () => {
      log('[Games] ✅ Processus spawné (PID:', gameProcess.pid, ')')
      
      // Détacher le processus pour qu'il continue même si l'app se ferme
      gameProcess.unref()
      
      // Vérifier après un court délai si le processus est toujours actif
      setTimeout(() => {
        try {
          // Vérifier si le processus existe toujours (signal 0 = vérification uniquement)
          process.kill(gameProcess.pid, 0)
          log('[Games] ✅ Processus toujours actif après vérification')
          resolve({ success: true, pid: gameProcess.pid })
        } catch (checkErr) {
          // Le processus n'existe plus
          if (gameProcess.exitCode !== null) {
            errorLog('[Games] ❌ Le processus s\'est terminé immédiatement avec le code:', gameProcess.exitCode)
            reject(new Error(`Le jeu s'est terminé immédiatement avec le code ${gameProcess.exitCode}. Vérifiez les logs Windows pour plus de détails.`))
          } else {
            // Processus peut-être terminé mais exitCode pas encore disponible
            log('[Games] ⚠️ Processus peut-être terminé, mais on considère le lancement comme réussi')
            resolve({ success: true, pid: gameProcess.pid })
          }
        }
      }, 300) // Attendre 300ms pour vérifier
    })
    
    // Si le processus se ferme avec un code d'erreur, logger l'erreur
    gameProcess.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        errorLog('[Games] ❌ Le processus s\'est terminé avec le code:', code, 'signal:', signal)
      }
    })
  })
}

/* ---------------- IPC: launch game (ancien handler, conservé pour compatibilité) ---------------- */
ipcMain.handle('games:launchGame', async (event, exePath) => {
  try {
    log('[Games] 🚀 Lancement du jeu (ancien handler):', exePath)
    return await launchGameDirectly(exePath)
  } catch (error) {
    errorLog('[Games] Erreur lors du lancement du jeu:', error)
    throw error
  }
})

/* ---------------- IPC: shell openPath ---------------- */
ipcMain.handle('shell:openPath', async (event, filePath) => {
  try {
    await shell.openPath(filePath)
    return { success: true }
  } catch (error) {
    errorLog('[Shell] Erreur lors de l\'ouverture du chemin:', error)
    throw error
  }
})

/**
 * Tuer les processus du jeu avant la désinstallation
 */
async function killGameProcesses(gameFolder) {
  log('[Uninstall] 🔍 Recherche de processus actifs...')
  
  const execPromise = promisify(exec)

  try {
    // Lister tous les .exe dans le dossier du jeu
    const exeFiles = []
    
    function findExeFiles(dir) {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true })
        
        for (const file of files) {
          const fullPath = path.join(dir, file.name)
          
          if (file.isDirectory()) {
            findExeFiles(fullPath)
          } else if (file.name.toLowerCase().endsWith('.exe')) {
            exeFiles.push(file.name)
          }
        }
      } catch (err) {
        // Ignorer les erreurs de lecture
      }
    }

    findExeFiles(gameFolder)

    if (exeFiles.length === 0) {
      log('[Uninstall] Aucun .exe trouvé')
      return
    }

    log('[Uninstall] .exe trouvés:', exeFiles)

    // Tuer chaque processus
    for (const exeName of exeFiles) {
      try {
        await execPromise(`taskkill /F /IM "${exeName}" /T`)
        log(`[Uninstall] ✅ Processus ${exeName} terminé`)
      } catch (err) {
        // Le processus n'est probablement pas en cours d'exécution
        log(`[Uninstall] ℹ️ Processus ${exeName} non actif`)
      }
    }
  } catch (err) {
    log('[Uninstall] ⚠️ Erreur lors de la recherche de processus:', err.message)
  }
}

/**
 * Suppression forcée avec commande système
 */
async function forceDeleteFolder(folderPath) {
  const execPromise = promisify(exec)

  log('[Uninstall] 🔨 Suppression forcée avec rmdir...')

  // Utiliser la commande Windows rmdir /s /q
  const command = process.platform === 'win32'
    ? `rmdir /s /q "${folderPath}"`
    : `rm -rf "${folderPath}"`

  try {
    await execPromise(command)
    log('[Uninstall] ✅ Suppression forcée réussie')
  } catch (err) {
    errorLog('[Uninstall] ❌ Échec suppression forcée:', err)
    throw err
  }
}

/* ---------------- IPC: uninstall game ---------------- */
ipcMain.handle('games:uninstallGame', async (event, gameName) => {
  try {
    log('[Uninstall] 🗑️ Désinstallation de:', gameName)
    
    let gameFolder = null
    
    // Fonction de normalisation pour supprimer les caractères spéciaux
    const normalizeName = (name) => {
      if (!name) return ''
      return name
        .toLowerCase()
        .trim()
        .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // Supprimer les symboles spéciaux
        .replace(/[^\x20-\x7E]/g, '') // Supprimer tous les caractères non-ASCII
        .replace(/\s+/g, ' ') // Collapser les espaces multiples
        .replace(/[^a-z0-9\s]/g, '') // Supprimer tous les caractères non alphanumériques
        .trim()
    }
    
    // 🔍 MÉTHODE 1 : Chercher dans le cache de scan (plus fiable)
    if (scanCache.games && scanCache.games.length > 0) {
      log('[Uninstall] 🔍 Recherche dans le cache de scan...')
      const normalizedGameName = normalizeName(gameName)
      
      for (const installedGame of scanCache.games) {
        const installedGameName = normalizeName(installedGame.gameName || installedGame.name || '')
        // Correspondance exacte ou partielle
        if ((installedGameName === normalizedGameName || 
             installedGameName.includes(normalizedGameName) ||
             normalizedGameName.includes(installedGameName)) && 
            installedGame.gameFolder) {
          gameFolder = installedGame.gameFolder
          log('[Uninstall] 📁 Jeu trouvé dans le cache:', gameFolder)
          break
        }
      }
    }
    
    // 🔍 MÉTHODE 2 : Si pas trouvé dans le cache, chercher dans les dossiers
    if (!gameFolder) {
      log('[Uninstall] 🔍 Recherche dans les dossiers...')
      
      // Normaliser le nom du jeu (enlever "-AnkerGames" ou "-Anker")
      const normalizedName = gameName.replace(/-AnkerGames?$/i, '').trim()
      const nameVariants = [gameName, normalizedName]
      
      const foldersToScan = [
        app.getPath('downloads'),
        app.getPath('documents'),
        app.getPath('pictures'), // Scanner Pictures aussi
        path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'),
        path.join(app.getPath('documents'), 'Games')
      ]
      
      for (const folder of foldersToScan) {
        if (!fs.existsSync(folder)) continue
        
        // Essayer avec chaque variante du nom
        for (const nameVariant of nameVariants) {
          const gamePath = path.join(folder, nameVariant)
          const markerPath = path.join(gamePath, '.crklauncher')
          
          log(`[Uninstall] 🔍 Vérification: ${gamePath}`)
          
          if (fs.existsSync(markerPath)) {
            try {
              const gameData = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
              const markerGameName = normalizeName(gameData.gameName || '')
              const searchGameName = normalizeName(gameName)
              
              // Correspondance exacte ou partielle
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
        
        // Vérifier aussi dans tous les sous-dossiers
        try {
          const subfolders = fs.readdirSync(folder, { withFileTypes: true })
          for (const subfolder of subfolders) {
            if (subfolder.isDirectory()) {
              const subGamePath = path.join(folder, subfolder.name)
              const subMarkerPath = path.join(subGamePath, '.crklauncher')
              
              if (fs.existsSync(subMarkerPath)) {
                try {
                  const gameData = JSON.parse(fs.readFileSync(subMarkerPath, 'utf8'))
                  const markerGameName = normalizeName(gameData.gameName || '')
                  const searchGameName = normalizeName(gameName)
                  
                  // Correspondance exacte ou partielle
                  if (markerGameName === searchGameName ||
                      markerGameName.includes(searchGameName) ||
                      searchGameName.includes(markerGameName)) {
                    gameFolder = subGamePath
                    log('[Uninstall] 📁 Jeu trouvé dans sous-dossier:', gameFolder)
                    break
                  }
                } catch (err) {
                  // Ignorer les erreurs de lecture
                }
              }
            }
          }
        } catch (err) {
          // Ignorer les erreurs de lecture
        }
        
        if (gameFolder) break
      }
    }
    
    if (!gameFolder || !fs.existsSync(gameFolder)) {
      // Si le dossier n'existe pas, vérifier s'il a peut-être déjà été supprimé
      // En cherchant dans le cache de scan pour voir s'il était là avant
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
      
      // Si le cache a été invalidé (lastScan = 0) ou si le scan a trouvé 0 jeux,
      // c'est probablement parce que le jeu a déjà été supprimé
      const cacheWasCleared = scanCache.lastScan === 0
      const noGamesInCache = !scanCache.games || scanCache.games.length === 0
      
      if (wasInCache || cacheWasCleared || noGamesInCache) {
        // Le jeu était dans le cache mais le dossier n'existe plus
        // OU le cache a été invalidé (probablement après une désinstallation précédente)
        // OU il n'y a plus de jeux dans le cache (tous supprimés)
        // Il a probablement déjà été supprimé, considérer comme succès
        log('[Uninstall] ℹ️ Le dossier n\'existe plus - considéré comme déjà supprimé', 
            wasInCache ? '(était dans le cache)' : 
            cacheWasCleared ? '(cache invalidé)' : 
            '(aucun jeu dans le cache)')
        
        // Invalider le cache et envoyer l'événement
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
      
      // Si vraiment aucun indice que le jeu a été supprimé, lancer une erreur
      throw new Error('Jeu non trouvé')
    }
    
    // 🔒 Fermer tous les processus liés au jeu
    await killGameProcesses(gameFolder)
    
    // ⏳ Attendre 1 seconde que les fichiers se déverrouillent
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 🗑️ Utiliser directement la méthode alternative (rmdir /s /q) qui fonctionne mieux
    let deleted = false
    
    // Vérifier d'abord si le dossier existe
    if (!fs.existsSync(gameFolder)) {
      log('[Uninstall] ℹ️ Le dossier n\'existe plus, considéré comme supprimé')
      deleted = true
    } else {
      try {
        log('[Uninstall] 🔨 Suppression avec méthode alternative (rmdir /s /q)...')
        await forceDeleteFolder(gameFolder)
        
        // Attendre un peu pour que Windows libère les ressources
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Vérifier que le dossier a bien été supprimé
        if (!fs.existsSync(gameFolder)) {
          deleted = true
          log('[Uninstall] ✅ Suppression réussie avec méthode alternative')
        } else {
          // Le dossier existe encore, mais peut-être qu'il est en cours de suppression
          // Attendre encore un peu et vérifier à nouveau
          log('[Uninstall] ⏳ Vérification après attente supplémentaire...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          if (!fs.existsSync(gameFolder)) {
            deleted = true
            log('[Uninstall] ✅ Suppression réussie avec méthode alternative (après attente)')
          } else {
            // Vérifier une dernière fois après un délai supplémentaire
            await new Promise(resolve => setTimeout(resolve, 1000))
            if (!fs.existsSync(gameFolder)) {
              deleted = true
              log('[Uninstall] ✅ Dossier supprimé (vérification finale)')
            } else {
              log('[Uninstall] ⚠️ Le dossier existe encore, mais la commande rmdir a été exécutée. Il sera peut-être supprimé par Windows plus tard.')
              // Considérer comme supprimé si la commande a réussi (Windows peut prendre du temps)
              // Vérifier une dernière fois après un délai plus long
              await new Promise(resolve => setTimeout(resolve, 3000))
              if (!fs.existsSync(gameFolder)) {
                deleted = true
                log('[Uninstall] ✅ Dossier supprimé après délai supplémentaire')
              } else {
                // Même si le dossier existe encore, la commande a été exécutée avec succès
                // Windows peut prendre du temps pour libérer les ressources
                deleted = true
                log('[Uninstall] ✅ Suppression considérée comme réussie (Windows libérera les ressources)')
              }
            }
          }
        }
      } catch (finalErr) {
        errorLog('[Uninstall] ❌ Erreur lors de la suppression alternative:', finalErr)
        // Vérifier une dernière fois si le dossier existe vraiment
        await new Promise(resolve => setTimeout(resolve, 1000))
        if (!fs.existsSync(gameFolder)) {
          deleted = true
          log('[Uninstall] ✅ Dossier supprimé malgré l\'erreur (vérification finale)')
        } else {
          throw new Error(`Impossible de supprimer le dossier. Le dossier est peut-être ouvert dans l'Explorateur ou utilisé par un autre programme. Fermez tous les programmes et réessayez.`)
        }
      }
    }
    
    // ✅ Si la suppression a réussi (même si le dossier existe encore mais la commande a été exécutée)
    if (deleted) {
      // 🗑️ Supprimer le raccourci sur le bureau si il existe
      try {
        const desktopPath = app.getPath('desktop')
        const shortcutPath = path.join(desktopPath, `${gameName}.lnk`)
        
        if (fs.existsSync(shortcutPath)) {
          fs.unlinkSync(shortcutPath)
          log('[Uninstall] 🗑️ Raccourci supprimé du bureau:', shortcutPath)
        } else {
          log('[Uninstall] ℹ️ Aucun raccourci trouvé sur le bureau pour:', gameName)
        }
      } catch (shortcutErr) {
        // Ne pas bloquer la désinstallation si la suppression du raccourci échoue
        log('[Uninstall] ⚠️ Erreur lors de la suppression du raccourci:', shortcutErr.message)
      }
      
      // Invalider le cache après désinstallation
      scanCache.lastScan = 0
      
      // Envoyer l'événement IMMÉDIATEMENT avant le scan pour que l'UI se mette à jour tout de suite
      const allWindows = BrowserWindow.getAllWindows()
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('game-uninstalled', {
            gameName: gameName
          })
          log('[Uninstall] 📤 Événement game-uninstalled envoyé (immédiat)')
        }
      })
      
      // Forcer un scan immédiatement après la désinstallation (en arrière-plan)
      // Ne pas attendre le résultat, juste mettre à jour le cache
      try {
        log('[Uninstall] 🔄 Déclenchement du scan des jeux installés...')
        const foldersToScan = [
          app.getPath('downloads'),
          app.getPath('documents'),
          app.getPath('pictures'), // Scanner Pictures aussi
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
        
        // Mettre à jour le cache
        scanCache.games = allInstalledGames
        scanCache.lastScan = Date.now()
        
        log('[Uninstall] ✅ Scan terminé,', allInstalledGames.length, 'jeux trouvés')
      } catch (scanErr) {
        log('[Uninstall] ⚠️ Erreur lors du scan après désinstallation:', scanErr.message)
        // Ne pas lancer d'erreur, le scan est juste pour mettre à jour le cache
      }
      
      // ✅ Retourner le succès même si le scan ne trouve plus le jeu (c'est normal après suppression)
      return { success: true, message: `${gameName} a été désinstallé avec succès` }
    } else {
      // Si la suppression n'a pas réussi, lancer une erreur
      throw new Error('Impossible de supprimer le dossier. Le dossier est peut-être ouvert dans l\'Explorateur ou utilisé par un autre programme.')
    }
  } catch (err) {
    errorLog('[Uninstall] ❌ Erreur:', err)
    return { success: false, error: err.message }
  }
})

/* ---------------- IPC: open game folder ---------------- */
ipcMain.handle('games:openGameFolder', async (event, gameName) => {
  try {
    log('[OpenFolder] Ouverture du dossier pour:', gameName)
    
    let gameFolder = null
    
    // 🔍 MÉTHODE 1 : Chercher dans le cache de scan (plus fiable)
    if (scanCache.games && scanCache.games.length > 0) {
      log('[OpenFolder] 🔍 Recherche dans le cache de scan...')
      const normalizedGameName = gameName.toLowerCase().trim()
      
      for (const installedGame of scanCache.games) {
        const installedGameName = (installedGame.gameName || '').toLowerCase().trim()
        if (installedGameName === normalizedGameName && installedGame.gameFolder) {
          gameFolder = installedGame.gameFolder
          log('[OpenFolder] 📁 Jeu trouvé dans le cache:', gameFolder)
          break
        }
      }
    }
    
    // 🔍 MÉTHODE 2 : Si pas trouvé dans le cache, chercher dans les dossiers
    if (!gameFolder) {
      log('[OpenFolder] 🔍 Recherche dans les dossiers...')
      
      // Normaliser le nom du jeu (enlever "-AnkerGames" ou "-Anker")
      const normalizedName = gameName.replace(/-AnkerGames?$/i, '').trim()
      const nameVariants = [gameName, normalizedName]
      
      const foldersToScan = [
        app.getPath('downloads'),
        app.getPath('documents'),
        app.getPath('pictures'), // Scanner Pictures aussi
        path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'),
        path.join(app.getPath('documents'), 'Games')
      ]
      
      for (const folder of foldersToScan) {
        if (!fs.existsSync(folder)) continue
        
        // Essayer avec chaque variante du nom
        for (const nameVariant of nameVariants) {
          const gamePath = path.join(folder, nameVariant)
          const markerPath = path.join(gamePath, '.crklauncher')
          
          if (fs.existsSync(markerPath)) {
            try {
              const gameData = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
              const markerGameName = (gameData.gameName || '').toLowerCase().trim()
              const searchGameName = gameName.toLowerCase().trim()
              
              if (markerGameName === searchGameName) {
                gameFolder = gamePath
                log('[OpenFolder] 📁 Jeu trouvé:', gameFolder)
                break
              }
            } catch (err) {
              // Ignorer les erreurs de lecture
            }
          }
        }
        
        if (gameFolder) break
        
        // Vérifier aussi dans tous les sous-dossiers
        try {
          const subfolders = fs.readdirSync(folder, { withFileTypes: true })
          for (const subfolder of subfolders) {
            if (subfolder.isDirectory()) {
              const subGamePath = path.join(folder, subfolder.name)
              const subMarkerPath = path.join(subGamePath, '.crklauncher')
              
              if (fs.existsSync(subMarkerPath)) {
                try {
                  const gameData = JSON.parse(fs.readFileSync(subMarkerPath, 'utf8'))
                  const markerGameName = (gameData.gameName || '').toLowerCase().trim()
                  const searchGameName = gameName.toLowerCase().trim()
                  
                  if (markerGameName === searchGameName) {
                    gameFolder = subGamePath
                    log('[OpenFolder] 📁 Jeu trouvé dans sous-dossier:', gameFolder)
                    break
                  }
                } catch (err) {
                  // Ignorer les erreurs de lecture
                }
              }
            }
          }
        } catch (err) {
          // Ignorer les erreurs de lecture
        }
        
        if (gameFolder) break
      }
    }
    
    if (!gameFolder || !fs.existsSync(gameFolder)) {
      throw new Error('Dossier non trouvé')
    }
    
    await shell.openPath(gameFolder)
    
    log('[OpenFolder] ✅ Dossier ouvert:', gameFolder)
    
    return { success: true }
  } catch (err) {
    errorLog('[OpenFolder] ❌ Erreur:', err)
    return { success: false, error: err.message }
  }
})

/* ---------------- IPC: créer un raccourci sur le bureau ---------------- */
ipcMain.handle('games:createDesktopShortcut', async (event, gameName, exePath) => {
  try {
    log('[Shortcut] Création d\'un raccourci pour:', gameName, exePath)
    
    if (!exePath || !fs.existsSync(exePath)) {
      throw new Error('Chemin de l\'exécutable invalide ou fichier introuvable')
    }
    
    const desktopPath = app.getPath('desktop')
    const shortcutPath = path.join(desktopPath, `${gameName}.lnk`)
    
    // Utiliser PowerShell pour créer le raccourci sur Windows
    if (process.platform === 'win32') {
      // Créer un script PowerShell temporaire pour éviter les problèmes d'échappement
      const tempScriptPath = path.join(app.getPath('temp'), `create-shortcut-${Date.now()}.ps1`)
      // Échapper correctement les chemins pour PowerShell (gérer les caractères spéciaux comme ®)
      const escapeForPowerShell = (str) => {
        return str
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '`"')
          .replace(/\$/g, '`$')
          .replace(/`/g, '``')
      }
      
      const escapedShortcutPath = escapeForPowerShell(shortcutPath)
      const escapedExePath = escapeForPowerShell(exePath)
      const escapedWorkingDir = escapeForPowerShell(path.dirname(exePath))
      const escapedGameName = escapeForPowerShell(gameName)
      
      const escapedIconPath = escapeForPowerShell(exePath) // Utiliser l'exe comme icône
      
      const scriptContent = `$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${escapedShortcutPath}")
$Shortcut.TargetPath = "${escapedExePath}"
$Shortcut.WorkingDirectory = "${escapedWorkingDir}"
$Shortcut.Description = "Lancer ${escapedGameName}"
$Shortcut.IconLocation = "${escapedIconPath},0"
$Shortcut.Save()
Write-Host "Shortcut created successfully"
`
      
      try {
        // Écrire le script dans un fichier temporaire
        fs.writeFileSync(tempScriptPath, scriptContent, 'utf8')
        
        // Exécuter le script PowerShell
        const execPromise = promisify(exec)
        await execPromise(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`)
        
        // Supprimer le fichier temporaire
        try {
          fs.unlinkSync(tempScriptPath)
        } catch (e) {
          // Ignorer les erreurs de suppression
        }
        
        // Vérifier que le fichier a bien été créé
        if (fs.existsSync(shortcutPath)) {
          log('[Shortcut] ✅ Raccourci créé:', shortcutPath)
          return { success: true, shortcutPath }
        } else {
          throw new Error('Le raccourci n\'a pas été créé (fichier introuvable après création)')
        }
      } catch (scriptErr) {
        // Nettoyer le fichier temporaire en cas d'erreur
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath)
          }
        } catch (e) {
          // Ignorer
        }
        throw scriptErr
      }
    } else {
      // Pour Linux/Mac, créer un fichier .desktop ou .app
      throw new Error('Création de raccourci non supportée sur cette plateforme')
    }
  } catch (err) {
    errorLog('[Shortcut] ❌ Erreur:', err)
    return { success: false, error: err.message }
  }
})

/* ---------------- Auto-updater ---------------- */

let autoUpdater = null

/**
 * Ferme tous les processus Actoris en cours d'exécution
 * Utilise taskkill sur Windows pour forcer la fermeture
 * Exclut le processus actuel (qui sera fermé par quitAndInstall)
 */
async function killAllActorisProcesses() {
  if (process.platform !== 'win32') {
    log('[Updater] Fermeture des processus non-Windows non implémentée')
    return
  }

  const execPromise = promisify(exec)
  const currentPid = process.pid
  const processNames = [
    'Actoris.exe',
    'Actoris-Setup.exe',
  ]

  // Ajouter le nom de l'exécutable actuel (sans le chemin)
  const currentExe = path.basename(process.execPath)
  if (currentExe && !processNames.includes(currentExe)) {
    processNames.push(currentExe)
  }

  log('[Updater] Recherche des processus Actoris (PID actuel:', currentPid, ')...')
  
  for (const processName of processNames) {
    try {
      // Lister tous les processus avec ce nom et leur PID
      const checkResult = await execPromise(`tasklist /FI "IMAGENAME eq ${processName}" /FO CSV /NH`)
      if (checkResult.stdout && checkResult.stdout.trim()) {
        const lines = checkResult.stdout.trim().split('\n')
        for (const line of lines) {
          if (!line || !line.includes(processName)) continue
          
          // Extraire le PID de la ligne CSV
          const csvFields = line.split(',')
          if (csvFields.length >= 2) {
            const pid = parseInt(csvFields[1].replace(/"/g, '').trim(), 10)
            
            // Ne pas fermer le processus actuel (il sera fermé par quitAndInstall)
            if (pid && pid !== currentPid) {
              log(`[Updater] Processus trouvé: ${processName} (PID: ${pid}), fermeture...`)
              try {
                // Fermer le processus avec taskkill /F (force) /T (tree - tous les processus enfants)
                await execPromise(`taskkill /F /PID ${pid} /T`)
                log(`[Updater] ✅ Processus ${processName} (PID: ${pid}) fermé`)
              } catch (killErr) {
                // Le processus peut ne pas exister ou être déjà fermé
                if (!killErr.message.includes('not found') && !killErr.message.includes('introuvable') && !killErr.message.includes('not running')) {
                  log(`[Updater] ⚠️ Erreur lors de la fermeture de ${processName} (PID: ${pid}):`, killErr.message)
                }
              }
            } else if (pid === currentPid) {
              log(`[Updater] Processus actuel détecté (PID: ${pid}), sera fermé par quitAndInstall`)
            }
          }
        }
      }
    } catch (checkErr) {
      // Le processus n'existe probablement pas, continuer
      if (!checkErr.message.includes('not found') && !checkErr.message.includes('introuvable')) {
        log(`[Updater] ⚠️ Erreur lors de la vérification de ${processName}:`, checkErr.message)
      }
    }
  }

  // Attendre un peu pour que les processus se ferment
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  log('[Updater] Fermeture des processus terminée')
}

async function initializeAutoUpdater() {
  if (isDev) return // Ne pas charger en développement
  
  try {
    // Charger electron-updater seulement en production
    const { autoUpdater: updater } = await import('electron-updater')
    autoUpdater = updater
    
    // Configuration de l'auto-updater
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    
    // Événements de l'auto-updater
    autoUpdater.on('checking-for-update', () => {
      log('[Updater] Vérification des mises à jour...')
    })
    
    autoUpdater.on('update-available', (info) => {
      log('[Updater] Mise à jour disponible:', info.version)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', info)
      }
    })
    
    autoUpdater.on('update-not-available', (info) => {
      log('[Updater] Aucune mise à jour disponible')
    })
    
    autoUpdater.on('error', (err) => {
      errorLog('[Updater] Erreur:', err)
    })
    
    autoUpdater.on('download-progress', (progressObj) => {
      const message = `Téléchargement: ${Math.round(progressObj.percent)}%`
      log('[Updater]', message)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', progressObj)
      }
    })
    
    autoUpdater.on('update-downloaded', async (info) => {
      log('[Updater] Mise à jour téléchargée:', info.version)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', info)
      }
      
      // Ne pas installer automatiquement, attendre que l'utilisateur clique sur "Installer"
      // L'installation sera déclenchée via le handler IPC 'updates:install'
      log('[Updater] Mise à jour prête, en attente de l\'action de l\'utilisateur')
    })
    
    // Vérifier les mises à jour au démarrage (après un délai)
    setTimeout(() => {
      if (autoUpdater) {
        autoUpdater.checkForUpdates().catch(err => {
          errorLog('[Updater] Erreur lors de la vérification:', err)
        })
      }
    }, 5000) // Attendre 5 secondes après le démarrage
  } catch (err) {
    errorLog('[Updater] Impossible de charger electron-updater:', err)
  }
}

/* ---------------- Serveur HTTP pour les confirmations ---------------- */
// Créer un serveur HTTP local pour recevoir les confirmations depuis le site web
function createConfirmationServer() {
  try {
    confirmationServer = http.createServer((req, res) => {
      // CORS headers pour permettre les requêtes depuis le site web
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }
      
      const url = new URL(req.url, `http://${req.headers.host}`)
      
      // Route pour confirmer le téléchargement
      if (url.pathname === '/confirm-download') {
        const gameName = url.searchParams.get('game')
        const gameId = url.searchParams.get('gameId')
        
        log('[Confirmation Server] ✅ Confirmation reçue:', { gameName, gameId })
        
        // Répondre immédiatement
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, message: 'Confirmation reçue' }))
        
        // Déclencher le téléchargement
        if (gameId || gameName) {
          setTimeout(() => {
            unlockGame(gameName, gameId)
          }, 100)
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      }
    })
    
    confirmationServer.listen(3001, 'localhost', () => {
      log('[Confirmation Server] ✅ Serveur HTTP démarré sur http://localhost:3001')
    })
    
    confirmationServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        log('[Confirmation Server] ⚠️ Le port 3001 est déjà utilisé, le serveur existe peut-être déjà')
      } else {
        errorLog('[Confirmation Server] ❌ Erreur:', err)
      }
    })
  } catch (err) {
    errorLog('[Confirmation Server] ❌ Erreur lors de la création du serveur:', err)
  }
}

/* ---------------- Protocole personnalisé actoris:// ---------------- */
// Enregistrer le protocole personnalisé pour ouvrir le launcher depuis le site web
function registerProtocol() {
  try {
    if (process.defaultApp || app.isPackaged) {
      const wasSet = app.setAsDefaultProtocolClient('actoris')
      if (wasSet) {
        log('[Protocol] ✅ Protocole actoris:// enregistré avec succès')
      } else {
        log('[Protocol] ⚠️ Le protocole actoris:// est déjà enregistré ou l\'enregistrement a échoué')
      }
    } else {
      // En développement, utiliser le chemin complet de l'exécutable
      const wasSet = app.setAsDefaultProtocolClient('actoris', process.execPath, [path.resolve(process.argv[1])])
      if (wasSet) {
        log('[Protocol] ✅ Protocole actoris:// enregistré avec succès (mode dev)')
      } else {
        log('[Protocol] ⚠️ Le protocole actoris:// est déjà enregistré ou l\'enregistrement a échoué (mode dev)')
      }
    }
  } catch (err) {
    errorLog('[Protocol] ❌ Erreur lors de l\'enregistrement du protocole:', err)
  }
}

// Enregistrer le protocole dès que possible
registerProtocol()

// Gérer l'ouverture du launcher via le protocole personnalisé
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleProtocolUrl(url)
})

// Sur Windows, utiliser second-instance pour gérer le protocole
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Si une autre instance est lancée, se concentrer sur la fenêtre principale
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }

  // Vérifier si une URL de protocole est passée en argument
  const protocolUrl = commandLine.find(arg => arg.startsWith('actoris://'))
  if (protocolUrl) {
    handleProtocolUrl(protocolUrl)
  }
})

// Fonction pour gérer les URLs du protocole personnalisé
function handleProtocolUrl(url) {
  try {
    log('[Protocol] URL reçue:', url)
    const urlObj = new URL(url)
    
    if (urlObj.protocol !== 'actoris:') {
      log('[Protocol] Protocole invalide:', urlObj.protocol)
      return
    }

    const gameName = urlObj.searchParams.get('game')
    const gameId = urlObj.searchParams.get('gameId')

    log('[Protocol] Jeu à débloquer:', gameName, gameId ? `(ID: ${gameId})` : '')

    // Si la fenêtre principale n'existe pas, la créer
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow().then(() => {
        // Attendre que la fenêtre soit prête avant de naviguer
        setTimeout(() => {
          unlockGame(gameName, gameId)
        }, 1000)
      })
    } else {
      // La fenêtre existe déjà, débloquer le jeu
      unlockGame(gameName, gameId)
    }
  } catch (err) {
    errorLog('[Protocol] Erreur lors du traitement de l\'URL:', err)
  }
}

// Fonction pour débloquer un jeu
async function unlockGame(gameName, gameId) {
  try {
    log('[Protocol] Déblocage du jeu:', gameName, gameId ? `(ID: ${gameId})` : '')
    
    // Mettre la fenêtre au premier plan
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.show()
    }
    
    // 🎯 NOUVEAU FLUX : Demander où télécharger et démarrer le téléchargement
    // Au lieu de juste naviguer vers la page, on demande directement où télécharger
    if (gameId && mainWindow && !mainWindow.isDestroyed()) {
      // Envoyer un événement pour demander où télécharger et démarrer le téléchargement
      mainWindow.webContents.send('protocol:start-download', { gameId, gameName })
      log('[Protocol] Démarrage du téléchargement via protocole:', gameId)
    } else if (gameName && mainWindow && !mainWindow.isDestroyed()) {
      // Si pas de gameId, naviguer vers la page pour que l'utilisateur puisse télécharger
      mainWindow.webContents.send('navigate-to-game', { gameName })
      log('[Protocol] Navigation vers la page du jeu (pas de gameId):', gameName)
    }
  } catch (err) {
    errorLog('[Protocol] Erreur lors du déblocage:', err)
  }
}

// Empêcher plusieurs instances (Windows)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

/* ---------------- app lifecycle ---------------- */
app.whenReady().then(async () => {
  // Ré-enregistrer le protocole au démarrage pour s'assurer qu'il est bien enregistré
  registerProtocol()
  
  // Initialiser l'auto-updater
  initializeAutoUpdater().catch(err => {
    errorLog('[Updater] Erreur lors de l\'initialisation:', err)
  })
  // Enregistrer seulement les handlers critiques au démarrage
  registerCriticalHandlers()
  
  // Créer et afficher la fenêtre principale immédiatement
  await createWindow()
  log('App ready')
  
  // Délayer toutes les autres opérations pour ne pas bloquer le démarrage
  setTimeout(() => {
    // Enregistrer tous les autres handlers
    registerAllHandlers()
    // Configurer la session de téléchargement
    setupDefaultSession()
    // Créer la fenêtre cachée
    createHiddenWindow()
    // Créer le serveur HTTP pour les confirmations
    createConfirmationServer()
  }, 500) // 500ms après le démarrage
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else if (!mainWindow) createWindow()
  })

  // Vérifier si l'app a été lancée via le protocole personnalisé
  if (process.platform === 'win32') {
    const protocolUrl = process.argv.find(arg => arg.startsWith('actoris://'))
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl)
    }
  }
})

// Suivre tous les processus enfants lancés
const childProcesses = new Set()

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Fermeture complète : tuer tous les processus enfants
app.on('before-quit', async (event) => {
  log('[App] Fermeture de l\'application, arrêt de tous les processus enfants...')
  
  // Fermer le serveur HTTP de confirmation
  if (confirmationServer) {
    try {
      confirmationServer.close(() => {
        log('[Confirmation Server] ✅ Serveur HTTP fermé')
      })
    } catch (err) {
      errorLog('[Confirmation Server] ❌ Erreur lors de la fermeture:', err)
    }
  }
  
  // Tuer tous les processus enfants
  for (const childProcess of childProcesses) {
    try {
      if (childProcess && !childProcess.killed) {
        log(`[App] Arrêt du processus enfant PID: ${childProcess.pid}`)
        childProcess.kill('SIGTERM')
        
        // Attendre un peu puis forcer si nécessaire
        setTimeout(() => {
          if (!childProcess.killed) {
            log(`[App] Forçage de l'arrêt du processus PID: ${childProcess.pid}`)
            childProcess.kill('SIGKILL')
          }
        }, 1000)
      }
    } catch (err) {
      errorLog(`[App] Erreur lors de l'arrêt du processus:`, err)
    }
  }
  
  // Tuer aussi les processus de jeux lancés
  try {
    const execPromise = promisify(exec)
    // Lister tous les processus liés aux jeux et les tuer
    // (Cette partie peut être étendue selon les besoins)
  } catch (err) {
    errorLog('[App] Erreur lors de la fermeture des processus de jeux:', err)
  }
  
  childProcesses.clear()
})

/* ---------------- export (optional) ---------------- */
export { downloadFromPixelDrainUrl }