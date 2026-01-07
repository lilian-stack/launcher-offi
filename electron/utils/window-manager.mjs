/**
 * Gestionnaire de fenêtres
 */
import electron from 'electron';
const { BrowserWindow, shell, app } = electron
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { log, errorLog } from './logger.mjs'
import { isDev, VITE_DEV_SERVER_URL } from './config.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Créer la fenêtre principale
 */
export async function createMainWindow() {
  let mainWindow = null
  
  // Détruire l'ancienne fenêtre si elle existe
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }
  
  mainWindow = new BrowserWindow({
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
  
  if (isDev) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(VITE_DEV_SERVER_URL).catch(err => {
        errorLog('❌ [window-manager] Error loading dev server:', err)
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
              errorLog('❌ [window-manager] Impossible de charger index.html')
            })
          } else {
            errorLog('❌ [window-manager] index.html introuvable')
          }
        })
      } else {
        const fallbackPath = path.join(__dirname, '../dist/index.html')
        if (fs.existsSync(fallbackPath)) {
          mainWindow.loadFile(fallbackPath).catch(() => {
            errorLog('❌ [window-manager] Impossible de charger index.html')
          })
        } else {
          errorLog('❌ [window-manager] index.html introuvable')
        }
      }
    }
  }

  // Configurer le CSP
  const { session } = await import('electron')
  if (mainWindow.webContents.session) {
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
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    errorLog('❌ [window-manager] Échec du chargement:', errorCode, errorDescription, validatedURL)
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

  log('Main window created')
  return mainWindow
}
