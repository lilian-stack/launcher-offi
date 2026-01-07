/**
 * Gestionnaire de fenêtres Electron
 */

import electron from 'electron';
const { BrowserWindow, app, shell, session } = electron
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { 
  setMainWindow, 
  setHiddenWindow, 
  getMainWindow as getMainWindowState, 
  getHiddenWindow as getHiddenWindowState,
  getActiveDownload, 
  setDownloadDestinationPath 
} from './state.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import lazy pour éviter les dépendances circulaires
let confirmDownloadToRedirect = null
async function getConfirmDownloadToRedirect() {
  if (!confirmDownloadToRedirect) {
    // Cette fonction sera importée depuis main.js ou un module dédié
    // Pour l'instant, on la laisse undefined et elle sera injectée
    return confirmDownloadToRedirect
  }
  return confirmDownloadToRedirect
}

/**
 * Injecte la fonction de confirmation (pour éviter les imports circulaires)
 */
export function injectConfirmDownloadToRedirect(fn) {
  confirmDownloadToRedirect = fn
}

/**
 * Crée la fenêtre principale
 */
export async function createWindow(log, errorLog) {
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER === 'true'
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  
  // Détruire l'ancienne fenêtre si elle existe
  const currentMainWindow = getMainWindowState()
  if (currentMainWindow && !currentMainWindow.isDestroyed()) {
    currentMainWindow.destroy()
  }
  
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b0b11',
    minWidth: 1200,
    minHeight: 720,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: true,
      offscreen: false,
      spellcheck: false,
      enableWebSQL: false,
      v8CacheOptions: 'code',
    },
  })

  setMainWindow(mainWindow)
  mainWindow.setMenuBarVisibility(false)

  // Charger un loader HTML immédiat
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
  
  await mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loaderHTML))
  mainWindow.show()
  
  // Charger le contenu principal
  if (isDev) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(VITE_DEV_SERVER_URL).catch(err => {
        if (errorLog) errorLog('❌ [window-manager] Error loading dev server:', err)
      })
    }
  } else {
    const appPath = app.getAppPath()
    const indexPath = path.join(appPath, 'dist', 'index.html')
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath).catch(err => {
          const fallbackPath = path.join(__dirname, '../dist/index.html')
          if (fs.existsSync(fallbackPath)) {
            mainWindow.loadFile(fallbackPath).catch(() => {
              if (errorLog) errorLog('❌ [window-manager] Impossible de charger index.html')
            })
          } else {
            if (errorLog) errorLog('❌ [window-manager] index.html introuvable')
          }
        })
      } else {
        const fallbackPath = path.join(__dirname, '../dist/index.html')
        if (fs.existsSync(fallbackPath)) {
          mainWindow.loadFile(fallbackPath).catch(() => {
            if (errorLog) errorLog('❌ [window-manager] Impossible de charger index.html')
          })
        } else {
          if (errorLog) errorLog('❌ [window-manager] index.html introuvable')
        }
      }
    }
  }
  
  // Configurer le CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "media-src 'self' https://*.steamstatic.com https://*.steamusercontent.com https://*.akamai.steamstatic.com https://video.akamai.steamstatic.com https://cdn.akamai.steamstatic.com https://steamcdn-a.akamaihd.net https://*.youtube.com https://*.youtube-nocookie.com https://*.vimeo.com; " +
      "img-src 'self' data: blob: https: http:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "connect-src 'self' http://127.0.0.1:* http://localhost:* https: ws: wss:;"
    ]
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': csp
      }
    })
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorLog) errorLog('❌ [window-manager] Échec du chargement:', errorCode, errorDescription, validatedURL)
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
      
      if (currentUrl) {
        const currentParsed = new URL(currentUrl)
        if (parsedUrl.origin !== currentParsed.origin) {
          event.preventDefault()
        }
      }
    } catch (err) {
      // Ignorer les erreurs de parsing d'URL
    }
  })

  return mainWindow
}

/**
 * Crée la fenêtre cachée pour les téléchargements
 */
export function createHiddenWindow(log, errorLog) {
  const currentHiddenWindow = getHiddenWindowState()
  if (currentHiddenWindow && !currentHiddenWindow.isDestroyed()) {
    return currentHiddenWindow
  }

  const hiddenWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      spellcheck: false,
      enableWebSQL: false,
      v8CacheOptions: 'code',
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'Auxclick',
    }
  })
  
  hiddenWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
  hiddenWindow._pendingDownload = null
  setHiddenWindow(hiddenWindow)

  hiddenWindow.webContents.on('did-fail-load', (e, errorCode, errorDesc, validatedURL) => {
    if (log) log('HiddenWindow did-fail-load', errorCode, errorDesc, validatedURL)
  })

  // Attacher un handler webRequest global
  try {
    const filter = { urls: ['<all_urls>'] }
    
    hiddenWindow.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
      try {
        const ctx = hiddenWindow && hiddenWindow._pendingDownload
        if (!ctx || !ctx.active) {
          const url = details.url || ''
          const isDiscord = url.includes('discord.com') || url.includes('discordapp.com')
          const isSteam = url.includes('steam') || url.includes('steampowered.com')
          const isExternalService = isDiscord || isSteam || url.includes('googleapis.com') || url.includes('gstatic.com')
          
          if (!isExternalService && (url.match(/\.(zip|rar|7z|exe|iso|dmg|pkg|bin)(\?|$)/i) || url.includes('download') || url.includes('/file/'))) {
            if (log) log('[Hidden webRequest] Potentially relevant request:', url.substring(0, 100))
          }
          return callback({ cancel: false })
        }

        const u = details.url
        const lower = u.toLowerCase()
        
        if (lower.includes('koyso.to/download/') && !lower.match(/\.(zip|rar|7z|exe|iso|dmg|pkg)(\?|$)/i)) {
          if (log) log('[Hidden webRequest] ⚠️ URL koyso.to ignorée (nécessite un clic sur bouton)')
          return callback({ cancel: false })
        }
        
        const isFile = /\.zip(\?|$)|\.rar(\?|$)|\.7z(\?|$)|\.exe(\?|$)|\.iso(\?|$)|\.dmg(\?|$)|\.pkg(\?|$)/i.test(lower)
        const useful = lower.includes('download') || lower.includes('/file/') || lower.includes('/api/file/') || lower.includes('/files/') || lower.includes('dlproxy') || lower.includes('apophis')
        
        const isKnownDownloadDomain = lower.includes('buzzheavier.com') || 
                                     lower.includes('pixeldrain.com') || 
                                     lower.includes('gofile.io') ||
                                     lower.includes('koyso.to')

        if (isFile || useful || isKnownDownloadDomain) {
          ctx.active = false
          const downloadUrl = details.url
          setDownloadDestinationPath(ctx.destinationPath || null)
          
          if (log) log('[Hidden webRequest] ✅ DETECTED download URL:', downloadUrl)
          
          try {
            session.defaultSession.downloadURL(downloadUrl)
            if (log) log('[Hidden webRequest] downloadURL() called successfully')
            
            // Envoyer la confirmation si nécessaire
            const activeDownload = getActiveDownload()
            if (activeDownload && activeDownload.redirectUrl) {
              if (log) log('[Hidden webRequest] ✅ redirectUrl trouvé, envoi de la confirmation dans 500ms...')
              setTimeout(async () => {
                try {
                  const confirmFn = await getConfirmDownloadToRedirect()
                  if (confirmFn) {
                    await confirmFn(activeDownload.redirectUrl, activeDownload.gameName, activeDownload.gameId)
                    if (log) log('[Hidden webRequest] ✅ Confirmation envoyée avec succès')
                  }
                } catch (err) {
                  if (errorLog) errorLog('[Hidden webRequest] ❌ Erreur lors de la confirmation:', err)
                }
              }, 500)
            }
          } catch (dlErr) {
            if (errorLog) errorLog('[Hidden webRequest] Error calling downloadURL:', dlErr)
          }
          
          try { 
            ctx.resolve({ success: true, downloadUrl }) 
            if (log) log('[Hidden webRequest] Promise resolved')
          } catch (e) {
            if (errorLog) errorLog('[Hidden webRequest] Error resolving promise:', e)
          }
          return callback({ cancel: false })
        }
      } catch (e) {
        if (errorLog) errorLog('hidden webRequest handler error', e)
      }
      callback({ cancel: false })
    })
  } catch (e) {
    if (errorLog) errorLog('Failed to register hidden webRequest handler', e)
  }

  if (log) log('Hidden window created and webRequest handler attached')
  return hiddenWindow
}

/**
 * Récupère la fenêtre principale
 */
export function getMainWindow() {
  return getMainWindowState()
}

/**
 * Récupère la fenêtre cachée
 */
export function getHiddenWindow() {
  return getHiddenWindowState()
}
