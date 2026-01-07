// main.js (corrigé & logs ajoutés)
const { app, BrowserWindow, ipcMain, shell, session, dialog, Menu } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const fs = require('node:fs')
const fsPromises = require('node:fs').promises
const https = require('node:https')
const http = require('node:http')
const crypto = require('node:crypto')
const { exec, spawn, fork } = require('node:child_process')
const { promisify } = require('node:util')
const { downloadWithRedirect, fetchJSON, convertPixelDrain, downloadHttpToFile, downloadFromPixelDrainUrl, detectProvider } = require('./utils/download-helpers.js')
// Import lazy de game-extractor.js (contient des modules lourds comme node-7z)

/* --- Gestionnaire d'erreur global --- */
// Capturer toutes les erreurs non gérées pour éviter les crashes
process.on('uncaughtException', (error) => {
  // Logs désactivés - erreurs critiques seulement si nécessaire
  // console.error('[Uncaught Exception]', error)
})

process.on('unhandledRejection', (reason, promise) => {
  // Logs désactivés - erreurs critiques seulement si nécessaire
})

/* --- IMPORTS DE SERVICE (lazy loading pour améliorer les performances) --- */
// Les services seront chargés à la demande pour améliorer le temps de démarrage
let githubService = null
let steamService = null
let gamesService = null

// Import du service de persistance des jeux installés
// Note: installed-games-store.js utilise maintenant SimpleStore (pas electron-store)
const { installedGamesStore } = require('./installed-games-store.js')
let discordService = null
let websocketService = null
let gameExtractor = null
let lockrService = null
let adsService = null
let discordRPCService = null

// Import du service SQLite pour la bibliothèque de jeux
const sqliteService = require('./utils/sqlite-service.js')

/* --- MONITORING DE PERFORMANCE --- */
const { startMemoryMonitoring } = require('./performance-monitor.js')

// Fonction de chargement lazy pour game-extractor
async function getGameExtractor() {
  if (!gameExtractor) {
    gameExtractor = await import('./game-extractor.mjs').catch(() => import('./game-extractor.js'))
  }
  return gameExtractor
}

// Fonction de chargement lazy pour SQLite library
async function getGamesLibrarySQLite() {
  if (!gamesLibrarySQLite) {
    try {
      const sqliteService = require('./utils/sqlite-service.js')
      gamesLibrarySQLite = sqliteService
    } catch (error) {
      console.error('[SQLite] Erreur chargement module:', error)
      throw error
    }
  }
  return gamesLibrarySQLite
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
    const isDev = !app.isPackaged
    let servicePath = null
    
    if (isDev) {
      // En mode développement, utiliser le chemin relatif avec pathToFileURL
      const devPath = path.resolve(__dirname, 'steam-service.mjs')
      if (fs.existsSync(devPath)) {
        servicePath = pathToFileURL(devPath).href
      } else {
        servicePath = './steam-service.mjs'
      }
    } else {
      // En production, chercher dans le dossier d'installation
      const execPathDir = path.dirname(process.execPath)
      const possiblePaths = [
        path.join(execPathDir, 'steam-service.mjs'),
        path.join(execPathDir, 'resources', 'app.asar', 'electron', 'steam-service.mjs'),
        path.join(__dirname, 'steam-service.mjs')
      ]
      
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          servicePath = pathToFileURL(testPath).href
          break
        }
      }
    }
    
    if (!servicePath) {
      throw new Error('steam-service.mjs introuvable dans tous les emplacements possibles')
    }
    
    steamService = await import(servicePath)
  }
  return steamService
}

async function getGamesService() {
  if (!gamesService) {
    // Chercher games-service.mjs dans plusieurs emplacements
    const isDev = !app.isPackaged
    let servicePath = null
    
    if (isDev) {
      // En mode développement, utiliser le chemin relatif avec pathToFileURL
      const devPath = path.resolve(__dirname, 'games-service.mjs')
      if (fs.existsSync(devPath)) {
        servicePath = pathToFileURL(devPath).href
      } else {
        // Fallback direct
        servicePath = './games-service.mjs'
      }
    } else {
      // En production, chercher dans le dossier d'installation (extraFiles)
      const execPathDir = path.dirname(process.execPath)
      const possiblePaths = [
        path.join(execPathDir, 'games-service.mjs'), // Dossier d'installation
        path.join(execPathDir, 'resources', 'app.asar', 'electron', 'games-service.mjs'), // Dans asar
        path.join(__dirname, 'games-service.mjs') // Chemin relatif depuis __dirname
      ]
      
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          servicePath = pathToFileURL(testPath).href
          break
        }
      }
    }
    
    if (!servicePath) {
      throw new Error('games-service.mjs introuvable dans tous les emplacements possibles')
    }
    
    gamesService = await import(servicePath)
  }
  return gamesService
}

async function getDiscordService() {
  // Utiliser le service sécurisé qui communique avec le serveur
  if (!discordService) {
    const isDev = !app.isPackaged
    let servicePath = null
    
    errorLog('[Main] 🔍 Initialisation du service Discord...')
    errorLog('[Main] 📁 isDev:', isDev)
    
    if (!isDev) {
      // En production, chercher d'abord dans le dossier d'installation (extraFiles)
      const installDir = path.dirname(process.execPath)
      // installDir peut être: C:\Users\...\AppData\Local\Programs\Actoris (per-user) ou C:\Program Files (x86)\Actoris (per-machine)
      const possiblePaths = [
        path.join(installDir, 'discord-service-secure.mjs'),  // Dossier d'installation (extraFiles) - PRIORITÉ
        path.join(installDir, 'discord-service-secure.js'),   // Fallback ancien nom
        path.join(__dirname, 'discord-service-secure.mjs'),   // Même dossier que main.js (asar) - PRIORITÉ
        path.join(__dirname, 'discord-service-secure.js'),    // Fallback ancien nom
      ]
      
      errorLog('[Main] 📁 Chemins possibles:', possiblePaths)
      servicePath = possiblePaths.find(p => {
        const exists = fs.existsSync(p)
        errorLog(`[Main] 📁 ${p}: ${exists ? '✅ existe' : '❌ n\'existe pas'}`)
        return exists
      })
      
      if (servicePath) {
        try {
          errorLog('[Main] 📤 Import depuis:', servicePath)
          // Utiliser pathToFileURL pour convertir le chemin en URL de fichier
          const fileUrl = pathToFileURL(servicePath).href
          errorLog('[Main] 📤 URL de fichier:', fileUrl)
          discordService = await import(fileUrl)
          errorLog('[Main] ✅ Service importé avec succès depuis dossier d\'installation')
          errorLog('[Main] 📋 Clés disponibles:', Object.keys(discordService || {}))
        } catch (err) {
          errorLog('[Main] ❌ Erreur import depuis dossier d\'installation:', err.message)
          errorLog('[Main] ❌ Stack:', err.stack)
          // Fallback vers le chemin relatif
          try {
            errorLog('[Main] 🔄 Fallback vers asar...')
            discordService = await import('./discord-service-secure.mjs').catch(() => import('./discord-service-secure.js'))
            errorLog('[Main] ✅ Service importé depuis asar')
          } catch (err2) {
            errorLog('[Main] ❌ Erreur import depuis asar:', err2.message)
          }
        }
      } else {
        // Fallback vers le chemin relatif si le fichier n'est pas trouvé
        errorLog('[Main] ⚠️ Fichier non trouvé, fallback vers asar...')
        try {
            discordService = await import('./discord-service-secure.mjs').catch(() => import('./discord-service-secure.js'))
          errorLog('[Main] ✅ Service importé depuis asar')
        } catch (err) {
          errorLog('[Main] ❌ discord-service-secure.js non trouvé:', err.message)
        }
      }
    } else {
      // En dev, utiliser le chemin relatif standard
      errorLog('[Main] 🔧 Mode DEV: import depuis ./discord-service-secure.mjs')
      try {
        discordService = await import('./discord-service-secure.mjs').catch(() => import('./discord-service-secure.js'))
        errorLog('[Main] ✅ Service importé en dev')
      } catch (err) {
        errorLog('[Main] ❌ Erreur import en dev:', err.message)
        errorLog('[Main] ❌ Stack:', err.stack)
      }
    }
    
    // Si le service sécurisé n'a pas pu être chargé, fallback vers l'ancien
    if (!discordService) {
      try {
        errorLog('[Main] ⚠️ Utilisation de l\'ancien service Discord (non sécurisé)')
        discordService = await import('./discord-service.js')
        errorLog('[Main] ✅ Ancien service importé')
      } catch (err) {
        errorLog('[Main] ❌ Impossible de charger le service Discord:', err.message)
        errorLog('[Main] ❌ Stack:', err.stack)
      }
    }
    
    // Initialiser l'URL de l'API - Forcer IPv4 pour éviter les problèmes IPv6
    if (discordService && discordService.setApiUrl) {
      // S'assurer que l'URL utilise IPv4 (127.0.0.1) et non IPv6 (::1)
      const apiUrlIPv4 = API_URL.includes('localhost') ? API_URL.replace('localhost', '127.0.0.1') : API_URL
      errorLog('[Main] 🔧 Configuration API_URL:', apiUrlIPv4)
      discordService.setApiUrl(apiUrlIPv4)
      errorLog('[Main] ✅ API_URL configurée')
    } else {
      errorLog('[Main] ⚠️ setApiUrl non disponible dans le service')
    }
    
    if (!discordService) {
      errorLog('[Main] ❌ CRITIQUE: discordService est toujours null après toutes les tentatives!')
    } else {
      errorLog('[Main] ✅ Service Discord initialisé avec succès')
    }
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

async function getDiscordRPCService() {
  if (!discordRPCService) {
    discordRPCService = await import('./discord-rpc-service.mjs').catch(() => import('./discord-rpc-service.js'))
  }
  return discordRPCService
}

/* --- Utils chemins --- */
// __filename et __dirname sont automatiquement disponibles en CommonJS

/* --- Config dev / API URL --- */
const isDev = !app.isPackaged || process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER === 'true'
const isProduction = !isDev && app.isPackaged

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
// Forcer IPv4 pour éviter les problèmes IPv6 vs IPv4 (::1 vs 127.0.0.1)
let API_URL = process.env.API_URL || 'http://127.0.0.1:3001'
// S'assurer que localhost est toujours remplacé par 127.0.0.1
if (API_URL.includes('localhost')) {
  API_URL = API_URL.replace('localhost', '127.0.0.1')
}
try {
  const configPath = path.join(__dirname, '../websocket-config.json')
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (config.apiUrl) {
      API_URL = config.apiUrl
      // Forcer IPv4 même si le config contient localhost
      if (API_URL.includes('localhost')) {
        API_URL = API_URL.replace('localhost', '127.0.0.1')
      }
    }
    }
} catch (e) {
      log(LOG_LEVELS.WARN, '[Main] Failed loading websocket-config.json, using default API_URL')
}

/* --- Globals --- */
let mainWindow = null
let hiddenWindow = null
let lockrWindow = null
let lockrWindows = [] // Liste de toutes les fenêtres Lockr ouvertes
let lockrTabs = [] // Structure: [{ id, url, title, active }]
let currentTabId = null
let lockrRedirectDetected = false // Variable globale pour suivre les redirections Netlify

// 🚪 FONCTION UTILITAIRE POUR FERMER TOUTES LES FENÊTRES LOCKR
function closeAllLockrWindows() {
  log('[Lockr] 🚪 Fermeture de toutes les fenêtres Lockr...')
  let closedCount = 0
  const windowsToClose = new Set()
  
  // Ajouter toutes les fenêtres dans lockrWindows[]
  lockrWindows.forEach((win) => {
    if (win && !win.isDestroyed()) {
      windowsToClose.add(win)
    }
  })
  
  // Ajouter aussi la fenêtre principale Lockr (lockrWindow)
  if (lockrWindow && !lockrWindow.isDestroyed()) {
    windowsToClose.add(lockrWindow)
  }
  
  // 🎯 MÉTHODE ALTERNATIVE : Trouver toutes les fenêtres qui ne sont pas la fenêtre principale
  // et qui ont un titre contenant "Lockr" ou "Redirect" ou "Redirection"
  try {
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach((win) => {
      if (win && !win.isDestroyed() && win !== mainWindow) {
        const title = win.getTitle().toLowerCase()
        // Si le titre contient "lockr", "redirect", "redirection", ou "actoris" (pour les fenêtres de redirection)
        if (title.includes('lockr') || title.includes('redirect') || title.includes('redirection') || title.includes('actoris')) {
          windowsToClose.add(win)
          log(`[Lockr] 🔍 Fenêtre Lockr trouvée par titre: "${win.getTitle()}"`)
        }
      }
    })
  } catch (err) {
    errorLog('[Lockr] ⚠️ Erreur lors de la recherche de toutes les fenêtres:', err)
  }
  
  // Fermer toutes les fenêtres trouvées
  windowsToClose.forEach((win) => {
    if (win && !win.isDestroyed()) {
      try {
        log(`[Lockr] 🚪 Fermeture de la fenêtre: "${win.getTitle()}"`)
        win.close()
        closedCount++
      } catch (closeErr) {
        errorLog(`[Lockr] ⚠️ Erreur lors de la fermeture de la fenêtre:`, closeErr)
      }
    }
  })
  
  // Nettoyer les listes
  lockrWindows = []
  lockrWindow = null
  
  log(`[Lockr] ✅ ${closedCount} fenêtre(s) Lockr fermée(s)`)
  return closedCount
}
let currentGameToLaunch = null // Jeu sélectionné pour le système à un seul lien Lockr
let downloadDestinationPath = null
// 🎯 VARIABLE GLOBALE POUR LE TÉLÉCHARGEMENT EN COURS (ne dépend pas de l'URL qui change avec les redirections)
let activeDownload = null
let extractingGames = new Set() // Pour éviter les extractions en double
let activeDownloads = new Set() // Pour éviter les téléchargements en double (par filePath)
let uninstallingGames = new Set() // Pour éviter les désinstallations simultanées
let confirmationServer = null // Serveur HTTP pour recevoir les confirmations depuis le site web
let webSocketServer = null // Serveur WebSocket pour recevoir les confirmations depuis le site web
let willDownloadListener = null // Pour pouvoir nettoyer le handler will-download

/* --- Logger intelligent (optimisé pour dev & prod) --- */
const LOG_LEVELS = {
  ERROR: 0,   // Toujours logué
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
}

// En dev : logs complets, en prod : seulement erreurs
const CURRENT_LOG_LEVEL = (isDev || process.env.ENABLE_LOGS === 'true')
  ? LOG_LEVELS.DEBUG
  : LOG_LEVELS.ERROR

function baseLog(level, ...args) {
  if (level > CURRENT_LOG_LEVEL) return
  const prefixMap = {
    [LOG_LEVELS.ERROR]: '[ERROR]',
    [LOG_LEVELS.WARN]: '[WARN]',
    [LOG_LEVELS.INFO]: '[INFO]',
    [LOG_LEVELS.DEBUG]: '[DEBUG]',
  }
  const prefix = prefixMap[level] || '[LOG]'
  // Utiliser console.error pour ERROR, console.log pour le reste
  if (level === LOG_LEVELS.ERROR) {
    console.error(prefix, ...args)
  } else {
  }
}

// Compatibilité avec tous les anciens appels: log('message') / log('a', 'b', ...)
// ET nouveau style: log(LOG_LEVELS.DEBUG, 'message détaillé')
function log(...args) {
  if (!args.length) return
  if (typeof args[0] === 'number' && Object.values(LOG_LEVELS).includes(args[0])) {
    const [level, ...rest] = args
    baseLog(level, ...rest)
  } else {
    baseLog(LOG_LEVELS.INFO, ...args)
  }
}

function errorLog(...args) { 
  baseLog(LOG_LEVELS.ERROR, ...args)
}

/* ---------------- createWindow ---------------- */
async function createWindow() {
  // Détruire l'ancienne fenêtre si elle existe et n'est pas déjà détruite
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b0b11',
    minWidth: 1200,
    minHeight: 720,
    frame: false, // Pas de barre de titre système, on crée la nôtre
    titleBarStyle: 'hidden',
    show: false, // Ne pas afficher immédiatement
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // Optimisations de performance
      enableRemoteModule: false,
      sandbox: false, // Nécessaire pour certains IPC
      // Optimisations mémoire
      backgroundThrottling: false, // Éviter le throttling en arrière-plan
      // Optimisations réseau
      webSecurity: true, // Garder la sécurité web
      // Optimisations de rendu
      offscreen: false,
      // Désactiver les fonctionnalités inutiles
      spellcheck: false,
      enableWebSQL: false,
      // Optimisations V8
      v8CacheOptions: 'code',
    },
  })

  // Intercepter les erreurs de chargement de ressources pour afficher des messages plus clairs
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      if (errorCode === -105 || errorCode === -106) { // ERR_NAME_NOT_RESOLVED ou ERR_INTERNET_DISCONNECTED
        errorLog(`⚠️ [main.js] Impossible de charger ${validatedURL}`)
        errorLog('💡 [main.js] Le serveur Vite n\'est probablement pas démarré.')
        errorLog('💡 [main.js] Solution: Lancez "npm run dev" dans un terminal séparé, ou utilisez "npm start"')
      } else if (errorCode === -118) { // ERR_CONNECTION_TIMED_OUT
        errorLog(`⏱️ [main.js] Timeout lors du chargement de ${validatedURL}`)
        errorLog('💡 [main.js] Le serveur Vite met peut-être trop de temps à démarrer.')
      }
    }
  })

  // Masquer la barre de menu
  mainWindow.setMenuBarVisibility(false)

  // S'assurer que la fenêtre apparaît au premier plan quand elle est prête
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.moveTop()
    }
  })

  // Charger un loader HTML immédiat pour éviter l'écran noir
  const loaderHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: linear-gradient(135deg, #0a0a0f 0%, #0f0f14 50%, #0a0a0f 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            overflow: hidden;
          }
          .loader-container {
            text-align: center;
            color: #60a5fa;
          }
          .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(96, 165, 250, 0.2);
            border-top-color: #60a5fa;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .text {
            color: #9ca3af;
            font-size: 16px;
            font-weight: 500;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            background: linear-gradient(to right, #60a5fa, #34d399);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="loader-container">
          <div class="logo">ACTORIS</div>
          <div class="spinner"></div>
          <div class="text">Chargement...</div>
        </div>
      </body>
    </html>
  `
  
  // Charger le loader immédiatement et afficher la fenêtre
  await mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loaderHTML))
  // La fenêtre sera affichée via l'événement 'ready-to-show' ci-dessus
  if (!mainWindow.isVisible()) {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.moveTop()
  }
  
  // Charger directement l'app (ignorer le splash pour éviter les délais)
  // Le loader sera remplacé par l'app dès qu'elle sera prête

  // Charger le contenu principal immédiatement (sans délai pour éviter le blocage)
  // Ne pas attendre le splash - charger l'app directement
  if (isDev) {
    // Charger directement avec un délai pour laisser Vite compiler
    // La vérification stricte peut échouer même si Vite est prêt
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Attendre un peu pour que Vite termine sa compilation initiale
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          log('[main.js] Chargement de Vite...')
          mainWindow.loadURL(VITE_DEV_SERVER_URL).catch(err => {
            errorLog('❌ [main.js] Erreur lors du chargement:', err.message)
            // Si erreur, réessayer après un délai supplémentaire
            setTimeout(() => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                log('[main.js] Nouvelle tentative de chargement...')
                mainWindow.loadURL(VITE_DEV_SERVER_URL).catch(err2 => {
                  errorLog('❌ [main.js] Échec du chargement après retry:', err2.message)
                  // Fallback vers dist si disponible
                  const appPath = app.getAppPath()
                  const indexPath = path.join(appPath, 'dist', 'index.html')
                  if (fs.existsSync(indexPath)) {
                    log('[main.js] Fallback vers dist/index.html')
                    mainWindow.loadFile(indexPath).catch(() => {})
                  }
                })
              }
            }, 3000)
          })
        }
      }, 3000) // Attendre 3 secondes pour que Vite termine sa compilation initiale avec esbuild
    }
    
    // Code de vérification avancée (désactivé pour simplifier)
    if (false && mainWindow && !mainWindow.isDestroyed()) {
      // Fonction pour vérifier si le serveur Vite est disponible et prêt
      const checkViteServer = async (maxAttempts = 20, delay = 500) => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const result = await new Promise((resolve) => {
              const req = http.get(VITE_DEV_SERVER_URL, (res) => {
                // Vérifier que la réponse est valide (200-299)
                if (res.statusCode >= 200 && res.statusCode < 400) {
                  // Vérifier aussi que l'endpoint répond avec du HTML valide
                  let data = ''
                  let resolved = false
                  
                  const finish = (success) => {
                    if (!resolved) {
                      resolved = true
                      resolve(success)
                    }
                  }
                  
                  res.on('data', chunk => {
                    if (!resolved) {
                      data += chunk.toString()
                      // Si on a assez de données pour détecter du HTML valide, résoudre immédiatement
                      if (data.includes('<!doctype') || 
                          data.includes('<!DOCTYPE') || 
                          data.includes('id="root"') ||
                          data.includes('<div id="root"') ||
                          data.includes('type="module"')) {
                        finish(true)
                        res.destroy()
                      } else if (data.length > 10240) {
                        // Si on a lu 10KB et qu'on n'a pas trouvé de HTML valide, c'est suspect
                        finish(false)
                        res.destroy()
                      }
                    }
                  })
                  
                  res.on('end', () => {
                    if (!resolved) {
                      // Vérifier une dernière fois avec toutes les données
                      // Vite peut renvoyer du HTML même pendant la compilation initiale
                      const hasValidContent = data.includes('<!doctype') || 
                                             data.includes('<!DOCTYPE') || 
                                             data.includes('id="root"') ||
                                             data.includes('<div id="root"') ||
                                             data.includes('type="module"') ||
                                             data.includes('<html') ||
                                             data.includes('<body') ||
                                             data.includes('vite') ||
                                             data.length > 100 // Si on a reçu au moins 100 bytes, c'est probablement valide
                      finish(hasValidContent)
                    }
                  })
                  
                  res.on('error', () => finish(false))
                  
                  // Timeout pour la réponse
                  res.setTimeout(3000, () => {
                    if (!resolved) {
                      finish(false)
                      res.destroy()
                    }
                  })
                } else {
                  resolve(false)
                }
              })
              
              req.on('error', () => resolve(false))
              req.setTimeout(3000, () => {
                req.destroy()
                resolve(false)
              })
            })
            
            if (result) {
              log(`[main.js] ✅ Serveur Vite prêt (tentative ${attempt}/${maxAttempts})`)
              return true
            }
            
            if (attempt < maxAttempts) {
              if (attempt % 4 === 0) {
                log(`[main.js] ⏳ Attente du serveur Vite... (tentative ${attempt}/${maxAttempts})`)
              }
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          } catch (e) {
            if (attempt < maxAttempts) {
              if (attempt % 4 === 0) {
                log(`[main.js] ⏳ Erreur lors de la vérification, nouvelle tentative... (${attempt}/${maxAttempts})`)
              }
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }
        }
        return false
      }
      
      // Vérifier et charger avec retry amélioré
      checkViteServer().then(serverAvailable => {
        if (serverAvailable) {
          mainWindow.loadURL(VITE_DEV_SERVER_URL).catch(err => {
            errorLog('❌ [main.js] Erreur lors du chargement du serveur dev:', err.message)
            // Fallback vers dist si erreur de chargement
            const appPath = app.getAppPath()
            const indexPath = path.join(appPath, 'dist', 'index.html')
            if (fs.existsSync(indexPath)) {
              log('[main.js] Fallback vers dist/index.html après erreur de chargement')
              mainWindow.loadFile(indexPath).catch(() => {})
            }
          })
        } else {
          // Le serveur n'est pas encore prêt après toutes les tentatives
          // Mais Vite peut être en train de compiler, essayons quand même de charger
          log(`⚠️ [main.js] Le serveur Vite n'a pas répondu après toutes les tentatives`)
          log('💡 [main.js] Tentative de chargement quand même (Vite peut être en train de compiler avec esbuild)...')
          
          // Attendre encore 2 secondes puis essayer de charger (donner le temps à esbuild de finir)
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              log('[main.js] Tentative de chargement de Vite après délai supplémentaire...')
              mainWindow.loadURL(VITE_DEV_SERVER_URL).catch(err => {
                errorLog('❌ [main.js] Erreur lors du chargement:', err.message)
                // Fallback vers dist si disponible
                const appPath = app.getAppPath()
                const indexPath = path.join(appPath, 'dist', 'index.html')
                if (fs.existsSync(indexPath)) {
                  log('[main.js] Fallback vers dist/index.html')
                  mainWindow.loadFile(indexPath).catch(() => {
                    errorLog('❌ [main.js] Impossible de charger depuis dist')
                  })
                } else {
                  errorLog('❌ [main.js] Aucun build dist disponible.')
                  errorLog('💡 [main.js] Assurez-vous que Vite est démarré: npm run dev')
                }
              })
            }
          }, 2000)
        }
      })
    }
  } else {
      // Mode production - charger directement sans logs pour accélérer
      const appPath = app.getAppPath()
      const indexPath = path.join(appPath, 'dist', 'index.html')
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (fs.existsSync(indexPath)) {
          mainWindow.loadFile(indexPath).catch(err => {
            // Essayer le fallback en silence
            const fallbackPath = path.join(__dirname, '../dist/index.html')
            if (fs.existsSync(fallbackPath)) {
              mainWindow.loadFile(fallbackPath).catch(() => {
                errorLog('❌ [main.js] Impossible de charger index.html')
              })
            } else {
              errorLog('❌ [main.js] index.html introuvable')
            }
          })
        } else {
          // Essayer le fallback directement
          const fallbackPath = path.join(__dirname, '../dist/index.html')
          if (fs.existsSync(fallbackPath)) {
            mainWindow.loadFile(fallbackPath).catch(() => {
              errorLog('❌ [main.js] Impossible de charger index.html')
            })
          } else {
            errorLog('❌ [main.js] index.html introuvable')
          }
        }
      }
    }
  
  // Configurer le CSP pour autoriser les vidéos Steam et autres médias
  // ET corriger les MIME types pour les modules JS
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "media-src 'self' https://*.steamstatic.com https://*.steamusercontent.com https://*.akamai.steamstatic.com https://video.akamai.steamstatic.com https://cdn.akamai.steamstatic.com https://steamcdn-a.akamaihd.net https://*.youtube.com https://*.youtube-nocookie.com https://*.vimeo.com; " +
      "img-src 'self' data: blob: https: http:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "font-src 'self' data:; " +
      "connect-src 'self' http://127.0.0.1:* http://localhost:* https: ws: wss:;"
    ]
    
    // Corriger le MIME type pour les fichiers JS/JSX
    const responseHeaders = { ...details.responseHeaders }
    const url = details.url.toLowerCase()
    
    if (url.endsWith('.js') || url.endsWith('.jsx') || url.includes('/assets/') && url.endsWith('.js')) {
      // Forcer le MIME type correct pour les modules JavaScript
      if (!responseHeaders['Content-Type']) {
        responseHeaders['Content-Type'] = ['application/javascript']
      } else if (Array.isArray(responseHeaders['Content-Type'])) {
        responseHeaders['Content-Type'] = ['application/javascript']
      } else {
        responseHeaders['Content-Type'] = 'application/javascript'
      }
    }
    
    callback({
      responseHeaders: {
        ...responseHeaders,
        'Content-Security-Policy': csp
      }
    })
  })

  // Écouter les événements de chargement de la page (logs désactivés pour accélérer)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    errorLog('❌ [main.js] Échec du chargement:', errorCode, errorDescription, validatedURL)
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
      if (!mainWindow || mainWindow.isDestroyed()) return
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

  // Désactiver DevTools (F12, Ctrl+Shift+I) en production
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Bloquer F12
      if (input.key === 'F12') {
        event.preventDefault()
        return
      }
      // Bloquer Ctrl+Shift+I (ou Cmd+Option+I sur Mac)
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault()
        return
      }
      // Bloquer Ctrl+Shift+J (ou Cmd+Option+J sur Mac)
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'j') {
        event.preventDefault()
        return
      }
    })
    
    // S'assurer que DevTools n'est jamais ouvert en production
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools()
    }
  }

  // S'assurer que la fenêtre est au premier plan après création et chargement complet
  mainWindow.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
      mainWindow.moveTop()
    }
  })

  log('Main window created')
}

/* ---------------- Enregistrement différé des IPC handlers ---------------- */
let criticalHandlersRegistered = false
let allHandlersRegistered = false
let discordDeadLinkHandlerRegistered = false

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
      errorLog('[IPC] 📥 discord:getAuthUrl appelé')
      errorLog('[IPC] 🔍 Récupération du service Discord...')
      
      // Vérifier d'abord si discordService est déjà initialisé
      if (!discordService) {
        errorLog('[IPC] ⚠️ discordService est null, tentative d\'initialisation...')
        const service = await getDiscordService()
        if (!service) {
          errorLog('[IPC] ❌ discordService est toujours null après getDiscordService()!')
          errorLog('[IPC] ❌ Vérification des chemins...')
          const isDev = !app.isPackaged
          if (!isDev) {
            const installDir = path.dirname(process.execPath)
            const possiblePaths = [
              path.join(installDir, 'discord-service-secure.js'),
              path.join(__dirname, 'discord-service-secure.js'),
            ]
            possiblePaths.forEach(p => {
              const exists = fs.existsSync(p)
              errorLog(`[IPC] 📁 ${p}: ${exists ? '✅ existe' : '❌ n\'existe pas'}`)
            })
          }
          return { 
            success: false, 
            error: 'Discord service not initialized. Please check the logs.' 
          }
        }
        discordService = service
      }
      
      const service = discordService
      
      // VÉRIFIER que le service existe
      if (!service) {
        errorLog('[IPC] ❌ discordService est null!')
        return { 
          success: false, 
          error: 'Discord service not initialized. Please check the logs.' 
        }
      }
      
      // VÉRIFIER que getDiscordAuthUrl existe
      if (typeof service.getDiscordAuthUrl !== 'function') {
        errorLog('[IPC] ❌ service.getDiscordAuthUrl n\'est pas une fonction!')
        errorLog('[IPC] ❌ Type de service:', typeof service)
        errorLog('[IPC] ❌ Clés disponibles:', Object.keys(service || {}))
        return { 
          success: false, 
          error: 'getDiscordAuthUrl function not found in Discord service' 
        }
      }
      
      errorLog('[IPC] ✅ Service récupéré, appel de getDiscordAuthUrl...')
      const result = await service.getDiscordAuthUrl()
      log('[IPC] ✅ discord:getAuthUrl success')
      log('[IPC] 📍 URL reçue:', typeof result, result ? (typeof result === 'string' ? result.substring(0, 50) + '...' : JSON.stringify(result).substring(0, 50)) : 'null')
      
      // Vérifier que result est valide AVANT de le convertir en string
      if (!result || result === 'undefined' || result === 'null') {
        errorLog('[IPC] ❌ result est undefined/null!')
        throw new Error('getDiscordAuthUrl a retourné undefined')
      }
      
      // S'assurer de retourner un objet simple sérialisable
      const urlString = String(result)
      
      // Vérifier que l'URL ne contient pas "undefined"
      if (urlString === 'undefined' || urlString === 'null' || urlString.includes('client_id=undefined') || urlString.includes('client_id=null')) {
        errorLog('[IPC] ❌ L\'URL contient undefined/null!')
        errorLog('[IPC] ❌ URL:', urlString)
        throw new Error('L\'URL générée contient client_id=undefined')
      }
      
      log('[IPC] 📤 Retour de l\'URL:', urlString.substring(0, 50) + '...')
      return { success: true, url: urlString }
    } catch (err) {
      errorLog('[IPC] ❌ discord:getAuthUrl error')
      errorLog('[IPC] ❌ Type:', err.constructor.name)
      errorLog('[IPC] ❌ Message:', err.message)
      errorLog('[IPC] ❌ Stack:', err.stack)
      return { success: false, error: err.message || 'Erreur lors de la récupération de l\'URL d\'authentification' }
    }
  })

  ipcMain.handle('discord:authenticate', async (event, code, redirectUri) => {
    try {
      log('discord:authenticate called')
      const service = await getDiscordService()
      // Utiliser la nouvelle méthode sécurisée qui communique avec le serveur
      const result = await service.authenticateWithDiscord(code, redirectUri)
      
      // Si l'authentification réussit, enregistrer/mettre à jour l'utilisateur dans Supabase
      if (result.success && result.user) {
        try {
          log('[Discord Auth] 📝 Enregistrement de l\'utilisateur dans Supabase...')
          const { upsertUserToSupabase } = await import('./supabase-users-service.mjs')
          const supabaseResult = await upsertUserToSupabase(result.user)
          if (supabaseResult.success) {
            log('[Discord Auth] ✅ Utilisateur enregistré/mis à jour dans Supabase:', result.user.id)
          } else if (supabaseResult.ignored) {
            // La table users n'existe pas, c'est normal, on continue
            log('[Discord Auth] ⚠️ Table users n\'existe pas dans Supabase (ignoré)')
          } else {
            errorLog('[Discord Auth] ⚠️ Échec de l\'enregistrement dans Supabase, mais authentification réussie')
          }
        } catch (supabaseError) {
          // Ne pas faire échouer l'authentification si Supabase échoue
          if (supabaseError.message && (supabaseError.message.includes('table') && supabaseError.message.includes('not exist') || supabaseError.message.includes('schema cache'))) {
            log('[Discord Auth] ⚠️ Table users n\'existe pas dans Supabase (ignoré)')
          } else {
            errorLog('[Discord Auth] ⚠️ Erreur lors de l\'enregistrement dans Supabase:', supabaseError.message)
            log('[Discord Auth] ⚠️ L\'authentification Discord a réussi mais l\'enregistrement Supabase a échoué')
          }
        }
      }
      
      log('discord:authenticate success')
      return result
    } catch (err) {
      errorLog('discord:authenticate error', err)
      // Retourner un objet d'erreur au lieu de lancer une exception
      // pour que le frontend puisse l'afficher correctement
      // Préserver les détails de l'erreur du backend si disponibles
      const errorResponse = err.response?.data || {}
      return {
        success: false,
        error: errorResponse.error || err.message || 'Erreur lors de l\'authentification Discord',
        errorCode: errorResponse.errorCode || (errorResponse.error ? errorResponse.error.toUpperCase() : undefined),
        message: errorResponse.message || errorResponse.error_description || err.message,
        details: errorResponse.details || undefined
      }
    }
  })

  // Handler critique pour la session Discord (utilisé au démarrage)
  ipcMain.handle('discord:getSession', async (event, sessionToken) => {
    try {
      const service = await getDiscordService()
      if (service.getSession) {
        const result = await service.getSession(sessionToken)
        return result
      } else {
        // Fallback : utiliser l'API directement
        const axios = (await import('axios')).default
        const API_URL = process.env.API_URL || 'http://127.0.0.1:3001'
        const response = await axios.post(`${API_URL}/api/discord/session`, {
          sessionToken
        })
        return response.data
      }
    } catch (err) {
      errorLog('discord:getSession error', err)
      return {
        success: false,
        error: err.message || 'Erreur lors de la récupération de la session'
      }
    }
  })

  // Handler critique pour les jeux (utilisé au démarrage)
  // Handler pour récupérer les catégories depuis Supabase
  ipcMain.handle('games:getCategories', async () => {
    try {
      const { getCategoriesFromSupabase } = await import('./supabase-games-service.mjs')
      const categories = await getCategoriesFromSupabase()
      return categories
    } catch (error) {
      errorLog('[main] ❌ Erreur lors de la récupération des catégories:', error)
      return []
    }
  })

  ipcMain.handle('games:getGames', async (event, forceRefresh = false) => {
    try {
      log('[Games] 📡 games:getGames appelé, forceRefresh:', forceRefresh)
      
      // Vérifier la configuration Supabase avant d'appeler le service
      try {
        const { SUPABASE_CONFIG } = await import('./supabase-config.mjs').catch(() => import('./supabase-config.js'))
        log('[Games] ✅ Configuration Supabase chargée')
        log('[Games] 📍 URL:', SUPABASE_CONFIG.URL || 'MANQUANTE')
        log('[Games] 🔑 ANON_KEY:', SUPABASE_CONFIG.ANON_KEY ? 'PRÉSENTE' : 'MANQUANTE')
        if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
          errorLog('[Games] ❌ Configuration Supabase incomplète!')
        }
      } catch (configError) {
        errorLog('[Games] ❌ Erreur lors du chargement de la config Supabase:', configError.message)
      }
      
      const service = await getGamesService()
      // Invalider le cache si forceRefresh est true
      if (forceRefresh) {
        service.invalidateGamesCache()
        log('[Games] 🔄 Cache invalidé, rechargement depuis Supabase...')
      }
      log('[Games] 📡 Appel à getGamesFromGitHub...')
      const result = await service.getGamesFromGitHub(forceRefresh)
      log('[Games] ✅ Jeux récupérés:', result.games?.length || 0, 'jeux')
      
      // Vérifier les jeux en ligne (pour debug)
      if (result.games && result.games.length > 0) {
        const onlineCount = result.games.filter(g => g.isOnline === true).length
        log('[Games] 🔍 Jeux avec isOnline=true:', onlineCount, 'sur', result.games.length)
        
        // Vérifier spécifiquement "Gang Beasts"
        const gangBeasts = result.games.find(g => {
          const name = (g.name || g.title || '').toLowerCase()
          return name.includes('gang beasts')
        })
        if (gangBeasts) {
          log('[Games] 🔍 Gang Beasts trouvé - isOnline:', gangBeasts.isOnline, 'type:', typeof gangBeasts.isOnline)
        } else {
          log('[Games] ⚠️ Gang Beasts NON trouvé dans les jeux récupérés')
        }
        
        log('[Games] 📋 Premiers jeux:', result.games.slice(0, 3).map(g => `${g.name || g.title || 'Sans nom'} (online: ${g.isOnline})`))
      } else {
        log('[Games] ⚠️ Aucun jeu trouvé dans la réponse')
      }
      return result
    } catch (err) {
      errorLog('[Games] ❌ Erreur dans games:getGames:', err.message)
      errorLog('[Games] ❌ Stack:', err.stack)
      // Retourner un objet avec games vide au lieu de throw pour éviter de bloquer l'UI
      return { games: [] }
    }
  })

  // Handlers Discord RPC
  ipcMain.handle('discord-rpc:init', async () => {
    try {
      const service = await getDiscordRPCService()
      const result = await service.initDiscordRPC()
      return { success: result }
    } catch (err) {
      errorLog('discord-rpc:init error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('discord-rpc:setPresence', async (event, presence) => {
    try {
      const service = await getDiscordRPCService()
      const result = await service.setDiscordPresence(presence)
      return { success: result }
    } catch (err) {
      errorLog('discord-rpc:setPresence error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('discord-rpc:setGamePresence', async (event, gameName, gameImageKey) => {
    try {
      const service = await getDiscordRPCService()
      const result = await service.setGamePresence(gameName, gameImageKey)
      return { success: result }
    } catch (err) {
      errorLog('discord-rpc:setGamePresence error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('discord-rpc:resetPresence', async () => {
    try {
      const service = await getDiscordRPCService()
      const result = await service.resetPresence()
      return { success: result }
    } catch (err) {
      errorLog('discord-rpc:resetPresence error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('discord-rpc:disconnect', async () => {
    try {
      const service = await getDiscordRPCService()
      const result = await service.disconnectDiscordRPC()
      return { success: result }
    } catch (err) {
      errorLog('discord-rpc:disconnect error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('discord:openAuthUrl', async (event, url) => {
    return new Promise(async (resolve, reject) => {
      let authWindow = null
      try {
        // Logs réduits - seulement en cas d'erreur ou en dev
        const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
        
        // Vérifier que l'URL est valide
        if (!url || typeof url !== 'string') {
          errorLog('[IPC] ❌ URL invalide dans discord:openAuthUrl')
          reject(new Error('URL d\'authentification Discord invalide'))
          return
        }
        
        // Vérifier que l'URL contient bien le client_id
        if (!url.includes('client_id=') || url.includes('client_id=undefined')) {
          errorLog('[IPC] ❌ L\'URL ne contient pas de client_id valide!')
          reject(new Error('L\'URL d\'authentification ne contient pas de client_id valide'))
          return
        }
        
        const { DISCORD_CONFIG } = await import('./discord-config.mjs')
        const redirectUri = DISCORD_CONFIG.REDIRECT_URI
        
        // Logs détaillés uniquement en dev
        if (isDev) {
          try {
            const urlObj = new URL(url)
            const redirectParam = urlObj.searchParams.get('redirect_uri')
            if (redirectParam && decodeURIComponent(redirectParam) !== redirectUri) {
              errorLog('[IPC] ⚠️ INCOHÉRENCE: redirect_uri dans l\'URL ne correspond pas à DISCORD_CONFIG!')
            }
          } catch (e) {
            // Ignorer les erreurs de parsing en production
          }
        }
        
        // Créer la fenêtre IMMÉDIATEMENT pour éviter l'écran noir
        authWindow = new BrowserWindow({
          width: 500,
          height: 700,
          show: false, // Ne pas afficher immédiatement
          modal: true,
          parent: (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : (BrowserWindow.getFocusedWindow() || null),
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Optimisations pour la fenêtre d'auth
            backgroundThrottling: false,
            spellcheck: false,
            enableWebSQL: false,
            v8CacheOptions: 'code',
          }
        })

        // Masquer la barre de menu de la fenêtre Discord
        authWindow.setMenuBarVisibility(false)
        
        // Afficher un loader HTML pendant le chargement
        const loaderHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  background: linear-gradient(135deg, #0a0a0f 0%, #0f0f14 50%, #0a0a0f 100%);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .loader {
                  text-align: center;
                  color: #60a5fa;
                }
                .spinner {
                  width: 50px;
                  height: 50px;
                  border: 4px solid rgba(96, 165, 250, 0.2);
                  border-top-color: #60a5fa;
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
                  margin: 0 auto 20px;
                }
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
                .text {
                  color: #9ca3af;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="loader">
                <div class="spinner"></div>
                <div class="text">Connexion à Discord...</div>
              </div>
            </body>
          </html>
        `
        
        // Charger le loader immédiatement et afficher la fenêtre
        await authWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loaderHTML))
        authWindow.show()

        const handleCallback = (url) => {
          try {
            const urlObj = new URL(url)
            const redirectUriObj = new URL(redirectUri)
            
            // Vérifier si l'URL correspond au redirect URI (même origin)
            // OU si c'est une URL locale (localhost) avec le code
            const isRedirectUri = urlObj.origin === redirectUriObj.origin
            const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1'
            
            if (isRedirectUri || isLocalhost) {
              const code = urlObj.searchParams.get('code')
              const error = urlObj.searchParams.get('error')
              
              if (code) {
                log('[IPC] ✅ Code Discord reçu:', code.substring(0, 10) + '...')
                authWindow.close()
                resolve({ success: true, code })
                return true
              } else if (error) {
                errorLog('[IPC] ❌ Erreur Discord:', error)
                authWindow.close()
                resolve({ success: false, error })
                return true
              }
            }
          } catch (err) {
            errorLog('[IPC] handleCallback discord error:', err)
          }
          return false
        }

        // Gérer la fermeture de la fenêtre par l'utilisateur
        authWindow.on('closed', () => {
          // Si la Promise n'a pas encore été résolue, c'est que l'utilisateur a fermé la fenêtre
          if (!authWindow.isDestroyed || authWindow.isDestroyed()) {
            // Ne pas rejeter si on a déjà résolu
            // On vérifie si la fenêtre a été fermée sans résoudre la Promise
            setTimeout(() => {
              // Laisser la Promise en attente, le frontend gérera le timeout
            }, 100)
          }
        })

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

        authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
          errorLog('[IPC] ❌ Fenêtre Discord failed to load:', errorCode, errorDescription, validatedURL)
          if (errorCode !== -3) { // -3 = ERR_ABORTED (redirection normale)
            authWindow.close()
            reject(new Error(`Erreur de chargement: ${errorDescription}`))
          }
        })
        
        authWindow.webContents.on('did-start-loading', () => {
          // Logs désactivés pour réduire le bruit
        })
        
        authWindow.webContents.on('did-finish-load', () => {
          // Vérifier l'URL finale chargée
          const finalUrl = authWindow.webContents.getURL()
          // Vérifier si l'URL contient déjà le code (ignorer le loader HTML)
          if (finalUrl && !finalUrl.startsWith('data:text/html')) {
            handleCallback(finalUrl)
          }
        })
        
        // Attendre un court délai pour que le loader s'affiche, puis charger l'URL Discord
        setTimeout(() => {
          authWindow.loadURL(url).catch(err => {
            errorLog('[IPC] ❌ Erreur lors du chargement de l\'URL:', err)
            if (authWindow && !authWindow.isDestroyed()) {
              authWindow.close()
            }
            reject(err)
          })
        }, 100) // 100ms pour que le loader s'affiche
      } catch (err) {
        errorLog('discord:openAuthUrl error', err)
        reject(new Error(err.message || 'Erreur Discord'))
      }
    })
  })

  ipcMain.handle('app:quit', async () => {
    try {
      log('[App] Fermeture de l\'application demandée')
      
      // Fermer toutes les fenêtres d'abord
      const allWindows = BrowserWindow.getAllWindows()
      for (const win of allWindows) {
        if (win && !win.isDestroyed()) {
          win.destroy()
        }
      }
      
      // Tuer tous les processus enfants
      for (const childProcess of childProcesses) {
        try {
          if (childProcess && !childProcess.killed) {
            childProcess.kill('SIGTERM')
            setTimeout(() => {
              if (!childProcess.killed) {
                childProcess.kill('SIGKILL')
              }
            }, 500)
          }
        } catch (err) {
          // Ignorer les erreurs
        }
      }
      
      // Tuer tous les processus Actoris restants
      try {
        if (process.platform === 'win32') {
          exec('taskkill /F /IM Actoris.exe /T', (error) => {
            // Ignorer les erreurs (processus peut ne pas exister)
          })
        }
      } catch (err) {
        // Ignorer
      }
      
      // Quitter l'application
      app.exit(0)
      return { success: true }
    } catch (err) {
      errorLog('app:quit error', err)
      // Forcer la fermeture même en cas d'erreur
      app.exit(0)
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

  // Window control handlers
  ipcMain.handle('window:minimize', async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize()
        return { success: true }
      }
      return { success: false, error: 'Window not available' }
    } catch (err) {
      errorLog('window:minimize error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('window:maximize', async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.maximize()
        return { success: true }
      }
      return { success: false, error: 'Window not available' }
    } catch (err) {
      errorLog('window:maximize error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('window:unmaximize', async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.unmaximize()
        return { success: true }
      }
      return { success: false, error: 'Window not available' }
    } catch (err) {
      errorLog('window:unmaximize error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('window:close', async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close()
        return { success: true }
      }
      return { success: false, error: 'Window not available' }
    } catch (err) {
      errorLog('window:close error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('window:isMaximized', async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow.isMaximized()
      }
      return false
    } catch (err) {
      errorLog('window:isMaximized error', err)
      return false
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

/* ---------------- Supabase Users IPC handlers ---------------- */
ipcMain.handle('supabase:getUsers', async () => {
  try {
    log('[Supabase Users] Récupération des utilisateurs depuis Supabase...')
    const { getUsersFromSupabase } = await import('./supabase-users-service.mjs')
    const result = await getUsersFromSupabase()
    log('[Supabase Users] ✅ Utilisateurs récupérés:', result.users?.length || 0)
    return result
  } catch (err) {
    errorLog('[Supabase Users] ❌ Erreur lors de la récupération:', err)
    // Retourner un tableau vide en cas d'erreur plutôt que de faire échouer
    return { users: [] }
  }
})

/* ---------------- Steam IPC handlers ---------------- */
ipcMain.handle('steam:getGameData', async (event, appId) => {
  try {
    const service = await getSteamService()
    if (!service || !service.getSteamGameData) {
      throw new Error('Service Steam non disponible ou fonction getSteamGameData introuvable')
    }
    const result = await service.getSteamGameData(appId)
    return result
  } catch (err) {
    errorLog('steam:getGameData error', err)
    throw err
  }
})

/* ---------------- Games IPC handlers ---------------- */
// Note: games:getGames est maintenant dans registerCriticalHandlers() pour être disponible immédiatement

ipcMain.handle('games:addGame', async (event, gameData) => {
  try {
    log('games:addGame called')
    const service = await getGamesService()
    const result = await service.addGame(gameData)
    
    // Envoyer une notification Discord si l'ajout a réussi
    if (result && (result.success !== false)) {
      try {
        log('[Discord Webhook] 📤 Envoi de la notification pour le nouveau jeu...')
        const { notifyGameAdded } = await import('./discord-webhook-service.mjs')
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

  /* ---------------- Discord Webhook pour liens morts ---------------- */
  // Vérifier si le handler n'est pas déjà enregistré
  if (!discordDeadLinkHandlerRegistered) {
    discordDeadLinkHandlerRegistered = true
    ipcMain.handle('discord:notify-dead-link', async (event, gameName, errorMessage, gameId = null) => {
      try {
        log('[Discord Webhook] 📤 Demande d\'envoi de webhook pour lien mort:', gameName)
        const { notifyDeadLink } = await import('./discord-webhook-service.mjs')
        const result = await notifyDeadLink(gameName, errorMessage, gameId)
        if (result.success) {
          log('[Discord Webhook] ✅ Webhook envoyé avec succès pour:', gameName)
        } else {
          errorLog('[Discord Webhook] ⚠️ Échec de l\'envoi (non bloquant):', result.error)
        }
        return result
      } catch (webhookError) {
        errorLog('[Discord Webhook] ⚠️ Erreur lors de l\'envoi du webhook (non bloquant):', webhookError.message)
        return { success: false, error: webhookError.message }
      }
    })
  } else {
    log('[Discord Webhook] ⚠️ Handler discord:notify-dead-link déjà enregistré, ignoré')
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
    
    // Récupérer les données du jeu avant la mise à jour pour le webhook
    let gameDataBefore = null
    if (updates.downloadUrl) {
      try {
        const gamesResult = await service.getGamesFromGitHub(false)
        const allGames = gamesResult?.games || []
        gameDataBefore = allGames.find(g => g.id === gameId || String(g.id) === String(gameId))
      } catch (err) {
        log('[Webhook] ⚠️ Impossible de récupérer les données du jeu avant mise à jour:', err.message)
      }
    }
    
    const result = await service.updateGame(gameId, updates)
    log('games:updateGame success')
    
    // Envoyer une notification Discord si un lien de téléchargement a été mis à jour
    if (updates.downloadUrl && result && result.success !== false) {
      try {
        log('[Discord Webhook] 📤 Envoi de la notification pour lien remis à jour...')
        const { notifyLinkUpdated } = await import('./discord-webhook-service.mjs')
        
        // Récupérer les données complètes du jeu après la mise à jour
        const gamesResult = await service.getGamesFromGitHub(false)
        const allGames = gamesResult?.games || []
        const updatedGame = allGames.find(g => g.id === gameId || String(g.id) === String(gameId))
        
        if (updatedGame) {
          const webhookResult = await notifyLinkUpdated(updatedGame)
          if (webhookResult.success) {
            log('[Discord Webhook] ✅ Notification Discord envoyée avec succès pour lien remis à jour')
          } else {
            log('[Discord Webhook] ⚠️ Échec de l\'envoi (non bloquant):', webhookResult.error)
          }
        }
      } catch (webhookError) {
        // Ne pas faire échouer la mise à jour si le webhook échoue
        errorLog('[Discord Webhook] ⚠️ Erreur lors de l\'envoi du webhook pour lien remis à jour (non bloquant):', webhookError.message)
      }
    }
    
    return result
  } catch (err) {
    errorLog('games:updateGame error', err)
    throw err
  }
})

/* ---------------- Discord IPC handlers ---------------- */
  ipcMain.handle('discord:refreshToken', async (event, sessionToken) => {
  try {
    const service = await getDiscordService()
    if (service.refreshDiscordToken) {
        const result = await service.refreshDiscordToken(sessionToken)
    return result
    } else {
        return {
          success: false,
          error: 'Service de rafraîchissement non disponible'
        }
    }
  } catch (err) {
    errorLog('discord:refreshToken error', err)
      return {
        success: false,
        error: err.message || 'Erreur lors du rafraîchissement du token'
      }
    }
  })

  // Note: discord:getSession est maintenant dans registerCriticalHandlers() pour être disponible immédiatement

  ipcMain.handle('discord:syncRoles', async (event, sessionToken) => {
    try {
      const { syncRoles } = await import('./discord-service-secure.mjs').catch(() => import('./discord-service-secure.js'))
      const result = await syncRoles(sessionToken)
      return result
    } catch (err) {
      errorLog('discord:syncRoles error', err)
      return { success: false, error: err.message || 'Erreur lors de la synchronisation des rôles' }
    }
  })

  ipcMain.handle('discord:logout', async (event, sessionToken) => {
    try {
      const service = await getDiscordService()
      if (service.logout) {
        const result = await service.logout(sessionToken)
        return result
      } else {
        // Fallback : utiliser l'API directement
        const axios = (await import('axios')).default
        const API_URL = process.env.API_URL || 'http://127.0.0.1:3001'
        const response = await axios.post(`${API_URL}/api/discord/logout`, {
          sessionToken
        })
        return response.data
      }
    } catch (err) {
      errorLog('discord:logout error', err)
      return {
        success: false,
        error: err.message || 'Erreur lors de la déconnexion'
      }
  }
})

/* ---------------- Updates IPC handlers ---------------- */
ipcMain.handle('updates:download', async (event, url, filename) => {
  try {
    log('[Update] 📥 Handler updates:download appelé')
    log('[Update] URL:', url)
    log('[Update] Filename:', filename)
    
    const downloadsDir = app.getPath('downloads')
    const filePath = path.join(downloadsDir, filename || 'update.bin')
    
    log('[Update] 📁 Dossier de téléchargement:', downloadsDir)
    log('[Update] 📄 Chemin complet:', filePath)
    
    // Fonction de progression pour envoyer les mises à jour au renderer
    const onProgress = (received, total, progress) => {
      log('[Update] 📊 Progression:', Math.round(progress) + '%', `(${received}/${total} bytes)`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:download-progress', {
          received,
          total,
          progress: Math.round(progress)
        })
      }
    }
    
    log('[Update] 🚀 Démarrage du téléchargement...')
    
    await downloadWithRedirect(url, filePath, 0, onProgress)
    
    log('[Update] ✅ Téléchargement terminé:', filePath)
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      throw new Error('Le fichier téléchargé n\'existe pas')
    }
    
    const fileStats = fs.statSync(filePath)
    log('[Update] 📦 Taille du fichier:', fileStats.size, 'bytes')
    
    // Envoyer un événement de complétion
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:download-complete', {
        success: true,
        filePath
      })
      log('[Update] 📤 Événement update:download-complete envoyé')
    }
    
    return { success: true, filePath }
  } catch (error) {
    errorLog('[Update] Erreur de téléchargement:', error)
    return { success: false, error: error.message || 'Erreur de téléchargement' }
  }
})

// IPC Handler pour installer la mise à jour en arrière-plan (sans fermer le launcher)
ipcMain.handle('updates:installInBackground', async (event, installerPath) => {
  try {
    log('[Updater] Installation en arrière-plan demandée...')
    log('[Updater] Chemin de l\'installateur:', installerPath)
    
    if (!installerPath || !fs.existsSync(installerPath)) {
      throw new Error('Chemin de l\'installateur invalide ou fichier introuvable')
    }
    
    // Vérifier que le fichier est bien un .exe
    if (!installerPath.toLowerCase().endsWith('.exe')) {
      throw new Error('Le fichier installateur doit être un fichier .exe')
    }
    
    // Installer en arrière-plan avec spawn (sans afficher l'installateur)
    // Utiliser le paramètre /S pour installation silencieuse NSIS
    // Sur Windows, utiliser le chemin avec guillemets si nécessaire et shell: true
    const normalizedPath = path.normalize(installerPath)
    const quotedPath = normalizedPath.includes(' ') ? `"${normalizedPath}"` : normalizedPath
    
    // Utiliser exec au lieu de spawn pour les .exe sur Windows (plus fiable)
    const installCommand = `${quotedPath} /S`
    
    log('[Updater] Commande d\'installation:', installCommand)
    
    const installProcess = spawn(installCommand, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      shell: true // Nécessaire sur Windows pour exécuter les .exe
    })
    
    installProcess.unref() // Détacher le processus pour qu'il continue après la fermeture
    
    // Attendre un peu pour vérifier que le processus a démarré
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Vérifier si le processus est toujours en cours
    if (installProcess.killed) {
      throw new Error('L\'installation n\'a pas pu démarrer')
    }
    
    log('[Updater] Installation démarrée en arrière-plan (PID:', installProcess.pid, ')')
    
    // Envoyer un événement de complétion après un délai (approximatif)
    // En réalité, on ne peut pas vraiment savoir quand c'est terminé sans surveiller le processus
    // On va envoyer un événement après un délai raisonnable
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:install-complete', { success: true })
      }
    }, 5000) // 5 secondes pour l'installation (approximatif)
    
    return { success: true }
  } catch (error) {
    errorLog('[Updater] Erreur lors de l\'installation en arrière-plan:', error)
    const errorMessage = error.message || 'Erreur lors de l\'installation'
    // Nettoyer le message d'erreur pour éviter "spawn UNKNOWN"
    const cleanErrorMessage = errorMessage.replace(/spawn\s+UNKNOWN/gi, 'Erreur lors du lancement de l\'installateur')
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:install-complete', { 
        success: false, 
        error: cleanErrorMessage
      })
    }
    return { success: false, error: cleanErrorMessage }
  }
})

// IPC Handler pour installer la mise à jour (ancienne méthode - ferme le launcher)
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
    // Note: Le mode silencieux nécessite des privilèges administrateur
    // Si l'utilisateur n'a pas les privilèges, l'installateur s'affichera quand même
    log('[Updater] Lancement de l\'installation en mode silencieux...')
    
    // Tuer tous les processus Actoris une dernière fois avant l'installation
    try {
      if (process.platform === 'win32') {
        exec('taskkill /F /IM Actoris.exe /T', (error) => {
          // Ignorer les erreurs
        })
      }
    } catch (err) {
      // Ignorer
    }
    
    // Attendre un peu pour que les processus se ferment
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Installer en mode silencieux
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

  /* ---------------- Image Cache IPC handlers ---------------- */
  let imageCacheService = null
  async function getImageCacheService() {
    if (!imageCacheService) {
      imageCacheService = await import('./image-cache-service.js')
    }
    return imageCacheService
  }

  ipcMain.handle('image-cache:cacheImage', async (event, url) => {
    try {
      const service = await getImageCacheService()
      const result = await service.cacheImage(url)
      return { success: true, path: result }
    } catch (err) {
      errorLog('image-cache:cacheImage error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('image-cache:getCachedImagePath', async (event, url) => {
    try {
      const service = await getImageCacheService()
      const result = service.getCachedImagePath(url)
      return { success: true, path: result }
    } catch (err) {
      errorLog('image-cache:getCachedImagePath error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('image-cache:isImageCached', async (event, url) => {
    try {
      const service = await getImageCacheService()
      const result = service.isImageCached(url)
      return { success: true, cached: result }
    } catch (err) {
      errorLog('image-cache:isImageCached error', err)
      return { success: false, cached: false }
    }
  })

  ipcMain.handle('image-cache:preloadImage', async (event, url) => {
    try {
      const service = await getImageCacheService()
      await service.preloadImage(url)
      return { success: true }
    } catch (err) {
      errorLog('image-cache:preloadImage error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('image-cache:clearCache', async () => {
    try {
      const service = await getImageCacheService()
      service.clearCache()
      return { success: true }
    } catch (err) {
      errorLog('image-cache:clearCache error', err)
    return { success: false, error: err.message }
  }
})

  /* ---------------- Support IPC handlers ---------------- */
  ipcMain.handle('support:submitGameSuggestion', async (event, suggestionData) => {
    try {
      log('[Support] 📤 Envoi d\'une suggestion de jeu vers Discord (via serveur backend)...')
      
      // IMPORTANT: Tout est géré côté serveur backend pour la sécurité
      // Le serveur backend a accès au .env et au bot Discord
      const axios = (await import('axios')).default
      const API_URL = process.env.API_URL || 'http://127.0.0.1:3001'
      
      const response = await axios.post(`${API_URL}/api/discord/send-suggestion`, suggestionData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.data && response.data.success) {
        log('[Support] ✅ Suggestion envoyée avec succès via serveur backend')
        return {
          success: true,
          messageId: response.data.messageId,
          suggestionId: response.data.suggestionId
        }
      } else {
        errorLog('[Support] ❌ Échec de l\'envoi de la suggestion:', response.data?.error)
        return {
          success: false,
          error: response.data?.error || 'Erreur lors de l\'envoi'
        }
      }
    } catch (err) {
      errorLog('[Support] ❌ Erreur lors de l\'envoi de la suggestion:', err)
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Erreur inconnue'
      }
    }
  })

  log('[Handlers] Tous les handlers enregistrés')
}

/* ---------------- Universal Download Helpers ---------------- */

/**
 * Détecte le provider à partir de l'URL
 */
/**
 * Télécharge depuis BuzzHeavier en utilisant la fenêtre cachée Electron avec clic automatique
 * Détecte automatiquement les liens directs (CDN) vs pages BUZZHEAVIER
 */
async function downloadBuzzHeavierWithElectron(url, destinationPath = null) {
  log('[BuzzHeavier] Lancement avec fenêtre cachée Electron pour télécharger…')
  
  // 🎯 DÉTECTION AUTOMATIQUE : Lien direct ou page BUZZHEAVIER ?
  const isDirectLink = url.includes('/download/') || 
                       url.includes('dlproxy') || 
                       url.includes('.zip') || 
                       url.includes('.rar') ||
                       url.includes('.7z') ||
                       url.includes('solaris.dlproxy.uk') ||
                       url.includes('cdn') ||
                       url.includes('direct')
  
  if (isDirectLink) {
    log('[BuzzHeavier] ✅ Lien direct détecté, téléchargement immédiat')
    // Lien direct - Télécharger immédiatement via downloadURL
    return new Promise((resolve, reject) => {
      try {
        // Créer ou réutiliser la fenêtre cachée uniquement quand nécessaire
        if (!hiddenWindow || hiddenWindow.isDestroyed()) {
          createHiddenWindow()
        }
        
        const absoluteDestFolder = destinationPath || path.join(app.getPath('downloads'), 'Actoris Games')
        
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(absoluteDestFolder)) {
          fs.mkdirSync(absoluteDestFolder, { recursive: true })
          log('[BuzzHeavier] Dossier créé:', absoluteDestFolder)
        }
        
        // Extraire le nom de fichier de l'URL
        const urlPath = new URL(url).pathname
        const fileName = path.basename(urlPath) || 'download.zip'
        const filePath = path.join(absoluteDestFolder, fileName)
        
        log('[BuzzHeavier] Téléchargement direct vers:', filePath)
        
        // Utiliser downloadURL pour télécharger directement
        // Le téléchargement sera géré par will-download
        hiddenWindow.webContents.downloadURL(url)
        
        // Le téléchargement sera géré par will-download qui mettra à jour activeDownload
        // On attend un peu pour que will-download se déclenche
        setTimeout(() => {
          log('[BuzzHeavier] ✅ Téléchargement direct lancé')
          resolve({ success: true, method: 'direct_download', filePath })
        }, 500)
      } catch (error) {
        errorLog('[BuzzHeavier] Erreur lors du téléchargement direct:', error)
        reject(error)
      }
    })
  }
  
  // Sinon, c'est une page BUZZHEAVIER - continuer avec le processus normal
  log('[BuzzHeavier] Page BUZZHEAVIER détectée, chargement de la page...')

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
          
          // 🎯 ENVOYER LA CONFIRMATION VERS REDIRECT.HTML APRÈS LE DÉMARRAGE DU TÉLÉCHARGEMENT
          // Si le téléchargement vient d'un lien Lockr (via redirect.html), confirmer l'usage
          if (activeDownload && activeDownload.redirectUrl) {
            log('[BuzzHeavier] ✅ redirectUrl trouvé, envoi de la confirmation dans 500ms...')
            setTimeout(async () => {
              try {
                log('[BuzzHeavier] 📤 Envoi de la confirmation maintenant...')
                await confirmDownloadToRedirect(activeDownload.redirectUrl, activeDownload.gameName, activeDownload.gameId)
                log('[BuzzHeavier] ✅ Confirmation envoyée avec succès')
              } catch (err) {
                errorLog('[BuzzHeavier] ❌ Erreur lors de la confirmation vers redirect.html:', err)
              }
            }, 500)
          }
          
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
            
            // 🎯 ENVOYER LA CONFIRMATION VERS REDIRECT.HTML APRÈS LE DÉMARRAGE DU TÉLÉCHARGEMENT
            if (activeDownload && activeDownload.redirectUrl) {
              log('[BuzzHeavier] ✅ redirectUrl trouvé, envoi de la confirmation dans 500ms...')
              setTimeout(async () => {
                try {
                  log('[BuzzHeavier] 📤 Envoi de la confirmation maintenant...')
                  await confirmDownloadToRedirect(activeDownload.redirectUrl, activeDownload.gameName, activeDownload.gameId)
                  log('[BuzzHeavier] ✅ Confirmation envoyée avec succès')
                } catch (err) {
                  errorLog('[BuzzHeavier] ❌ Erreur lors de la confirmation vers redirect.html:', err)
                }
              }, 500)
            }
            
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
                  log('Bouton trouvé avec sélecteur:', selector)
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
          
          errorLog('Aucun bouton de téléchargement trouvé ou visible')
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
/**
 * Télécharge depuis GoFile en utilisant le script Python avancé
 */
async function downloadGofileWithElectron(url, destinationPath = null, gameName = null) {
  log('[GoFile] Utilisation du script Python avancé pour télécharger…')

  try {
    // Vérifier si c'est une URL Gofile valide
    if (!url.includes('gofile.io')) {
      throw new Error('[GoFile] URL invalide. Doit contenir gofile.io')
    }
    
    log('[GoFile] URL Gofile détectée:', url)

    const destFolder = destinationPath || app.getPath('downloads')
    const absoluteDestFolder = path.resolve(destFolder)
    log('[GoFile] Dossier de destination:', absoluteDestFolder)

    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(absoluteDestFolder)) {
      fs.mkdirSync(absoluteDestFolder, { recursive: true })
      log('[GoFile] Dossier créé:', absoluteDestFolder)
    }

    // Extraire l'ID depuis l'URL pour l'utiliser comme gameId
    const contentIdMatch = url.match(/gofile\.io\/d\/([a-zA-Z0-9]+)/)
    const gameId = contentIdMatch ? contentIdMatch[1] : null
    
    // Utiliser le nom du jeu fourni, sinon fallback vers l'ID
    const finalGameName = gameName || gameId || 'GofileDownload'
    
    log('[GoFile] Démarrage du téléchargement Python pour:', finalGameName)
    
    // Envoyer l'événement de démarrage
    const downloadData = {
      gameId: finalGameName, // Utiliser le nom du jeu comme ID
      gameName: finalGameName,
      url: url,
      destinationPath: absoluteDestFolder,
      provider: 'gofile',
      totalBytes: 0,
      downloadedBytes: 0,
      progress: 0,
      speed: 0,
      eta: 0
    }
    
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('download:started', downloadData)
        log('[GoFile] Événement download:started envoyé')
      }
    })
    
    // Démarrer le téléchargement en arrière-plan
    setImmediate(() => {
      startGofileDownloadProcess(url, absoluteDestFolder, finalGameName, gameId)
    })
    
    return { 
      success: true, 
      downloadUrl: url,
      destinationPath: absoluteDestFolder,
      method: 'python-script',
      gameId: finalGameName, // Utiliser le nom du jeu comme ID
      gameName: finalGameName
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
            try {
              download()
              return { success: true, method: 'direct_function_call' }
            } catch (e) {
              return { success: false, error: e.message }
            }
          }
          
          // Si la fonction n'existe pas, chercher le bouton et cliquer dessus
          // Chercher le bouton "Download" ou "Télécharger"
          const buttons = Array.from(document.querySelectorAll('button, a, .btn, [role="button"]'))
          
          for (const btn of buttons) {
            const text = btn.textContent.trim().toLowerCase()
            const isVisible = btn.offsetParent !== null
            
            // Koyso a un bouton "Download" ou "Télécharger" qui doit être visible
            if ((text === 'download' || text === 'télécharger' || text.includes('download')) && isVisible) {
              btn.click()
              return { success: true, text: btn.textContent.trim(), method: 'button_click' }
            }
          }
          
          // Chercher aussi dans div.download_div avec class="button"
          const downloadDiv = document.querySelector('div.download_div')
          if (downloadDiv) {
            const divButton = downloadDiv.querySelector('button.button, button[onclick*="download"]')
            if (divButton && divButton.offsetParent !== null) {
              divButton.click()
              return { success: true, text: divButton.textContent.trim(), method: 'download_div_click' }
            }
          }
          
          // Si pas trouvé, essayer avec un sélecteur CSS direct
          const downloadBtn = document.querySelector('button:not([style*="display: none"])')
          if (downloadBtn && downloadBtn.textContent.toLowerCase().includes('download') && downloadBtn.offsetParent !== null) {
            downloadBtn.click()
            return { success: true, text: downloadBtn.textContent.trim(), method: 'css_selector_click' }
          }
          
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
async function universalDownload(url, destinationPath = null, gameName = null) {
  log('[Downloader] URL reçue:', url)
  log('[Downloader] Nom du jeu:', gameName)

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
        return await downloadGofileWithElectron(url, destinationPath, gameName)
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

/* ---------------- Hidden window + webRequest interceptor ---------------- */

function createHiddenWindow() {
  if (hiddenWindow && !hiddenWindow.isDestroyed()) return hiddenWindow

  hiddenWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      // Optimisations pour la fenêtre cachée
      backgroundThrottling: false,
      spellcheck: false,
      enableWebSQL: false,
      v8CacheOptions: 'code',
      // Désactiver le rendu visuel (déjà offscreen)
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'Auxclick',
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
            
            // Détecter les domaines de téléchargement connus (buzzheavier, pixeldrain, etc.)
            const isKnownDownloadDomain = lower.includes('buzzheavier.com') || 
                                         lower.includes('pixeldrain.com') || 
                                         lower.includes('gofile.io') ||
                                         lower.includes('koyso.to')
            
            log('[Hidden webRequest] isFile:', isFile, 'useful:', useful, 'isKnownDownloadDomain:', isKnownDownloadDomain)

            if (isFile || useful || isKnownDownloadDomain) {
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
                
                // 🎯 ENVOYER LA CONFIRMATION VERS REDIRECT.HTML APRÈS LE DÉMARRAGE DU TÉLÉCHARGEMENT
                // Si le téléchargement vient d'un lien Lockr (via redirect.html), confirmer l'usage
                if (activeDownload && activeDownload.redirectUrl) {
                  log('[Hidden webRequest] ✅ redirectUrl trouvé, envoi de la confirmation dans 500ms...')
                  setTimeout(async () => {
                    try {
                      log('[Hidden webRequest] 📤 Envoi de la confirmation maintenant...')
                      await confirmDownloadToRedirect(activeDownload.redirectUrl, activeDownload.gameName, activeDownload.gameId)
                      log('[Hidden webRequest] ✅ Confirmation envoyée avec succès')
                    } catch (err) {
                      errorLog('[Hidden webRequest] ❌ Erreur lors de la confirmation vers redirect.html:', err)
                    }
                  }, 500)
                } else {
                  log('[Hidden webRequest] ⚠️ Pas de redirectUrl, confirmation ignorée')
                  if (!activeDownload) {
                    log('[Hidden webRequest] ⚠️ activeDownload est null/undefined')
                  } else if (!activeDownload.redirectUrl) {
                    log('[Hidden webRequest] ⚠️ activeDownload.redirectUrl est null/undefined')
                  }
                }
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
  // Nettoyer l'ancien listener si déjà défini (évite les leaks lors des rechargements)
  if (willDownloadListener) {
    try {
      session.defaultSession.removeListener('will-download', willDownloadListener)
    } catch (e) {
      // Ignorer les erreurs de nettoyage
    }
  }

  willDownloadListener = async (event, item, webContents) => {
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
    
    // 🎯 NOTE: Plus besoin de vérifier WinRAR car 7zip portable intégré peut extraire les RAR
    // Le launcher utilise maintenant 7zip portable intégré pour tous les formats (RAR, ZIP, 7Z, etc.)
    // L'extraction est 100% silencieuse, sans aucune fenêtre visible
    
    // 🎯 UTILISER L'INFO DU TÉLÉCHARGEMENT ACTIF
    let destFolder = downloadDestinationPath || app.getPath('downloads')
    let gameName = null
    
    log('[will-download] 🔍 Vérification de activeDownload...')
    log('[will-download] activeDownload existe?', !!activeDownload)
    if (activeDownload) {
      log('[will-download] activeDownload.redirectUrl:', activeDownload.redirectUrl)
      log('[will-download] activeDownload.gameName:', activeDownload.gameName)
      log('[will-download] activeDownload.gameId:', activeDownload.gameId)
    }
    
    // 🎯 VÉRIFIER SI LE TÉLÉCHARGEMENT VIENT D'UNE FENÊTRE LOCKR (après complétion des quêtes)
    const isFromLockrWindow = lockrWindows.some(win => win && !win.isDestroyed() && win.webContents === webContents)
    
    if (isFromLockrWindow && currentGameToLaunch) {
      log('[will-download] 🎯 Téléchargement détecté depuis une fenêtre Lockr (quêtes complétées)')
      log('[will-download] 🎮 Jeu:', currentGameToLaunch.gameName, 'ID:', currentGameToLaunch.gameId)
      
      // Mettre en pause le téléchargement pour demander le dossier
      log('[will-download] ⏸️ Mise en pause du téléchargement pour demander le dossier...')
      item.pause()
      
      // Créer activeDownload si nécessaire
      if (!activeDownload) {
        log('[will-download] 📝 Création de activeDownload pour le téléchargement Lockr')
        activeDownload = {
          gameId: currentGameToLaunch.gameId,
          gameName: currentGameToLaunch.gameName,
          folder: null, // Sera défini après la sélection du dossier
          url: downloadURL,
          originalUrl: downloadURL,
          timestamp: Date.now(),
          redirectUrl: null,
          downloadItem: item, // Stocker l'item pour pouvoir le reprendre
          waitingForFolder: true, // Indiquer qu'on attend la sélection du dossier
          lockrCompleted: true // Si will-download détecte ce téléchargement, c'est que Lockr a été complété
        }
      } else {
        activeDownload.downloadItem = item
        activeDownload.waitingForFolder = true
      }
      
      // Demander le dossier de téléchargement
      log('[will-download] 📁 Demande du dossier de téléchargement...')
      try {
        const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
          properties: ['openDirectory'],
          title: `Choisir le dossier de téléchargement pour ${currentGameToLaunch.gameName}`
        })
        
        if (result.canceled || !result.filePaths || !result.filePaths.length) {
          log('[will-download] ❌ Sélection de dossier annulée')
          event.preventDefault() // Annuler le téléchargement
          activeDownload = null
          return
        }
        
        destFolder = result.filePaths[0]
        log('[will-download] ✅ Dossier sélectionné:', destFolder)
        
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true })
          log('[will-download] 📁 Dossier créé:', destFolder)
        }
        
        // Mettre à jour activeDownload avec le dossier
        activeDownload.folder = destFolder
        activeDownload.waitingForFolder = false
        
        // Mettre à jour le chemin de sauvegarde et reprendre le téléchargement
        const filePath = path.join(destFolder, fileName)
        item.setSavePath(filePath)
        log('[will-download] ✅ Chemin de sauvegarde défini:', filePath)
        
        // Reprendre le téléchargement
        item.resume()
        log('[will-download] ▶️ Téléchargement repris')
        
        // Ouvrir automatiquement le dossier de téléchargement
        setTimeout(async () => {
          try {
            log('[will-download] 📁 Ouverture automatique du dossier de téléchargement...')
            await shell.openPath(destFolder)
            log('[will-download] ✅ Dossier ouvert:', destFolder)
            
            // 🚪 FERMER TOUTES LES FENÊTRES LOCKR (pop-ups ET fenêtre principale)
            closeAllLockrWindows()
          } catch (openErr) {
            errorLog('[will-download] ⚠️ Erreur lors de l\'ouverture du dossier:', openErr)
          }
        }, 1000) // Attendre 1 seconde pour que le téléchargement démarre
        
      } catch (err) {
        errorLog('[will-download] ❌ Erreur lors de la sélection du dossier:', err)
        event.preventDefault() // Annuler le téléchargement
        activeDownload = null
        return
      }
      
      gameName = currentGameToLaunch.gameName
    } else if (activeDownload) {
      log('  -> Game Name:', activeDownload.gameName)
      log('  -> Destination:', activeDownload.folder)
      destFolder = activeDownload.folder || destFolder
      gameName = activeDownload.gameName
    } else {
      log('  -> ⚠️ Aucun téléchargement actif, utilisation des valeurs par défaut')
      // Essayer d'extraire le nom du jeu du nom de fichier
      gameName = fileName ? path.basename(fileName, path.extname(fileName)) : 'Jeu'
      log('  -> Nom du jeu déduit:', gameName)
    }
    
    if (activeDownload && !activeDownload.waitingForFolder) {
      // Stocker le chemin final pour l'extraction (seulement si on n'attend pas le dossier)
      activeDownload.filePath = path.join(destFolder, fileName)
      activeDownload.fileName = fileName
      // Stocker l'objet item pour pouvoir le contrôler (pause/annuler)
      if (!activeDownload.downloadItem) {
      activeDownload.downloadItem = item
      }
      log('  -> ✅ activeDownload mis à jour avec le chemin du fichier et l\'objet item')
    } else if (activeDownload && activeDownload.waitingForFolder) {
      // Le dossier a déjà été demandé et défini dans le bloc précédent
      log('  -> ✅ activeDownload déjà configuré avec le dossier sélectionné')
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
    
    // Ensure destination folder exists (seulement si on n'a pas déjà géré le dossier pour Lockr)
    if (!isFromLockrWindow || !activeDownload || !activeDownload.waitingForFolder) {
    try {
      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true })
        log('  -> Created destination folder')
      }
    } catch (e) {
      errorLog('  -> Error creating destination folder:', e)
    }
    
    // 🎯 FORCER le chemin de sauvegarde (même pour les redirections)
      // Ne pas le faire si on vient de Lockr car c'est déjà fait dans le bloc précédent
    item.setSavePath(filePath)
    log('  -> Save path FORCED successfully')
    } else {
      log('  -> Save path déjà défini pour le téléchargement Lockr')
    }
    
    // 🎯 ÉMETTRE L'ÉVÉNEMENT download:started POUR INFORMER LE RENDERER
    const gameId = activeDownload ? activeDownload.gameId : null
    const finalGameName = gameName || (activeDownload ? activeDownload.gameName : 'Jeu') || 'Jeu'
    const totalBytes = item.getTotalBytes() || 0
    
    log('[will-download] 📤 Envoi de l\'événement download:started')
    log('[will-download]   - gameId:', gameId)
    log('[will-download]   - gameName:', finalGameName)
    log('[will-download]   - totalBytes:', totalBytes)
    log('[will-download]   - activeDownload existe?', !!activeDownload)
    
    const downloadData = {
      gameId: gameId || null,
      gameName: finalGameName,
      totalBytes: totalBytes
    }
    
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('download:started', downloadData)
        log('[will-download] ✅ Événement download:started envoyé à la fenêtre:', downloadData)
      }
    })
    
    // 🎯 ENVOYER LA CONFIRMATION VERS REDIRECT.HTML APRÈS LE DÉMARRAGE DU TÉLÉCHARGEMENT
    // Si le téléchargement vient d'un lien Lockr (via redirect.html), confirmer l'usage
    log('[will-download] 🔍 Vérification de la confirmation redirectUrl APRÈS setSavePath...')
    log('[will-download] activeDownload existe?', !!activeDownload)
    if (activeDownload) {
      log('[will-download] activeDownload.redirectUrl:', activeDownload.redirectUrl)
      log('[will-download] activeDownload.gameName:', activeDownload.gameName)
      log('[will-download] activeDownload.gameId:', activeDownload.gameId)
    }
    
    if (activeDownload && activeDownload.redirectUrl) {
      log('[will-download] ✅ redirectUrl trouvé, envoi de la confirmation dans 500ms...')
      setTimeout(async () => {
        try {
          log('[will-download] 📤 Envoi de la confirmation maintenant...')
          log('[will-download] redirectUrl:', activeDownload.redirectUrl)
          log('[will-download] gameName:', activeDownload.gameName)
          log('[will-download] gameId:', activeDownload.gameId)
          await confirmDownloadToRedirect(activeDownload.redirectUrl, activeDownload.gameName, activeDownload.gameId)
          log('[will-download] ✅ Confirmation envoyée avec succès')
        } catch (err) {
          errorLog('[will-download] ❌ Erreur lors de la confirmation vers redirect.html:', err)
        }
      }, 500) // Attendre 500ms pour s'assurer que le téléchargement est bien démarré
    } else {
      log('[will-download] ⚠️ Pas de redirectUrl, confirmation ignorée')
      if (!activeDownload) {
        log('[will-download] ⚠️ activeDownload est null/undefined')
      } else if (!activeDownload.redirectUrl) {
        log('[will-download] ⚠️ activeDownload.redirectUrl est null/undefined')
        log('[will-download] ⚠️ activeDownload complet:', JSON.stringify(activeDownload, null, 2))
      }
    }
    
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

          const errLockrCompleted = (activeDownload && activeDownload.lockrCompleted) || false
          
          allWindows.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('download:error', {
                gameId: errGameId,
                gameName: errGameName,
                error: 'interrupted', // Utiliser le mot-clé anglais pour la détection
                lockrCompleted: errLockrCompleted
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
          // Vérifier que item a la méthode isPaused avant de l'appeler
          if (typeof item.isPaused === 'function' && item.isPaused()) {
            log('[Download] Pausé - Ne pas envoyer de progression')
            // Envoyer un événement de pause au renderer
            if (activeDownload && activeDownload.gameName) {
              const allWindows = BrowserWindow.getAllWindows()
              allWindows.forEach(win => {
                if (win && !win.isDestroyed()) {
                  win.webContents.send('download:paused', {
                    gameId: activeDownload.gameId || null,
                    gameName: activeDownload.gameName
                  })
                }
              })
            }
            return // Ne pas continuer à envoyer la progression
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
      log('[Download] ✅ ÉVÉNEMENT "done" DÉCLENCHÉ !')
      log('[Download] État:', state)
      log('[Download] Fichier:', filePath)
      log('[Download] Nom du fichier:', fileName)
      
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
          const errLockrCompleted1 = (activeDownload && activeDownload.lockrCompleted) || false
          
          allWindows.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('download:error', {
                gameId: gameId,
                gameName: gameName,
                error: 'Le fichier téléchargé n\'existe pas. Il a peut-être été supprimé.',
                lockrCompleted: errLockrCompleted1
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
            const errLockrCompleted2 = (activeDownload && activeDownload.lockrCompleted) || false
            
            allWindows.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:error', {
                  gameId: gameId,
                  gameName: gameName,
                  error: 'Le fichier téléchargé est vide. Veuillez réessayer.',
                  lockrCompleted: errLockrCompleted2
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
            const errLockrCompleted3 = (activeDownload && activeDownload.lockrCompleted) || false
            
            allWindows.forEach(win => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download:error', {
                  gameId: gameId,
                  gameName: gameName,
                  error: `Téléchargement incomplet: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(expectedSize / 1024 / 1024).toFixed(2)} MB. Veuillez réessayer.`,
                  lockrCompleted: errLockrCompleted3
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
        log('[Download] 📦 VÉRIFICATION DE L\'ARCHIVE')
        log('[Download] Extension détectée:', fileExtension)
        
        // Liste étendue des extensions d'archives
        const archiveExtensions = ['.rar', '.zip', '.7z', '.tar', '.gz', '.bz2', '.tar.gz', '.tar.bz2']
        const isArchive = archiveExtensions.includes(fileExtension) || archiveExtensions.some(ext => filePath.toLowerCase().endsWith(ext))
        
        log('[Download] Est une archive?', isArchive)
        log('[Download] Nom du jeu:', gameName)
        log('[Download] Dossier de destination:', destFolder)
        log('[Download] Chemin du fichier:', filePath)
        log('[Download] activeDownload existe?', !!activeDownload)
        
        // Si ce n'est pas une archive reconnue mais qu'on a un nom de jeu, vérifier si c'est peut-être une archive
        if (!isArchive && gameName && fs.existsSync(filePath)) {
          // Vérifier les premiers octets pour détecter les signatures d'archives
          try {
            const buffer = Buffer.alloc(10)
            const fd = fs.openSync(filePath, 'r')
            fs.readSync(fd, buffer, 0, 10, 0)
            fs.closeSync(fd)
            
            // Vérifier les signatures communes
            const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B // PK (ZIP)
            const isRar = buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21 // Rar!
            const is7z = buffer[0] === 0x37 && buffer[1] === 0x7A && buffer[2] === 0xBC && buffer[3] === 0xAF // 7z signature
            
            if (isZip || isRar || is7z) {
              log('[Download] ⚠️ Archive détectée par signature mais extension non reconnue, extraction quand même')
              // Traiter comme une archive
            }
          } catch (sigError) {
            log('[Download] ⚠️ Impossible de vérifier la signature du fichier:', sigError.message)
          }
        }
        
        log('[Download] 📦 CONDITIONS POUR EXTRACTION:')
        log('[Download]   - isArchive:', isArchive)
        log('[Download]   - gameName:', gameName)
        log('[Download]   - Les deux conditions remplies?', isArchive && gameName)
        
        if (isArchive && gameName) {
          log('[Download] ✅ CONDITIONS REMPLIES - DÉMARRAGE DE L\'EXTRACTION')
          // 🎯 VÉRIFIER SI C'EST UN TÉLÉCHARGEMENT MULTI-PARTIES
          const isMultiPart = activeDownload ? activeDownload.isMultiPart : false
          const currentPart = activeDownload ? activeDownload.currentPart : null
          const totalParts = activeDownload ? activeDownload.totalParts : null
          const isLastPart = currentPart === totalParts
          
          log('[Download] 📦 Multi-parties?', isMultiPart, 'Partie:', currentPart, '/', totalParts)
          
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
              webContents || (mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null),
              gameId // Passer le gameId pour l'inclure dans le fichier .crklauncheur
            )
            const gameFolder = extractResult.gameFolder || extractResult // Compatibilité avec ancien format
            const exePath = extractResult.exePath || null
            log('[Extract] ✅ Installation terminée:', gameFolder)
            if (exePath) {
              log('[Extract] ✅ Exécutable trouvé:', exePath)
            }
            
            // Invalider le cache pour forcer un nouveau scan
            scanCache.lastScan = 0
            
            // 🔄 FORCER UN NOUVEAU SCAN DES JEUX INSTALLÉS
            log('[Extract] 🔄 Forcer un nouveau scan des jeux installés...')
            try {
              const extractor = await getGameExtractor()
              
              // Scanner le dossier de destination
              const installedGames = extractor.scanInstalledGames(destFolder, true)
              log('[Extract] ✅ Jeux installés détectés dans le dossier:', installedGames.length)
              
              // Convertir au format attendu par le cache
              const formattedGames = installedGames.map(game => ({
                id: game.gameId || game.id || activeDownload?.gameId || game.launcherId,
                gameId: game.gameId || game.id || activeDownload?.gameId || game.launcherId, // Utiliser le gameId du fichier .crklauncheur si disponible
                gameName: game.name || game.gameName || activeDownload?.gameName,
                name: game.name || game.gameName || activeDownload?.gameName,
                title: game.name || game.gameName || activeDownload?.gameName,
                path: game.path,
                gamePath: game.path,
                exePath: game.exePath,
                launcherId: game.launcherId || activeDownload?.gameId || null,
                installed: true
              }))
              
              // Fusionner avec les jeux existants dans le cache
              const existingGames = scanCache.games || []
              const mergedGames = [...existingGames]
              
              // Ajouter les nouveaux jeux (éviter les doublons)
              for (const newGame of formattedGames) {
                const exists = mergedGames.find(g => g.path === newGame.path || g.gamePath === newGame.path)
                if (!exists) {
                  mergedGames.push(newGame)
                }
              }
              
              // Mettre à jour le cache
              scanCache.lastScan = Date.now()
              scanCache.games = mergedGames
              log('[Extract] ✅ Cache mis à jour avec', mergedGames.length, 'jeux')
              
              // 💾 SAUVEGARDER LES JEUX INSTALLÉS DANS LE STORE
              try {
                await installedGamesStore.saveInstalledGamesFromScan(formattedGames)
                log('[Extract] 💾 Jeux sauvegardés dans le store de persistance')
              } catch (storeError) {
                errorLog('[Extract] ⚠️ Erreur lors de la sauvegarde dans le store:', storeError)
              }
              
              // Notifier le renderer que les jeux installés ont été mis à jour
              const allWindowsScan = BrowserWindow.getAllWindows()
              allWindowsScan.forEach(win => {
                if (win && !win.isDestroyed()) {
                  win.webContents.send('games:installed-updated', {
                    games: installedGames,
                    folder: destFolder
                  })
                  log('[Extract] 📤 Événement games:installed-updated envoyé')
                }
              })
            } catch (scanError) {
              errorLog('[Extract] ⚠️ Erreur lors du scan des jeux installés:', scanError)
            }
            
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
                const errLockrCompleted4 = (activeDownload && activeDownload.lockrCompleted) || false
                
                win.webContents.send('download:extraction-failed', {
                  gameId: gameId,
                  gameName: gameName,
                  error: extractError.message || 'Erreur inconnue lors de l\'extraction'
                })
                win.webContents.send('download:error', {
                  gameId: gameId,
                  gameName: gameName,
                  error: `Erreur d'extraction: ${extractError.message || 'Erreur inconnue'}`,
                  lockrCompleted: errLockrCompleted4
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
          log('[Download] ⚠️ EXTRACTION NON DÉCLENCHÉE - CONDITIONS NON REMPLIES')
          if (!isArchive) {
            log('[Download] ⚠️   Raison: Le fichier n\'est pas reconnu comme une archive')
            log('[Download] ⚠️   Extension:', fileExtension)
            log('[Download] ⚠️   Extensions supportées:', archiveExtensions)
          }
          if (!gameName) {
            log('[Download] ⚠️   Raison: Aucun nom de jeu disponible')
            log('[Download] ⚠️   activeDownload:', activeDownload ? 'existe' : 'null')
          }
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
        const errLockrCompleted5 = (activeDownload && activeDownload.lockrCompleted) || false
        
        allWindowsFail.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:error', {
              gameId: gameId,
              gameName: gameName,
              error: `Téléchargement échoué: ${state}`,
              lockrCompleted: errLockrCompleted5
            })
            log('[Download] 📤 Événement download:error envoyé')
          }
        })
        
        // Réinitialiser en cas d'échec
        if (activeDownload) activeDownload = null
      }
    })
  }

  session.defaultSession.on('will-download', willDownloadListener)
  log(LOG_LEVELS.INFO, 'Default session will-download handler set up')
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

// Handler IPC pour téléchargement Gofile avec script Python
ipcMain.handle('download:gofile', async (event, { url, installPath, gameName, password }) => {
  try {
    console.log('[IPC] Téléchargement Gofile demandé:', { url, installPath, gameName })
    
    // Créer le dossier d'installation s'il n'existe pas
    if (!fs.existsSync(installPath)) {
      fs.mkdirSync(installPath, { recursive: true })
    }
    
    // Extraire le nom du jeu depuis l'URL ou utiliser un nom par défaut
    const contentIdMatch = url.match(/gofile\.io\/d\/([a-zA-Z0-9]+)/)
    const gameId = contentIdMatch ? contentIdMatch[1] : null
    const finalGameName = gameName || gameId || 'GofileDownload'
    
    // Envoyer l'événement de démarrage immédiatement
    const downloadData = {
      gameId: gameName, // Utiliser le nom du jeu comme ID pour éviter la confusion avec l'ID Gofile
      gameName: finalGameName,
      url: url,
      destinationPath: installPath,
      provider: 'gofile',
      totalBytes: 0, // Sera mis à jour quand on connaîtra la taille
      downloadedBytes: 0,
      progress: 0,
      speed: 0,
      eta: 0
    }
    
    // Envoyer à toutes les fenêtres
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('download:started', downloadData)
        console.log('[IPC] Événement download:started envoyé pour Gofile')
      }
    })
    
    // Démarrer le téléchargement en arrière-plan
    setImmediate(() => {
      startGofileDownloadProcess(url, installPath, finalGameName, gameId, password)
    })
    
    // Retourner immédiatement le succès
    return { 
      success: true, 
      message: 'Téléchargement Gofile démarré',
      gameId: finalGameName, // Utiliser le nom du jeu comme ID
      gameName: finalGameName
    }
    
  } catch (error) {
    console.error('[IPC] Erreur téléchargement Gofile:', error)
    return { success: false, error: error.message }
  }
})

// Fonction pour démarrer le processus de téléchargement Gofile
// Fonction pour démarrer le processus de téléchargement Gofile (Version JavaScript native)
// Fonction pour démarrer le processus de téléchargement Gofile (Version hybride JavaScript Enhanced + Python fallback)
async function startGofileDownloadProcess(url, installPath, gameName, gameId, password = null) {
  try {
    console.log('[Gofile] Démarrage du processus de téléchargement Enhanced:', { url, installPath, gameName })
    
    // Essayer d'abord avec le téléchargeur JavaScript Enhanced (avec authentification)
    const jsSuccess = await tryGofileJavaScript(url, installPath, gameName, gameId, password)
    
    if (jsSuccess) {
      console.log('[Gofile] ✅ Téléchargement JavaScript Enhanced réussi')
      return
    }
    
    // Si JavaScript Enhanced échoue, basculer sur Python
    console.log('[Gofile] ⚠️ JavaScript Enhanced échoué, basculement sur Python...')
    await tryGofilePython(url, installPath, gameName, gameId, password)
    
  } catch (error) {
    console.error('[Gofile] Erreur lors du démarrage du téléchargement:', error)
    
    const errorData = {
      gameId: gameName,
      gameName: gameName,
      url: url,
      provider: 'gofile',
      success: false,
      error: 'Erreur système: ' + error.message
    }
    
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('download:error', errorData)
      }
    })
  }
}

// Tentative avec le téléchargeur JavaScript Enhanced (avec authentification)
async function tryGofileJavaScript(url, installPath, gameName, gameId, password) {
  try {
    console.log('[GofileJS] 🚀 Tentative avec téléchargeur JavaScript Enhanced (avec authentification)...')
    
    // Importer le téléchargeur Enhanced avec authentification automatique
    const { GofileDownloaderEnhanced } = require(path.join(__dirname, '..', 'scripts', 'gofile-downloader-enhanced.js'))
    
    // Créer une instance du téléchargeur Enhanced avec authentification automatique
    const downloader = new GofileDownloaderEnhanced({
      rootDir: installPath,
      maxWorkers: 3,
      timeout: 30000,
      chunkSize: 2 * 1024 * 1024, // 2MB
      retries: 3, // Moins de retries pour basculer plus vite sur Python
      password: password
    })
    
    let totalBytes = 0
    let downloadedBytes = 0
    let lastProgressTime = Date.now()
    let jsDownloadStarted = false
    
    const allWindows = BrowserWindow.getAllWindows()
    
    // Écouter les événements du téléchargeur
    downloader.on('log', (message) => {
      console.log('[GofileJS]', message)
    })
    
    downloader.on('error', (error) => {
      console.error('[GofileJS] Erreur:', error)
      
      // Ne pas envoyer l'erreur à l'UI si on n'a pas encore commencé le téléchargement
      // (on va essayer Python à la place)
      if (jsDownloadStarted) {
        const errorMessage = typeof error === 'string' ? error : error.message || error.toString()
        
        let userMessage = 'Erreur de téléchargement Gofile'
        let suggestions = []
        
        if (errorMessage.includes('Token Gofile requis') || errorMessage.includes('error-token') || errorMessage.includes('Impossible de créer un compte Gofile')) {
          userMessage = 'Authentification Gofile échouée'
          suggestions = [
            'L\'API Gofile a changé ses exigences d\'authentification',
            'Essayez avec une URL plus récente',
            'Le service basculera automatiquement sur Python'
          ]
        } else if (errorMessage.includes('non trouvé') || errorMessage.includes('error-notFound')) {
          userMessage = 'Contenu Gofile introuvable'
          suggestions = [
            'L\'URL est expirée ou le contenu a été supprimé',
            'Vérifiez l\'URL dans un navigateur',
            'Demandez une nouvelle URL'
          ]
        }
        
        const errorData = {
          gameId: gameName,
          gameName: gameName,
          url: url,
          provider: 'gofile',
          success: false,
          error: userMessage,
          suggestions: suggestions,
          technicalError: errorMessage
        }
        
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:error', errorData)
          }
        })
      }
    })
    
    downloader.on('fileStart', (data) => {
      jsDownloadStarted = true
      console.log('[GofileJS] Début téléchargement fichier:', data.filename)
      
      if (data.size > 0) {
        totalBytes = data.size
      }
    })
    
    downloader.on('progress', (data) => {
      const now = Date.now()
      
      // Throttle les événements de progression (toutes les 500ms)
      if (now - lastProgressTime > 500) {
        downloadedBytes = data.downloaded
        if (data.total > totalBytes) {
          totalBytes = data.total
        }
        
        const progressData = {
          gameId: gameName,
          gameName: gameName,
          url: url,
          provider: 'gofile',
          progress: data.progress,
          downloadedBytes: downloadedBytes,
          totalBytes: totalBytes,
          method: 'javascript-enhanced'
        }
        
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:progress', progressData)
          }
        })
        
        lastProgressTime = now
      }
    })
    
    downloader.on('fileComplete', (data) => {
      console.log('[GofileJS] Fichier terminé:', data.filename)
    })
    
    downloader.on('extractionStart', (data) => {
      console.log('[GofileJS] Début extraction:', data.filename)
      
      const extractionData = {
        gameId: gameName,
        gameName: gameName,
        provider: 'gofile',
        status: 'extracting',
        totalBytes: totalBytes,
        extractedBytes: 0
      }
      
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('extraction-started', extractionData)
        }
      })
    })
    
    downloader.on('extractionComplete', (data) => {
      console.log('[GofileJS] Extraction terminée:', data.filename)
      
      const extractionData = {
        gameId: gameName,
        gameName: gameName,
        provider: 'gofile',
        success: true,
        installPath: installPath
      }
      
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('download:extracted', extractionData)
        }
      })
      
      // Démarrer la détection automatique du jeu après extraction
      setTimeout(() => {
        detectAndRegisterGame(installPath, gameName)
      }, 2000)
    })
    
    // Démarrer le téléchargement JavaScript
    const success = await downloader.download(url)
    
    if (success) {
      console.log('[GofileJS] ✅ Téléchargement terminé avec succès')
      
      const completeData = {
        gameId: gameName,
        gameName: gameName,
        url: url,
        destinationPath: installPath,
        provider: 'gofile',
        success: true,
        totalBytes: totalBytes,
        downloadedBytes: totalBytes,
        method: 'javascript-enhanced'
      }
      
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('download:complete', completeData)
        }
      })
      
      return true
    } else {
      console.log('[GofileJS] ❌ Téléchargement JavaScript échoué')
      return false
    }
    
  } catch (error) {
    console.error('[GofileJS] Erreur JavaScript:', error.message)
    return false
  }
}

// Tentative avec le script Python (fallback)
async function tryGofilePython(url, installPath, gameName, gameId, password) {
  try {
    console.log('[GofilePY] 🐍 Basculement sur téléchargeur Python...')
    
    const allWindows = BrowserWindow.getAllWindows()
    
    // Notifier l'utilisateur du basculement
    allWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('download:info', {
          gameId: gameName,
          gameName: gameName,
          provider: 'gofile',
          message: 'Basculement sur méthode alternative...',
          method: 'python'
        })
      }
    })
    
    // Utiliser le service Python existant
    const gofilePythonService = require(path.join(__dirname, '..', 'src', 'services', 'gofilePythonService.js'))
    
    // Démarrer le téléchargement Python
    const success = await gofilePythonService.downloadGofile(url, installPath, gameName, {
      onProgress: (progress) => {
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:progress', {
              ...progress,
              gameId: gameName,
              gameName: gameName,
              provider: 'gofile',
              method: 'python'
            })
          }
        })
      },
      onComplete: (data) => {
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:complete', {
              ...data,
              gameId: gameName,
              gameName: gameName,
              provider: 'gofile',
              method: 'python'
            })
          }
        })
        
        // Démarrer la détection automatique du jeu
        setTimeout(() => {
          detectAndRegisterGame(installPath, gameName)
        }, 2000)
      },
      onError: (error) => {
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:error', {
              gameId: gameName,
              gameName: gameName,
              url: url,
              provider: 'gofile',
              success: false,
              error: 'Erreur Python: ' + error.message,
              method: 'python'
            })
          }
        })
      }
    })
    
    if (success) {
      console.log('[GofilePY] ✅ Téléchargement Python réussi')
    } else {
      console.log('[GofilePY] ❌ Téléchargement Python échoué')
    }
    
    return success
    
  } catch (error) {
    console.error('[GofilePY] Erreur Python:', error.message)
    
    // Erreur finale - les deux méthodes ont échoué
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('download:error', {
          gameId: gameName,
          gameName: gameName,
          url: url,
          provider: 'gofile',
          success: false,
          error: 'Toutes les méthodes de téléchargement ont échoué',
          suggestions: [
            'Vérifiez que l\'URL Gofile est valide',
            'Essayez de télécharger manuellement',
            'Contactez le support si le problème persiste'
          ],
          technicalError: error.message
        })
      }
    })
    
    return false
  }
}

// Fonction pour détecter et enregistrer automatiquement un jeu après extraction
async function detectAndRegisterGame(installPath, gameName) {
  try {
    console.log('[GameDetection] Détection automatique du jeu dans:', installPath)
    
    if (!fs.existsSync(installPath)) {
      console.error('[GameDetection] Dossier d\'installation non trouvé:', installPath)
      return
    }
    
    // Chercher les fichiers .exe dans le dossier et ses sous-dossiers
    const exeFiles = []
    
    function scanDirectory(dir, depth = 0) {
      if (depth > 3) return // Limiter la profondeur de scan
      
      try {
        const items = fs.readdirSync(dir)
        
        for (const item of items) {
          const itemPath = path.join(dir, item)
          const stat = fs.statSync(itemPath)
          
          if (stat.isFile() && item.toLowerCase().endsWith('.exe')) {
            // Ignorer les fichiers système et utilitaires courants
            const fileName = item.toLowerCase()
            if (!fileName.includes('unins') && 
                !fileName.includes('setup') && 
                !fileName.includes('install') && 
                !fileName.includes('redist') && 
                !fileName.includes('vcredist') && 
                !fileName.includes('directx') && 
                !fileName.includes('crash') &&
                !fileName.includes('report') &&
                !fileName.includes('update') &&
                !fileName.includes('launcher') &&
                !fileName.includes('patcher')) {
              
              exeFiles.push({
                path: itemPath,
                name: item,
                size: stat.size,
                dir: dir
              })
            }
          } else if (stat.isDirectory() && depth < 3) {
            // Scanner les sous-dossiers
            scanDirectory(itemPath, depth + 1)
          }
        }
      } catch (error) {
        console.error('[GameDetection] Erreur lors du scan de', dir, ':', error)
      }
    }
    
    scanDirectory(installPath)
    
    if (exeFiles.length === 0) {
      console.warn('[GameDetection] Aucun fichier .exe trouvé dans:', installPath)
      return
    }
    
    // Trier les .exe par taille (le plus gros en premier, souvent le jeu principal)
    exeFiles.sort((a, b) => b.size - a.size)
    
    console.log('[GameDetection] Fichiers .exe trouvés:', exeFiles.map(f => ({ name: f.name, size: f.size })))
    
    // Prendre le plus gros .exe comme jeu principal
    const mainExe = exeFiles[0]
    console.log('[GameDetection] .exe principal détecté:', mainExe.name)
    
    // Enregistrer le jeu dans le store des jeux installés
    try {
      // Utiliser le service d'installation de jeux
      const gameData = {
        gameId: gameName, // Utiliser le nom comme ID
        gameName: gameName,
        name: gameName,
        path: installPath,
        gamePath: installPath,
        exePath: mainExe.path,
        installDate: new Date().toISOString(),
        installedVersion: '1.0',
        launcherId: 'gofile-download'
      }
      
      // Utiliser le store des jeux installés
      const { installedGamesStore } = require('./installed-games-store.js')
      await installedGamesStore.addGame(gameData)
      
      console.log('[GameDetection] ✅ Jeu enregistré avec succès:', gameName)
      
      // Notifier toutes les fenêtres que le jeu a été installé
      const allWindows = BrowserWindow.getAllWindows()
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('game-installed', {
            gameId: gameName,
            gameName: gameName,
            installPath: installPath,
            exePath: mainExe.path
          })
        }
      })
      
    } catch (error) {
      console.error('[GameDetection] ❌ Erreur lors de l\'enregistrement:', error)
    }
    
  } catch (error) {
    console.error('[GameDetection] ❌ Erreur lors de la détection automatique:', error)
  }
}

// Handler IPC pour récupérer les informations Gofile
// Handler IPC pour récupérer les informations Gofile via Enhanced Downloader
ipcMain.handle('utils:getGofileInfo', async (event, url, password = null) => {
  try {
    console.log('[IPC] Récupération info Gofile Enhanced:', url)
    
    // Utiliser le téléchargeur Enhanced avec authentification automatique
    const { GofileDownloaderEnhanced } = require(path.join(__dirname, '..', 'scripts', 'gofile-downloader-enhanced.js'))
    
    const downloader = new GofileDownloaderEnhanced({
      rootDir: '/tmp', // Dossier temporaire, on ne télécharge pas
      timeout: 15000,
      password: password
    })
    
    // Extraire l'ID depuis l'URL
    const contentId = downloader.extractContentId(url)
    if (!contentId) {
      return { success: false, error: 'URL invalide - impossible d\'extraire l\'ID' }
    }
    
    console.log('[IPC] Content ID extrait:', contentId)
    
    // Créer un compte Gofile automatiquement
    await downloader.createGofileAccount()
    console.log('[IPC] Compte Gofile créé automatiquement')
    
    // Construire l'URL API avec authentification complète
    let apiUrl = `https://api.gofile.io/contents/${contentId}?cache=true&sortField=createTime&sortDirection=1`
    
    // Ajouter le mot de passe si fourni (hashé comme dans Python)
    if (password) {
      const crypto = require('crypto')
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex')
      apiUrl += `&password=${hashedPassword}`
      console.log('[IPC] Mot de passe hashé ajouté')
    }
    
    // Headers avec authentification complète (Enhanced)
    const headers = {
      ...downloader.defaultHeaders,
      'X-Website-Token': downloader.websiteToken, // Header spécial requis
      'Authorization': `Bearer ${downloader.token}`, // Token automatique
      'Accept': 'application/json'
    }
    
    console.log('[IPC] Requête API avec authentification Enhanced...')
    
    // Utiliser la méthode Enhanced pour faire la requête
    const apiData = await downloader.makeRequest(apiUrl, {
      method: 'GET',
      headers: headers
    })
    
    if (apiData && apiData.status === 'ok' && apiData.data) {
      console.log('[IPC] ✅ Informations Gofile Enhanced récupérées avec succès')
      
      // Calculer les statistiques
      let totalSize = 0
      let filesCount = 0
      
      if (apiData.data.children) {
        Object.values(apiData.data.children).forEach(child => {
          if (child.type === 'file' && child.size) {
            totalSize += parseInt(child.size)
            filesCount++
          }
        })
      }
      
      return { 
        success: true, 
        data: apiData.data,
        totalSize: totalSize,
        filesCount: filesCount,
        enhanced: true // Marqueur pour indiquer que c'est via Enhanced
      }
    } else {
      const errorMsg = apiData ? `Erreur API: ${apiData.status}` : 'Pas de réponse API'
      console.log('[IPC] ❌', errorMsg)
      return { success: false, error: errorMsg }
    }
    
  } catch (error) {
    console.error('[IPC] Erreur récupération Gofile Enhanced:', error)
    return { success: false, error: error.message }
  }
})

// Handler IPC pour préparer le téléchargement pour Lockr (sans télécharger maintenant)
ipcMain.handle('download:prepareForLockr', async (event, gameId, gameName, folderPath, lockrUrl) => {
  try {
    log('[Download] 📝 Préparation du téléchargement pour Lockr')
    log('[Download] 🎮 Jeu:', gameName, 'ID:', gameId)
    log('[Download] 📁 Dossier:', folderPath)
    log('[Download] 🔗 URL Lockr reçue:', lockrUrl)
    
    const destFolder = path.resolve(folderPath || app.getPath('downloads'))
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true })
      log('[Download] Dossier créé:', destFolder)
    }
    
    // 🎯 PRÉPARER activeDownload ET ATTENDRE QUE will-download DÉTECTE LE VRAI LIEN VIP
    // Le vrai lien VIP sera détecté automatiquement par will-download après que l'utilisateur
    // ait complété les quêtes Lockr et que Lockr redirige vers le vrai lien de téléchargement
    log('[Download] 📝 Préparation de activeDownload - attente que will-download détecte le vrai lien VIP...')
    
    // Préparer activeDownload avec le dossier sélectionné
    // Le vrai lien VIP sera détecté automatiquement par will-download quand Lockr redirige
    activeDownload = {
      gameId: gameId || null,
      gameName: gameName,
      folder: destFolder,
      url: lockrUrl, // URL Lockr (sera remplacée par le vrai lien VIP quand détecté)
      originalUrl: lockrUrl,
      timestamp: Date.now(),
      isMultiPart: false,
      currentPart: null,
      totalParts: null,
      redirectUrl: null,
      waitingForLockr: true, // Indiquer qu'on attend que will-download détecte le vrai lien VIP
      lockrCompleted: false // Les quêtes ne sont pas encore complétées
    }
    
    log('[Download] ✅ activeDownload préparé')
    log('[Download] 📁 Dossier sélectionné:', destFolder)
    log('[Download] ⏳ Le téléchargement démarrera automatiquement quand will-download détecte le vrai lien VIP')
    log('[Download] 📝 Le dossier sera utilisé automatiquement quand le téléchargement sera détecté')
    
    return { success: true, message: 'Dossier préparé. Le téléchargement démarrera automatiquement après les quêtes Lockr.' }
  } catch (err) {
    errorLog('[Download] ❌ Erreur lors de la préparation:', err)
    return { success: false, error: err.message }
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
  const userStatus = options.userStatus || { isAdmin: false, isVip: false, isBoost: false } // Par défaut, utilisateur gratuit
  
  log('[Download] ============================================')
  log('[Download] 🚀 NOUVEAU TÉLÉCHARGEMENT')
  log('[Download] URL:', url)
  log('[Download] Jeu:', gameName)
  log('[Download] Dossier:', destinationPath)
  const statusText = userStatus.isAdmin ? 'ADMIN' : (userStatus.isVip ? 'VIP' : (userStatus.isBoost ? 'BOOST' : 'GRATUIT'))
  log('[Download] Statut utilisateur:', statusText)
  log('[Download] ============================================')
  
  // 🎯 VÉRIFIER LE STATUT UTILISATEUR ET UTILISER LE LIEN LOCKR SPÉCIFIQUE AU JEU SI NÉCESSAIRE
  // Les admins, VIP et Boost ont accès direct aux liens (pas de Lockr.so)
  // Si lockrCompleted est true, cela signifie que l'utilisateur a déjà complété les pubs Lockr
  // et qu'on doit utiliser le lien direct fourni (pas le lien Lockr)
  let finalUrl = url
  const lockrCompleted = options.lockrCompleted || false
  
  // Récupérer le username Discord depuis userStatus pour l'utiliser comme userId dans les liens Lockr
  const discordUsername = userStatus?.username || null
  if (discordUsername) {
    log('[Download] 👤 Username Discord récupéré:', discordUsername)
  }
  
  if (!userStatus.isAdmin && !userStatus.isVip && !userStatus.isBoost && !lockrCompleted) {
    // Utilisateur gratuit ET pubs Lockr pas encore complétées : utiliser le lien Lockr spécifique au jeu
    let lockrUrl = null
    
    // Essayer de récupérer le lien Lockr depuis les données du jeu
    if (options.gameId) {
      try {
        const service = await getGamesService()
        const gamesResult = await service.getGamesFromGitHub()
        const games = gamesResult.games || []
        const game = games.find(g => g.id === options.gameId)
        
        if (game && game.lockrUrl) {
          lockrUrl = game.lockrUrl
          log('[Download] 🔒 Lien Lockr spécifique trouvé pour le jeu:', lockrUrl)
          
          // Si le lien Lockr contient déjà un userId, le remplacer par le username Discord
          // Sinon, ajouter le username comme userId dans l'URL de redirection
          // Note: Le userId sera ajouté automatiquement dans redirect.html via le protocole
        }
      } catch (err) {
        errorLog('[Download] ⚠️ Erreur lors de la récupération du lien Lockr:', err)
      }
    }
    
    // Si pas de lien Lockr spécifique, retourner une erreur
    if (!lockrUrl) {
      errorLog('[Download] ❌ Aucun lien Lockr configuré pour ce jeu:', gameName)
      throw new Error(`Aucun lien Lockr configuré pour "${gameName}". Veuillez contacter un administrateur.`)
    }
    
    finalUrl = lockrUrl
    log('[Download] 🔒 Utilisation du lien Lockr spécifique au jeu:', lockrUrl)
  } else if (lockrCompleted) {
    // Pubs Lockr déjà complétées, utiliser le lien direct fourni
    log('[Download] ✅ Pubs Lockr déjà complétées, utilisation du lien direct fourni')
  } else {
    log('[Download] ✅ Utilisateur ADMIN/VIP/BOOST, lien direct utilisé')
  }
  
  // S'assurer que destinationPath est une string valide
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
  
  // 🎯 DÉFINIR LE TÉLÉCHARGEMENT ACTIF
  log('[Download] 🔍 Options reçues pour activeDownload:')
  log('[Download]   - options.redirectUrl:', options.redirectUrl)
  log('[Download]   - options.gameId:', options.gameId)
  log('[Download]   - options.gameName:', options.gameName)
  
  activeDownload = {
    gameId: options.gameId || null,
    gameName: gameName,
    folder: destFolder,
    url: finalUrl, // Utiliser finalUrl (peut être un lien Lockr)
    originalUrl: url, // Conserver l'URL originale pour référence
    timestamp: Date.now(),
    isMultiPart: options.isMultiPart || false,
    currentPart: options.currentPart || null,
    totalParts: options.totalParts || null,
    redirectUrl: options.redirectUrl || null, // URL de redirect.html pour confirmation
    lockrCompleted: lockrCompleted // Indiquer si les publicités ont été complétées
  }
  
  log('[Download] Téléchargement actif défini:', activeDownload)
  log('[Download] 🔍 redirectUrl dans activeDownload:', activeDownload.redirectUrl)
  
  // Essayer d'abord le téléchargement universel (PixelDrain, BuzzHeavier, GoFile, Koyso, etc.)
  // Note: Si c'est un lien Lockr, on passe par le flux générique pour gérer les publicités
  try {
    const provider = detectProvider(finalUrl)
    if (provider !== 'unknown' && finalUrl === url) {
      // Seulement si ce n'est pas un lien Lockr et que le provider est supporté
      log('[Download] Provider supporté détecté:', provider, '- utilisation du téléchargement universel')
      const result = await universalDownload(finalUrl, destinationPath, gameName)
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

  // 🚀 NOUVEAU : Essayer le téléchargement parallèle accéléré pour les URLs directes
  // (seulement si ce n'est pas un lien Lockr et que l'option est activée)
  if (finalUrl === url && options.useAcceleratedDownload !== false) {
    // Vérifier si c'est une URL directe (http/https vers un fichier)
    const isDirectFileUrl = /^https?:\/\/.+\.(zip|rar|7z|exe|msi|tar|gz|bz2|iso|dmg|pkg)(\?.*)?$/i.test(finalUrl)
    
    if (isDirectFileUrl) {
      try {
        log('[Download] ⚡ Tentative de téléchargement parallèle accéléré...')
        const { ParallelDownloader } = await import('./download-accelerator.js')
        
        // Déterminer le nom du fichier
        const urlPath = new URL(finalUrl).pathname
        const fileName = path.basename(urlPath) || `${gameName}.zip`
        const outputPath = path.join(destFolder, fileName)
        
        // Créer le téléchargeur parallèle
        const downloader = new ParallelDownloader({
          chunkCount: options.chunkCount || 8,
          maxRetries: options.maxRetries || 3,
          timeout: options.timeout || 30000,
          onProgress: (progress) => {
            // Envoyer la progression au renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download:progress', {
                gameName: gameName,
                gameId: options.gameId || null,
                progress: progress.percentage,
                downloaded: progress.downloaded,
                total: progress.total
              })
            }
          }
        })
        
        // Écouter les événements
        downloader.on('progress', (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download:progress', {
              gameName: gameName,
              gameId: options.gameId || null,
              progress: progress.percentage,
              downloaded: progress.downloaded,
              total: progress.total
            })
          }
        })
        
        // Lancer le téléchargement
        await downloader.download(finalUrl, outputPath)
        
        log('[Download] ✅ Téléchargement parallèle réussi:', outputPath)
        
        // Notifier le renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download:complete', {
            gameName: gameName,
            gameId: options.gameId || null,
            filePath: outputPath
          })
        }
        
        return { success: true, path: outputPath }
      } catch (accelError) {
        errorLog('[Download] ⚠️ Téléchargement parallèle échoué, passage au flux générique:', accelError.message)
        // Continue avec le flux générique si le téléchargement parallèle échoue
      }
    }
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
        originalUrl: url, // Stocker l'URL originale pour utilisation en fallback
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
          errorLog('[Download] ⏱️ Timeout: aucun téléchargement détecté automatiquement après', timeoutMs, 'ms')
          errorLog('[Download] URL:', finalUrl)
          // signal renderer to consider visible mode
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download:requires-visible-interaction', { url: finalUrl })
          }
          // Ne PAS réinitialiser activeDownload ici car le téléchargement peut avoir démarré via downloadURL()
          // activeDownload sera réinitialisé dans le handler 'done' du téléchargement
          reject(new Error(`Le téléchargement n'a pas démarré automatiquement. Cela peut être dû à:\n- Un lien Lockr nécessitant la complétion des publicités\n- Un site nécessitant une interaction manuelle\n\nVeuillez réessayer ou contacter le support.`))
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
      
      // Vérifier que item est un DownloadItem valide avec les méthodes nécessaires
      if (typeof item.isDestroyed !== 'function' || typeof item.isPaused !== 'function' || typeof item.pause !== 'function') {
        errorLog('[Download] ⚠️ downloadItem invalide, méthodes manquantes')
        return { success: false, error: 'Objet de téléchargement invalide' }
      }
      
      if (!item.isDestroyed() && !item.isPaused()) {
        item.pause()
        log('[Download] Téléchargement mis en pause pour:', activeDownload.gameName)
        
        // Notifier toutes les fenêtres
        const allWindows = BrowserWindow.getAllWindows()
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:paused', {
              gameId: activeDownload.gameId || null,
              gameName: activeDownload.gameName
            })
          }
        })
        
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
      
      // Vérifier que item est un DownloadItem valide avec les méthodes nécessaires
      if (typeof item.isDestroyed !== 'function' || typeof item.isPaused !== 'function' || typeof item.resume !== 'function') {
        errorLog('[Download] ⚠️ downloadItem invalide, méthodes manquantes')
        return { success: false, error: 'Objet de téléchargement invalide' }
      }
      
      if (!item.isDestroyed() && item.isPaused()) {
        item.resume()
        log('[Download] Téléchargement repris pour:', activeDownload.gameName)
        
        // Notifier toutes les fenêtres
        const allWindows = BrowserWindow.getAllWindows()
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:resumed', {
              gameId: activeDownload.gameId || null,
              gameName: activeDownload.gameName
            })
          }
        })
        
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
      
      // Vérifier que item est un DownloadItem valide avec les méthodes nécessaires
      if (typeof item.isDestroyed !== 'function' || typeof item.cancel !== 'function') {
        errorLog('[Download] ⚠️ downloadItem invalide, méthodes manquantes')
        // Même si l'item est invalide, on peut quand même supprimer le fichier et réinitialiser
        const filePath = activeDownload.filePath
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath)
            log('[Download] 🗑️ Fichier supprimé:', filePath)
          } catch (deleteError) {
            errorLog('[Download] ⚠️ Erreur lors de la suppression du fichier:', deleteError)
          }
        }
        activeDownload = null
        return { success: true, fileDeleted: true, error: 'Objet de téléchargement invalide mais annulé' }
      }
      
      if (!item.isDestroyed()) {
        // 🗑️ SUPPRIMER LE FICHIER TÉLÉCHARGÉ (PARTIEL OU COMPLET) SI IL EXISTE
        let fileDeleted = false
        const filePath = activeDownload.filePath || item.getSavePath()
        
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath)
            fileDeleted = true
            log('[Download] 🗑️ Fichier supprimé:', filePath)
          } catch (deleteError) {
            errorLog('[Download] ⚠️ Erreur lors de la suppression du fichier:', deleteError)
            // Continuer même si la suppression échoue
          }
        }
        
        // Annuler le téléchargement
        item.cancel()
        const cancelledGameName = activeDownload.gameName
        log('[Download] Téléchargement annulé pour:', cancelledGameName)
        
        // Notifier toutes les fenêtres
        const allWindows = BrowserWindow.getAllWindows()
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:cancelled', {
              gameId: activeDownload.gameId,
              gameName: cancelledGameName,
              fileDeleted: fileDeleted
            })
          }
        })
        
        // Réinitialiser activeDownload
        activeDownload = null
        log('[Download] ✅ Téléchargement annulé et fichier supprimé pour:', cancelledGameName)
        return { success: true, fileDeleted: fileDeleted }
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
  // Récupérer les jeux installés (depuis le cache)
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
    // C'est CRUCIAL : on doit effacer tous les jeux précédents pour éviter
    // que des jeux non installés restent dans la liste
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
    // Chercher le gameId du catalogue pour chaque jeu scanné
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
            
            // Si le fichier .crklauncheur n'avait pas de gameId, le mettre à jour
            if (scannedGame.crklauncherFilePath && (!scannedGame.gameId || scannedGame.gameId === scannedGame.launcherId)) {
              try {
                const crkContent = JSON.parse(fs.readFileSync(scannedGame.crklauncherFilePath, 'utf8'))
                if (!crkContent.gameId && !crkContent.id) {
                  crkContent.gameId = String(catalogGameId)
                  crkContent.id = String(catalogGameId)
                  fs.writeFileSync(scannedGame.crklauncherFilePath, JSON.stringify(crkContent, null, 2), 'utf8')
                }
              } catch (updateError) {
                console.warn('[Scan] ⚠️ Impossible de mettre à jour le fichier .crklauncheur:', updateError)
              }
            }
            
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
      await installedGamesStore.saveInstalledGamesFromScan(allInstalledGames)
    } catch (storeError) {
      errorLog('[Scan] ⚠️ Erreur lors de la sauvegarde dans le store:', storeError)
    }
    
    // 🔄 FUSIONNER AVEC LES JEUX SAUVEGARDÉS (pour récupérer les jeux dont les dossiers existent toujours)
    const savedGames = await installedGamesStore.verifyInstalledGames(fs.existsSync)
    const mergedGames = await installedGamesStore.mergeWithScannedGames(allInstalledGames)
    
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

/* ---------------- IPC: is game installed ---------------- */
// S'assurer que le handler est enregistré avant app.whenReady()
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
    const allInstalled = await installedGamesStore.getAllInstalledGames()
    
    // Vérifier dans le store de persistance avec l'ID exact
    let savedGame = await installedGamesStore.getInstalledGame(gameId)
    
    // Si pas trouvé, essayer des variantes d'ID (lowercase, slug, etc.)
    if (!savedGame) {
      const gameIdLower = String(gameId).toLowerCase()
      const gameIdSlug = gameIdLower.replace(/\s+/g, '-')
      
      // Essayer avec toutes les clés disponibles
      for (const [key, value] of Object.entries(allInstalled)) {
        const keyLower = String(key).toLowerCase()
        if (keyLower === gameIdLower || keyLower === gameIdSlug || 
            String(key).toLowerCase() === String(gameId).toLowerCase()) {
          savedGame = value
          break
        }
      }
    }
    
    // Si toujours pas trouvé, chercher dans le cache de scan par nom (si on a le nom du jeu)
    // Cette partie sera gérée par le scan qui sauvegarde les jeux avec leur launcherId
    
    if (savedGame) {
      const gamePath = savedGame.path || savedGame.gamePath || savedGame.installFolder
      
      // Vérifier que le dossier existe vraiment
      if (gamePath && fs.existsSync(gamePath)) {
        log('[isGameInstalled] ✅ Jeu installé trouvé dans le store:', gameId, gamePath)
        return {
          installed: true,
          path: gamePath,
          gameData: {
            gameId: savedGame.gameId || gameId,
            gameName: savedGame.gameName || savedGame.name,
            path: gamePath,
            gamePath: gamePath,
            exePath: savedGame.exePath,
            launcherId: savedGame.launcherId,
            installDate: savedGame.installedAt,
            installedVersion: savedGame.version
          }
        }
      } else {
        // Le dossier n'existe plus, nettoyer
        log('[isGameInstalled] 🗑️ Dossier inexistant, suppression du store:', gameId, gamePath)
        await installedGamesStore.removeInstalledGame(gameId)
        return { installed: false, path: null, gameData: null }
      }
    }

    // Si toujours pas trouvé, chercher par nom dans tous les jeux sauvegardés
    // (utile si le jeu a été scanné avec un launcherId mais qu'on cherche avec le gameId du catalogue)
    if (!savedGame && Object.keys(allInstalled).length > 0) {
      // Obtenir le nom du jeu depuis le catalogue si possible
      // On va chercher dans tous les jeux sauvegardés pour trouver une correspondance par nom
      const gameIdStr = String(gameId).toLowerCase()
      
      for (const [key, gameData] of Object.entries(allInstalled)) {
        const gameName = (gameData.gameName || gameData.name || '').toLowerCase()
        const keyStr = String(key).toLowerCase()
        
        // Si le gameId correspond à un launcherId ou si on trouve une correspondance partielle
        if (keyStr === gameIdStr || 
            (gameName && (gameName.includes(gameIdStr) || gameIdStr.includes(gameName)))) {
          savedGame = gameData
          break
        }
      }
    }

    if (savedGame) {
      const gamePath = savedGame.path || savedGame.gamePath || savedGame.installFolder
      
      // Vérifier que le dossier existe vraiment
      if (gamePath && fs.existsSync(gamePath)) {
        return {
          installed: true,
          path: gamePath,
          gameData: {
            gameId: savedGame.gameId || gameId,
            gameName: savedGame.gameName || savedGame.name,
            path: gamePath,
            gamePath: gamePath,
            exePath: savedGame.exePath,
            launcherId: savedGame.launcherId,
            installDate: savedGame.installedAt,
            installedVersion: savedGame.version
          }
        }
      } else {
        // Le dossier n'existe plus, nettoyer
        await installedGamesStore.removeInstalledGame(gameId)
        return { installed: false, path: null, gameData: null }
      }
    }

    console.log('[isGameInstalled] ❌ Jeu non installé pour gameId:', gameId)
    return { installed: false, path: null, gameData: null }
  } catch (error) {
    errorLog('[Games] Erreur lors de la vérification de l\'installation:', error)
    console.error('[Games] Erreur détaillée:', error)
    return { installed: false, path: null, gameData: null, error: error.message }
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
    
    // Récupérer le username Discord depuis userStatus (si disponible)
    const discordUsername = userStatusObj?.username || userStatusObj?.discordUsername || null
    
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
              // Utiliser le username Discord comme userId pour le lien Lockr
              const redirectUrl = await adsService.getRedirectUrl(gameName, exePath, gameIdForRedirect, discordUsername)
              
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

/* ---------------- IPC: créer un casier Lockr pour un jeu ---------------- */
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

/* ---------------- IPC: récupérer les infos d'un casier Lockr ---------------- */
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

/* ---------------- IPC: mettre à jour un casier Lockr ---------------- */
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

/* ---------------- IPC: mettre à jour le lockrUrl d'un jeu par son nom ---------------- */
ipcMain.handle('lockr:updateGameLockrUrl', async (event, gameName, lockrUrl) => {
  try {
    log('[Lockr] Mise à jour du lockrUrl pour le jeu:', gameName)
    log('[Lockr] Nouveau lockrUrl:', lockrUrl)
    
    // Récupérer tous les jeux
    const service = await getGamesService()
    const gamesResult = await service.getGamesFromGitHub()
    const games = gamesResult.games || []
    
    // Chercher le jeu par nom (insensible à la casse)
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
    
    // Mettre à jour le jeu avec le nouveau lockrUrl
    await service.updateGame(game.id, { lockrUrl: lockrUrl })
    log('[Lockr] ✅ Jeu mis à jour avec succès dans la base de données')
    
    return { success: true, gameId: game.id, gameName: game.title || game.name, lockrUrl: lockrUrl }
  } catch (err) {
    errorLog('[Lockr] ❌ Erreur lors de la mise à jour du lockrUrl:', err)
    return { success: false, error: err.message }
  }
})

/* ---------------- IPC: Système à un seul lien Lockr ---------------- */
// Configuration : URL unique Lockr et URL de redirection Netlify
const UNIQUE_LOCKR_URL = 'https://lockr.net/7dhjn5m8' // URL Lockr unique pour tous les jeux
const NETLIFY_REDIRECT_URL = 'https://inquisitive-peony-762c3b.netlify.app/redirect' // URL Netlify déployée

// Fonction réutilisable pour créer une fenêtre Lockr
async function createLockrWindow(url, title = 'Lockr', isMainWindow = false) {
  // Créer une session séparée pour Lockr avec des permissions étendues
  const lockrSession = session.fromPartition(`lockr-session-${Date.now()}`, { cache: true })
  
  // Configurer le CSP pour la session Lockr
  lockrSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "frame-src *; " +
          "child-src * blob:; " +
          "worker-src * blob:; " +
          "script-src * 'unsafe-inline' 'unsafe-eval' blob:; " +
          "style-src * 'unsafe-inline'; " +
          "img-src * data: blob:; " +
          "connect-src *; " +
          "font-src * data:;"
        ]
      }
    })
  })
  
  // 🎯 IMPORTANT : Ajouter un listener will-download sur la session Lockr
  // pour détecter les téléchargements depuis les fenêtres Lockr
  lockrSession.on('will-download', async (event, item, webContents) => {
    log('[Lockr Session] ============================================')
    log('[Lockr Session] ✅✅✅ will-download détecté sur session Lockr! ✅✅✅')
    log('[Lockr Session] URL:', item.getURL())
    log('[Lockr Session] Filename:', item.getFilename())
    log('[Lockr Session] ============================================')
    
    // Vérifier si c'est un téléchargement depuis une fenêtre Lockr
    const isFromLockrWindow = lockrWindows.some(win => win && !win.isDestroyed() && win.webContents === webContents)
    log('[Lockr Session] isFromLockrWindow:', isFromLockrWindow)
    log('[Lockr Session] currentGameToLaunch:', currentGameToLaunch)
    
    if (isFromLockrWindow && currentGameToLaunch) {
      log('[Lockr Session] 🎯 Téléchargement détecté depuis une fenêtre Lockr (quêtes complétées)')
      log('[Lockr Session] 🎮 Jeu:', currentGameToLaunch.gameName, 'ID:', currentGameToLaunch.gameId)
      
      // Utiliser le même handler que la session par défaut
      // Mais on doit le faire manuellement car on est dans une session différente
      const fileName = item.getFilename()
      const downloadURL = item.getURL()
      
      // Ignorer les fichiers HTML
      const fileExtension = path.extname(fileName).toLowerCase()
      if (['.htm', '.html'].includes(fileExtension)) {
        log('[Lockr Session] ⚠️ Fichier HTML ignoré (redirection)')
        event.preventDefault()
        return
      }
      
      // Mettre en pause le téléchargement pour demander le dossier
      log('[Lockr Session] ⏸️ Mise en pause du téléchargement pour demander le dossier...')
      item.pause()
      
      // Créer activeDownload si nécessaire
      if (!activeDownload) {
        log('[Lockr Session] 📝 Création de activeDownload pour le téléchargement Lockr')
        activeDownload = {
          gameId: currentGameToLaunch.gameId,
          gameName: currentGameToLaunch.gameName,
          folder: null,
          url: downloadURL,
          originalUrl: downloadURL,
          timestamp: Date.now(),
          redirectUrl: null,
          downloadItem: item,
          waitingForFolder: true,
          lockrCompleted: true // Si will-download détecte ce téléchargement, c'est que Lockr a été complété
        }
      } else {
        activeDownload.downloadItem = item
        activeDownload.waitingForFolder = true
      }
      
      // Demander le dossier de téléchargement
      log('[Lockr Session] 📁 Demande du dossier de téléchargement...')
      try {
        const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
          properties: ['openDirectory'],
          title: `Choisir le dossier de téléchargement pour ${currentGameToLaunch.gameName}`
        })
        
        if (result.canceled || !result.filePaths || !result.filePaths.length) {
          log('[Lockr Session] ❌ Sélection de dossier annulée')
          event.preventDefault()
          activeDownload = null
          return
        }
        
        const destFolder = result.filePaths[0]
        log('[Lockr Session] ✅ Dossier sélectionné:', destFolder)
        
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true })
          log('[Lockr Session] 📁 Dossier créé:', destFolder)
        }
        
        // Mettre à jour activeDownload avec le dossier
        activeDownload.folder = destFolder
        activeDownload.waitingForFolder = false
        activeDownload.filePath = path.join(destFolder, fileName)
        activeDownload.fileName = fileName
        
        // Mettre à jour le chemin de sauvegarde et reprendre le téléchargement
        item.setSavePath(activeDownload.filePath)
        log('[Lockr Session] ✅ Chemin de sauvegarde défini:', activeDownload.filePath)
        
        // Reprendre le téléchargement
        item.resume()
        log('[Lockr Session] ▶️ Téléchargement repris')
        
        // Ouvrir automatiquement le dossier de téléchargement
        setTimeout(async () => {
          try {
            log('[Lockr Session] 📁 Ouverture automatique du dossier de téléchargement...')
            await shell.openPath(destFolder)
            log('[Lockr Session] ✅ Dossier ouvert:', destFolder)
            
            // 🚪 FERMER TOUTES LES FENÊTRES LOCKR (pop-ups ET fenêtre principale)
            closeAllLockrWindows()
          } catch (openErr) {
            errorLog('[Lockr Session] ⚠️ Erreur lors de l\'ouverture du dossier:', openErr)
          }
        }, 1000)
        
        // Émettre l'événement download:started
        const downloadData = {
          gameId: currentGameToLaunch.gameId,
          gameName: currentGameToLaunch.gameName,
          totalBytes: item.getTotalBytes() || 0
        }
        
        const allWindows = BrowserWindow.getAllWindows()
        allWindows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('download:started', downloadData)
            log('[Lockr Session] ✅ Événement download:started envoyé')
          }
        })
        
      } catch (err) {
        errorLog('[Lockr Session] ❌ Erreur lors de la sélection du dossier:', err)
        event.preventDefault()
        activeDownload = null
        return
      }
    } else {
      log('[Lockr Session] ⚠️ Téléchargement détecté mais conditions non remplies:')
      log('[Lockr Session]   - isFromLockrWindow:', isFromLockrWindow)
      log('[Lockr Session]   - currentGameToLaunch:', currentGameToLaunch ? 'existe' : 'null')
      log('[Lockr Session] ⚠️ Le téléchargement sera géré par la session par défaut')
    }
  })
  
  log('[Lockr] ✅ Listener will-download ajouté sur la session Lockr')
  log('[Lockr] 📝 Session Lockr créée:', lockrSession.partition)
  
  // Créer la fenêtre Lockr
  // Si c'est la fenêtre principale (avec les quêtes), utiliser une taille normale
  // Si c'est une fenêtre de pub, utiliser une petite taille
  const isMainLockrWindow = isMainWindow
  const windowConfig = isMainLockrWindow ? {
    // Fenêtre principale : taille normale pour les quêtes
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600
  } : {
    // Fenêtre de pub : petite taille pour reconnaître que c'est une publicité
    width: 600,
    height: 450,
    minWidth: 400,
    minHeight: 300
  }
  
  const newWindow = new BrowserWindow({
    ...windowConfig,
    parent: isMainWindow ? mainWindow : null,
    modal: false,
    autoHideMenuBar: !isMainLockrWindow, // Cacher la barre de menu seulement pour les pubs
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webviewTag: false,
      nativeWindowOpen: false,
      webSecurity: false,
      session: lockrSession,
      devTools: isDev && isMainLockrWindow, // Activer DevTools seulement en développement
      cache: true
    },
    title: title,
    resizable: true // Permettre le redimensionnement
  })
  
  // Ajouter à la liste des fenêtres
  lockrWindows.push(newWindow)
  
  // Nettoyer la liste quand la fenêtre se ferme
  newWindow.on('closed', () => {
    const index = lockrWindows.indexOf(newWindow)
    if (index > -1) {
      lockrWindows.splice(index, 1)
    }
    if (isMainWindow && newWindow === lockrWindow) {
      lockrWindow = null
    }
  })
  
  // Ne pas ouvrir DevTools par défaut pour les petites fenêtres de pub
  // En production, désactiver complètement DevTools (F12, Ctrl+Shift+I)
  
  // Raccourci clavier pour DevTools (seulement en développement)
  if (isDev) {
    newWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        if (newWindow.webContents.isDevToolsOpened()) {
          newWindow.webContents.closeDevTools()
        } else {
          newWindow.webContents.openDevTools()
        }
      }
      if (input.key === 'F12') {
        if (newWindow.webContents.isDevToolsOpened()) {
          newWindow.webContents.closeDevTools()
        } else {
          newWindow.webContents.openDevTools()
        }
      }
    })
  } else {
    // En production, bloquer tous les raccourcis DevTools
    newWindow.webContents.on('before-input-event', (event, input) => {
      // Bloquer F12
      if (input.key === 'F12') {
        event.preventDefault()
        return
      }
      // Bloquer Ctrl+Shift+I (ou Cmd+Option+I sur Mac)
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault()
        return
      }
      // Bloquer Ctrl+Shift+J (ou Cmd+Option+J sur Mac)
      if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'j') {
        event.preventDefault()
        return
      }
    })
    
    // S'assurer que DevTools n'est jamais ouvert en production
    if (newWindow.webContents.isDevToolsOpened()) {
      newWindow.webContents.closeDevTools()
    }
  }
  
  // Créer le menu de navigation
  const lockrMenu = Menu.buildFromTemplate([
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Précédent',
          accelerator: 'Alt+Left',
          click: () => {
            if (newWindow && !newWindow.isDestroyed() && newWindow.webContents.canGoBack()) {
              newWindow.webContents.goBack()
            }
          }
        },
        {
          label: 'Suivant',
          accelerator: 'Alt+Right',
          click: () => {
            if (newWindow && !newWindow.isDestroyed() && newWindow.webContents.canGoForward()) {
              newWindow.webContents.goForward()
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Actualiser',
          accelerator: 'F5',
          click: () => {
            if (newWindow && !newWindow.isDestroyed()) {
              newWindow.webContents.reload()
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Fermer',
          accelerator: 'Escape',
          click: () => {
            if (newWindow && !newWindow.isDestroyed()) {
              newWindow.close()
            }
          }
        }
      ]
    }
  ])
  
  newWindow.setMenu(lockrMenu)
  
  // Fonction pour injecter la barre de navigation
  const injectChromeNavigationBar = () => {
    if (!newWindow || newWindow.isDestroyed()) return
    
    const canGoBack = newWindow.webContents.canGoBack()
    const canGoForward = newWindow.webContents.canGoForward()
    
    newWindow.webContents.executeJavaScript(`
      (function() {
        const canGoBack = ${canGoBack};
        const canGoForward = ${canGoForward};
        
        const existingBar = document.getElementById('lockr-chrome-nav-bar')
        if (existingBar) {
          existingBar.remove()
        }
        
        const navBar = document.createElement('div')
        navBar.id = 'lockr-chrome-nav-bar'
        navBar.style.cssText = \`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 50px;
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border-bottom: 2px solid #0f3460;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 15px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        \`
        
        const navContainer = document.createElement('div')
        navContainer.style.cssText = \`
          display: flex;
          align-items: center;
          gap: 10px;
        \`
        
        const backBtn = document.createElement('button')
        backBtn.innerHTML = '← Précédent'
        backBtn.style.cssText = \`
          background: \${canGoBack ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #4b5563, #374151)'};
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: \${canGoBack ? 'pointer' : 'not-allowed'};
          opacity: \${canGoBack ? '1' : '0.5'};
          transition: all 0.2s ease;
        \`
        
        if (canGoBack) {
          backBtn.onclick = function() {
            if (window.electron && window.electron.lockr && window.electron.lockr.goBack) {
              window.electron.lockr.goBack()
            }
          }
        }
        
        const forwardBtn = document.createElement('button')
        forwardBtn.innerHTML = 'Suivant →'
        forwardBtn.style.cssText = \`
          background: \${canGoForward ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #4b5563, #374151)'};
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: \${canGoForward ? 'pointer' : 'not-allowed'};
          opacity: \${canGoForward ? '1' : '0.5'};
          transition: all 0.2s ease;
        \`
        
        if (canGoForward) {
          forwardBtn.onclick = function() {
            if (window.electron && window.electron.lockr && window.electron.lockr.goForward) {
              window.electron.lockr.goForward()
            }
          }
        }
        
        const closeBtn = document.createElement('button')
        closeBtn.innerHTML = '✕ Fermer'
        closeBtn.style.cssText = \`
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        \`
        
        closeBtn.onmouseenter = function() {
          this.style.background = 'linear-gradient(135deg, #f87171, #ef4444)'
          this.style.transform = 'scale(1.05)'
        }
        closeBtn.onmouseleave = function() {
          this.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
          this.style.transform = 'scale(1)'
        }
        closeBtn.onclick = function() {
          if (window.electron && window.electron.lockr && window.electron.lockr.closeWindow) {
            window.electron.lockr.closeWindow()
          }
        }
        
        navContainer.appendChild(backBtn)
        navContainer.appendChild(forwardBtn)
        navBar.appendChild(navContainer)
        navBar.appendChild(closeBtn)
        
        if (document.body) {
          document.body.insertBefore(navBar, document.body.firstChild)
          document.body.style.paddingTop = '50px'
        } else {
          window.addEventListener('DOMContentLoaded', function() {
            document.body.insertBefore(navBar, document.body.firstChild)
            document.body.style.paddingTop = '50px'
          })
        }
      })()
    `).catch(err => {
      errorLog('[Lockr] Erreur lors de l\'injection de la barre:', err)
    })
  }
  
  // Configurer le handler pour ouvrir de nouvelles fenêtres
  newWindow.webContents.setWindowOpenHandler(({ url }) => {
    log('[Lockr] 🔗 Nouvelle page demandée:', url)
    
    // Ne pas fermer automatiquement les fenêtres lors de l'ouverture d'une nouvelle page
    // La fermeture sera gérée uniquement lorsque le jeu sera vraiment lancé
    
    // Pour tous les liens Lockr/Netlify, ouvrir dans une nouvelle fenêtre Electron
    if (url.includes('lockr') || url.includes('netlify') || url.startsWith('http')) {
      log('[Lockr] ✅ Ouverture dans une nouvelle fenêtre Electron:', url)
      createLockrWindow(url, `Lockr - ${new URL(url).hostname}`, false)
      return { action: 'deny' } // Bloquer l'ouverture du navigateur, on gère nous-mêmes
    }
    
    // Bloquer les autres liens
    log('[Lockr] 🚫 Lien bloqué:', url)
    return { action: 'deny' }
  })
  
  // Surveiller les navigations pour détecter les redirections vers le vrai lien VIP
  newWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    log('[Lockr] 📍 Navigation vers:', navigationUrl)
    
    // 🎯 DÉTECTER LES REDIRECTIONS VERS DES LIENS DE TÉLÉCHARGEMENT (pixeldrain, buzzheavier, etc.)
    const downloadProviders = ['pixeldrain', 'buzzheavier', 'gofile', 'koyso', 'mega', 'mediafire', 'zippyshare']
    const isDownloadLink = downloadProviders.some(provider => navigationUrl.toLowerCase().includes(provider))
    
    if (isDownloadLink && currentGameToLaunch) {
      log('[Lockr] 🎯🎯🎯 LIEN DE TÉLÉCHARGEMENT DÉTECTÉ DANS LA NAVIGATION! 🎯🎯🎯')
      log('[Lockr] 📥 URL de téléchargement:', navigationUrl)
      log('[Lockr] 🎮 Jeu:', currentGameToLaunch.gameName, 'ID:', currentGameToLaunch.gameId)
      log('[Lockr] ⚠️ Le téléchargement devrait être détecté par will-download')
      // Ne pas bloquer - laisser will-download gérer
    }
    
    // Autoriser les navigations vers Lockr, Netlify et les liens de téléchargement
    if (!navigationUrl.includes('lockr') && 
        !navigationUrl.includes('netlify') && 
        !navigationUrl.includes('inquisitive-peony') &&
        !isDownloadLink) {
      log('[Lockr] 🚫 Navigation externe bloquée:', navigationUrl)
      event.preventDefault()
      return
    }
    
    // Ne pas fermer automatiquement les fenêtres lors de la navigation
    // La fermeture sera gérée uniquement via le handler IPC 'lockr:netlify-redirect-detected'
    // qui est appelé depuis la page redirect.html quand le jeu est vraiment lancé
  })
  
  // Aussi surveiller did-navigate pour détecter les redirections
  newWindow.webContents.on('did-navigate', (event, navigationUrl) => {
    log('[Lockr] ✅ Navigation terminée vers:', navigationUrl)
    
    // Détecter les liens de téléchargement
    const downloadProviders = ['pixeldrain', 'buzzheavier', 'gofile', 'koyso', 'mega', 'mediafire', 'zippyshare']
    const isDownloadLink = downloadProviders.some(provider => navigationUrl.toLowerCase().includes(provider))
    
    if (isDownloadLink && currentGameToLaunch) {
      log('[Lockr] 🎯 LIEN DE TÉLÉCHARGEMENT DÉTECTÉ DANS did-navigate!')
      log('[Lockr] 📥 URL:', navigationUrl)
      log('[Lockr] ⏳ Le téléchargement devrait être détecté par will-download sous peu...')
    }
    
    // Détecter quand on navigue vers redirect.html (Netlify) et mettre la fenêtre au premier plan
    if (navigationUrl && (navigationUrl.includes('redirect.html') || navigationUrl.includes('netlify') || navigationUrl.includes('inquisitive-peony'))) {
      log('[Lockr] 📍 Navigation vers redirect.html détectée, mise au premier plan...')
      // Mettre la fenêtre au premier plan avec plusieurs méthodes pour s'assurer qu'elle reste visible
      if (newWindow && !newWindow.isDestroyed()) {
        // Méthode 1 : Toujours au-dessus temporairement
        newWindow.setAlwaysOnTop(true)
        newWindow.show()
        newWindow.focus()
        newWindow.moveTop()
        
        // Méthode 2 : Forcer le focus de la fenêtre principale si elle existe
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus()
          // Puis remettre le focus sur la fenêtre Lockr
          setTimeout(() => {
            if (newWindow && !newWindow.isDestroyed()) {
              newWindow.focus()
            }
          }, 100)
        }
        
        // Méthode 3 : Désactiver "toujours au-dessus" après 3 secondes pour ne pas bloquer l'utilisateur
        setTimeout(() => {
          if (newWindow && !newWindow.isDestroyed()) {
            newWindow.setAlwaysOnTop(false)
            log('[Lockr] ✅ Mode "toujours au-dessus" désactivé après 3 secondes')
          }
        }, 3000)
        
        log('[Lockr] ✅ Fenêtre mise au premier plan avec toujours au-dessus temporaire')
      }
    }
  })
  
  // Injecter la barre après le chargement
  newWindow.webContents.on('did-finish-load', () => {
    const currentUrl = newWindow.webContents.getURL()
    
    // Détecter redirect.html et mettre au premier plan
    if (currentUrl && (currentUrl.includes('redirect.html') || currentUrl.includes('netlify') || currentUrl.includes('inquisitive-peony'))) {
      log('[Lockr] 📍 Page redirect.html chargée, mise au premier plan...')
      if (newWindow && !newWindow.isDestroyed()) {
        newWindow.setAlwaysOnTop(true)
        newWindow.show()
        newWindow.focus()
        newWindow.moveTop()
        
        setTimeout(() => {
          if (newWindow && !newWindow.isDestroyed()) {
            newWindow.setAlwaysOnTop(false)
          }
        }, 3000)
        
        log('[Lockr] ✅ Fenêtre redirect.html mise au premier plan')
      }
    }
    
    // Injecter la barre de navigation
    setTimeout(() => {
      injectChromeNavigationBar()
    }, 1000)
  })
  
  newWindow.webContents.on('did-frame-finish-load', (event, isMainFrame) => {
    if (isMainFrame) {
      setTimeout(() => {
        injectChromeNavigationBar()
      }, 500)
    }
  })
  
  // Charger l'URL
  await newWindow.loadURL(url)
  
  // Mettre la fenêtre au premier plan après le chargement initial
  if (newWindow && !newWindow.isDestroyed()) {
    newWindow.show()
    newWindow.focus()
  }
  
  return newWindow
}

// Fonction pour ouvrir Lockr avec un seul lien pour tous les jeux
async function openLockrForGame(gameId, gameName) {
  try {
    log('[Lockr Unique] 🎮 Ouverture Lockr pour le jeu:', gameName, 'ID:', gameId)
    
    // Sauvegarder le jeu sélectionné
    currentGameToLaunch = { gameId, gameName }
    log('[Lockr Unique] 💾 Jeu sauvegardé:', currentGameToLaunch)
    
    // Pour les utilisateurs gratuits, le système will-download détectera automatiquement
    // le vrai lien VIP quand Lockr redirige après la complétion des quêtes
    // Le dossier sera demandé automatiquement quand le téléchargement sera détecté
    
    // Fermer toutes les fenêtres Lockr existantes
    lockrWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.close()
      }
    })
    lockrWindows = []
    
    // Construire l'URL Netlify avec les paramètres du jeu
    const netlifyUrl = new URL(NETLIFY_REDIRECT_URL)
    netlifyUrl.searchParams.set('game', gameName)
    if (gameId) {
      netlifyUrl.searchParams.set('gameId', gameId)
    }
    const netlifyUrlWithParams = netlifyUrl.toString()
    
    // Construire l'URL Lockr avec la redirection Netlify (incluant les paramètres du jeu)
    const fullLockrUrl = `${UNIQUE_LOCKR_URL}?redirect=${encodeURIComponent(netlifyUrlWithParams)}`
    log('[Lockr Unique] ═══════════════════════════════════════')
    log('[Lockr Unique] 🎮 JEU SÉLECTIONNÉ:', gameName)
    log('[Lockr Unique] 🆔 Game ID:', gameId)
    log('[Lockr Unique] 🔗 URL Lockr:', fullLockrUrl)
    log('[Lockr Unique] ➡️  Redirection attendue:', netlifyUrlWithParams)
    log('[Lockr Unique] ═══════════════════════════════════════')
    
    // Réinitialiser la variable globale de redirection
    lockrRedirectDetected = false
    
    // Créer la fenêtre principale Lockr
    lockrWindow = await createLockrWindow(fullLockrUrl, `Lockr - ${gameName}`, true)
    
    log('[Lockr Unique] ✅ Fenêtre Lockr créée avec succès')
    
    return { success: true }
  } catch (err) {
    errorLog('[Lockr Unique] ❌ Erreur lors de l\'ouverture de Lockr:', err)
    currentGameToLaunch = null
    return { success: false, error: err.message }
  }
}

// Handler IPC pour lancer un jeu via le système à un seul lien Lockr
ipcMain.handle('lockr:launchGameWithUniqueLink', async (event, gameId, gameName) => {
  try {
    log('[Lockr Unique] ═══════════════════════════════════════')
    log('[Lockr Unique] 🎮 DEMANDE DE LANCEMENT VIA LIEN UNIQUE')
    log('[Lockr Unique] 📛 Jeu:', gameName)
    log('[Lockr Unique] 🆔 ID:', gameId)
    log('[Lockr Unique] ═══════════════════════════════════════')
    
    // Vérifier que les paramètres sont valides
    if (!gameId || !gameName) {
      errorLog('[Lockr Unique] ❌ Paramètres manquants:', { gameId, gameName })
      return { success: false, error: 'Paramètres manquants: gameId et gameName sont requis' }
    }
    
    // Ouvrir Lockr dans une fenêtre Electron (PAS dans le navigateur)
    await openLockrForGame(gameId, gameName)
    
    log('[Lockr Unique] ✅ Fonction openLockrForGame appelée avec succès')
    return { success: true }
  } catch (err) {
    errorLog('[Lockr Unique] ❌ Erreur:', err)
    errorLog('[Lockr Unique] ❌ Stack:', err.stack)
    return { success: false, error: err.message }
  }
})

// Handler IPC pour récupérer le jeu actuellement sélectionné
ipcMain.handle('lockr:getCurrentGame', async (event) => {
  return currentGameToLaunch
})

// Handler IPC pour fermer la fenêtre Lockr
ipcMain.handle('lockr:close-window', async (event) => {
  // 🎯 FERMER UNIQUEMENT LA FENÊTRE QUI A ENVOYÉ L'ÉVÉNEMENT
  // Ne pas fermer toutes les fenêtres, juste celle qui a cliqué sur "Fermer"
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  
  if (senderWindow && !senderWindow.isDestroyed()) {
    log('[Lockr] 🚪 Fermeture de la fenêtre Lockr qui a envoyé l\'événement')
    
    // Retirer la fenêtre de la liste lockrWindows
    const index = lockrWindows.findIndex(win => win && !win.isDestroyed() && win === senderWindow)
    if (index !== -1) {
      lockrWindows.splice(index, 1)
      log(`[Lockr] ✅ Fenêtre retirée de la liste (index ${index})`)
    }
    
    // Fermer uniquement cette fenêtre
    senderWindow.close()
    return { success: true }
  }
  
  // Fallback : utiliser lockrWindow si senderWindow n'est pas trouvé
  if (lockrWindow && !lockrWindow.isDestroyed()) {
    log('[Lockr] ⚠️ Utilisation du fallback lockrWindow')
    lockrWindow.close()
    return { success: true }
  }
  
  return { success: false, error: 'Fenêtre Lockr non trouvée' }
})

// Handler IPC pour navigation
ipcMain.handle('lockr:go-back', async (event) => {
  // 🎯 UTILISER LA FENÊTRE QUI A ENVOYÉ L'ÉVÉNEMENT
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  
  if (senderWindow && !senderWindow.isDestroyed() && senderWindow.webContents.canGoBack()) {
    senderWindow.webContents.goBack()
    return { success: true }
  }
  
  // Fallback : utiliser lockrWindow si senderWindow n'est pas trouvé
  if (lockrWindow && !lockrWindow.isDestroyed() && lockrWindow.webContents.canGoBack()) {
    lockrWindow.webContents.goBack()
    return { success: true }
  }
  
  return { success: false }
})

ipcMain.handle('lockr:go-forward', async (event) => {
  // 🎯 UTILISER LA FENÊTRE QUI A ENVOYÉ L'ÉVÉNEMENT
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  
  if (senderWindow && !senderWindow.isDestroyed() && senderWindow.webContents.canGoForward()) {
    senderWindow.webContents.goForward()
    return { success: true }
  }
  
  // Fallback : utiliser lockrWindow si senderWindow n'est pas trouvé
  if (lockrWindow && !lockrWindow.isDestroyed() && lockrWindow.webContents.canGoForward()) {
    lockrWindow.webContents.goForward()
    return { success: true }
  }
  
  return { success: false }
})

// Handler IPC pour détecter les redirections Netlify depuis le renderer
ipcMain.on('lockr:netlify-redirect-detected', (event, url) => {
  log('[Lockr Unique] ✅✅✅ REDIRECTION NETLIFY DÉTECTÉE DANS UN IFRAME ! ✅✅✅')
  log('[Lockr Unique] 🔗 URL:', url)
  log('[Lockr Unique] 🎯 Jeu qui va se lancer:', currentGameToLaunch?.gameName, 'ID:', currentGameToLaunch?.gameId)
  
  lockrRedirectDetected = true
  
  // Lancer le téléchargement du jeu si on a les infos du jeu
  if (currentGameToLaunch && currentGameToLaunch.gameId && currentGameToLaunch.gameName) {
    log('[Lockr Unique] 🚀 Lancement du téléchargement du jeu...')
    log('[Lockr Unique] 📛 Jeu:', currentGameToLaunch.gameName)
    log('[Lockr Unique] 🆔 ID:', currentGameToLaunch.gameId)
    
    // Utiliser unlockGame pour lancer le téléchargement
    unlockGame(currentGameToLaunch.gameName, currentGameToLaunch.gameId, url)
  } else {
    log('[Lockr Unique] ⚠️ Pas d\'infos de jeu disponibles pour lancer le téléchargement')
  }
  
  // Trouver la fenêtre qui a envoyé le message et la fermer uniquement
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  
  // Fermer uniquement la fenêtre qui a détecté la redirection après 30 secondes (augmenté pour laisser plus de temps)
  setTimeout(() => {
    if (senderWindow && !senderWindow.isDestroyed()) {
      log('[Lockr Unique] 🚪 Fermeture de la fenêtre Lockr après redirection...')
      senderWindow.close()
    }
  }, 30000) // 30 secondes pour laisser le temps de voir le message de succès
})

// Handler IPC pour lancer le téléchargement depuis redirect.html
ipcMain.handle('lockr:startGameDownload', async (event, gameId, gameName, redirectUrl = null) => {
  try {
    log('[Lockr] 🚀 Demande de lancement du téléchargement depuis redirect.html')
    log('[Lockr] 📛 Jeu reçu:', gameName)
    log('[Lockr] 🆔 ID reçu:', gameId)
    log('[Lockr] 🔗 Redirect URL:', redirectUrl)
    
    // Si les paramètres ne sont pas fournis, utiliser currentGameToLaunch
    let finalGameId = gameId
    let finalGameName = gameName
    
    if (!finalGameId || !finalGameName) {
      log('[Lockr] ⚠️ Paramètres manquants, utilisation de currentGameToLaunch...')
      if (currentGameToLaunch) {
        if (!finalGameId && currentGameToLaunch.gameId) {
          finalGameId = currentGameToLaunch.gameId
          log('[Lockr] ✅ GameId récupéré depuis currentGameToLaunch:', finalGameId)
        }
        if (!finalGameName && currentGameToLaunch.gameName) {
          finalGameName = currentGameToLaunch.gameName
          log('[Lockr] ✅ GameName récupéré depuis currentGameToLaunch:', finalGameName)
        }
      }
    }
    
    if (!finalGameId || !finalGameName) {
      errorLog('[Lockr] ❌ Paramètres manquants après récupération:', { gameId: finalGameId, gameName: finalGameName })
      return { success: false, error: 'Paramètres manquants: gameId et gameName sont requis' }
    }
    
    log('[Lockr] 🎮 Lancement du téléchargement avec:', { gameId: finalGameId, gameName: finalGameName })
    
    // Utiliser unlockGame pour lancer le téléchargement
    // unlockGame va envoyer protocol:start-download qui déclenchera le téléchargement
    // GameDetails récupérera le lien direct VIP (violet) depuis game.downloadUrl
    await unlockGame(finalGameName, finalGameId, redirectUrl)
    
    log('[Lockr] ✅ Téléchargement lancé avec succès')
    return { success: true }
  } catch (err) {
    errorLog('[Lockr] ❌ Erreur lors du lancement du téléchargement:', err)
    return { success: false, error: err.message }
  }
})

/* ---------------- IPC: générer les casiers Lockr pour tous les jeux ---------------- */
ipcMain.handle('lockr:generateLockersForAllGames', async (event) => {
  try {
    log('[Lockr] ============================================')
    log('[Lockr] 🚀 DÉBUT DE LA GÉNÉRATION DES CASIERS LOCKR')
    log('[Lockr] ============================================')
    
    // Récupérer tous les jeux
    const service = await getGamesService()
    const gamesResult = await service.getGamesFromGitHub()
    const games = gamesResult.games || []
    
    log('[Lockr] 📋 Nombre total de jeux trouvés:', games.length)
    log('[Lockr] 📋 Liste des jeux:', games.map(g => `${g.id}: ${g.title || g.name || 'Sans nom'}`).join(', '))
    
    const results = []
    const lockrService = await getLockrService()
    
    // URL de redirection par défaut (site Vercel) - Utiliser la configuration centralisée
    const { getRedirectUrl: getVercelRedirectUrl } = await import('./vercel-config.js')
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
        
        // 🎯 NOUVEAU : Toujours créer/mettre à jour le casier avec la nouvelle URL Vercel
        // Même si un casier existe déjà, on le met à jour avec la nouvelle URL
        const hasExistingLocker = !!game.lockrUrl
        
        if (hasExistingLocker) {
          log('[Lockr] ⚠️ Le jeu a déjà un lien Lockr:', game.lockrUrl)
          log('[Lockr] 🔄 Mise à jour du casier avec la nouvelle URL Vercel...')
          
          // Extraire l'ID du casier existant pour le mettre à jour
          const { extractLockerId } = await import('./lockr-service.js')
          const existingLockerId = extractLockerId(game.lockrUrl)
          
          if (existingLockerId) {
            // Mettre à jour le casier existant avec la nouvelle URL
            const baseUrl = getVercelRedirectUrl(gameName, gameId)
            log('[Lockr] 🔄 Mise à jour du casier existant (ID:', existingLockerId, ') avec:', baseUrl)
            
            const updateResult = await lockrService.updateLocker(existingLockerId, baseUrl, gameName)
            
            if (updateResult.success && updateResult.lockerUrl) {
              log('[Lockr] ✅ Casier mis à jour avec succès:', updateResult.lockerUrl)
              
              // Mettre à jour dans Supabase
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
                // Continuer pour créer un nouveau casier
              }
            } else {
              log('[Lockr] ⚠️ Échec de la mise à jour, création d\'un nouveau casier...')
              // Continuer pour créer un nouveau casier
            }
          } else {
            log('[Lockr] ⚠️ Impossible d\'extraire l\'ID du casier, création d\'un nouveau...')
            // Continuer pour créer un nouveau casier
          }
        }
        
        // Créer un nouveau casier avec la nouvelle URL Vercel (ou si la mise à jour a échoué)
        // 🎯 NOUVEAU SYSTÈME : Un seul casier par jeu avec nouvelle URL Vercel
        // L'URL pointe vers redirect.html qui générera un token dynamiquement via l'API Vercel
        const baseUrl = getVercelRedirectUrl(gameName, gameId)
        log('[Lockr] 🔗 URL de base pour le nouveau casier (nouvelle URL Vercel):', baseUrl)
        
        // Créer un nouveau casier Lockr avec la nouvelle URL Vercel
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
        
        // Mettre à jour le jeu avec le lien Lockr (un seul casier par jeu)
        try {
          log('[Lockr] 💾 Mise à jour du jeu dans la base de données...')
          log('[Lockr] 💾 GameId:', gameId)
          log('[Lockr] 💾 LockerUrl:', lockerUrl)
          
          const updateData = {
            lockr_url: lockerUrl // Utiliser snake_case pour Supabase
          }
          
          log('[Lockr] 💾 Données de mise à jour:', JSON.stringify(updateData, null, 2))
          
          // Mettre à jour dans Supabase via le service de jeux
          await service.updateGame(gameId, updateData)
          log('[Lockr] ✅ Jeu mis à jour avec succès dans la base de données')
          
          // Vérifier que la mise à jour a bien fonctionné
          const verifyResult = await service.getGamesFromGitHub(true) // Force refresh
          const updatedGame = verifyResult.games?.find(g => g.id === gameId)
          if (updatedGame) {
            log('[Lockr] ✅ Vérification: jeu trouvé après mise à jour')
            log('[Lockr] ✅ lockrUrl:', updatedGame.lockrUrl || updatedGame.LockrUrl || updatedGame.lockr_url)
          } else {
            errorLog('[Lockr] ⚠️ Vérification: jeu non trouvé après mise à jour')
          }
        } catch (updateErr) {
          errorLog('[Lockr] ❌ Erreur lors de la mise à jour du jeu dans la base de données:', updateErr)
          errorLog('[Lockr] ❌ Stack:', updateErr.stack)
          errorLog('[Lockr] ⚠️ Le casier a été créé mais n\'a pas pu être sauvegardé')
        }
        
        results.push({
          gameId,
          gameName,
          success: true,
          lockerUrl: lockerUrl
        })
        
        log('[Lockr] ✅ Jeu traité avec succès:', gameName)
        
        // Petit délai pour éviter de surcharger l'API Lockr
        log('[Lockr] ⏳ Attente de 500ms avant le prochain jeu...')
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err) {
        errorLog('[Lockr] ❌ ERREUR CRITIQUE pour le jeu:', game.id)
        errorLog('[Lockr] ❌ Nom du jeu:', game.title || game.name || 'Sans nom')
        errorLog('[Lockr] ❌ Détails de l\'erreur:', err.message)
        errorLog('[Lockr] ❌ Stack trace:', err.stack)
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
    const skippedCount = results.filter(r => r.skipped).length
    
    log('[Lockr] ============================================')
    log('[Lockr] 📊 RÉSUMÉ DE LA GÉNÉRATION')
    log('[Lockr] ============================================')
    log('[Lockr] 📋 Total de jeux traités:', games.length)
    log('[Lockr] ✅ Succès:', successCount)
    log('[Lockr] ⏭️ Ignorés (déjà créés):', skippedCount)
    log('[Lockr] ❌ Échecs:', failCount)
    log('[Lockr] ============================================')
    
    // Afficher la liste des jeux avec succès
    if (successCount > 0) {
      log('[Lockr] ✅ Jeux avec casier Lockr créé:')
      results.filter(r => r.success && !r.skipped).forEach(r => {
        log(`[Lockr]   - ${r.gameName} (ID: ${r.gameId})`)
        log(`[Lockr]     URL: ${r.lockerUrl}`)
      })
    }
    
    // Afficher la liste des jeux ignorés
    if (skippedCount > 0) {
      log('[Lockr] ⏭️ Jeux ignorés (déjà un lien Lockr):')
      results.filter(r => r.skipped).forEach(r => {
        log(`[Lockr]   - ${r.gameName} (ID: ${r.gameId})`)
        log(`[Lockr]     URL existante: ${r.lockerUrl}`)
      })
    }
    
    // Afficher la liste des échecs
    if (failCount > 0) {
      errorLog('[Lockr] ❌ Jeux en échec:')
      results.filter(r => !r.success).forEach(r => {
        errorLog(`[Lockr]   - ${r.gameName} (ID: ${r.gameId})`)
        errorLog(`[Lockr]     Erreur: ${r.error}`)
      })
    }
    
    log('[Lockr] ============================================')
    log('[Lockr] ✅ GÉNÉRATION TERMINÉE')
    log('[Lockr] ============================================')
    
    // Invalider le cache des jeux pour forcer le rechargement
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
      skippedCount,
      failCount,
      results
    }
  } catch (err) {
    errorLog('[Lockr] ============================================')
    errorLog('[Lockr] ❌ ERREUR CRITIQUE LORS DE LA GÉNÉRATION')
    errorLog('[Lockr] ============================================')
    errorLog('[Lockr] ❌ Message:', err.message)
    errorLog('[Lockr] ❌ Stack trace:', err.stack)
    errorLog('[Lockr] ============================================')
    return { success: false, error: err.message }
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

  // Utiliser la commande Windows rmdir /s /q pour supprimer même les dossiers vides
  // /s = supprimer récursivement, /q = mode silencieux (pas de confirmation)
  const command = process.platform === 'win32'
    ? `rmdir /s /q "${folderPath}" 2>nul || rd /s /q "${folderPath}" 2>nul`
    : `rm -rf "${folderPath}"`

  try {
    await execPromise(command, { shell: true })
    // Attendre un peu pour que Windows libère le dossier
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Vérifier si le dossier existe encore
    if (fs.existsSync(folderPath)) {
      // Si le dossier existe encore, essayer une dernière fois avec PowerShell
      if (process.platform === 'win32') {
        const psCommand = `powershell -Command "Remove-Item -Path '${folderPath.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue"`
        await execPromise(psCommand, { shell: true })
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    log('[Uninstall] ✅ Suppression forcée réussie')
  } catch (err) {
    // Ne pas throw l'erreur si c'est juste que le dossier n'existe plus
    if (!fs.existsSync(folderPath)) {
      log('[Uninstall] ✅ Dossier supprimé (vérification post-commande)')
    } else {
      errorLog('[Uninstall] ❌ Échec suppression forcée:', err)
      throw err
    }
  }
}

/* ---------------- IPC: uninstall game ---------------- */
/**
 * Compter le nombre total de fichiers dans un dossier (récursif)
 */
function countFilesRecursive(dir) {
  let count = 0
  try {
    if (!fs.existsSync(dir)) return 0
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const fullPath = path.join(dir, item)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          count += countFilesRecursive(fullPath)
        } else {
          count++
        }
      } catch (err) {
        // Ignorer les erreurs d'accès
      }
    }
  } catch (error) {
    // Ignorer les erreurs
  }
  return count
}

/**
 * Supprimer un dossier de manière asynchrone (optimisé vitesse maximale, sans progression)
 */
async function deleteDirectoryWithProgress(dir, event, totalFiles) {
  async function deleteRecursive(currentPath) {
    try {
      const items = await fsPromises.readdir(currentPath)
      
      // Supprimer les fichiers d'abord en parallèle (plus rapide)
      const filePromises = []
      const dirPromises = []
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item)
        
        try {
          const stat = await fsPromises.stat(fullPath)
          
          if (stat.isDirectory()) {
            // Traiter les dossiers après
            dirPromises.push(fullPath)
          } else {
            // Supprimer les fichiers en parallèle sans délai
            filePromises.push(
              fsPromises.unlink(fullPath).catch(err => {
                // Ignorer les erreurs sur des fichiers individuels
                console.warn('[Uninstall] ⚠️ Erreur suppression fichier:', fullPath, err.message)
              })
            )
          }
        } catch (itemError) {
          // Ignorer les erreurs
        }
      }
      
      // Supprimer tous les fichiers en parallèle (pas de progression envoyée)
      await Promise.all(filePromises)
      
      // Supprimer les dossiers récursivement
      for (const dirPath of dirPromises) {
        try {
          await deleteRecursive(dirPath)
          // Essayer rmdir d'abord, puis rm si nécessaire
          try {
            await fsPromises.rmdir(dirPath)
          } catch (rmdirError) {
            // Si rmdir échoue (dossier non vide), utiliser rm avec recursive
            try {
              await fsPromises.rm(dirPath, { recursive: true, force: true })
            } catch (rmError) {
              // Dernier recours : rmSync
              if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true })
              }
            }
          }
        } catch (dirError) {
          console.warn('[Uninstall] ⚠️ Erreur suppression dossier:', dirPath, dirError.message)
          // Fallback avec rmSync si tout échoue
          if (fs.existsSync(dirPath)) {
            try {
              fs.rmSync(dirPath, { recursive: true, force: true })
            } catch (syncErr) {
              console.warn('[Uninstall] ⚠️ Échec fallback sync pour:', dirPath)
            }
          }
        }
      }
      
    } catch (error) {
      console.error('[Uninstall] ❌ Erreur lors de la suppression récursive:', error)
      throw error
    }
  }
  
  try {
    await deleteRecursive(dir)
    
    // Attendre un peu pour que Windows libère complètement les fichiers
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Supprimer le dossier racine avec plusieurs tentatives
    // On utilise rm avec recursive: true et force: true pour s'assurer que tout est supprimé
    if (fs.existsSync(dir)) {
      let deleted = false
      const maxAttempts = 5
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
          // Tentative 1-2 : Utiliser fsPromises.rm (asynchrone)
          if (attempt <= 2) {
            await fsPromises.rm(dir, { recursive: true, force: true })
            log(`[Uninstall] ✅ Dossier racine supprimé avec fsPromises.rm (tentative ${attempt})`)
            deleted = true
            break
          } 
          // Tentatives 3-5 : Utiliser fs.rmSync (synchrone, plus fiable sur Windows)
          else {
            fs.rmSync(dir, { recursive: true, force: true })
            log(`[Uninstall] ✅ Dossier racine supprimé avec fs.rmSync (tentative ${attempt})`)
            deleted = true
            break
          }
        } catch (error) {
          log(`[Uninstall] ⚠️ Tentative ${attempt}/${maxAttempts} échouée:`, error.message)
          
          // Si ce n'est pas la dernière tentative, attendre un peu avant de réessayer
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 300 * attempt)) // Délai croissant
          } else {
            // Dernière tentative : utiliser la commande système Windows
            try {
              await forceDeleteFolder(dir)
          await new Promise(resolve => setTimeout(resolve, 500))
              if (!fs.existsSync(dir)) {
                log('[Uninstall] ✅ Dossier racine supprimé avec forceDeleteFolder (dernière tentative)')
                deleted = true
                break
              }
            } catch (forceErr) {
              errorLog('[Uninstall] ❌ Échec final de suppression du dossier racine:', forceErr.message)
              throw new Error(`Impossible de supprimer le dossier "${dir}" après ${maxAttempts} tentatives`)
            }
          }
        }
      }
      
      // Vérification finale
      if (!deleted && fs.existsSync(dir)) {
        errorLog('[Uninstall] ❌ Le dossier racine existe toujours après toutes les tentatives')
        throw new Error(`Impossible de supprimer le dossier "${dir}"`)
      }
    }
    
    // Envoyer uniquement la progression finale à 100%
    if (event && event.sender && !event.sender.isDestroyed()) {
      event.sender.send('uninstall:progress', {
        progress: 100,
        step: 'Finalisation...',
        deletedFiles: totalFiles,
        totalFiles
      })
    }
  } catch (error) {
    console.error('[Uninstall] ❌ Erreur lors de la suppression:', error)
    throw error
  }
}

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
          // Ne pas utiliser ce chemin invalide, continuer la recherche
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
        .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // Supprimer les symboles spéciaux
        .replace(/[^\x20-\x7E]/g, '') // Supprimer tous les caractères non-ASCII
        .replace(/\s+/g, ' ') // Collapser les espaces multiples
        .replace(/[^a-z0-9\s]/g, '') // Supprimer tous les caractères non alphanumériques
        .trim()
    }
    
    // 🔍 MÉTHODE 1 : Chercher dans le cache de scan (plus fiable)
    if (!gameFolder && scanCache.games && scanCache.games.length > 0) {
      log('[Uninstall] 🔍 MÉTHODE 1: Recherche dans le cache de scan...')
      log('[Uninstall]   - Nombre de jeux dans le cache:', scanCache.games.length)
      const normalizedGameName = normalizeName(gameName)
      log('[Uninstall]   - Nom du jeu normalisé:', normalizedGameName)
      
      for (const installedGame of scanCache.games) {
        const installedGameName = normalizeName(installedGame.gameName || installedGame.name || '')
        log('[Uninstall]   - Comparaison avec:', installedGameName, '↔', normalizedGameName)
        
        // Correspondance exacte ou partielle
        if ((installedGameName === normalizedGameName || 
             installedGameName.includes(normalizedGameName) ||
             normalizedGameName.includes(installedGameName)) && 
            (installedGame.gameFolder || installedGame.folder || installedGame.path || installedGame.gamePath)) {
          gameFolder = installedGame.gameFolder || installedGame.folder || installedGame.path || installedGame.gamePath
          log('[Uninstall] ✅ Jeu trouvé dans le cache:', gameFolder)
          log('[Uninstall]   - Vérification existence:', fs.existsSync(gameFolder))
          break
        }
      }
      
      if (!gameFolder) {
        log('[Uninstall] ❌ Jeu non trouvé dans le cache')
      }
    }
    
    // 🔍 MÉTHODE 2 : Si pas trouvé dans le cache, chercher dans les dossiers
    if (!gameFolder) {
      log('[Uninstall] 🔍 MÉTHODE 2: Recherche dans les dossiers...')
      
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
          // Chercher le fichier .crklauncheur (avec "eur") ou .crklauncher (ancienne version)
          const markerPath1 = path.join(gamePath, `${nameVariant}.crklauncheur`)
          const markerPath2 = path.join(gamePath, '.crklauncheur')
          const markerPath3 = path.join(gamePath, '.crklauncher')
          const markerPath = fs.existsSync(markerPath1) ? markerPath1 : 
                           (fs.existsSync(markerPath2) ? markerPath2 : markerPath3)
          
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
              // Chercher le fichier .crklauncheur (avec "eur") ou .crklauncher (ancienne version)
              const subMarkerPath1 = path.join(subGamePath, `${subfolder.name}.crklauncheur`)
              const subMarkerPath2 = path.join(subGamePath, '.crklauncheur')
              const subMarkerPath3 = path.join(subGamePath, '.crklauncher')
              const subMarkerPath = fs.existsSync(subMarkerPath1) ? subMarkerPath1 : 
                                   (fs.existsSync(subMarkerPath2) ? subMarkerPath2 : subMarkerPath3)
              
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
      
      // Si un chemin a été fourni directement mais n'existe pas, c'est une erreur
      if (gameFolderPath && gameFolder === gameFolderPath) {
        log('[Uninstall] ❌ ERREUR: Le chemin fourni n\'existe pas:', gameFolderPath)
        return { success: false, error: `Le dossier fourni n'existe pas: ${gameFolderPath}` }
      }
      
      // Si le dossier n'existe pas et n'était pas fourni directement, vérifier s'il a peut-être déjà été supprimé
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
      
      // Si le jeu était dans le cache mais le dossier n'existe plus, il a été supprimé
      if (wasInCache) {
        log('[Uninstall] ℹ️ Le jeu était dans le cache mais le dossier n\'existe plus - déjà supprimé')
        
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
      
      // Si le dossier n'existe pas et n'était pas dans le cache, c'est une erreur
      return { success: false, error: `Le dossier du jeu n'existe pas: ${gameFolder}` }
    }
    
    // ✅ VÉRIFICATION FINALE : S'assurer que le dossier existe avant de continuer
    if (!fs.existsSync(gameFolder)) {
      log('[Uninstall] ❌ ERREUR: Le dossier n\'existe pas:', gameFolder)
      return { success: false, error: `Le dossier du jeu n'existe pas: ${gameFolder}` }
    }
    
    log('[Uninstall] ✅ Dossier confirmé, début de la suppression...')
    
    // 🗑️ Supprimer le fichier .crklauncheur AVANT la suppression du dossier
    try {
      // Chercher le fichier .crklauncheur dans différents emplacements possibles
      const launcherFilePaths = [
        path.join(gameFolder, `${gameName}.crklauncheur`),
        path.join(gameFolder, `.${gameName}.crklauncheur`),
        path.join(gameFolder, `.crklauncheur`),
        path.join(gameFolder, `${gameName}.crklauncher`), // Ancienne version
        path.join(gameFolder, `.crklauncher`) // Ancienne version
      ]
      
      let foundLauncherFile = null
      for (const launcherFilePath of launcherFilePaths) {
        if (fs.existsSync(launcherFilePath)) {
          foundLauncherFile = launcherFilePath
          break
        }
      }
      
      // Chercher aussi récursivement dans le dossier
      if (!foundLauncherFile) {
        try {
          const files = fs.readdirSync(gameFolder)
          for (const file of files) {
            if (file.endsWith('.crklauncheur') || file.endsWith('.crklauncher')) {
              foundLauncherFile = path.join(gameFolder, file)
              break
            }
          }
        } catch (err) {
          // Ignorer les erreurs de lecture
        }
      }
      
      if (foundLauncherFile) {
        log('[Uninstall] 🗑️ Suppression du fichier .crklauncheur:', foundLauncherFile)
        fs.unlinkSync(foundLauncherFile)
        log('[Uninstall] ✅ Fichier .crklauncheur supprimé avec succès')
      } else {
        log('[Uninstall] ⚠️ Aucun fichier .crklauncheur trouvé à supprimer')
        log('[Uninstall]   - Fichiers recherchés:', launcherFilePaths)
      }
    } catch (launcherFileErr) {
      // Ne pas bloquer la désinstallation si la suppression du fichier échoue
      log('[Uninstall] ⚠️ Erreur lors de la suppression du fichier .crklauncheur:', launcherFileErr.message)
    }
    
    // 🔒 Fermer tous les processus liés au jeu
    log('[Uninstall] 🔒 Fermeture des processus liés au jeu...')
    await killGameProcesses(gameFolder)
    log('[Uninstall] ✅ Processus fermés')
    
    // ⏳ Attendre un peu que les fichiers se déverrouillent
    log('[Uninstall] ⏳ Attente pour libérer les fichiers...')
    
    // Envoyer la progression initiale
    if (event && event.sender && !event.sender.isDestroyed()) {
      event.sender.send('uninstall:progress', {
        progress: 0,
        step: 'Arrêt des processus...',
        deletedFiles: 0,
        totalFiles: 0
      })
    }
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 🗑️ Supprimer le dossier avec progression asynchrone optimisée
    log('[Uninstall] 🗑️ Suppression du dossier du jeu avec progression optimisée:', gameFolder)
    
    // Vérifier d'abord si le dossier existe
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
        // Compter les fichiers (optionnel, juste pour le log)
        log('[Uninstall] 📊 Comptage des fichiers...')
        const totalFiles = countFilesRecursive(gameFolder)
        log('[Uninstall] 📊 Total fichiers à supprimer:', totalFiles)
        
        if (totalFiles === 0) {
          // Si aucun fichier, supprimer directement le dossier vide
          log('[Uninstall] 📁 Dossier vide détecté, suppression directe...')
          let deleted = false
          
          try {
            // Tentative 1 : fsPromises.rm (asynchrone)
            await fsPromises.rm(gameFolder, { recursive: true, force: true })
            await new Promise(resolve => setTimeout(resolve, 200))
            if (!fs.existsSync(gameFolder)) {
              log('[Uninstall] ✅ Dossier vide supprimé avec fsPromises.rm')
              deleted = true
            }
          } catch (rmError) {
            log('[Uninstall] ⚠️ fsPromises.rm échoué, tentative avec rmdir:', rmError.message)
            
            try {
              // Tentative 2 : rmdir si le dossier est vraiment vide
              await fsPromises.rmdir(gameFolder)
              await new Promise(resolve => setTimeout(resolve, 200))
              if (!fs.existsSync(gameFolder)) {
                log('[Uninstall] ✅ Dossier vide supprimé avec rmdir')
                deleted = true
              }
            } catch (rmdirError) {
              log('[Uninstall] ⚠️ rmdir échoué, tentative avec rmSync:', rmdirError.message)
              
              try {
                // Tentative 3 : rmSync (synchrone, plus fiable)
              fs.rmSync(gameFolder, { recursive: true, force: true })
                await new Promise(resolve => setTimeout(resolve, 200))
                if (!fs.existsSync(gameFolder)) {
                  log('[Uninstall] ✅ Dossier vide supprimé avec rmSync')
                  deleted = true
            }
              } catch (syncError) {
                errorLog('[Uninstall] ⚠️ rmSync échoué aussi:', syncError.message)
              }
            }
          }
          
          // Vérification finale
          if (!deleted && fs.existsSync(gameFolder)) {
            log('[Uninstall] ⚠️ Le dossier vide existe toujours, tentative avec forceDeleteFolder...')
            try {
              await forceDeleteFolder(gameFolder)
              await new Promise(resolve => setTimeout(resolve, 500))
              if (!fs.existsSync(gameFolder)) {
                log('[Uninstall] ✅ Dossier vide supprimé avec forceDeleteFolder')
                deleted = true
              }
            } catch (forceErr) {
              errorLog('[Uninstall] ⚠️ Même forceDeleteFolder a échoué:', forceErr.message)
            }
          }
          
          if (deleted || !fs.existsSync(gameFolder)) {
            log('[Uninstall] ✅ Dossier vide confirmé supprimé')
          }
          
          // Envoyer la progression finale
          if (event && event.sender && !event.sender.isDestroyed()) {
            event.sender.send('uninstall:progress', {
              progress: 100,
              step: 'Finalisation...',
              deletedFiles: 0,
              totalFiles: 0
            })
          }
        } else {
          // Supprimer rapidement sans progression intermédiaire (juste spinner)
          await deleteDirectoryWithProgress(gameFolder, event, totalFiles)
          log('[Uninstall] ✅ Dossier supprimé')
        }
        
        // Vérifier que le dossier a bien été supprimé avec plusieurs tentatives
        let folderStillExists = fs.existsSync(gameFolder)
        if (folderStillExists) {
          log('[Uninstall] ⏳ Le dossier existe encore après suppression, tentatives de nettoyage...')
          
          // Faire plusieurs tentatives avec des délais croissants
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              // Attendre un peu plus longtemps à chaque tentative
              await new Promise(resolve => setTimeout(resolve, 300 * attempt))
            
              // Essayer avec fs.rmSync (synchrone, plus fiable)
            if (fs.existsSync(gameFolder)) {
                fs.rmSync(gameFolder, { recursive: true, force: true })
                log(`[Uninstall] ✅ Dossier supprimé avec fs.rmSync (tentative ${attempt})`)
                await new Promise(resolve => setTimeout(resolve, 200))
              }
              
              // Vérifier si le dossier existe encore
              folderStillExists = fs.existsSync(gameFolder)
              if (!folderStillExists) {
                log('[Uninstall] ✅ Dossier confirmé supprimé après vérification')
                break
        }
          } catch (syncErr) {
              log(`[Uninstall] ⚠️ Tentative ${attempt} échouée:`, syncErr.message)
              
              // Dernière tentative : utiliser forceDeleteFolder
              if (attempt === 3 && fs.existsSync(gameFolder)) {
            try {
                  log('[Uninstall] 🔨 Dernière tentative avec forceDeleteFolder...')
              await forceDeleteFolder(gameFolder)
              await new Promise(resolve => setTimeout(resolve, 500))
                  
                  folderStillExists = fs.existsSync(gameFolder)
                  if (!folderStillExists) {
                    log('[Uninstall] ✅ Dossier supprimé avec forceDeleteFolder (dernière tentative)')
                  } else {
                    errorLog('[Uninstall] ❌ Le dossier existe toujours même après forceDeleteFolder')
                  }
      } catch (forceErr) {
                  errorLog('[Uninstall] ❌ Erreur avec forceDeleteFolder:', forceErr)
            }
              }
            }
          }
          
          // Avertissement final si le dossier existe toujours
          if (fs.existsSync(gameFolder)) {
            errorLog('[Uninstall] ⚠️ ATTENTION: Le dossier existe toujours après toutes les tentatives:', gameFolder)
            errorLog('[Uninstall] ⚠️ Le dossier peut être verrouillé par un autre processus (Explorateur Windows, antivirus, etc.)')
          }
        }
      } catch (deleteError) {
        errorLog('[Uninstall] ❌ Erreur lors de la suppression asynchrone:', deleteError)
        
        // Fallback avec fs.rmSync si l'asynchrone échoue
        try {
          log('[Uninstall] 🔄 Tentative avec fs.rmSync en fallback...')
          
          // Faire plusieurs tentatives avec des délais
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
              
              // Dernière tentative : utiliser forceDeleteFolder
              if (attempt === 3) {
                try {
                  await forceDeleteFolder(gameFolder)
                  await new Promise(resolve => setTimeout(resolve, 500))
                  if (!fs.existsSync(gameFolder)) {
                    log('[Uninstall] ✅ Dossier supprimé avec forceDeleteFolder (fallback final)')
                    deleted = true
                  }
                } catch (forceErr) {
                  // Ignorer l'erreur, on va vérifier après
                }
              }
            }
          }
          
          if (deleted || !fs.existsSync(gameFolder)) {
            if (event && event.sender && !event.sender.isDestroyed()) {
              event.sender.send('uninstall:progress', {
                progress: 100,
                step: 'Finalisation...',
                deletedFiles: 0,
                totalFiles: 0
              })
            }
          } else {
            throw new Error('Le dossier existe toujours après toutes les tentatives de fallback')
          }
        } catch (rmErr) {
          errorLog('[Uninstall] ❌ Erreur avec fs.rmSync aussi:', rmErr)
          throw new Error(`Impossible de supprimer le dossier "${gameFolder}". Le dossier est peut-être ouvert dans l'Explorateur ou utilisé par un autre programme. Fermez tous les programmes et réessayez.`)
        }
      }
    }
    
    // ✅ Vérifier que la suppression a réellement réussi
    // Si le dossier existe encore (même vide), essayer de le supprimer
    if (fs.existsSync(gameFolder)) {
      log('[Uninstall] ⚠️ Le dossier existe encore, tentative de suppression finale...')
      try {
        // Vérifier si le dossier est vide (ignorer les fichiers cachés/système)
        let items = []
        try {
          items = fs.readdirSync(gameFolder)
          // Filtrer les fichiers cachés/système Windows (comme Thumbs.db, desktop.ini, etc.)
          items = items.filter(item => {
            const fullPath = path.join(gameFolder, item)
            try {
              const stat = fs.statSync(fullPath)
              // Ignorer les fichiers cachés et système
              if (item.startsWith('.') || item === 'Thumbs.db' || item === 'desktop.ini') {
                // Essayer de supprimer ces fichiers d'abord
                try {
                  if (stat.isFile()) {
                    fs.unlinkSync(fullPath)
                  } else if (stat.isDirectory()) {
                    fs.rmSync(fullPath, { recursive: true, force: true })
                  }
                } catch (delErr) {
                  // Ignorer les erreurs de suppression de fichiers système
                }
                return false
              }
              return true
            } catch {
              return false
            }
          })
        } catch (readErr) {
          log('[Uninstall] ⚠️ Erreur lors de la lecture du dossier:', readErr.message)
        }
        
        if (items.length === 0) {
          log('[Uninstall] 📁 Dossier vide détecté, suppression...')
          // Le dossier est vide, on peut le supprimer directement
          try {
            fs.rmdirSync(gameFolder)
            log('[Uninstall] ✅ Dossier vide supprimé avec rmdirSync')
          } catch (rmdirErr) {
            // Si rmdirSync échoue, essayer avec rmSync
            try {
              fs.rmSync(gameFolder, { recursive: true, force: true })
              log('[Uninstall] ✅ Dossier vide supprimé avec rmSync')
            } catch (rmErr) {
              // Dernier recours : commande système
              await forceDeleteFolder(gameFolder)
              log('[Uninstall] ✅ Dossier vide supprimé avec forceDeleteFolder')
            }
          }
        } else {
          log('[Uninstall] ⚠️ Le dossier contient encore des éléments:', items.length)
          // Réessayer la suppression récursive
          try {
            fs.rmSync(gameFolder, { recursive: true, force: true })
            log('[Uninstall] ✅ Dossier supprimé avec rmSync (réessai)')
          } catch (retryErr) {
            await forceDeleteFolder(gameFolder)
            log('[Uninstall] ✅ Dossier supprimé avec forceDeleteFolder (réessai)')
          }
        }
      } catch (finalErr) {
        errorLog('[Uninstall] ❌ Erreur lors de la suppression finale:', finalErr.message)
        // Dernière tentative avec forceDeleteFolder
        try {
          await forceDeleteFolder(gameFolder)
        } catch (forceErr) {
          errorLog('[Uninstall] ❌ Échec final de suppression:', forceErr.message)
        }
      }
    }
    
    const deleted = !fs.existsSync(gameFolder)
    
    if (deleted) {
      log('[Uninstall] ✅ Suppression confirmée - le dossier n\'existe plus')
      
      // 💾 SUPPRIMER LE JEU DU STORE DE PERSISTANCE
      try {
        // Chercher le gameId dans le cache ou par nom
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
        
        // Si on a un gameId, le supprimer du store
        if (gameIdToRemove) {
          await installedGamesStore.removeInstalledGame(gameIdToRemove)
          log('[Uninstall] 💾 Jeu supprimé du store:', gameIdToRemove)
        } else {
          // Sinon, essayer de trouver par chemin dans tous les jeux sauvegardés
          const allSavedGames = await installedGamesStore.getAllInstalledGames()
          for (const [savedGameId, savedGame] of Object.entries(allSavedGames)) {
            const savedPath = savedGame.path || savedGame.gamePath
            if (savedPath === gameFolder || savedPath === gameFolderPath) {
              await installedGamesStore.removeInstalledGame(savedGameId)
              log('[Uninstall] 💾 Jeu supprimé du store par chemin:', savedGameId)
              break
            }
          }
        }
      } catch (storeError) {
        errorLog('[Uninstall] ⚠️ Erreur lors de la suppression du store:', storeError)
      }
      
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
    } finally {
      // 🔓 Retirer le jeu de la liste des désinstallations en cours
      uninstallingGames.delete(gameName)
      log('[Uninstall] 🔓 Désinstallation terminée pour:', gameName)
    }
  } catch (err) {
    errorLog('[Uninstall] ❌ Erreur:', err)
    // 🔓 Retirer le jeu de la liste même en cas d'erreur
    uninstallingGames.delete(gameName)
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

/* ---------------- IPC: vérifier si un raccourci existe ---------------- */
ipcMain.handle('games:checkShortcutExists', async (event, gameName) => {
  try {
    if (!gameName) {
      return { exists: false }
    }
    
    const desktopPath = app.getPath('desktop')
    const shortcutPath = path.join(desktopPath, `${gameName}.lnk`)
    const exists = fs.existsSync(shortcutPath)
    
    return { exists }
  } catch (err) {
    errorLog('[Shortcut] ❌ Erreur lors de la vérification:', err)
    return { exists: false }
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
  
  // Tuer tous les processus Actoris d'un coup (plus rapide)
  try {
    for (const processName of processNames) {
      try {
        // Utiliser taskkill /F /IM pour tuer tous les processus avec ce nom
        await execPromise(`taskkill /F /IM ${processName} /T`)
      } catch (killErr) {
        // Le processus peut ne pas exister, ignorer
        if (!killErr.message.includes('not found') && !killErr.message.includes('introuvable') && !killErr.message.includes('not running')) {
          // Ignorer les autres erreurs aussi pour éviter les logs inutiles
        }
      }
    }
  } catch (err) {
    // Ignorer
  }

  // Attendre un peu pour que les processus se ferment
  await new Promise(resolve => setTimeout(resolve, 500))
}

async function initializeAutoUpdater() {
  if (isDev) return // Ne pas charger en développement
  
  try {
    // Charger electron-updater seulement en production
    try {
      const { autoUpdater: updater } = await import('electron-updater')
      autoUpdater = updater
    } catch (err) {
      errorLog('[Updater] electron-updater non disponible:', err.message)
      return
    }
    
    // Configuration de l'auto-updater optimisée
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    
    // ✅ Optimisation : Vérification asynchrone après le premier affichage
    // Ne pas bloquer le démarrage de l'application
    // La vérification sera lancée après un délai pour ne pas ralentir le premier lancement
    setTimeout(async () => {
      try {
        log('[Updater] Vérification des mises à jour en arrière-plan...')
        await autoUpdater.checkForUpdatesAndNotify()
      } catch (err) {
        errorLog('[Updater] Erreur lors de la vérification asynchrone:', err)
      }
    }, 5000) // Attendre 5 secondes après le démarrage
    
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
      
      // Route pour récupérer les infos d'un casier Lockr
      if (url.pathname === '/get-locker-info') {
        const lockerId = url.searchParams.get('lockerId')
        
        if (!lockerId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'lockerId manquant' }))
          return
        }
        
        // Récupérer les infos du casier
        getLockrService().then(async (lockrService) => {
          try {
            const result = await lockrService.getLockerInfo(lockerId)
            
            if (result.success) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ 
                success: true, 
                title: result.title,
                target: result.target
              }))
              log('[Confirmation Server] ✅ Infos du casier récupérées:', lockerId, result.title)
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: result.error }))
              errorLog('[Confirmation Server] ❌ Erreur lors de la récupération:', result.error)
            }
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: err.message }))
            errorLog('[Confirmation Server] ❌ Erreur:', err)
          }
        }).catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: err.message }))
          errorLog('[Confirmation Server] ❌ Erreur lors du chargement du service:', err)
        })
        return
      }
      
      // Route pour confirmer le téléchargement
      if (url.pathname === '/confirm-download') {
        let gameName = null
        let gameId = null
        
        // Gérer les requêtes GET (query parameters)
        if (req.method === 'GET') {
          gameName = url.searchParams.get('game')
          gameId = url.searchParams.get('gameId')
        }
        // Gérer les requêtes POST (JSON body)
        else if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => {
            body += chunk.toString()
          })
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              gameName = data.gameName || data.game
              gameId = data.gameId
            } catch (e) {
              errorLog('[Confirmation Server] Erreur de parsing JSON:', e)
            }
            
            // Répondre
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true, message: 'Confirmation reçue' }))
            
            // Déclencher le téléchargement
            if (gameId || gameName) {
              setTimeout(() => {
                unlockGame(gameName, gameId)
              }, 100)
            }
          })
          return // Sortir car on gère la réponse dans le callback 'end'
        }
        
        log('[Confirmation Server] ✅ Confirmation reçue:', { gameName, gameId })
        
        // Répondre immédiatement (pour GET)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, message: 'Confirmation reçue' }))
        
        // Déclencher le téléchargement
        if (gameId || gameName) {
          setTimeout(async () => {
            // Si pas de gameId mais qu'on a un gameName, essayer de trouver le gameId
            let finalGameId = gameId
            let finalGameName = gameName
            
            if (!finalGameId && finalGameName) {
              try {
                // Charger le service de jeux pour chercher par nom
                const service = await getGamesService()
                const gamesResult = await service.getGamesFromGitHub()
                const games = gamesResult.games || []
                
                // Normaliser le nom pour la recherche
                const normalizeName = (name) => {
                  if (!name) return ''
                  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
                }
                
                const normalizedSearchName = normalizeName(finalGameName)
                
                // Chercher le jeu par nom
                const foundGame = games.find(g => {
                  const gameTitle = g.title || g.name || ''
                  const normalizedGameTitle = normalizeName(gameTitle)
                  return normalizedGameTitle === normalizedSearchName || 
                         normalizedGameTitle.includes(normalizedSearchName) ||
                         normalizedSearchName.includes(normalizedGameTitle)
                })
                
                if (foundGame && foundGame.id) {
                  finalGameId = foundGame.id
                  finalGameName = foundGame.title || foundGame.name || finalGameName
                  log('[Confirmation Server] ✅ Jeu trouvé par nom:', finalGameName, 'ID:', finalGameId)
                } else {
                  log('[Confirmation Server] ⚠️ Jeu non trouvé par nom:', finalGameName)
                }
              } catch (err) {
                errorLog('[Confirmation Server] Erreur lors de la recherche du jeu par nom:', err)
              }
            }
            
            // Si la fenêtre principale existe, envoyer directement l'événement
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (finalGameId) {
                mainWindow.webContents.send('protocol:start-download', { gameId: finalGameId, gameName: finalGameName })
                log('[Confirmation Server] Événement protocol:start-download envoyé:', finalGameId, finalGameName)
              } else if (finalGameName) {
                mainWindow.webContents.send('navigate-to-game', { gameName: finalGameName })
                log('[Confirmation Server] Événement navigate-to-game envoyé:', finalGameName)
              }
            } else {
              // Sinon, utiliser unlockGame qui créera la fenêtre si nécessaire
              unlockGame(finalGameName, finalGameId)
            }
          }, 100)
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      }
    })
    
    // Ne plus démarrer le serveur de confirmation sur le port 3001
    // car le serveur backend Express l'utilise déjà
    // Les routes de confirmation sont maintenant dans launcher-server.js
    log('[Confirmation Server] ⚠️ Le serveur de confirmation est maintenant intégré dans le serveur backend Express')
    
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

/* ---------------- Serveur WebSocket pour le site web ---------------- */
// Créer un serveur WebSocket local pour recevoir les confirmations depuis le site web
function createWebSocketServer() {
  try {
    // Importer ws de manière dynamique
    import('ws').then((wsModule) => {
      // ws exporte WebSocketServer directement
      const { WebSocketServer } = wsModule
      
      webSocketServer = new WebSocketServer({ port: 5656 })
      log('[WebSocket Server] ✅ Serveur WebSocket démarré sur ws://localhost:5656')
      
      webSocketServer.on('connection', (ws) => {
        log('[WebSocket Server] ✅ Site web connecté au launcher')
        
        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString())
            log('[WebSocket Server] 📨 Message reçu:', data)
            
            if (data.action === 'startDownload') {
              const gameId = data.gameId
              const gameName = data.gameName
              
              log('[WebSocket Server] 🎮 Demande de téléchargement:', { gameId, gameName })
              
              // Si pas de gameId mais qu'on a un gameName, essayer de trouver le gameId
              let finalGameId = gameId
              let finalGameName = gameName
              
              if (!finalGameId && finalGameName) {
                try {
                  // Charger le service de jeux pour chercher par nom
                  const service = await getGamesService()
                  const gamesResult = await service.getGamesFromGitHub()
                  const games = gamesResult.games || []
                  
                  // Normaliser le nom pour la recherche
                  const normalizeName = (name) => {
                    if (!name) return ''
                    return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
                  }
                  
                  const normalizedSearchName = normalizeName(finalGameName)
                  
                  // Chercher le jeu par nom
                  const foundGame = games.find(g => {
                    const gameTitle = g.title || g.name || ''
                    const normalizedGameTitle = normalizeName(gameTitle)
                    return normalizedGameTitle === normalizedSearchName || 
                           normalizedGameTitle.includes(normalizedSearchName) ||
                           normalizedSearchName.includes(normalizedGameTitle)
                  })
                  
                  if (foundGame && foundGame.id) {
                    finalGameId = foundGame.id
                    finalGameName = foundGame.title || foundGame.name || finalGameName
                    log('[WebSocket Server] ✅ Jeu trouvé par nom:', finalGameName, 'ID:', finalGameId)
                  } else {
                    log('[WebSocket Server] ⚠️ Jeu non trouvé par nom:', finalGameName)
                  }
                } catch (err) {
                  errorLog('[WebSocket Server] Erreur lors de la recherche du jeu par nom:', err)
                }
              }
              
              // Répondre au site web que la demande a été reçue
              ws.send(JSON.stringify({ 
                success: true, 
                message: 'Demande de téléchargement reçue',
                gameId: finalGameId,
                gameName: finalGameName
              }))
              
              // Si la fenêtre principale existe, envoyer directement l'événement
              if (mainWindow && !mainWindow.isDestroyed()) {
                if (finalGameId) {
                  mainWindow.webContents.send('protocol:start-download', { gameId: finalGameId, gameName: finalGameName })
                  log('[WebSocket Server] Événement protocol:start-download envoyé:', finalGameId, finalGameName)
                } else if (finalGameName) {
                  mainWindow.webContents.send('navigate-to-game', { gameName: finalGameName })
                  log('[WebSocket Server] Événement navigate-to-game envoyé:', finalGameName)
                }
              } else {
                // Sinon, utiliser unlockGame qui créera la fenêtre si nécessaire
                unlockGame(finalGameName, finalGameId)
              }
            } else {
              log('[WebSocket Server] ⚠️ Action inconnue:', data.action)
              ws.send(JSON.stringify({ success: false, error: 'Action inconnue' }))
            }
          } catch (err) {
            errorLog('[WebSocket Server] ❌ Erreur lors du traitement du message:', err)
            ws.send(JSON.stringify({ success: false, error: err.message }))
          }
        })
        
        ws.on('error', (error) => {
          errorLog('[WebSocket Server] ❌ Erreur WebSocket:', error)
        })
        
        ws.on('close', () => {
          log('[WebSocket Server] 🔌 Site web déconnecté')
        })
      })
      
      webSocketServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          log('[WebSocket Server] ⚠️ Le port 5656 est déjà utilisé, le serveur existe peut-être déjà')
        } else {
          errorLog('[WebSocket Server] ❌ Erreur:', err)
        }
      })
    }).catch(err => {
      errorLog('[WebSocket Server] ❌ Erreur lors de l\'import de ws:', err)
    })
  } catch (err) {
    errorLog('[WebSocket Server] ❌ Erreur lors de la création du serveur:', err)
  }
}

/* ---------------- Protocole personnalisé actoris:// ---------------- */
// Enregistrer le protocole personnalisé pour ouvrir le launcher depuis le site web
function registerProtocol() {
  try {
    if (process.defaultApp || app.isPackaged) {
      // En production, utiliser la méthode standard
      const wasSet = app.setAsDefaultProtocolClient('actoris')
      if (wasSet) {
        log('[Protocol] ✅ Protocole actoris:// enregistré avec succès')
      } else {
        log('[Protocol] ⚠️ Le protocole actoris:// est déjà enregistré ou l\'enregistrement a échoué')
        // Essayer de ré-enregistrer quand même
        app.removeAsDefaultProtocolClient('actoris')
        const retrySet = app.setAsDefaultProtocolClient('actoris')
        if (retrySet) {
          log('[Protocol] ✅ Protocole actoris:// ré-enregistré avec succès après suppression')
        }
      }
    } else {
      // En développement, utiliser le chemin complet de l'exécutable
      // Retirer d'abord l'ancien enregistrement si il existe
      app.removeAsDefaultProtocolClient('actoris')
      
      // Obtenir le chemin absolu de l'exécutable Electron
      const electronPath = process.execPath
      const mainJsPath = path.resolve(__dirname, 'main.js')
      
      log('[Protocol] Enregistrement avec:', { electronPath, mainJsPath })
      
      const wasSet = app.setAsDefaultProtocolClient('actoris', electronPath, [mainJsPath])
      if (wasSet) {
        log('[Protocol] ✅ Protocole actoris:// enregistré avec succès (mode dev)')
      } else {
        log('[Protocol] ⚠️ Le protocole actoris:// est déjà enregistré ou l\'enregistrement a échoué (mode dev)')
        // Essayer sans arguments supplémentaires
        const wasSetSimple = app.setAsDefaultProtocolClient('actoris', electronPath)
        if (wasSetSimple) {
          log('[Protocol] ✅ Protocole actoris:// enregistré avec succès (mode dev, simple)')
        }
      }
    }
  } catch (err) {
    errorLog('[Protocol] ❌ Erreur lors de l\'enregistrement du protocole:', err)
  }
}

// Fonction pour gérer les URLs du protocole personnalisé
async function handleProtocolUrl(url) {
  try {
    log('[Protocol] URL reçue:', url)
    const urlObj = new URL(url)
    
    if (urlObj.protocol !== 'actoris:') {
      log('[Protocol] Protocole invalide:', urlObj.protocol)
      return
    }

    const gameName = urlObj.searchParams.get('game')
    const gameId = urlObj.searchParams.get('gameId')
    const downloadUrl = urlObj.searchParams.get('url')
    // Extraire l'action depuis le pathname (ex: actoris://launch -> 'launch', actoris://unlock -> 'unlock')
    // Si le pathname est vide ou '/', utiliser 'unlock' par défaut
    let action = urlObj.pathname
    if (!action || action === '/' || action === '') {
      action = 'unlock' // Par défaut
    } else {
      // Enlever le '/' initial si présent
      action = action.replace(/^\/+/, '')
    }
    // Si l'action est 'launch', la traiter comme 'unlock' (pour lancer le jeu)
    if (action === 'launch') {
      action = 'unlock'
    }
    const redirectUrl = urlObj.searchParams.get('redirectUrl') // URL de redirect.html pour confirmation
    const linkId = urlObj.searchParams.get('linkId') // ID unique du lien pour le blocage
    const blockUrl = urlObj.searchParams.get('blockUrl') // URL de l'API pour bloquer le lien
    
    log('[Protocol] 🔍 Action détectée:', action, '| Pathname:', urlObj.pathname, '| GameId:', gameId, '| GameName:', gameName)
    
    // 🔒 ÉTAPE 1 : BLOQUER LE LIEN IMMÉDIATEMENT (si linkId et blockUrl sont fournis)
    if (linkId && blockUrl && gameId) {
      log('[Protocol] 🔒 Blocage du lien immédiatement...')
      log('[Protocol] LinkId:', linkId)
      log('[Protocol] BlockUrl:', blockUrl)
      
      try {
        const https = (await import('node:https')).default
        const http = (await import('node:http')).default
        
        const blockUrlObj = new URL(blockUrl)
        const isHttps = blockUrlObj.protocol === 'https:'
        const client = isHttps ? https : http
        
        const payload = JSON.stringify({ linkId, gameId })
        
        const options = {
          hostname: blockUrlObj.hostname,
          port: blockUrlObj.port || (isHttps ? 443 : 80),
          path: blockUrlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        }
        
        const blockResult = await new Promise((resolve, reject) => {
          const req = client.request(options, (res) => {
            let data = ''
            res.on('data', (chunk) => { data += chunk })
            res.on('end', () => {
              try {
                const result = JSON.parse(data)
                resolve(result)
              } catch (e) {
                resolve({ success: false, error: 'Invalid JSON response' })
              }
            })
          })
          
          req.on('error', (err) => {
            log('[Protocol] ⚠️ Erreur réseau lors du blocage:', err.message)
            resolve({ success: false, error: err.message })
          })
          
          req.write(payload)
          req.end()
        })
        
        if (blockResult.success) {
          log('[Protocol] ✅ Lien bloqué avec succès')
        } else if (blockResult.alreadyBlocked) {
          log('[Protocol] ⚠️ Lien déjà bloqué - Partage détecté !')
          // Afficher un avertissement à l'utilisateur
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('protocol:link-already-blocked', {
              gameName,
              gameId
            })
          }
          // Ne pas continuer si le lien est déjà bloqué
          return
        } else {
          log('[Protocol] ⚠️ Échec du blocage, mais on continue quand même (mode dégradé)')
        }
      } catch (blockErr) {
        errorLog('[Protocol] ❌ Erreur lors du blocage du lien:', blockErr)
        // Continuer quand même en mode dégradé
      }
    }

    log('[Protocol] Action:', action, 'Jeu:', gameName, gameId ? `(ID: ${gameId})` : '', downloadUrl ? `URL: ${downloadUrl.substring(0, 50)}...` : '')
    
    // Si pas d'URL de redirect fournie, la reconstruire à partir des paramètres
    let finalRedirectUrl = redirectUrl
    if (!finalRedirectUrl && gameName) {
      try {
        const { getRedirectUrl } = await import('./vercel-config.js')
        const token = urlObj.searchParams.get('token') || 'actoris_2024_secure_redirect'
        const timestamp = urlObj.searchParams.get('timestamp') || Date.now().toString()
        
        // Essayer de récupérer le username Discord depuis la session
        let discordUsername = urlObj.searchParams.get('userId') // Si déjà dans l'URL, l'utiliser
        if (!discordUsername) {
          try {
            // Récupérer le username depuis la session Discord si disponible
            const discordService = await getDiscordService()
            // Note: Le username sera récupéré côté frontend et passé via le protocole
            // Pour l'instant, on utilise un ID généré si pas disponible
            discordUsername = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`
          } catch (err) {
            // Si erreur, utiliser un ID généré
            discordUsername = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`
          }
        }
        
        finalRedirectUrl = getRedirectUrl(gameName, gameId, token, timestamp, discordUsername)
        log('[Protocol] 🔗 URL de redirect.html reconstruite avec userId:', discordUsername)
      } catch (err) {
        errorLog('[Protocol] ⚠️ Erreur lors de la reconstruction de l\'URL redirect:', err)
      }
    }

    // Si c'est une action de téléchargement direct, utiliser le nouveau flux
    if (action === 'download' || downloadUrl) {
      log('[Protocol] 📥 Action de téléchargement direct détectée')
      handleDownloadProtocol(gameName, gameId, downloadUrl)
      return
    }
    
    // Sinon, utiliser le flux de déblocage normal
    // Si la fenêtre principale n'existe pas, la créer
    if (!mainWindow || mainWindow.isDestroyed()) {
      log('[Protocol] 📦 Création de la fenêtre principale...')
      createWindow().then(() => {
        // Attendre que la fenêtre soit prête et que la page soit chargée
        log('[Protocol] ⏳ Attente du chargement de la page après création...')
        const waitForPage = setInterval(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            const url = mainWindow.webContents.getURL()
            const loaded = url && (url.includes('index.html') || url.includes('localhost') || url.includes('127.0.0.1'))
            
            if (loaded) {
              clearInterval(waitForPage)
              log('[Protocol] ✅ Page chargée, déblocage du jeu')
              unlockGame(gameName, gameId, finalRedirectUrl)
            }
          } else {
            clearInterval(waitForPage)
          }
        }, 100)
        
        // Timeout après 10 secondes
        setTimeout(() => {
          clearInterval(waitForPage)
          log('[Protocol] ⚠️ Timeout, déblocage du jeu quand même')
          unlockGame(gameName, gameId, finalRedirectUrl)
        }, 10000)
      })
    } else {
      // La fenêtre existe déjà, s'assurer qu'elle est visible et au premier plan
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
      mainWindow.show()
      
      // Attendre un peu pour s'assurer que la fenêtre est prête
      setTimeout(() => {
        unlockGame(gameName, gameId, finalRedirectUrl)
      }, 100)
    }
  } catch (err) {
    errorLog('[Protocol] Erreur lors du traitement de l\'URL:', err)
  }
}

// Fonction pour débloquer un jeu
async function unlockGame(gameName, gameId, redirectUrl = null) {
  try {
    log('[Protocol] Déblocage du jeu:', gameName, gameId ? `(ID: ${gameId})` : '')
    
    // Mettre la fenêtre au premier plan
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.show()
    }
    
    let finalGameId = gameId
    let finalGameName = gameName
    
    // Si pas de gameId, chercher le jeu par nom
    if (!finalGameId && finalGameName) {
      try {
        log('[Protocol] 🔍 Recherche du jeu par nom:', finalGameName)
        const service = await getGamesService()
        const gamesResult = await service.getGamesFromGitHub()
        const games = gamesResult.games || []
        
        // Normaliser le nom pour la recherche
        const normalizeName = (name) => {
          if (!name) return ''
          return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
        }
        
        const normalizedSearchName = normalizeName(finalGameName)
        
        // Chercher le jeu par nom
        const foundGame = games.find(g => {
          const gameTitle = g.title || g.name || ''
          const normalizedGameTitle = normalizeName(gameTitle)
          return normalizedGameTitle === normalizedSearchName || 
                 normalizedGameTitle.includes(normalizedSearchName) ||
                 normalizedSearchName.includes(normalizedGameTitle)
        })
        
        if (foundGame && foundGame.id) {
          finalGameId = foundGame.id
          finalGameName = foundGame.title || foundGame.name || finalGameName
          log('[Protocol] ✅ Jeu trouvé par nom:', finalGameName, 'ID:', finalGameId)
        } else {
          log('[Protocol] ⚠️ Jeu non trouvé par nom:', finalGameName)
        }
      } catch (err) {
        errorLog('[Protocol] Erreur lors de la recherche du jeu par nom:', err)
      }
    }
    
    // 🎯 NOUVEAU FLUX : Demander où télécharger et démarrer le téléchargement
    // Au lieu de juste naviguer vers la page, on demande directement où télécharger
    if (finalGameId && mainWindow && !mainWindow.isDestroyed()) {
      // Fonction pour envoyer les événements une fois que la page est prête
      const sendEvents = () => {
        try {
          // Vérifier que la fenêtre et webContents sont toujours valides
          if (!mainWindow || mainWindow.isDestroyed()) {
            log('[Protocol] ⚠️ Fenêtre détruite, impossible d\'envoyer les événements')
            return
          }
          
          const currentURL = mainWindow.webContents.getURL()
          log('[Protocol] 📍 URL actuelle de la fenêtre:', currentURL ? currentURL.substring(0, 100) : 'null')
          
          // IMPORTANT: Envoyer protocol:start-download EN PREMIER pour activer le verrouillage de page
          // Puis naviguer vers la page du jeu
          // Cela empêche que la page change après la navigation
          log('[Protocol] 🔒 Activation du verrouillage de page AVANT la navigation')
          log('[Protocol] 🔍 redirectUrl dans unlockGame:', redirectUrl)
          mainWindow.webContents.send('protocol:start-download', { 
            gameId: finalGameId, 
            gameName: finalGameName,
            redirectUrl: redirectUrl || null // Passer l'URL de redirect.html pour confirmation
          })
          log('[Protocol] 📤 Événement protocol:start-download envoyé avec redirectUrl:', redirectUrl || 'null')
          
          // Ensuite naviguer vers la page du jeu
          mainWindow.webContents.send('navigate-to-game', { gameName: finalGameName, gameId: finalGameId })
          log('[Protocol] Navigation vers la page du jeu:', finalGameName, 'ID:', finalGameId)
        } catch (err) {
          errorLog('[Protocol] Erreur lors de l\'envoi des événements:', err)
        }
      }
      
      // Vérifier si la page est déjà chargée
      const currentURL = mainWindow.webContents.getURL()
      const isPageLoaded = currentURL && (currentURL.includes('index.html') || currentURL.includes('localhost') || currentURL.includes('127.0.0.1'))
      
      if (isPageLoaded) {
        // La page est déjà chargée, envoyer les événements immédiatement
        log('[Protocol] ✅ Page déjà chargée, envoi immédiat des événements')
        sendEvents()
      } else {
        // Attendre que la page soit chargée (délai réduit pour afficher le dialogue plus vite)
        log('[Protocol] ⏳ Attente du chargement de la page...')
        const checkPageLoaded = setInterval(() => {
          const url = mainWindow.webContents.getURL()
          const loaded = url && (url.includes('index.html') || url.includes('localhost') || url.includes('127.0.0.1'))
          
          if (loaded) {
            clearInterval(checkPageLoaded)
            log('[Protocol] ✅ Page chargée, envoi des événements')
            sendEvents()
          } else if (!mainWindow || mainWindow.isDestroyed()) {
            clearInterval(checkPageLoaded)
            log('[Protocol] ⚠️ Fenêtre fermée pendant l\'attente')
          }
        }, 50) // Délai réduit à 50ms pour vérifier plus rapidement
        
        // Timeout après 1 seconde (réduit de 5 secondes)
        setTimeout(() => {
          clearInterval(checkPageLoaded)
          log('[Protocol] ⚠️ Timeout, envoi des événements quand même')
          sendEvents()
        }, 1000) // Timeout réduit à 1 seconde
      }
    } else if (finalGameName && mainWindow && !mainWindow.isDestroyed()) {
      // Si toujours pas de gameId après recherche, naviguer vers la page pour que l'utilisateur puisse télécharger
      mainWindow.webContents.send('navigate-to-game', { gameName: finalGameName })
      log('[Protocol] Navigation vers la page du jeu (pas de gameId trouvé):', finalGameName)
    }
  } catch (err) {
    errorLog('[Protocol] Erreur lors du déblocage:', err)
  }
}

/**
 * Confirmer le téléchargement vers redirect.html pour invalider le lien
 * @param {string} redirectUrl - URL originale de redirect.html
 * @param {string} gameName - Nom du jeu
 * @param {string} gameId - ID du jeu
 */
async function confirmDownloadToRedirect(redirectUrl, gameName, gameId) {
  try {
    if (!redirectUrl || !redirectUrl.includes('redirect.html')) {
      log('[Confirm] ⚠️ URL de redirection invalide, confirmation ignorée')
      return
    }
    
    log('[Confirm] 📤 Envoi de la confirmation vers redirect.html...')
    log('[Confirm] URL:', redirectUrl)
    log('[Confirm] Jeu:', gameName, gameId ? `(ID: ${gameId})` : '')
    
    // Extraire les paramètres de l'URL originale
    const urlObj = new URL(redirectUrl)
    const gameNameParam = urlObj.searchParams.get('game') || gameName
    const gameIdParam = urlObj.searchParams.get('gameId') || gameId
    const token = urlObj.searchParams.get('token')
    const timestamp = urlObj.searchParams.get('timestamp')
    const userId = urlObj.searchParams.get('userId')
    
    // Construire l'URL de confirmation avec le paramètre confirmed=1
    const confirmUrl = new URL(redirectUrl)
    confirmUrl.searchParams.set('confirmed', '1')
    confirmUrl.searchParams.set('game', gameNameParam)
    if (gameIdParam) confirmUrl.searchParams.set('gameId', gameIdParam)
    if (token) confirmUrl.searchParams.set('token', token)
    if (timestamp) confirmUrl.searchParams.set('timestamp', timestamp)
    if (userId) confirmUrl.searchParams.set('userId', userId)
    
    log('[Confirm] URL de confirmation:', confirmUrl.toString())
    
    // Envoyer une requête GET vers redirect.html avec le paramètre confirmed=1
    // Cela déclenchera l'invalidation automatique du lien côté redirect.html
    const https = (await import('https')).default
    const http = (await import('http')).default
    
    return new Promise((resolve, reject) => {
      const url = new URL(confirmUrl.toString())
      const client = url.protocol === 'https:' ? https : http
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Actoris-Launcher/1.0.1'
        },
        timeout: 5000
      }
      
      const req = client.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            log('[Confirm] ✅ Confirmation envoyée avec succès vers redirect.html')
            
            // 🎯 ROTATION DES LIENS LOCKR : Passer au lien suivant après utilisation
            if (gameIdParam) {
              setTimeout(async () => {
                try {
                  await rotateLockrUrlForGame(gameIdParam, gameNameParam)
                } catch (rotateErr) {
                  errorLog('[Confirm] ⚠️ Erreur lors de la rotation du lien Lockr:', rotateErr)
                  // Ne pas bloquer si la rotation échoue
                }
              }, 1000) // Délai de 1 seconde pour laisser le temps à la confirmation
            }
            
            resolve()
          } else {
            errorLog('[Confirm] ⚠️ Réponse non-OK:', res.statusCode)
            resolve() // Ne pas rejeter, juste logger
          }
        })
      })
      
      req.on('error', (err) => {
        errorLog('[Confirm] ❌ Erreur lors de l\'envoi de la confirmation:', err.message)
        resolve() // Ne pas rejeter, juste logger
      })
      
      req.on('timeout', () => {
        req.destroy()
        errorLog('[Confirm] ⚠️ Timeout lors de l\'envoi de la confirmation')
        resolve() // Ne pas rejeter, juste logger
      })
      
      req.end()
    })
  } catch (err) {
    errorLog('[Confirm] ❌ Erreur lors de la confirmation:', err)
  }
}

// Fonction pour gérer le téléchargement direct depuis le protocole
async function handleDownloadProtocol(gameName, gameId, downloadUrl) {
  try {
    log('[Protocol] 📥 Téléchargement direct:', gameName, downloadUrl ? `URL: ${downloadUrl.substring(0, 50)}...` : '')
    
    // Si la fenêtre principale n'existe pas, la créer
    if (!mainWindow || mainWindow.isDestroyed()) {
      log('[Protocol] 📦 Création de la fenêtre principale...')
      await createWindow()
    }
    
    // S'assurer que la fenêtre est visible et au premier plan
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
      mainWindow.show()
    }
    
    // Attendre que la page soit chargée
    const waitForPage = () => {
      return new Promise((resolve) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const url = mainWindow.webContents.getURL()
          const loaded = url && (url.includes('index.html') || url.includes('localhost') || url.includes('127.0.0.1'))
          
          if (loaded) {
            resolve()
            return
          }
        }
        
        // Vérifier périodiquement
        const checkInterval = setInterval(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            const url = mainWindow.webContents.getURL()
            const loaded = url && (url.includes('index.html') || url.includes('localhost') || url.includes('127.0.0.1'))
            
            if (loaded) {
              clearInterval(checkInterval)
              resolve()
            }
          } else {
            clearInterval(checkInterval)
            resolve() // Résoudre quand même pour éviter d'attendre indéfiniment
          }
        }, 100)
        
        // Timeout après 10 secondes
        setTimeout(() => {
          clearInterval(checkInterval)
          resolve()
        }, 10000)
      })
    }
    
    await waitForPage()
    log('[Protocol] ✅ Page chargée, envoi des données de téléchargement')
    
    // Si pas de gameId, chercher le jeu par nom
    let finalGameId = gameId
    if (!finalGameId && gameName) {
      try {
        log('[Protocol] 🔍 Recherche du jeu par nom:', gameName)
        const service = await getGamesService()
        const gamesResult = await service.getGamesFromGitHub()
        const games = gamesResult.games || []
        
        const normalizeName = (name) => {
          if (!name) return ''
          return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
        }
        
        const normalizedSearchName = normalizeName(gameName)
        const foundGame = games.find(g => {
          const gameTitle = g.title || g.name || ''
          const normalizedGameTitle = normalizeName(gameTitle)
          return normalizedGameTitle === normalizedSearchName || 
                 normalizedGameTitle.includes(normalizedSearchName) ||
                 normalizedSearchName.includes(normalizedGameTitle)
        })
        
        if (foundGame && foundGame.id) {
          finalGameId = foundGame.id
          log('[Protocol] ✅ Jeu trouvé par nom:', gameName, 'ID:', finalGameId)
        }
      } catch (err) {
        errorLog('[Protocol] Erreur lors de la recherche du jeu par nom:', err)
      }
    }
    
    // Envoyer les données de téléchargement au renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      log('[Protocol] 📤 Envoi des données de téléchargement:', { gameId: finalGameId, gameName, downloadUrl })
      
      // Envoyer protocol:start-download EN PREMIER pour activer le verrouillage
      mainWindow.webContents.send('protocol:start-download', { 
        gameId: finalGameId, 
        gameName,
        downloadUrl // Ajouter l'URL de téléchargement
      })
      
      // Ensuite naviguer vers la page du jeu
      mainWindow.webContents.send('navigate-to-game', { 
        gameName, 
        gameId: finalGameId 
      })
      
      log('[Protocol] ✅ Données envoyées, téléchargement devrait démarrer automatiquement')
    }
  } catch (err) {
    errorLog('[Protocol] Erreur lors du traitement du téléchargement direct:', err)
  }
}

/* ---------------- app lifecycle ---------------- */
// Enregistrer les gestionnaires d'événements AVANT requestSingleInstanceLock
// pour éviter que second-instance soit déclenché avant que les handlers soient prêts

// Gérer l'ouverture du launcher via le protocole personnalisé
app.on('open-url', (event, url) => {
  event.preventDefault()
  try {
    // Attendre que l'app soit prête avant de gérer l'URL
    if (app.isReady()) {
      handleProtocolUrl(url)
    } else {
      app.whenReady().then(() => handleProtocolUrl(url)).catch(err => {
        errorLog('[open-url] Erreur lors de l\'attente de whenReady:', err)
      })
    }
  } catch (err) {
    errorLog('[open-url] Erreur lors du traitement:', err)
  }
})

// Sur Windows, utiliser second-instance pour gérer le protocole
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Attendre que l'app soit prête avant de gérer
  const handleSecondInstance = () => {
    try {
      // Si une autre instance est lancée, se concentrer sur la fenêtre principale
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }

      // Vérifier si une URL de protocole est passée en argument
      const protocolUrl = commandLine.find(arg => arg.startsWith('actoris://'))
      if (protocolUrl) {
        handleProtocolUrl(protocolUrl)
      }
    } catch (err) {
      errorLog('[second-instance] Erreur lors du traitement:', err)
    }
  }
  
  if (app.isReady()) {
    handleSecondInstance()
  } else {
    app.whenReady().then(handleSecondInstance).catch(err => {
      errorLog('[second-instance] Erreur lors de l\'attente de whenReady:', err)
    })
  }
})

/* --- Optimisations Electron avant app.whenReady() --- */
// Désactiver des fonctionnalités Chromium inutiles pour améliorer les performances
if (!isDev) {
  // Désactiver les fonctionnalités non essentielles
  app.commandLine.appendSwitch('disable-background-networking')
  app.commandLine.appendSwitch('disable-background-timer-throttling')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
  app.commandLine.appendSwitch('disable-breakpad')
  app.commandLine.appendSwitch('disable-client-side-phishing-detection')
  app.commandLine.appendSwitch('disable-component-update')
  app.commandLine.appendSwitch('disable-default-apps')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
  app.commandLine.appendSwitch('disable-extensions')
  app.commandLine.appendSwitch('disable-features', 'TranslateUI,BlinkGenPropertyTrees')
  app.commandLine.appendSwitch('disable-hang-monitor')
  app.commandLine.appendSwitch('disable-ipc-flooding-protection')
  app.commandLine.appendSwitch('disable-notifications')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-sync')
  app.commandLine.appendSwitch('disable-web-security') // Seulement si pas de contenu web externe sensible
  app.commandLine.appendSwitch('metrics-recording-only')
  app.commandLine.appendSwitch('no-first-run')
  app.commandLine.appendSwitch('no-default-browser-check')
  app.commandLine.appendSwitch('no-pings')
  app.commandLine.appendSwitch('no-zygote')
  app.commandLine.appendSwitch('use-mock-keychain') // Sur macOS pour éviter les prompts
  
  // Optimisations GPU (désactiver si pas nécessaire)
  // app.commandLine.appendSwitch('disable-gpu') // Décommenter si problèmes de performance
  // app.commandLine.appendSwitch('disable-gpu-compositing') // Décommenter si problèmes
  app.commandLine.appendSwitch('disable-software-rasterizer')
  // Optimisations GPU supplémentaires pour meilleures performances
  app.commandLine.appendSwitch('disable-gpu-vsync') // Désactiver VSync pour meilleur FPS
  app.commandLine.appendSwitch('enable-gpu-rasterization') // Activer la rasterisation GPU
  app.commandLine.appendSwitch('enable-zero-copy') // Activer zero-copy pour les images
  
  // Optimisations mémoire
  app.commandLine.appendSwitch('disable-background-timer-throttling')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
  
  // Optimisations réseau
  app.commandLine.appendSwitch('disable-background-networking')
  app.commandLine.appendSwitch('disable-sync')
}

// Empêcher plusieurs instances (Windows) - doit être appelé après l'enregistrement des handlers
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

// Fonction pour initialiser le service Discord au démarrage
async function initializeDiscordService() {
  errorLog('[Main] 🔧 Initialisation du service Discord au démarrage...')
  
  try {
    // Appeler getDiscordService() pour forcer l'initialisation
    // Cette fonction met à jour la variable globale discordService
    const service = await getDiscordService()
    
    // Vérifier que la variable globale est bien définie
    if (!discordService) {
      errorLog('[Main] ❌ discordService global est null après getDiscordService()!')
      errorLog('[Main] ❌ service retourné:', service ? 'existe' : 'null')
      errorLog('[Main] ❌ Vérification des chemins...')
      const isDev = !app.isPackaged
      if (!isDev) {
        const installDir = path.dirname(process.execPath)
        const possiblePaths = [
          path.join(installDir, 'discord-service-secure.js'),
          path.join(__dirname, 'discord-service-secure.js'),
        ]
        possiblePaths.forEach(p => {
          const exists = fs.existsSync(p)
          errorLog(`[Main] 📁 ${p}: ${exists ? '✅ existe' : '❌ n\'existe pas'}`)
        })
      }
      return false
    }
    
    // Utiliser la variable globale pour les vérifications
    const globalService = discordService
    
    errorLog('[Main] ✅ Service Discord importé avec succès')
    errorLog('[Main] 📋 Type de service:', typeof globalService)
    errorLog('[Main] 📋 Clés disponibles:', Object.keys(globalService || {}))
    errorLog('[Main] 📋 getDiscordAuthUrl existe?', typeof globalService.getDiscordAuthUrl === 'function')
    
    // Vérifier que getDiscordAuthUrl existe
    if (typeof globalService.getDiscordAuthUrl !== 'function') {
      errorLog('[Main] ❌ getDiscordAuthUrl n\'est pas une fonction!')
      errorLog('[Main] ❌ Service complet:', JSON.stringify(Object.keys(globalService || {}), null, 2))
      return false
    }
    
    errorLog('[Main] ✅ Service Discord initialisé et vérifié avec succès')
    errorLog('[Main] ✅ discordService global est maintenant défini:', !!discordService)
    return true
  } catch (err) {
    errorLog('[Main] ❌ Erreur lors de l\'initialisation du service Discord:', err)
    errorLog('[Main] ❌ Message:', err.message)
    errorLog('[Main] ❌ Stack:', err.stack)
    return false
  }
}

// ============================================
// FONCTION : Créer le .env automatiquement
// ============================================
function ensureEnvFile() {
  try {
    // Chemin du .env dans userData (accessible en lecture/écriture)
    const envPath = path.join(app.getPath('userData'), '.env')
    
    log('[Setup] 🔍 Vérification du fichier .env...')
    log('[Setup] 📁 Chemin:', envPath)
    
    // Si le .env n'existe pas, créer un template
    if (!fs.existsSync(envPath)) {
      log('[Setup] 📝 Création du fichier .env...')
      
      const envTemplate = `# Configuration Discord (SERVEUR UNIQUEMENT - JAMAIS dans le client)
# ⚠️ REMPLACER par vos propres valeurs (obtenues depuis le serveur Discord)
DISCORD_TOKEN=
DISCORD_CLIENT_ID=1398485031189483642
DISCORD_CLIENT_SECRET=
DISCORD_GUILD_ID=1332072935682478202

# Rôles Discord
DISCORD_ROLE_MEMBER=1332077241722605700
DISCORD_ROLE_VIP=1351995593383350302
DISCORD_ROLE_BOOST=1332111013205770282
DISCORD_ROLE_ADMIN=1332076547422683268

# Configuration serveur
PORT=3001
WS_PORT=8080

# URLs
DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
API_URL=http://127.0.0.1:3001
WS_URL=ws://127.0.0.1:8080

# Configuration générale
NODE_ENV=production
`
      
      fs.writeFileSync(envPath, envTemplate, 'utf-8')
      log('[Setup] ✅ Fichier .env créé avec succès à:', envPath)
      return { created: true, path: envPath }
    } else {
      log('[Setup] ✅ Fichier .env existe déjà:', envPath)
      return { created: false, path: envPath }
    }
  } catch (err) {
    errorLog('[Setup] ❌ Erreur lors de la création du .env:', err)
    return { created: false, error: err }
  }
}

// ============================================
// FONCTION : Charger le .env (utilise env-manager avec secure-config)
// ============================================
async function loadEnvFile() {
  try {
    // Utiliser env-manager qui gère secure-config automatiquement
    const { loadEnvFile: loadEnvFromManager } = await import('./utils/env-manager.mjs')
    return await loadEnvFromManager()
  } catch (err) {
    errorLog('[Setup] ❌ Erreur lors du chargement de la configuration:', err)
    return false
  }
}

/* ---------------- IPC: Utils handlers manquants ---------------- */

// Handler pour récupérer les disques disponibles
ipcMain.handle('utils:getAvailableDrives', async () => {
  try {
    const fs = require('fs')
    const path = require('path')
    
    // Méthode alternative : tester les lettres de disque de A à Z
    const drives = []
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    
    for (const letter of letters) {
      const drivePath = `${letter}:\\`
      try {
        // Tester si le disque existe en essayant d'accéder au répertoire racine
        const stats = fs.statSync(drivePath)
        if (stats.isDirectory()) {
          // Essayer de récupérer l'espace libre avec PowerShell
          try {
            const { exec } = require('child_process')
            const { promisify } = require('util')
            const execAsync = promisify(exec)
            
            // Utiliser PowerShell comme alternative à wmic
            const psCommand = `powershell "Get-WmiObject -Class Win32_LogicalDisk -Filter \\"DeviceID='${letter}:'\\" | Select-Object Size,FreeSpace | ConvertTo-Json"`
            const { stdout } = await execAsync(psCommand)
            const diskInfo = JSON.parse(stdout)
            
            if (diskInfo && diskInfo.Size) {
              const free = parseInt(diskInfo.FreeSpace) || 0
              const total = parseInt(diskInfo.Size) || 0
              const used = total - free
              
              drives.push({
                drive: `${letter}:`,
                free: free,
                total: total,
                used: used
              })
            }
          } catch (psError) {
            // Si PowerShell échoue aussi, ajouter le disque avec des valeurs par défaut
            const defaultTotal = 500 * 1024 * 1024 * 1024 // 500 GB
            const defaultFree = 250 * 1024 * 1024 * 1024  // 250 GB
            drives.push({
              drive: `${letter}:`,
              free: defaultFree,
              total: defaultTotal,
              used: defaultTotal - defaultFree
            })
          }
        }
      } catch (error) {
        // Le disque n'existe pas, continuer
        continue
      }
    }
    
    // Si aucun disque trouvé, retourner au moins C: par défaut
    if (drives.length === 0) {
      const defaultTotal = 500 * 1024 * 1024 * 1024 // 500 GB
      const defaultFree = 250 * 1024 * 1024 * 1024  // 250 GB
      drives.push({
        drive: 'C:',
        free: defaultFree,
        total: defaultTotal,
        used: defaultTotal - defaultFree
      })
    }
    
    return {
      success: true,
      drives: drives
    }
  } catch (error) {
    console.error('[Utils] Erreur récupération disques:', error)
    // Fallback : retourner C: par défaut
    const defaultTotal = 500 * 1024 * 1024 * 1024 // 500 GB
    const defaultFree = 250 * 1024 * 1024 * 1024  // 250 GB
    return {
      success: true,
      drives: [{
        drive: 'C:',
        free: defaultFree,
        total: defaultTotal,
        used: defaultTotal - defaultFree
      }]
    }
  }
})

// Handler pour récupérer l'espace disque d'un dossier
ipcMain.handle('utils:getDiskSpace', async (event, folderPath) => {
  try {
    const fs = require('fs')
    
    // Vérifier que le dossier existe
    if (!fs.existsSync(folderPath)) {
      const defaultTotal = 500 * 1024 * 1024 * 1024 // 500 GB
      const defaultFree = 250 * 1024 * 1024 * 1024  // 250 GB
      return { 
        success: true,
        free: defaultFree, 
        total: defaultTotal, 
        used: defaultTotal - defaultFree 
      }
    }
    
    const drive = folderPath.charAt(0).toUpperCase()
    
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      
      // Utiliser PowerShell comme alternative à wmic
      const psCommand = `powershell "Get-WmiObject -Class Win32_LogicalDisk -Filter \\"DeviceID='${drive}:'\\" | Select-Object Size,FreeSpace | ConvertTo-Json"`
      const { stdout } = await execAsync(psCommand)
      const diskInfo = JSON.parse(stdout)
      
      if (diskInfo && diskInfo.Size) {
        const free = parseInt(diskInfo.FreeSpace) || 0
        const total = parseInt(diskInfo.Size) || 0
        const used = total - free
        
        return {
          success: true,
          free: free,
          total: total,
          used: used
        }
      }
    } catch (psError) {
      console.error('[Utils] PowerShell échoué, utilisation de valeurs par défaut')
    }
    
    // Fallback : valeurs par défaut
    const defaultTotal = 500 * 1024 * 1024 * 1024 // 500 GB
    const defaultFree = 250 * 1024 * 1024 * 1024  // 250 GB
    return { 
      success: true,
      free: defaultFree, 
      total: defaultTotal, 
      used: defaultTotal - defaultFree 
    }
  } catch (error) {
    console.error('[Utils] Erreur espace disque:', error)
    const defaultTotal = 500 * 1024 * 1024 * 1024 // 500 GB
    const defaultFree = 250 * 1024 * 1024 * 1024  // 250 GB
    return { 
      success: true,
      free: defaultFree, 
      total: defaultTotal, 
      used: defaultTotal - defaultFree 
    }
  }
})

// Handler pour récupérer le contenu d'une page web
ipcMain.handle('utils:fetchPageContent', async (event, url, options = {}) => {
  try {
    const https = require('https')
    const http = require('http')
    const zlib = require('zlib')
    
    return new Promise((resolve) => {
      const client = url.startsWith('https:') ? https : http
      
      // Headers par défaut
      const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
      
      // Fusionner avec les headers personnalisés (bypass)
      const headers = { ...defaultHeaders, ...(options.headers || {}) }
      
      // Log pour debug bypass
      if (options.headers && Object.keys(options.headers).length > 0) {
        console.log('[Utils] Utilisation headers bypass pour:', url.substring(0, 50) + '...')
        console.log('[Utils] Headers bypass:', Object.keys(options.headers))
      }
      
      const req = client.get(url, { headers }, (res) => {
        let data = ''
        
        // Gérer la compression gzip
        let stream = res
        if (res.headers['content-encoding'] === 'gzip') {
          stream = res.pipe(zlib.createGunzip())
        }
        
        stream.on('data', (chunk) => {
          data += chunk.toString()
        })
        
        stream.on('end', () => {
          resolve({
            success: true,
            content: data,
            statusCode: res.statusCode,
            headers: res.headers
          })
        })
        
        stream.on('error', (error) => {
          console.error('[Utils] Erreur stream:', error)
          resolve({
            success: false,
            error: error.message
          })
        })
      })
      
      req.on('error', (error) => {
        console.error('[Utils] Erreur fetch page:', error)
        resolve({
          success: false,
          error: error.message
        })
      })
      
      req.setTimeout(15000, () => {
        req.destroy()
        resolve({
          success: false,
          error: 'Timeout - La page met trop de temps à répondre'
        })
      })
    })
  } catch (error) {
    console.error('[Utils] Erreur fetchPageContent:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

/* --- HANDLERS SQLITE LIBRARY --- */
async function initializeSQLiteHandlers() {
  try {
    const sqlite = await getGamesLibrarySQLite()
    
    // Initialiser la base de données
    ipcMain.handle('sqlite-library:init', async () => {
      try {
        await sqlite.initDatabase()
        console.log('[SQLite] ✅ sqlite-library:init OK')
        return { success: true }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:init error:', error)
        return { success: false, error: error.message }
      }
    })
    
    // Définir l'utilisateur Discord
    ipcMain.handle('sqlite-library:setUser', async (event, discordId, userData = null) => {
      try {
        await sqlite.setCurrentUser(discordId, userData)
        console.log('[SQLite] ✅ sqlite-library:setUser OK')
        return { success: true }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:setUser error:', error)
        return { success: false, error: error.message }
      }
    })
    
    // Charger un utilisateur
    ipcMain.handle('sqlite-library:loadUser', async (event, discordId) => {
      try {
        const user = await sqlite.loadUser(discordId)
        console.log('[SQLite] ✅ sqlite-library:loadUser OK')
        return { success: true, user }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:loadUser error:', error)
        return { success: false, user: null, error: error.message }
      }
    })
    
    // Récupérer tous les utilisateurs
    ipcMain.handle('sqlite-library:getAllUsers', async () => {
      try {
        const users = await sqlite.getAllUsers()
        console.log('[SQLite] ✅ sqlite-library:getAllUsers OK,', users.length, 'utilisateurs')
        return { success: true, users }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:getAllUsers error:', error)
        return { success: false, users: [], error: error.message }
      }
    })
    
    // Supprimer un utilisateur
    ipcMain.handle('sqlite-library:deleteUser', async (event, discordId) => {
      try {
        const success = await sqlite.deleteUser(discordId)
        console.log('[SQLite] ✅ sqlite-library:deleteUser OK')
        return { success }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:deleteUser error:', error)
        return { success: false, error: error.message }
      }
    })
    
    // Récupérer les jeux
    ipcMain.handle('sqlite-library:getGames', async (event, userId = null) => {
      try {
        const games = await sqlite.getAllInstalledGames(userId)
        console.log('[SQLite] ✅ sqlite-library:getGames OK,', games.length, 'jeux')
        return { success: true, games }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:getGames error:', error)
        return { success: false, games: [], error: error.message }
      }
    })
    
    // Ajouter un jeu
    ipcMain.handle('sqlite-library:addGame', async (event, gameId, gameData) => {
      try {
        await sqlite.saveInstalledGame(gameId, gameData)
        console.log('[SQLite] ✅ sqlite-library:addGame OK')
        return { success: true }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:addGame error:', error)
        return { success: false, error: error.message }
      }
    })
    
    // Supprimer un jeu
    ipcMain.handle('sqlite-library:removeGame', async (event, gameId) => {
      try {
        const deleted = await sqlite.removeInstalledGame(gameId)
        console.log('[SQLite] ✅ sqlite-library:removeGame OK')
        return { success: true, deleted }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:removeGame error:', error)
        return { success: false, error: error.message }
      }
    })
    
    // Vérifier si un jeu est installé
    ipcMain.handle('sqlite-library:hasGame', async (event, gameId) => {
      try {
        const hasGame = await sqlite.isGameInstalled(gameId)
        console.log('[SQLite] ✅ sqlite-library:hasGame OK')
        return { success: true, hasGame }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:hasGame error:', error)
        return { success: false, hasGame: false, error: error.message }
      }
    })
    
    // Obtenir les statistiques
    ipcMain.handle('sqlite-library:getStats', async (event, userId = null) => {
      try {
        const stats = await sqlite.getStatistics(userId)
        console.log('[SQLite] ✅ sqlite-library:getStats OK')
        return { success: true, stats }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:getStats error:', error)
        return { success: false, stats: null, error: error.message }
      }
    })
    
    // Jeux les plus joués
    ipcMain.handle('sqlite-library:getMostPlayed', async (event, limit = 10, userId = null) => {
      try {
        const games = await sqlite.getMostPlayedGames(limit, userId)
        console.log('[SQLite] ✅ sqlite-library:getMostPlayed OK')
        return { success: true, games }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:getMostPlayed error:', error)
        return { success: false, games: [], error: error.message }
      }
    })
    
    // Jeux récemment joués
    ipcMain.handle('sqlite-library:getRecentlyPlayed', async (event, limit = 10, userId = null) => {
      try {
        const games = await sqlite.getRecentlyPlayed(limit, userId)
        console.log('[SQLite] ✅ sqlite-library:getRecentlyPlayed OK')
        return { success: true, games }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:getRecentlyPlayed error:', error)
        return { success: false, games: [], error: error.message }
      }
    })
    
    // Rechercher des jeux
    ipcMain.handle('sqlite-library:searchGames', async (event, query, userId = null) => {
      try {
        const games = await sqlite.searchGames(query, userId)
        console.log('[SQLite] ✅ sqlite-library:searchGames OK')
        return { success: true, games }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:searchGames error:', error)
        return { success: false, games: [], error: error.message }
      }
    })
    
    // Mettre à jour le dernier jeu joué
    ipcMain.handle('sqlite-library:updateLastPlayed', async (event, gameId) => {
      try {
        await sqlite.updateLastPlayed(gameId)
        console.log('[SQLite] ✅ sqlite-library:updateLastPlayed OK')
        return { success: true }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:updateLastPlayed error:', error)
        return { success: false, error: error.message }
      }
    })
    
    // Incrémenter le temps de jeu
    ipcMain.handle('sqlite-library:incrementPlayTime', async (event, gameId, minutes) => {
      try {
        await sqlite.incrementPlayTime(gameId, minutes)
        console.log('[SQLite] ✅ sqlite-library:incrementPlayTime OK')
        return { success: true }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:incrementPlayTime error:', error)
        return { success: false, error: error.message }
      }
    })
    
    // Debug
    ipcMain.handle('sqlite-library:debug', async () => {
      try {
        const debug = await sqlite.debug()
        console.log('[SQLite] ✅ sqlite-library:debug OK')
        return { success: true, debug }
      } catch (error) {
        console.error('[SQLite] ❌ sqlite-library:debug error:', error)
        return { success: false, debug: null, error: error.message }
      }
    })
    
    console.log('[SQLite] ✅ Tous les handlers SQLite initialisés')
    
  } catch (error) {
    console.error('[SQLite] ❌ Erreur initialisation handlers:', error)
  }
}

app.whenReady().then(async () => {
  // Enregistrer le protocole après que l'app soit prête
  registerProtocol()
  
  // Initialiser les handlers SQLite
  await initializeSQLiteHandlers()
  
  // Démarrer le monitoring de performance (uniquement en dev)
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    try {
      startMemoryMonitoring(60000) // Logger toutes les minutes
      log('[Performance] ✅ Monitoring activé')
    } catch (err) {
      // Ignorer les erreurs de monitoring
    }
  }
  
  // ============================================
  // ÉTAPE 1 : Créer et charger le .env
  // ============================================
  log('[Setup] 🚀 Initialisation de la configuration...')
  
  // Créer le .env s'il n'existe pas
  const envResult = ensureEnvFile()
  if (envResult.created) {
    log('[Setup] 🎉 Fichier .env créé pour la première fois !')
  }
  
  // Charger le .env dans process.env
  await loadEnvFile()
  
  // ============================================
  // ============================================
  // ÉTAPE 2 : Vérifier que le .env existe (mais ne pas le charger)
  // Les variables seront vérifiées côté backend uniquement
  // ============================================
  if (envResult && envResult.path) {
    log('[Setup] ✅ Fichier .env disponible pour le backend:', envResult.path)
    log('[Setup] ⚠️  Le .env sera chargé uniquement par le backend (launcher-server.js)')
    log('[Setup] ⚠️  Les secrets Discord ne sont JAMAIS chargés côté client (sécurité)')
  } else {
    errorLog('[Setup] ⚠️  Le fichier .env n\'existe pas. Le backend peut ne pas démarrer correctement.')
    errorLog('[Setup] 💡 Le backend chargera le .env depuis:', envResult?.path || app.getPath('userData'))
  }
  
  // Créer le dossier cache/images dès le démarrage
  try {
    const cacheDir = path.join(app.getPath('userData'), 'cache', 'images')
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
      log('[Setup] Dossier cache/images créé:', cacheDir)
    }
  } catch (err) {
    errorLog('[Setup] Erreur lors de la création du dossier cache:', err)
  }
  
  // IMPORTANT : Initialiser le service Discord AVANT les handlers IPC
  errorLog('[Main] 🚀 Initialisation du service Discord...')
  const discordServiceInitialized = await initializeDiscordService()
  
  if (!discordServiceInitialized) {
    errorLog('[Main] ⚠️ Le service Discord n\'a pas pu être initialisé, mais on continue quand même')
  }
  
  // Initialiser l'auto-updater
  initializeAutoUpdater().catch(err => {
    errorLog('[Updater] Erreur lors de l\'initialisation:', err)
  })
  // Enregistrer seulement les handlers critiques au démarrage
  registerCriticalHandlers()
  
  // Démarrer le serveur backend en parallèle avec la création de la fenêtre
  // CRITICAL: Démarrer le backend AVANT de créer la fenêtre
  errorLog('[Main] 🚀 Démarrage du backend SERVEUR...')
  console.error('[Main] 🚀 Démarrage du backend SERVEUR...')
  
  const backendPromise = startBackendServer().catch(err => {
    const errorMsg = `[Backend Server] ❌ Erreur lors du démarrage: ${err.message || err}`
    errorLog(errorMsg)
    console.error(errorMsg)
    return { success: false, error: err }
  })
  
  // ============================================
  // CRÉER LA FENÊTRE IMMÉDIATEMENT (PRIORITÉ)
  // ============================================
  // Ne pas attendre le backend - créer la fenêtre en premier pour éviter l'écran noir
  createWindow().catch(err => {
    errorLog('[Setup] ❌ Erreur lors de la création de la fenêtre:', err)
  })
  
  // ============================================
  // SERVEUR CALLBACK OAUTH (Port 5173)
  // ============================================
  // Créer un petit serveur HTTP pour gérer le callback Discord OAuth
  try {
    const express = (await import('express')).default
    const callbackApp = express()
    
    // Protection contre les appels multiples
    let exchangeInProgress = false
    const usedCodes = new Set()
    
    callbackApp.get('/auth/callback', (req, res) => {
      const code = req.query.code
      const error = req.query.error
      
      log('[OAuth Callback] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      log('[OAuth Callback] 📥 Callback reçu')
      log('[OAuth Callback] Code:', code ? `✅ ${code.substring(0, 10)}...` : '❌')
      log('[OAuth Callback] Error:', error || 'Aucune')
      log('[OAuth Callback] Redirect URI utilisé:', process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback')
      log('[OAuth Callback] URL complète:', req.url)
      
      // Protection contre les appels multiples
      if (exchangeInProgress) {
        log('[OAuth Callback] ⚠️ Échange déjà en cours, ignoré')
        res.send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>⏳ Traitement en cours...</h1>
              <p>Veuillez patienter.</p>
            </body>
          </html>
        `)
        return
      }
      
      // Vérifier si le code a déjà été utilisé
      if (code && usedCodes.has(code)) {
        errorLog('[OAuth Callback] ❌ Code déjà utilisé:', code.substring(0, 10) + '...')
        res.send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>❌ Code déjà utilisé</h1>
              <p>Ce code d'autorisation a déjà été utilisé.</p>
              <p>Veuillez réessayer la connexion.</p>
            </body>
          </html>
        `)
        return
      }
      
      if (error) {
        errorLog('[OAuth Callback] ❌ Erreur Discord:', error)
        res.send(`
          <html>
            <head>
              <style>
                body {
                  font-family: 'Segoe UI', Arial, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  color: white;
                }
                .container {
                  text-align: center;
                  background: rgba(255,255,255,0.1);
                  padding: 40px;
                  border-radius: 20px;
                  backdrop-filter: blur(10px);
                }
                h1 { font-size: 48px; margin: 0 0 20px 0; }
                p { font-size: 18px; margin: 10px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>❌ Erreur</h1>
                <p>Une erreur s'est produite lors de la connexion.</p>
                <p>Vous pouvez fermer cette fenêtre.</p>
              </div>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `)
        return
      }
      
      if (code) {
        // Marquer le code comme utilisé
        usedCodes.add(code)
        exchangeInProgress = true
        
        log('[OAuth Callback] 🔄 Code marqué comme utilisé')
        log('[OAuth Callback] 🔄 Échange en cours...')
        
        // Envoyer le code à la fenêtre principale
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('discord-auth-code', code)
          log('[OAuth Callback] ✅ Code envoyé à la fenêtre principale')
          
          // Réinitialiser après 5 secondes
          setTimeout(() => {
            exchangeInProgress = false
            log('[OAuth Callback] ✅ Échange terminé, prêt pour un nouveau code')
          }, 5000)
        } else {
          exchangeInProgress = false
          errorLog('[OAuth Callback] ❌ Fenêtre principale non disponible')
        }
        
        // Page de succès
        res.send(`
          <html>
            <head>
              <style>
                body {
                  font-family: 'Segoe UI', Arial, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  color: white;
                }
                .container {
                  text-align: center;
                  background: rgba(255,255,255,0.1);
                  padding: 40px;
                  border-radius: 20px;
                  backdrop-filter: blur(10px);
                  animation: slideIn 0.5s ease-out;
                }
                @keyframes slideIn {
                  from { transform: translateY(-50px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
                h1 { font-size: 48px; margin: 0 0 20px 0; }
                p { font-size: 18px; margin: 10px 0; }
                .checkmark {
                  font-size: 64px;
                  animation: bounce 0.6s ease-in-out;
                }
                @keyframes bounce {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.2); }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="checkmark">✅</div>
                <h1>Connexion réussie !</h1>
                <p>Vous êtes maintenant connecté à Actoris.</p>
                <p>Cette fenêtre va se fermer automatiquement...</p>
              </div>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `)
      } else {
        res.status(400).send('Code manquant')
      }
    })
    
    const callbackServer = callbackApp.listen(5173, () => {
      log('[OAuth Callback] ✅ Serveur callback démarré sur http://localhost:5173')
    })
    
    // Gérer les erreurs du serveur
    callbackServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        log('[OAuth Callback] ⚠️ Port 5173 déjà utilisé (probablement Vite dev server)')
      } else {
        errorLog('[OAuth Callback] ❌ Erreur serveur:', err)
      }
    })
  } catch (err) {
    errorLog('[OAuth Callback] ❌ Impossible de démarrer le serveur callback:', err)
  }
  
  // ============================================
  // DÉMARRAGE DU BACKEND EN ARRIÈRE-PLAN
  // ============================================
  // Ne pas bloquer l'affichage - le backend se chargera en arrière-plan
  // La fenêtre est déjà créée, donc l'utilisateur voit l'écran de login immédiatement
  backendPromise.then((serverResult) => {
    if (serverResult?.success) {
      log('[Backend Server] ✅ Backend démarré avec succès (en arrière-plan)')
    } else {
      errorLog('[Backend Server] ⚠️ Le backend n\'a pas démarré correctement')
      errorLog('[Backend Server] ⚠️ L\'application continuera mais certaines fonctionnalités peuvent ne pas fonctionner')
      
      // Vérification rapide en arrière-plan (sans bloquer)
      setTimeout(async () => {
        let serverReady = false
        let attempts = 0
        const maxAttempts = 5 // Réduit pour ne pas bloquer
        
        while (!serverReady && attempts < maxAttempts) {
          try {
            const http = await import('http')
            await new Promise((resolve) => {
              const testRequest = http.request({
                hostname: '127.0.0.1',
                port: 3001,
                path: '/health',
                method: 'GET',
                timeout: 500
              }, (res) => {
                serverReady = true
                log('[Backend Server] ✅ Health check réussi après', attempts + 1, 'tentatives')
                resolve()
              })
              
              testRequest.on('error', () => {
                attempts++
                if (attempts < maxAttempts) {
                  setTimeout(resolve, 200)
                } else {
                  resolve()
                }
              })
              
              testRequest.on('timeout', () => {
                testRequest.destroy()
                attempts++
                if (attempts < maxAttempts) {
                  setTimeout(resolve, 200)
                } else {
                  resolve()
                }
              })
              
              testRequest.end()
            })
          } catch (err) {
            attempts++
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 200))
            } else {
              break
            }
          }
        }
      }, 1000) // Attendre 1 seconde avant de vérifier
    }
  }).catch((err) => {
    errorLog('[Backend Server] ❌ Erreur lors du démarrage du backend:', err)
  })
  
  log('App ready - Fenêtre affichée immédiatement')
  
  // Délayer toutes les autres opérations pour ne pas bloquer le démarrage
  setTimeout(async () => {
    // Enregistrer tous les autres handlers
    registerAllHandlers()
    // Configurer la session de téléchargement
    setupDefaultSession()
    // Le serveur HTTP de confirmation est maintenant intégré dans le serveur backend Express (launcher-server.js)
    // createConfirmationServer() n'est plus nécessaire car il utilisait le port 3001 qui est maintenant utilisé par le backend
    // Créer le serveur WebSocket pour les confirmations (méthode principale)
    createWebSocketServer()
    
    // Initialiser Discord RPC (optionnel, ne bloque pas si Discord n'est pas ouvert)
    try {
      const rpcService = await getDiscordRPCService()
      await rpcService.initDiscordRPC()
      log('[Discord RPC] Initialisation en arrière-plan')
    } catch (err) {
      // Erreur non bloquante - Discord RPC ne fonctionne que si Discord n'est ouvert
      errorLog('[Discord RPC] ⚠️  Erreur lors de l\'initialisation (non bloquant):', err.message)
      errorLog('[Discord RPC] ℹ️  C\'est normal si Discord n\'est pas ouvert sur votre machine')
    }
  }, 100) // 100ms après le démarrage

  // 🔍 SCAN AUTOMATIQUE DES JEUX INSTALLÉS AU DÉMARRAGE (EN ARRIÈRE-PLAN)
  // On le lance quelques secondes après le démarrage pour ne pas bloquer l'affichage
  setTimeout(async () => {
    try {
      log('[Startup] 🔍 Scan automatique des jeux installés (au démarrage)...')
      // Invalider le cache pour forcer un nouveau scan
      scanCache.lastScan = 0
      scanCache.games = []

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
      
      const allInstalledGames = []
      for (const folder of foldersToScan) {
        if (fs.existsSync(folder)) {
          const extractor = await getGameExtractor()
          const games = extractor.scanInstalledGames(folder)
          allInstalledGames.push(...games)
        }
      }
      
      // 💾 CHARGER LES JEUX SAUVEGARDÉS ET VÉRIFIER QU'ILS EXISTENT TOUJOURS
      try {
        const savedGames = await installedGamesStore.verifyInstalledGames(fs.existsSync)
        log('[Startup] 💾', Object.keys(savedGames).length, 'jeux sauvegardés chargés')
        
        // Fusionner les jeux scannés avec les jeux sauvegardés
        const mergedGames = await installedGamesStore.mergeWithScannedGames(allInstalledGames)
        
        scanCache.games = mergedGames
        scanCache.lastScan = Date.now()
        log('[Startup] ✅ Scan terminé,', mergedGames.length, 'jeux trouvés (', allInstalledGames.length, 'scannés,', Object.keys(savedGames).length, 'sauvegardés)')
        
        // Sauvegarder les jeux scannés
        await installedGamesStore.saveInstalledGamesFromScan(allInstalledGames)
      
        // Notifier le renderer avec les jeux fusionnés
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('games:installed-updated', {
            games: mergedGames
          })
        }
      } catch (storeError) {
        errorLog('[Startup] ⚠️ Erreur lors du chargement du store:', storeError)
        // Fallback : utiliser seulement les jeux scannés
        scanCache.games = allInstalledGames
        scanCache.lastScan = Date.now()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('games:installed-updated', {
            games: allInstalledGames
          })
        }
      }
    } catch (scanErr) {
      errorLog('[Startup] ⚠️ Erreur lors du scan au démarrage:', scanErr)
    }
  }, 3000) // Attendre 3 secondes après le démarrage
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else if (!mainWindow || mainWindow.isDestroyed()) createWindow()
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

// Démarrer le serveur backend automatiquement
let backendServerProcess = null

// Fonction pour tuer le processus qui utilise le port 3001
async function killProcessOnPort(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      // Sur Linux/Mac, utiliser lsof
      const lsof = spawn('lsof', ['-ti', `:${port}`])
      lsof.on('close', (code) => {
        if (code === 0) {
          const kill = spawn('kill', ['-9', lsof.stdout.toString().trim()])
          kill.on('close', () => resolve(true))
        } else {
          resolve(false)
        }
      })
    } else {
      // Sur Windows, utiliser netstat et taskkill
      const netstat = spawn('netstat', ['-ano'], { shell: true })
      let output = ''
      
      netstat.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      netstat.on('close', () => {
        const lines = output.split('\n')
        for (const line of lines) {
          if (line.includes(`:${port}`) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/)
            const pid = parts[parts.length - 1]
            if (pid && !isNaN(pid)) {
              log(`[Backend Server] 🔍 Processus trouvé sur le port ${port}: PID ${pid}`)
              const taskkill = spawn('taskkill', ['/F', '/PID', pid], { shell: true })
              taskkill.on('close', (code) => {
                if (code === 0) {
                  log(`[Backend Server] ✅ Processus ${pid} tué`)
                  resolve(true)
                } else {
                  errorLog(`[Backend Server] ⚠️ Impossible de tuer le processus ${pid}`)
                  resolve(false)
                }
              })
              taskkill.on('error', () => {
                resolve(false)
              })
              return
            }
          }
        }
        resolve(false)
      })
      
      netstat.on('error', () => {
        resolve(false)
      })
    }
  })
}

async function startBackendServer() {
  // Fonction pour envoyer les logs au renderer (activée pour le diagnostic)
  // DOIT être définie AVANT d'être utilisée
  const sendLog = (message, type = 'stdout') => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      try {
        mainWindow.webContents.send('backend-server:log', {
          type,
          message: String(message),
          timestamp: new Date().toISOString()
        })
      } catch (err) {
        // Ignorer les erreurs d'envoi de logs
      }
    }
  }

  errorLog('[Backend Server] 🚀 Démarrage du serveur backend...')
  sendLog('🚀 Démarrage du serveur backend...', 'stdout')
  errorLog('[Backend Server] 📁 isPackaged:', app.isPackaged)
  sendLog(`📁 isPackaged: ${app.isPackaged}`, 'stdout')
  errorLog('[Backend Server] 📁 __dirname:', __dirname)
  sendLog(`📁 __dirname: ${__dirname}`, 'stdout')
  errorLog('[Backend Server] 📁 app.getAppPath():', app.getAppPath())
  sendLog(`📁 app.getAppPath(): ${app.getAppPath()}`, 'stdout')
  
  if (backendServerProcess) {
    errorLog('[Backend Server] ✅ Serveur déjà démarré')
    return { success: true }
  }
  
  try {
    // Vérifier si le port 3001 est déjà utilisé
    const net = await import('net')
    const portInUse = await new Promise((resolve) => {
      const testServer = net.createServer()
      testServer.listen(3001, () => {
        testServer.once('close', () => resolve(false))
        testServer.close()
      })
      testServer.on('error', () => {
        resolve(true)
      })
    })
    
    if (portInUse) {
      errorLog('[Backend Server] ⚠️ Port 3001 déjà utilisé, tentative de libération...')
      sendLog('⚠️ Port 3001 déjà utilisé, tentative de libération...', 'stderr')
      const killed = await killProcessOnPort(3001)
      if (killed) {
        errorLog('[Backend Server] ✅ Processus sur le port 3001 tué, attente de libération...')
        sendLog('✅ Processus tué, attente de libération...', 'stdout')
        // Attendre plus longtemps pour que le port soit libéré
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Vérifier à nouveau si le port est libre
        const portStillInUse = await new Promise((resolve) => {
          const testServer2 = net.createServer()
          testServer2.listen(3001, () => {
            testServer2.once('close', () => resolve(false))
            testServer2.close()
          })
          testServer2.on('error', () => {
            resolve(true)
          })
        })
        
        if (portStillInUse) {
          errorLog('[Backend Server] ❌ Port 3001 toujours utilisé après tentative de libération')
          sendLog('❌ Port toujours utilisé, le backend ne peut pas démarrer', 'stderr')
          return { success: false, error: 'Port 3001 toujours utilisé après tentative de libération' }
        } else {
          errorLog('[Backend Server] ✅ Port 3001 libéré avec succès')
          sendLog('✅ Port libéré, démarrage du backend...', 'stdout')
        }
      } else {
        errorLog('[Backend Server] ⚠️ Impossible de tuer le processus sur le port 3001')
        sendLog('⚠️ Impossible de libérer le port, tentative de démarrage quand même...', 'stderr')
      }
    }
    
    // Chemin vers launcher-server.js
    // En dev: utiliser le chemin du projet, en prod: utiliser app.getAppPath()
    const isDev = !app.isPackaged
    let serverPath
    
    if (isDev) {
      // En développement, le fichier est à la racine du projet
      serverPath = path.join(__dirname, '..', 'launcher-server.js')
    } else {
      // En production, chercher launcher-server.mjs (renommé dans le build)
      // .mjs indique explicitement un module ES, pas besoin de package.json
      const appPath = app.getAppPath()
      const resourcesPath = process.resourcesPath || appPath
      const execPath = process.execPath
      const installDir = path.dirname(execPath)
      
      // Remplacer app.asar par app.asar.unpacked si nécessaire
      const unpackedPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked')
      
      const possiblePaths = [
        path.join(installDir, 'launcher-server.js'),            // Dossier d'installation (extraFiles) - PRIORITÉ
        path.join(unpackedPath, 'launcher-server.js'),          // app.asar.unpacked/ (asarUnpack)
        path.join(resourcesPath, 'app.asar.unpacked', 'launcher-server.js'), // resources/app.asar.unpacked/
        path.join(resourcesPath, 'launcher-server.js'),         // resources/ (extraResources)
        path.join(appPath, 'launcher-server.js'),               // app.asar/ (dans l'archive)
        path.join(path.dirname(appPath), 'launcher-server.js'), // Un niveau au-dessus
        // Fallback vers .mjs si .js n'existe pas (pour compatibilité)
        path.join(installDir, 'launcher-server.mjs'),
        path.join(unpackedPath, 'launcher-server.mjs'),
        path.join(__dirname, '..', 'launcher-server.js'),
      ]
      
      serverPath = possiblePaths.find(p => fs.existsSync(p))
      
      if (!serverPath) {
        serverPath = possiblePaths[0]
        const errorMsg = '[Backend Server] ❌ launcher-server.js non trouvé'
        errorLog(errorMsg)
        errorLog('[Backend Server] 📁 Chemins testés:', possiblePaths)
        errorLog('[Backend Server] 📁 appPath:', appPath)
        errorLog('[Backend Server] 📁 resourcesPath:', resourcesPath)
        errorLog('[Backend Server] 📁 installDir:', installDir)
        return { success: false, error: 'launcher-server.js not found' }
      }
      
      errorLog('[Backend Server] ✅ launcher-server.js trouvé:', serverPath)
      sendLog(`✅ launcher-server.js trouvé: ${serverPath}`, 'stdout')
    }
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(serverPath)) {
      errorLog('[Backend Server] ❌ Fichier serveur introuvable:', serverPath)
      errorLog('[Backend Server] 📁 Vérification existence:', fs.existsSync(serverPath))
      return { success: false, error: 'Server file not found: ' + serverPath }
    }
    
    errorLog('[Backend Server] ✅ Fichier serveur existe:', serverPath)
    sendLog(`✅ Fichier serveur existe: ${serverPath}`, 'stdout')
    
    // Déterminer le répertoire de travail pour le serveur backend
    // En dev: utiliser la racine du projet (où se trouve le .env)
    // En prod: utiliser le MÊME RÉPERTOIRE que launcher-server.js
    let serverCwd
    if (isDev) {
      serverCwd = path.join(__dirname, '..')  // Racine du projet en dev
    } else {
      // En production, utiliser le dossier où se trouve launcher-server.js
      // IMPORTANT: Utiliser path.dirname(serverPath) pour obtenir le répertoire exact
      // Exemple: C:\Users\...\AppData\Local\Programs\Actoris\launcher-server.mjs -> C:\Users\...\AppData\Local\Programs\Actoris\
      // Ou: C:\Program Files (x86)\Actoris\launcher-server.mjs -> C:\Program Files (x86)\Actoris\
      serverCwd = path.dirname(serverPath)
      
      // Vérifier aussi avec path.dirname(process.execPath) pour confirmation
      const execPathDir = path.dirname(process.execPath)
      errorLog('[Backend Server] 📁 serverPath:', serverPath)
      errorLog('[Backend Server] 📁 serverCwd (dirname de serverPath):', serverCwd)
      errorLog('[Backend Server] 📁 execPathDir (dirname de execPath):', execPathDir)
      sendLog(`📁 serverPath: ${serverPath}`, 'stdout')
      sendLog(`📁 serverCwd: ${serverCwd}`, 'stdout')
      sendLog(`📁 execPathDir: ${execPathDir}`, 'stdout')
      
      // Vérifier que serverPath est bien dans serverCwd
      const expectedServerPath = path.join(serverCwd, path.basename(serverPath))
      if (expectedServerPath !== serverPath) {
        errorLog('[Backend Server] ⚠️ ATTENTION: serverPath ne correspond pas à serverCwd!')
        errorLog('[Backend Server] ⚠️ expectedServerPath:', expectedServerPath)
        errorLog('[Backend Server] ⚠️ serverPath:', serverPath)
        sendLog(`⚠️ ATTENTION: serverPath ne correspond pas à serverCwd!`, 'stderr')
      }
      
      // Si serverCwd et execPathDir sont différents, logger un avertissement
      // car c'est là que launcher-server.js devrait être (d'après extraFiles)
      if (serverCwd !== execPathDir) {
        errorLog('[Backend Server] ⚠️ serverCwd et execPathDir sont différents!')
        errorLog('[Backend Server] ⚠️ serverCwd:', serverCwd)
        errorLog('[Backend Server] ⚠️ execPathDir:', execPathDir)
        sendLog(`⚠️ serverCwd et execPathDir sont différents`, 'stderr')
        // Ne pas changer serverCwd, mais vérifier que le package.json sera créé au bon endroit
      }
      
      // Mais aussi chercher le .env dans plusieurs emplacements
      const resourcesPath = process.resourcesPath || app.getAppPath()
      const execPath = process.execPath
      const installDir = path.dirname(execPath)
      const unpackedPath = app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked')
      
      // Ajouter aussi le chemin userData où le .env peut être créé automatiquement
      const userDataPath = app.getPath('userData')
      
      const possibleEnvPaths = [
        path.join(userDataPath, '.env'),         // userData (où setup-env.js crée le .env)
        path.join(installDir, '.env'),           // Dossier d'installation
        path.join(unpackedPath, '.env'),         // app.asar.unpacked/
        path.join(serverCwd, '.env'),            // Même dossier que launcher-server.js
        path.join(resourcesPath, '.env'),        // resources/
        path.join(app.getAppPath(), '.env'),     // app.asar/
      ]
      
    }
    
    errorLog('[Backend Server] 📁 serverCwd défini:', serverCwd)
    sendLog(`📁 serverCwd défini: ${serverCwd}`, 'stdout')
    
    // En production, si on utilise .mjs, pas besoin de package.json !
    // .mjs indique explicitement un module ES
    if (!isDev && serverPath.endsWith('.mjs')) {
      errorLog('[Backend Server] ✅ Utilisation de .mjs - pas besoin de package.json!')
      sendLog('✅ Utilisation de .mjs - pas besoin de package.json!', 'stdout')
    }
    
    // Si on utilise .js, créer un package.json avec "type": "module"
    if (!isDev && !serverPath.endsWith('.mjs')) {
      // Utiliser serverCwd qui est path.dirname(serverPath)
      // Cela garantit que package.json est dans le MÊME répertoire que launcher-server.js
      const packageJsonPath = path.join(serverCwd, 'package.json')
      
      errorLog('[Backend Server] 📁 ===== CRÉATION package.json =====')
      errorLog('[Backend Server] 📁 serverPath:', serverPath)
      errorLog('[Backend Server] 📁 serverCwd:', serverCwd)
      errorLog('[Backend Server] 📁 packageJsonPath:', packageJsonPath)
      errorLog('[Backend Server] 📁 Vérification: launcher-server.js devrait être dans:', serverCwd)
      sendLog(`📁 ===== CRÉATION package.json =====`, 'stdout')
      sendLog(`📁 serverPath: ${serverPath}`, 'stdout')
      sendLog(`📁 serverCwd: ${serverCwd}`, 'stdout')
      sendLog(`📁 packageJsonPath: ${packageJsonPath}`, 'stdout')
      
      // Vérifier que le fichier serveur est bien dans serverCwd
      const expectedServerPath = path.join(serverCwd, path.basename(serverPath))
      if (fs.existsSync(expectedServerPath)) {
        errorLog('[Backend Server] ✅ Fichier serveur trouvé dans serverCwd:', expectedServerPath)
        sendLog(`✅ Fichier serveur trouvé dans serverCwd`, 'stdout')
      } else {
        errorLog('[Backend Server] ⚠️ Fichier serveur NON trouvé dans serverCwd!')
        errorLog('[Backend Server] ⚠️ expectedServerPath:', expectedServerPath)
        errorLog('[Backend Server] ⚠️ serverPath réel:', serverPath)
        sendLog(`⚠️ Fichier serveur NON trouvé dans serverCwd!`, 'stderr')
      }
      
      // Lister les fichiers du répertoire AVANT création
      try {
        const filesBefore = fs.readdirSync(serverCwd)
        errorLog('[Backend Server] 📂 Fichiers dans le répertoire AVANT:', filesBefore.join(', '))
        sendLog(`📂 Fichiers AVANT: ${filesBefore.join(', ')}`, 'stdout')
      } catch (err) {
        errorLog('[Backend Server] ⚠️ Erreur lecture répertoire:', err.message)
        sendLog(`⚠️ Erreur lecture répertoire: ${err.message}`, 'stderr')
      }
      
      // Vérifier si le répertoire est accessible en écriture
      try {
        fs.accessSync(serverCwd, fs.constants.W_OK)
        errorLog('[Backend Server] ✅ Répertoire accessible en écriture')
        sendLog('✅ Répertoire accessible en écriture', 'stdout')
      } catch (err) {
        errorLog('[Backend Server] ❌ Répertoire NON accessible en écriture:', err.message)
        errorLog('[Backend Server] ❌ Code erreur:', err.code)
        sendLog(`❌ Répertoire NON accessible en écriture: ${err.message} (code: ${err.code})`, 'stderr')
        errorLog('[Backend Server] ⚠️ Utilisation de AppData comme fallback')
        sendLog('⚠️ Utilisation de AppData comme fallback', 'stderr')
      }
      
      // Lire le package.json existant s'il existe
      let existingPackageJson = {}
      if (fs.existsSync(packageJsonPath)) {
        try {
          existingPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
          errorLog('[Backend Server] 📋 package.json existant trouvé:', JSON.stringify(existingPackageJson, null, 2))
          sendLog(`📋 package.json existant: ${JSON.stringify(existingPackageJson, null, 2)}`, 'stdout')
        } catch (err) {
          errorLog('[Backend Server] ⚠️ Erreur lecture package.json existant:', err.message)
          sendLog(`⚠️ Erreur lecture package.json: ${err.message}`, 'stderr')
        }
      }
      
      // Fusionner avec la config existante et FORCER "type": "module"
      const packageJson = {
        ...existingPackageJson,
        "type": "module",  // FORCER "type": "module" (écrase toute valeur existante)
        "name": existingPackageJson.name || "actoris-launcher-server",
        "version": existingPackageJson.version || "1.0.0",
        "description": existingPackageJson.description || "Actoris Launcher Backend Server"
      }
      
      errorLog('[Backend Server] 📄 Tentative création package.json à:', packageJsonPath)
      sendLog(`📄 Tentative création package.json à: ${packageJsonPath}`, 'stdout')
      
      // Écrire de manière SYNCHRONE AVANT le fork
      let packageJsonCreated = false
      try {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8')
        errorLog('[Backend Server] ✅ package.json écrit (writeFileSync réussi)')
        sendLog('✅ package.json écrit (writeFileSync réussi)', 'stdout')
        packageJsonCreated = true
      } catch (err) {
        errorLog('[Backend Server] ❌ Erreur lors de l\'écriture de package.json:', err.message)
        errorLog('[Backend Server] ❌ Code erreur:', err.code)
        errorLog('[Backend Server] ❌ Stack:', err.stack)
        sendLog(`❌ Erreur écriture package.json: ${err.message} (code: ${err.code})`, 'stderr')
        
        // Si l'écriture échoue (permissions), essayer dans AppData
        if (err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'ENOENT') {
          errorLog('[Backend Server] ⚠️ Tentative de création dans AppData...')
          sendLog('⚠️ Tentative de création dans AppData...', 'stderr')
          
          const userDataPath = app.getPath('userData')
          const appDataPackageJsonPath = path.join(userDataPath, 'package.json')
          
          try {
            fs.writeFileSync(appDataPackageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8')
            errorLog('[Backend Server] ✅ package.json créé dans AppData:', appDataPackageJsonPath)
            sendLog(`✅ package.json créé dans AppData: ${appDataPackageJsonPath}`, 'stdout')
            // Note: Ce package.json dans AppData ne sera pas utilisé par Node.js car il n'est pas dans serverCwd
            // Mais on le crée quand même pour le diagnostic
          } catch (appDataErr) {
            errorLog('[Backend Server] ❌ Erreur création dans AppData aussi:', appDataErr.message)
            sendLog(`❌ Erreur création dans AppData: ${appDataErr.message}`, 'stderr')
          }
        }
      }
      
      // Vérifier que le fichier a bien été créé
      if (packageJsonCreated) {
        // Attendre un peu pour que le système de fichiers soit à jour (Windows)
        const waitStart = Date.now()
        while (Date.now() - waitStart < 500) {
          // Attente active de 500ms
        }
        
        if (fs.existsSync(packageJsonPath)) {
          const content = fs.readFileSync(packageJsonPath, 'utf-8')
          errorLog('[Backend Server] ✅ package.json existe et contenu:', content)
          sendLog(`✅ package.json existe et contenu: ${content}`, 'stdout')
          
          // Lister les fichiers APRÈS création
          try {
            const filesAfter = fs.readdirSync(serverCwd)
            errorLog('[Backend Server] 📂 Fichiers dans le répertoire APRÈS:', filesAfter.join(', '))
            sendLog(`📂 Fichiers APRÈS: ${filesAfter.join(', ')}`, 'stdout')
          } catch (err) {
            errorLog('[Backend Server] ⚠️ Erreur lecture répertoire après:', err.message)
            sendLog(`⚠️ Erreur lecture répertoire après: ${err.message}`, 'stderr')
          }
          
          // IMPORTANT : Synchroniser sur disque
          try {
            const fd = fs.openSync(packageJsonPath, 'r+')
            fs.fsyncSync(fd)
            fs.closeSync(fd)
            errorLog('[Backend Server] ✅ package.json synchronisé sur disque')
            sendLog('✅ package.json synchronisé sur disque', 'stdout')
          } catch (syncErr) {
            errorLog('[Backend Server] ⚠️ Erreur synchronisation:', syncErr.message)
            sendLog(`⚠️ Erreur synchronisation: ${syncErr.message}`, 'stderr')
          }
        } else {
          errorLog('[Backend Server] ❌ package.json N\'EXISTE PAS après création!')
          sendLog('❌ package.json N\'EXISTE PAS après création!', 'stderr')
        }
      }
    }
    
    // Vérifier que Node.js est disponible
    // En production, utiliser l'exécutable Electron qui inclut Node.js
    // Electron peut exécuter des scripts Node.js directement avec process.execPath
    let nodePath
    let useElectronExec = false
    
    if (isDev) {
      nodePath = 'node'
    } else {
      // En production, on a plusieurs options :
      // 1. Utiliser l'exécutable Electron directement (process.execPath) avec --eval
      // 2. Chercher node.exe dans le système
      // 3. Utiliser 'node' du PATH
      
      // Option 1 : Utiliser Electron lui-même (recommandé car garanti de fonctionner)
      // Electron peut exécuter des scripts Node.js avec process.execPath
      const electronPath = process.execPath
      
      // Option 2 : Chercher node.exe dans les ressources
      const resourcesPath = process.resourcesPath || app.getAppPath()
      const installDir = path.dirname(electronPath)
      
      const possibleNodePaths = [
        path.join(resourcesPath, 'node.exe'),
        path.join(resourcesPath, 'app', 'node.exe'),
        path.join(installDir, 'node.exe'),
        'node' // Fallback : utiliser node du PATH
      ]
      
      const foundNodePath = possibleNodePaths.find(p => {
        if (p === 'node') return true // Toujours accepter 'node' comme fallback
        return fs.existsSync(p)
      })
      
      if (foundNodePath && foundNodePath !== 'node') {
        nodePath = foundNodePath
      } else {
        nodePath = electronPath
        useElectronExec = true
      }
    }
    
    // En production, trouver le chemin vers les node_modules
    // Les node_modules sont copiés via extraFiles dans le même répertoire que launcher-server.mjs
    let nodeModulesPath = null
    if (!isDev) {
      // Définir resourcesPath et unpackedPath
      const resourcesPath = process.resourcesPath || app.getAppPath()
      const unpackedPath = app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked')
      const installDir = path.dirname(process.execPath)
      
      // PRIORITÉ 1: node_modules à côté de launcher-server.mjs (via extraFiles)
      // PRIORITÉ 2: node_modules dans app.asar.unpacked (via asarUnpack)
      
      const possibleNodeModulesPaths = [
        path.join(installDir, 'node_modules'),     // Dossier d'installation (extraFiles) - PRIORITÉ 1
        path.join(serverCwd, 'node_modules'),      // Même dossier que launcher-server.mjs
        path.join(unpackedPath, 'node_modules'),   // app.asar.unpacked/node_modules (asarUnpack) - PRIORITÉ 2
        path.join(resourcesPath, 'app.asar.unpacked', 'node_modules'), // resources/app.asar.unpacked/node_modules
        path.join(path.dirname(serverCwd), 'node_modules'), // Un niveau au-dessus
      ]
      
      nodeModulesPath = possibleNodeModulesPaths.find(p => fs.existsSync(p))
      
      errorLog('[Backend Server] 📦 Recherche node_modules...')
      sendLog('📦 Recherche node_modules...', 'stdout')
      possibleNodeModulesPaths.forEach(p => {
        const exists = fs.existsSync(p)
        errorLog(`[Backend Server] 📦 ${p}: ${exists ? '✅ trouvé' : '❌ non trouvé'}`)
        sendLog(`📦 ${p}: ${exists ? '✅ trouvé' : '❌ non trouvé'}`, exists ? 'stdout' : 'stderr')
      })
      
      if (nodeModulesPath) {
        errorLog('[Backend Server] ✅ node_modules trouvé:', nodeModulesPath)
        sendLog(`✅ node_modules trouvé: ${nodeModulesPath}`, 'stdout')
        
        // Vérifier que les modules nécessaires existent
        const requiredModules = ['express', 'ws', 'cors', 'dotenv', 'axios']
        requiredModules.forEach(module => {
          const modulePath = path.join(nodeModulesPath, module)
          const exists = fs.existsSync(modulePath)
          errorLog(`[Backend Server] 📦 ${module}: ${exists ? '✅' : '❌'}`)
          sendLog(`📦 ${module}: ${exists ? '✅' : '❌'}`, exists ? 'stdout' : 'stderr')
        })
      } else {
        errorLog('[Backend Server] ❌ node_modules non trouvé!')
        sendLog('❌ node_modules non trouvé!', 'stderr')
      }
    } else {
      nodeModulesPath = path.join(__dirname, '..', 'node_modules')
    }
    
    // Construire NODE_PATH avec le serveur et les node_modules
    const nodePathArray = [serverCwd]
    if (nodeModulesPath && fs.existsSync(nodeModulesPath)) {
      nodePathArray.push(nodeModulesPath)
    }
    if (isDev) {
      nodePathArray.push(path.join(__dirname, '..', 'node_modules'))
    }
    
    // Démarrer le serveur en arrière-plan
    const spawnArgs = [serverPath]
    
    // Chemin du .env pour le serveur backend
    // Le backend chargera lui-même le .env, on ne passe que le chemin
    const envFilePath = path.join(app.getPath('userData'), '.env')
    
    // Construire envVars SANS les secrets Discord (sécurité)
    // Le backend chargera lui-même le .env avec dotenv
    const envVars = {
      ...process.env, // Garder les variables système (USERPROFILE, etc.)
      // NE PAS inclure les secrets Discord - le backend les chargera depuis .env
      PORT: '3001', // Port par défaut
      NODE_ENV: process.env.NODE_ENV || 'production',
      // Passer le chemin du .env au serveur backend pour qu'il le charge
      ENV_FILE_PATH: envFilePath,
      // Ajouter le chemin du serveur et les node_modules dans NODE_PATH pour les imports
      NODE_PATH: nodePathArray.join(path.delimiter),
    }
    
    errorLog('[Backend Server] ⚠️  Les secrets Discord ne sont PAS passés au backend via envVars')
    errorLog('[Backend Server] ✅ Le backend chargera lui-même le .env depuis:', envFilePath)
    sendLog(`✅ Le backend chargera le .env depuis: ${envFilePath}`, 'stdout')
    
    const spawnOptions = {
      cwd: serverCwd,  // Utiliser le bon répertoire pour trouver le .env et les imports
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false, // Ne pas utiliser shell
      env: envVars
    }
    
    try {
      errorLog('[Backend Server] 🚀 Lancement du processus...')
      sendLog('🚀 Lancement du processus backend...', 'stdout')
      errorLog('[Backend Server] 📁 nodePath:', nodePath)
      sendLog(`📁 nodePath: ${nodePath}`, 'stdout')
      errorLog('[Backend Server] 📁 serverPath:', serverPath)
      sendLog(`📁 serverPath: ${serverPath}`, 'stdout')
      errorLog('[Backend Server] 📁 serverCwd:', serverCwd)
      sendLog(`📁 serverCwd: ${serverCwd}`, 'stdout')
      errorLog('[Backend Server] 📁 isDev:', isDev)
      sendLog(`📁 isDev: ${isDev}`, 'stdout')
      
      if (isDev) {
        errorLog('[Backend Server] 🔧 Mode DEV: utilisation de spawn')
        backendServerProcess = spawn(nodePath, spawnArgs, spawnOptions)
      } else {
        errorLog('[Backend Server] 📦 Mode PROD: utilisation de fork')
        sendLog('📦 Mode PROD: utilisation de fork', 'stdout')
        
        // IMPORTANT: Le package.json a déjà été créé AVANT cette section
        // Vérifier qu'il existe avant de faire le fork
        const packageJsonPath = path.join(serverCwd, 'package.json')
        if (!fs.existsSync(packageJsonPath)) {
          errorLog('[Backend Server] ❌ package.json n\'existe pas avant fork()!')
          sendLog('❌ package.json n\'existe pas avant fork()!', 'stderr')
        } else {
          errorLog('[Backend Server] ✅ package.json existe avant fork():', packageJsonPath)
          sendLog(`✅ package.json existe avant fork(): ${packageJsonPath}`, 'stdout')
          
          // Vérifier le contenu
          try {
            const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
            if (content.type === 'module') {
              errorLog('[Backend Server] ✅ package.json a "type": "module"')
              sendLog('✅ package.json a "type": "module"', 'stdout')
            } else {
              errorLog('[Backend Server] ⚠️ package.json n\'a pas "type": "module"!')
              sendLog('⚠️ package.json n\'a pas "type": "module"!', 'stderr')
            }
          } catch (err) {
            errorLog('[Backend Server] ⚠️ Erreur lecture package.json:', err.message)
            sendLog(`⚠️ Erreur lecture package.json: ${err.message}`, 'stderr')
          }
        }
        
        // Utiliser fork() avec le cwd où se trouve le package.json
        errorLog('[Backend Server] 🚀 fork() avec cwd:', serverCwd)
        sendLog(`🚀 fork() avec cwd: ${serverCwd}`, 'stdout')
        
        // S'assurer que les variables système sont passées au fork
        // NE PAS inclure les secrets Discord - le backend les chargera depuis .env
        const forkEnv = {
          ...envVars,
          // Les secrets Discord seront chargés par le backend depuis .env
          // Ne pas les passer ici pour des raisons de sécurité
        }
        
        errorLog('[Backend Server] 🔍 Variables passées au fork():')
        errorLog('  ENV_FILE_PATH:', forkEnv.ENV_FILE_PATH || '❌')
        errorLog('  PORT:', forkEnv.PORT || '❌')
        errorLog('  NODE_ENV:', forkEnv.NODE_ENV || '❌')
        errorLog('  ⚠️  Les secrets Discord ne sont PAS passés - le backend les chargera depuis .env')
        
        backendServerProcess = fork(serverPath, [], {
          cwd: serverCwd, // Utiliser le répertoire où se trouve le package.json
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          env: forkEnv,
          silent: false
        })
        
        errorLog('[Backend Server] ✅ Processus fork créé, PID:', backendServerProcess.pid)
        
        backendServerProcess.on('message', (message) => {
          errorLog('[Backend Server] 📨 Message reçu du backend:', JSON.stringify(message))
          sendLog(`📨 Message reçu: ${JSON.stringify(message)}`, 'stdout')
          if (message && message.type === 'backend-ready') {
            backendReadyReceived = true
            serverReady = true
            errorLog('[Backend Server] ✅ Signal backend-ready reçu!')
            sendLog('✅ Signal backend-ready reçu!', 'stdout')
          }
        })
      }
      
      errorLog('[Backend Server] ✅ Processus créé avec succès, PID:', backendServerProcess?.pid)
      console.error('[Backend Server] ✅ Processus créé avec succès, PID:', backendServerProcess?.pid)
      sendLog(`✅ Processus créé avec succès, PID: ${backendServerProcess?.pid}`, 'stdout')
      
      // Vérification immédiate que le processus n'est pas déjà mort
      if (!backendServerProcess || backendServerProcess.killed) {
        const errorMsg = '[Backend Server] ❌ Le processus est déjà mort immédiatement après création!'
        errorLog(errorMsg)
        console.error(errorMsg)
        sendLog(errorMsg, 'stderr')
        return { success: false, error: 'Process died immediately after creation' }
      }
      
      errorLog('[Backend Server] ✅ Processus vérifié, pas encore mort')
      console.error('[Backend Server] ✅ Processus vérifié, pas encore mort')
    } catch (spawnError) {
      const errorMsg = `[Backend Server] ❌ Erreur lors du lancement: ${spawnError.message || spawnError}`
      errorLog(errorMsg)
      sendLog(errorMsg, 'stderr')
      errorLog('[Backend Server] ❌ nodePath:', nodePath)
      errorLog('[Backend Server] ❌ spawnArgs:', spawnArgs)
      errorLog('[Backend Server] ❌ serverPath:', serverPath)
      errorLog('[Backend Server] ❌ serverCwd:', serverCwd)
      errorLog('[Backend Server] ❌ Stack:', spawnError.stack)
      return { success: false, error: spawnError }
    }
    
    // Buffer pour stocker les premières lignes de sortie
    let firstOutput = []
    let serverReady = false
    let backendReadyReceived = false
    
    // Logger les sorties du backend
    backendServerProcess.stdout.on('data', (data) => {
      const output = data.toString().trim()
      
      // Logger toutes les sorties importantes du backend
      if (output) {
        errorLog('[Backend Server] 📋 STDOUT:', output)
        sendLog(output, 'stdout') // Envoyer au renderer pour DevTools
      }
      
      // Vérifier si le serveur a démarré
      if (output.includes('Serveur démarré') || output.includes('port 3001') || output.includes('API Discord disponible') || output.includes('Express écoute') || output.includes('listening') || output.includes('écoute')) {
        if (!backendReadyReceived) {
        serverReady = true
          errorLog('[Backend Server] ✅ Serveur démarré détecté dans les logs')
          sendLog('✅ Serveur démarré détecté dans les logs', 'stdout')
        }
      }
      
      firstOutput.push(output)
      if (firstOutput.length > 20) {
        firstOutput.shift()
      }
    })
    
    backendServerProcess.stderr.on('data', (data) => {
      const error = data.toString().trim()
      
      // Logger toutes les erreurs
      if (error) {
        errorLog('[Backend Server] ❌ STDERR:', error)
        console.error('[Backend Server STDERR]', error) // AUSSI dans la console principale
        sendLog(error, 'stderr') // Envoyer au renderer pour DevTools
        firstOutput.push(`[ERROR] ${error}`)
      }
      
      // Si c'est une erreur critique, logger mais ne pas arrêter
      if (error.includes('EADDRINUSE')) {
        errorLog('[Backend Server] ❌ Erreur EADDRINUSE détectée dans STDERR')
        sendLog('❌ Port 3001 déjà utilisé - Le backend ne peut pas démarrer', 'stderr')
        // Essayer de tuer le processus et redémarrer
        killProcessOnPort(3001).then(killed => {
          if (killed) {
            errorLog('[Backend Server] ✅ Processus tué, redémarrage dans 2 secondes...')
            sendLog('✅ Processus tué, redémarrage dans 2 secondes...', 'stdout')
            setTimeout(async () => {
              await startBackendServer()
            }, 2000)
          } else {
            errorLog('[Backend Server] ❌ Impossible de libérer le port 3001')
            sendLog('❌ Impossible de libérer le port. Veuillez fermer l\'application qui utilise le port 3001.', 'stderr')
          }
        })
      } else if (error.includes('Cannot find module') || error.includes('SyntaxError') || error.includes('Error:') || error.includes('ENOENT')) {
        errorLog('[Backend Server] ❌ Erreur critique détectée:', error)
        console.error('[Backend Server] Erreur critique:', error) // AUSSI dans la console principale
        sendLog(`❌ Erreur critique: ${error}`, 'stderr')
      }
    })
    
    // Logger quand le processus se termine
    backendServerProcess.on('exit', (code, signal) => {
      errorLog('[Backend Server] ⚠️ Processus terminé - Code:', code, 'Signal:', signal)
      sendLog(`⚠️ Processus terminé - Code: ${code}, Signal: ${signal}`, code !== 0 && code !== null ? 'stderr' : 'stdout')
      if (code !== 0 && code !== null) {
        errorLog('[Backend Server] ❌ Le serveur backend s\'est arrêté avec le code:', code)
        sendLog(`❌ Le serveur backend s'est arrêté avec le code: ${code}`, 'stderr')
        errorLog('[Backend Server] 📋 Premières lignes de sortie:', firstOutput.slice(0, 10).join('\n'))
        sendLog(`📋 Premières lignes de sortie: ${firstOutput.slice(0, 10).join('\n')}`, 'stderr')
      }
      backendServerProcess = null
    })
    
    // Logger les erreurs du processus
    backendServerProcess.on('error', (err) => {
      errorLog('[Backend Server] ❌ Erreur du processus:', err.message)
      sendLog(`❌ Erreur du processus: ${err.message}`, 'stderr')
      errorLog('[Backend Server] ❌ Stack:', err.stack)
      sendLog(`❌ Stack: ${err.stack}`, 'stderr')
    })
    
    backendServerProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        const errorMsg = `[Backend Server] ❌ Le serveur s'est arrêté avec une erreur (code: ${code})`
        errorLog(errorMsg)
        console.error(errorMsg)
        errorLog('[Backend Server] 📋 Premières lignes de sortie:')
        firstOutput.forEach(line => {
          errorLog('  ' + line)
        })
      }
      backendServerProcess = null
    })
    
    backendServerProcess.on('error', (err) => {
      const errorMsg = `[Backend Server] ❌ Erreur lors du lancement: ${err.message || err}`
      errorLog(errorMsg)
      console.error(errorMsg)
      backendServerProcess = null
    })
    
            // Réduire le temps d'attente initial pour accélérer le démarrage
            const waitTime = (!isDev && backendServerProcess && backendServerProcess.send) ? 100 : 500
            await new Promise(resolve => setTimeout(resolve, waitTime))
    
    // Vérifier si le serveur est toujours en cours d'exécution
    if (!backendServerProcess || backendServerProcess.killed) {
      const errorMsg = '[Backend Server] ❌ Le serveur s\'est arrêté immédiatement après le démarrage'
      errorLog(errorMsg)
      console.error(errorMsg)
      sendLog('❌ Le serveur s\'est arrêté immédiatement après le démarrage', 'stderr')
      const outputLines = firstOutput.slice(0, 10).join('\n')
      errorLog('[Backend Server] 📋 Premières lignes de sortie:', outputLines)
      console.error('[Backend Server] 📋 Premières lignes de sortie:', outputLines)
      sendLog(`📋 Premières lignes de sortie: ${outputLines}`, 'stderr')
      return { success: false, error: 'Server process died immediately', output: outputLines }
    }
    
    errorLog('[Backend Server] ✅ Processus backend actif, PID:', backendServerProcess.pid)
    sendLog(`✅ Processus backend actif, PID: ${backendServerProcess.pid}`, 'stdout')
    
    // Vérifier rapidement si le serveur répond
    if (backendReadyReceived) {
      childProcesses.add(backendServerProcess)
      return { success: true }
    }
    
    // Attendre le signal IPC (max 1.5 secondes - optimisé)
    if (!isDev && backendServerProcess && backendServerProcess.send) {
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 300))
        if (backendReadyReceived) {
          childProcesses.add(backendServerProcess)
          return { success: true }
        }
        if (backendServerProcess.killed || !backendServerProcess.pid) {
          errorLog('[Backend Server] ❌ Le processus backend s\'est arrêté')
          return { success: false, error: 'Backend process died' }
        }
      }
    }
    
    // Vérification rapide via health check (max 2 tentatives, 300ms entre chaque)
    const checkBackendHealth = async () => {
        const http = await import('http')
      return new Promise((resolve) => {
        const options = {
          hostname: '127.0.0.1',
            port: 3001,
            path: '/health',
            method: 'GET',
          timeout: 500
        }
        
        const req = http.request(options, (res) => {
          resolve(res.statusCode === 200)
        })
        
        req.on('error', () => resolve(false))
        req.on('timeout', () => {
          req.destroy()
          resolve(false)
        })
        
        req.end()
      })
    }
    
    let serverResponding = false
    for (let i = 0; i < 2; i++) {
      serverResponding = await checkBackendHealth()
      if (serverResponding) break
      if (i < 1) await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    if (serverResponding) {
      childProcesses.add(backendServerProcess)
      return { success: true }
    } else {
      // Continuer quand même, le serveur peut démarrer plus tard
      if (backendServerProcess) {
        childProcesses.add(backendServerProcess)
      }
      return { success: true } // Retourner success pour ne pas bloquer le démarrage
    }
  } catch (err) {
    errorLog('[Backend Server] ❌ Erreur lors du démarrage:', err)
    return { success: false, error: err }
  }
}

app.on('window-all-closed', async () => {
  // Déconnecter Discord RPC avant de quitter
      try {
    const rpcService = await getDiscordRPCService()
    await rpcService.disconnectDiscordRPC()
        } catch (err) {
    // Ignorer les erreurs de déconnexion
  }
  
  // Tuer le processus backend spécifiquement
  if (backendServerProcess && !backendServerProcess.killed) {
    try {
      log('[Backend Server] 🛑 Arrêt du processus backend...')
      backendServerProcess.kill('SIGTERM')
      setTimeout(() => {
        if (backendServerProcess && !backendServerProcess.killed) {
          backendServerProcess.kill('SIGKILL')
      }
      }, 500)
  } catch (err) {
      // Ignorer
  }
  }
  
  // Tuer tous les processus enfants avant de quitter
  for (const childProcess of childProcesses) {
    try {
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM')
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL')
          }
        }, 500)
      }
    } catch (err) {
      // Ignorer
    }
  }
  
  // Tuer tous les processus Actoris restants
  try {
    if (process.platform === 'win32') {
      exec('taskkill /F /IM Actoris.exe /T', (error) => {
        // Ignorer les erreurs
      })
    }
  } catch (err) {
    // Ignorer
  }
  
  if (process.platform !== 'darwin') {
    app.exit(0) // Utiliser exit au lieu de quit pour forcer la fermeture
  }
})

// Fermeture complète : tuer tous les processus enfants
app.on('before-quit', async (event) => {
  // Ne pas prévenir la fermeture
  event.preventDefault()
  
  // Fermer le serveur HTTP de confirmation
  if (confirmationServer) {
    try {
      confirmationServer.close(() => {
        // Ignorer les logs en production
      })
    } catch (err) {
      // Ignorer
    }
  }
  
  // Fermer le serveur WebSocket
  if (webSocketServer) {
    try {
      webSocketServer.close(() => {
        // Ignorer les logs
      })
    } catch (err) {
      // Ignorer
    }
  }
  
  // Tuer le processus backend spécifiquement
  if (backendServerProcess && !backendServerProcess.killed) {
    try {
      errorLog('[Backend Server] 🛑 Arrêt du processus backend...')
      backendServerProcess.kill('SIGTERM')
      // Attendre un peu puis forcer si nécessaire
      setTimeout(() => {
        if (backendServerProcess && !backendServerProcess.killed) {
          backendServerProcess.kill('SIGKILL')
        }
      }, 500)
    } catch (err) {
      errorLog('[Backend Server] ⚠️ Erreur lors de l\'arrêt:', err)
    }
  }
  
  // Tuer tous les processus enfants immédiatement
  for (const childProcess of childProcesses) {
    try {
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGKILL') // Forcer immédiatement
      }
    } catch (err) {
      // Ignorer
    }
  }
  
  // Tuer tous les processus Actoris restants
  try {
    if (process.platform === 'win32') {
      exec('taskkill /F /IM Actoris.exe /T', (error) => {
        // Ignorer
      })
    }
  } catch (err) {
    // Ignorer
  }
  
  childProcesses.clear()
  
  // Nettoyer le listener will-download pour éviter les fuites
  if (willDownloadListener) {
    try {
      session.defaultSession.removeListener('will-download', willDownloadListener)
    } catch (e) {
      // Ignorer les erreurs de nettoyage
    }
    willDownloadListener = null
  }
  
  // Forcer la fermeture
  app.exit(0)
})

/* ---------------- export (optional) ---------------- */