// main.js (corrigé & logs ajoutés)
import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import https from 'node:https'
import http from 'node:http'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { extractAndMarkGame, scanInstalledGames } from './game-extractor.js'

/* --- IMPORTS DE SERVICE (laisse comme avant) --- */
import * as githubService from './github-service.js'
import * as steamService from './steam-service.js'
import * as gamesService from './games-service.js'
import * as discordService from './discord-service.js'
import * as websocketService from './websocket-service.js'

/* --- Utils chemins --- */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* --- Config dev / API URL --- */
const isDev = process.env.VITE_DEV_SERVER === 'true'
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

/* --- Small logger helper --- */
function log(...args) {
  console.log('[Main]', ...args)
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main:log', args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))))
    }
  } catch (e) {}
}
function errorLog(...args) { console.error('[Main]', ...args) }

/* ---------------- createWindow ---------------- */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b0b11',
    minWidth: 1200,
    minHeight: 720,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (isDev) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // En production, utiliser app.getAppPath() pour gérer correctement les archives asar
    const appPath = app.getAppPath()
    const indexPath = path.join(appPath, 'dist', 'index.html')
    log('Loading index.html from:', indexPath)
    // Vérifier que le fichier existe
    if (!fs.existsSync(indexPath)) {
      errorLog('index.html not found at:', indexPath)
      // Essayer avec __dirname comme fallback
      const fallbackPath = path.join(__dirname, '../dist/index.html')
      if (fs.existsSync(fallbackPath)) {
        log('Using fallback path:', fallbackPath)
        await mainWindow.loadFile(fallbackPath)
      } else {
        errorLog('index.html not found at fallback path either:', fallbackPath)
        throw new Error(`index.html not found. Tried: ${indexPath} and ${fallbackPath}`)
      }
    } else {
      await mainWindow.loadFile(indexPath)
    }
  }

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

/* ---------------- Basic IPC handlers (kept) ---------------- */
/* ... keep your github/steam/games/discord/websocket handlers exactly as before ... */
/* For brevity I will re-add only a few crucial ones here; keep the rest from your original file. */

/* ---------------- GitHub IPC handlers ---------------- */
ipcMain.handle('github:getUsers', async () => {
  try {
    log('github:getUsers called')
    const result = await githubService.getUsersFromGitHub()
    return result
  } catch (err) {
    errorLog('github:getUsers error', err)
    throw err
  }
})

ipcMain.handle('github:createUser', async (event, userData) => {
  try {
    log('github:createUser called')
    const result = await githubService.createUser(userData)
    return result
  } catch (err) {
    errorLog('github:createUser error', err)
    throw err
  }
})

ipcMain.handle('github:loginUser', async (event, email, password) => {
  try {
    log('github:loginUser called with email:', email)
    const result = await githubService.loginUser(email, password)
    return result
  } catch (err) {
    errorLog('github:loginUser error', err)
    throw err
  }
})

ipcMain.handle('github:findUser', async (event, email, username) => {
  try {
    const result = await githubService.findUser(email, username)
    return result
  } catch (err) {
    errorLog('github:findUser error', err)
    throw err
  }
})

ipcMain.handle('github:updateUser', async (event, email, updates) => {
  try {
    const result = await githubService.updateUser(email, updates)
    return result
  } catch (err) {
    errorLog('github:updateUser error', err)
    throw err
  }
})

ipcMain.handle('github:deleteUser', async (event, email) => {
  try {
    log('github:deleteUser called with email:', email)
    const result = await githubService.deleteUser(email)
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
    const result = await steamService.getSteamGameData(appId)
    return result
  } catch (err) {
    errorLog('steam:getGameData error', err)
    throw err
  }
})

/* ---------------- Games IPC handlers ---------------- */
ipcMain.handle('games:getGames', async () => {
  try {
    log('games:getGames called')
    const result = await gamesService.getGamesFromGitHub()
    log('games:getGames result:', result)
    log('games:getGames games count:', result?.games?.length || 0)
    return result
  } catch (err) {
    errorLog('games:getGames error', err)
    throw err
  }
})

ipcMain.handle('games:addGame', async (event, gameData) => {
  try {
    log('games:addGame called')
    const result = await gamesService.addGame(gameData)
    return result
  } catch (err) {
    errorLog('games:addGame error', err)
    throw err
  }
})

ipcMain.handle('games:deleteGame', async (event, gameId) => {
  try {
    log('games:deleteGame called with gameId:', gameId)
    const result = await gamesService.deleteGame(gameId)
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
    const result = await gamesService.updateGame(gameId, updates)
    log('games:updateGame success')
    return result
  } catch (err) {
    errorLog('games:updateGame error', err)
    throw err
  }
})

/* ---------------- Discord IPC handlers ---------------- */
ipcMain.handle('discord:getAuthUrl', async () => {
  try {
    log('discord:getAuthUrl called')
    const result = discordService.getDiscordAuthUrl()
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
    const result = await discordService.authenticateWithDiscord(code)
    log('discord:authenticate success')
    return result
  } catch (err) {
    errorLog('discord:authenticate error', err)
    throw err
  }
})

ipcMain.handle('discord:refreshToken', async (event, refreshToken) => {
  try {
    log('discord:refreshToken called')
    const result = await discordService.refreshDiscordToken(refreshToken)
    log('discord:refreshToken success')
    return result
  } catch (err) {
    errorLog('discord:refreshToken error', err)
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
        'User-Agent': 'Actoris-Launcher/1.0.5',
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

/* ---------------- WebSocket IPC handlers ---------------- */
ipcMain.handle('websocket:connect', async () => {
  try {
    log('websocket:connect called')
    // Le service utilise WS_URL depuis websocket-config.json
    websocketService.connectWebSocket(
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
      }
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
    websocketService.disconnectWebSocket()
    return { success: true }
  } catch (err) {
    errorLog('websocket:disconnect error', err)
    throw err
  }
})

ipcMain.handle('websocket:send', async (event, message) => {
  try {
    log('websocket:send called')
    const success = websocketService.sendWebSocketMessage(message)
    return { success }
  } catch (err) {
    errorLog('websocket:send error', err)
    throw err
  }
})

ipcMain.handle('websocket:isConnected', async () => {
  return websocketService.isWebSocketConnected()
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
          'User-Agent': 'Actoris-Launcher/1.0.5'
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

/* ---------------- App IPC handlers ---------------- */
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

/* ---------------- Universal Download Helpers ---------------- */

/**
 * Détecte le provider à partir de l'URL
 */
function detectProvider(url) {
  if (url.includes('pixeldrain.com')) return 'pixeldrain'
  if (url.includes('buzzheavier.com')) return 'buzzheavier'
  if (url.includes('gofile.io')) return 'gofile'
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
        'User-Agent': 'Actoris-Launcher/1.0.5',
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
 * Convertit une URL GoFile en lien de téléchargement direct
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
        const directURL = await convertGofile(url)
        log('[Downloader] Lien final à télécharger:', directURL)
        downloadDestinationPath = destinationPath || null
        session.defaultSession.downloadURL(directURL)
        return { success: true, downloadUrl: directURL, provider }
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
    const req = client.get(url, { headers: { 'User-Agent': 'Actoris-Launcher/1.0.0' } }, (res) => {
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

  hiddenWindow._pendingDownload = null

  // will-download on hiddenWindow session handled by defaultSession (we configure setupDefaultSession)
  hiddenWindow.webContents.on('did-fail-load', (e, errorCode, errorDesc, validatedURL) => {
    log('HiddenWindow did-fail-load', errorCode, errorDesc, validatedURL)
  })

      // Attach a global webRequest handler for the hiddenWindow's session.
      try {
        const filter = { urls: ['<all_urls>'] }
        hiddenWindow.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
          try {
            const ctx = hiddenWindow && hiddenWindow._pendingDownload
            if (!ctx || !ctx.active) {
              // Log all requests for debugging (only first few chars to avoid spam)
              if (details.url && details.url.length > 0) {
                const urlPreview = details.url.substring(0, 100)
                log('[Hidden webRequest] Request (no active context):', urlPreview)
              }
              return callback({ cancel: false })
            }

            const u = details.url
            const lower = u.toLowerCase()
            log('[Hidden webRequest] Checking URL:', u.substring(0, 150))
            
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
      destFolder = activeDownload.folder
      gameName = activeDownload.gameName
      
      // Stocker le chemin final pour l'extraction
      activeDownload.filePath = path.join(destFolder, fileName)
      activeDownload.fileName = fileName
    } else {
      log('  -> ⚠️ Aucun téléchargement actif')
    }
    
    const filePath = path.join(destFolder, fileName)
    log('  -> Full path:', filePath)
    
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
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            log('[Download] Pausé')
          } else {
            const received = item.getReceivedBytes()
            const total = item.getTotalBytes()
            const progress = total > 0 ? (received / total) : 0
            const progressPercent = Math.round(progress * 100)
            
            log(`[Download] Progression: ${progressPercent}% ${received} / ${total}`)
            
            // 🎯 Envoyer la progression au renderer avec le nom du jeu
            // Envoyer à TOUTES les fenêtres pour être sûr que l'événement arrive
            if (activeDownload && activeDownload.gameName) {
              const allWindows = BrowserWindow.getAllWindows()
              const progressData = {
                gameName: activeDownload.gameName,
                progress: progressPercent,
                received,
                total
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
            }
          }
        }
      } catch (e) { 
        errorLog('[Download] Error in updated handler:', e)
      }
    })

    item.once('done', async (e, state) => {
      const filePath = item.getSavePath()
      
      log('[Download] ============================================')
      log('[Download] État:', state)
      log('[Download] Fichier:', filePath)
      
      if (!activeDownload) {
        log('[Download] ⚠️ Aucune info de téléchargement disponible')
        return
      }
      
      log('[Download] Info récupérée:', activeDownload)
      
      if (state === 'completed') {
        log('[Download] ✅ Téléchargement terminé:', filePath)
        
        // 🎯 VÉRIFIER L'INTÉGRITÉ DU FICHIER
        try {
          const fileStats = fs.statSync(filePath)
          const downloadedSize = fileStats.size
          const expectedSize = item.getTotalBytes()
          
          log('[Download] Taille téléchargée:', downloadedSize, 'octets')
          log('[Download] Taille attendue:', expectedSize, 'octets')
          
          if (downloadedSize === 0) {
            errorLog('[Download] ❌ Le fichier est vide !')
            
            if (webContents && !webContents.isDestroyed()) {
              webContents.send('download:error', {
                gameName: activeDownload.gameName,
                error: 'Le fichier téléchargé est vide. Veuillez réessayer.'
              })
            } else if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download:error', {
                gameName: activeDownload.gameName,
                error: 'Le fichier téléchargé est vide. Veuillez réessayer.'
              })
            }
            
            activeDownload = null
            return
          }
          
          if (expectedSize > 0 && downloadedSize < expectedSize) {
            errorLog('[Download] ❌ Téléchargement incomplet !')
            errorLog('[Download]   Téléchargé:', downloadedSize, '/ Attendu:', expectedSize)
            
            if (webContents && !webContents.isDestroyed()) {
              webContents.send('download:error', {
                gameName: activeDownload.gameName,
                error: `Téléchargement incomplet: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(expectedSize / 1024 / 1024).toFixed(2)} MB. Veuillez réessayer.`
              })
            } else if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download:error', {
                gameName: activeDownload.gameName,
                error: `Téléchargement incomplet: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(expectedSize / 1024 / 1024).toFixed(2)} MB. Veuillez réessayer.`
              })
            }
            
            activeDownload = null
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
        log('[Download] Nom du jeu:', activeDownload.gameName)
        log('[Download] Dossier de destination:', activeDownload.folder)
        
        if (isArchive && activeDownload.gameName) {
          log('[Extract] 📦 Démarrage de l\'extraction pour:', activeDownload.gameName)
          
          // Envoyer notification que l'extraction commence à toutes les fenêtres
          const allWindows = BrowserWindow.getAllWindows()
          allWindows.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('extraction-started', {
                gameName: activeDownload.gameName
              })
              log('[Extract] 📤 Événement extraction-started envoyé')
            }
          })
          
          try {
            const gameFolder = await extractAndMarkGame(filePath, activeDownload.folder, activeDownload.gameName, webContents || (mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null))
            log('[Extract] ✅ Installation terminée:', gameFolder)
            
            // Invalider le cache pour forcer un nouveau scan
            scanCache.lastScan = 0
            
            // Notifier le renderer - envoyer à toutes les fenêtres
            const allWindowsComplete = BrowserWindow.getAllWindows()
            allWindowsComplete.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:complete', {
                  gameName: activeDownload.gameName,
                  success: true,
                  folder: gameFolder
                })
                log('[Extract] 📤 Événement download:complete envoyé')
              }
            })
            
            // Réinitialiser
            activeDownload = null
            log('[Download] Téléchargement actif réinitialisé')
            
          } catch (extractError) {
            errorLog('[Extract] ❌ Erreur:', extractError)
            
            // Envoyer l'erreur à toutes les fenêtres
            const allWindowsError = BrowserWindow.getAllWindows()
            allWindowsError.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:error', {
                  gameName: activeDownload.gameName,
                  error: `Erreur d'extraction: ${extractError.message}`
                })
                log('[Extract] 📤 Événement download:error envoyé')
              }
            })
            
            // Réinitialiser même en cas d'erreur
            activeDownload = null
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
        if (activeDownload) {
          const allWindowsFail = BrowserWindow.getAllWindows()
          allWindowsFail.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('download:error', {
                gameName: activeDownload.gameName,
                error: `Téléchargement échoué: ${state}`
              })
              log('[Download] 📤 Événement download:error envoyé')
            }
          })
        }
        
        // Réinitialiser en cas d'échec
        activeDownload = null
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
  
  log('[Download] ============================================')
  log('[Download] 🚀 NOUVEAU TÉLÉCHARGEMENT')
  log('[Download] URL:', url)
  log('[Download] Jeu:', gameName)
  log('[Download] Dossier:', destinationPath)
  log('[Download] ============================================')
  
  const destFolder = path.resolve(destinationPath || app.getPath('downloads'))
  
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true })
    log('[Download] Dossier créé:', destFolder)
  }
  
  // 🎯 DÉFINIR LE TÉLÉCHARGEMENT ACTIF
  activeDownload = {
    gameName: gameName,
    folder: destFolder,
    url: url,
    timestamp: Date.now()
  }
  
  log('[Download] Téléchargement actif défini:', activeDownload)
  
  // Essayer d'abord le téléchargement universel (PixelDrain, BuzzHeavier, GoFile)
  try {
    const provider = detectProvider(url)
    if (provider !== 'unknown') {
      log('Provider supporté détecté, utilisation du téléchargement universel')
      const result = await universalDownload(url, destinationPath)
      return result
    }
  } catch (e) {
    log('Téléchargement universel échoué, passage au flux générique:', e.message)
    // Continue avec le flux générique si le téléchargement universel échoue
    // Ne pas réinitialiser activeDownload ici car le téléchargement peut encore démarrer via will-download
  }

  // Generic hidden-window flow
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

      // load URL
      log('HiddenWindow loading URL (background):', url)
      await hiddenWindow.loadURL(url)

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
          // Réinitialiser activeDownload en cas de timeout
          activeDownload = null
          reject(new Error('Aucun lien de téléchargement détecté (timeout). Essaie avec showWindowForCaptcha = true.'))
        }
      }, 500)

    } catch (err) {
      try { if (hiddenWindow) hiddenWindow._pendingDownload = null } catch(e) {}
      errorLog('download-game generic flow error', err)
      // Réinitialiser activeDownload en cas d'erreur
      activeDownload = null
      reject(err)
    }
  })
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
      log('[Scan] ⚡ Utilisation du cache (dernier scan il y a', Math.round((now - scanCache.lastScan) / 1000), 's)')
      return { success: true, games: scanCache.games }
    }
    
    log('[Scan] 🔍 Scan demandé' + (forceRefresh ? ' (forcé)' : ''))
    
    // Si aucun dossier spécifié, scanner plusieurs emplacements possibles
    const foldersToScan = []
    
    if (gamesFolder) {
      foldersToScan.push(gamesFolder)
    } else {
      // Scanner les emplacements par défaut
      foldersToScan.push(app.getPath('downloads'))
      foldersToScan.push(app.getPath('documents')) // Scanner Documents directement aussi
      foldersToScan.push(path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'))
      foldersToScan.push(path.join(app.getPath('documents'), 'Games'))
    }
    
    const allInstalledGames = []
    
    for (const folder of foldersToScan) {
      if (fs.existsSync(folder)) {
        log('[Scan] Scan des jeux installés dans:', folder)
        const games = scanInstalledGames(folder)
        allInstalledGames.push(...games)
        log('[Scan] Jeux trouvés dans', folder, ':', games.length)
      }
    }
    
    // Mettre à jour le cache
    scanCache.games = allInstalledGames
    scanCache.lastScan = now
    
    log('[Scan] ✅ Total jeux trouvés:', allInstalledGames.length)
    return { success: true, games: allInstalledGames }
  } catch (error) {
    errorLog('[Scan] Erreur lors du scan:', error)
    return { success: false, error: error.message, games: [] }
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

/* ---------------- IPC: launch game ---------------- */
ipcMain.handle('games:launchGame', async (event, exePath) => {
  try {
    log('[Games] Lancement du jeu:', exePath)
    
    if (!fs.existsSync(exePath)) {
      throw new Error('Le fichier exécutable est introuvable: ' + exePath)
    }
    
    // Utiliser shell.openPath pour lancer le jeu
    await shell.openPath(exePath)
    log('[Games] Jeu lancé avec succès')
    return { success: true }
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
    
    // Chercher le jeu dans tous les dossiers scannés
    const foldersToScan = [
      app.getPath('downloads'),
      app.getPath('documents'),
      path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'),
      path.join(app.getPath('documents'), 'Games')
    ]
    
    let gameFolder = null
    
    for (const folder of foldersToScan) {
      if (fs.existsSync(folder)) {
        const gamePath = path.join(folder, gameName)
        const markerPath = path.join(gamePath, '.crklauncher')
        
        log(`[Uninstall] 🔍 Vérification: ${gamePath}`)
        log(`[Uninstall] 🔍 Marqueur: ${markerPath}`)
        log(`[Uninstall] 🔍 Marqueur existe? ${fs.existsSync(markerPath)}`)
        
        if (fs.existsSync(markerPath)) {
          gameFolder = gamePath
          log('[Uninstall] 📁 Jeu trouvé dans:', gameFolder)
          break
        }
        
        // Vérifier aussi dans les sous-dossiers au cas où
        try {
          const subfolders = fs.readdirSync(folder, { withFileTypes: true })
          for (const subfolder of subfolders) {
            if (subfolder.isDirectory()) {
              const subGamePath = path.join(folder, subfolder.name)
              const subMarkerPath = path.join(subGamePath, '.crklauncher')
              
              if (fs.existsSync(subMarkerPath)) {
                try {
                  const gameData = JSON.parse(fs.readFileSync(subMarkerPath, 'utf8'))
                  if (gameData.gameName === gameName) {
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
      throw new Error('Jeu non trouvé')
    }
    
    // 🔒 Fermer tous les processus liés au jeu
    await killGameProcesses(gameFolder)
    
    // ⏳ Attendre 1 seconde que les fichiers se déverrouillent
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 🗑️ Supprimer avec retry (jusqu'à 5 tentatives)
    let deleted = false
    let attempts = 0
    const maxAttempts = 5
    
    while (!deleted && attempts < maxAttempts) {
      attempts++
      log(`[Uninstall] Tentative ${attempts}/${maxAttempts}...`)
      
      try {
        // Méthode 1 : fs.rmSync avec force
        fs.rmSync(gameFolder, { 
          recursive: true, 
          force: true,
          maxRetries: 3,
          retryDelay: 1000
        })
        
        deleted = true
        log('[Uninstall] ✅ Jeu désinstallé avec succès')
      } catch (err) {
        log(`[Uninstall] ⚠️ Échec tentative ${attempts}:`, err.message)
        
        if (attempts < maxAttempts) {
          // Attendre avant de réessayer
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          // Dernière tentative : utiliser méthode alternative
          log('[Uninstall] 🔄 Tentative avec méthode alternative...')
          
          try {
            await forceDeleteFolder(gameFolder)
            deleted = true
            log('[Uninstall] ✅ Suppression réussie avec méthode alternative')
          } catch (finalErr) {
            throw new Error(`Impossible de supprimer le dossier après ${maxAttempts} tentatives. Le dossier est peut-être ouvert dans l'Explorateur ou utilisé par un autre programme. Fermez tous les programmes et réessayez.`)
          }
        }
      }
    }
    
    // Invalider le cache après désinstallation
    scanCache.lastScan = 0
    
    return { success: true, message: `${gameName} a été désinstallé avec succès` }
  } catch (err) {
    errorLog('[Uninstall] ❌ Erreur:', err)
    return { success: false, error: err.message }
  }
})

/* ---------------- IPC: open game folder ---------------- */
ipcMain.handle('games:openGameFolder', async (event, gameName) => {
  try {
    log('[OpenFolder] Ouverture du dossier pour:', gameName)
    
    // Chercher le jeu dans tous les dossiers scannés
    const foldersToScan = [
      app.getPath('downloads'),
      app.getPath('documents'),
      path.join(app.getPath('documents'), 'CrackenLauncher', 'Games'),
      path.join(app.getPath('documents'), 'Games')
    ]
    
    let gameFolder = null
    
    for (const folder of foldersToScan) {
      if (fs.existsSync(folder)) {
        const gamePath = path.join(folder, gameName)
        const markerPath = path.join(gamePath, '.crklauncher')
        
        if (fs.existsSync(markerPath)) {
          gameFolder = gamePath
          break
        }
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

/* ---------------- app lifecycle ---------------- */
app.whenReady().then(() => {
  setupDefaultSession()
  createWindow()
  createHiddenWindow()
  log('App ready')
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else if (!mainWindow) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/* ---------------- export (optional) ---------------- */
export { downloadFromPixelDrainUrl }
