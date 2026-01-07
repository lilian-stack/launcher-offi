/**
 * Gestionnaire de mise à jour automatique
 */
import { BrowserWindow } from 'electron'
import { log, errorLog } from './logger.js'
import { isDev } from './config.js'

let autoUpdater = null
let mainWindow = null

export function setMainWindow(window) {
  mainWindow = window
}

/**
 * Initialiser l'auto-updater
 */
export async function initializeAutoUpdater() {
  if (isDev) return // Ne pas charger en développement
  
  try {
    const { autoUpdater: updater } = await import('electron-updater')
    autoUpdater = updater
    
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    
    // Vérification asynchrone après le premier affichage
    setTimeout(async () => {
      try {
        log('[Updater] Vérification des mises à jour en arrière-plan...')
        await autoUpdater.checkForUpdatesAndNotify()
      } catch (err) {
        errorLog('[Updater] Erreur lors de la vérification asynchrone:', err)
      }
    }, 5000)
    
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
      log('[Updater] Mise à jour prête, en attente de l\'action de l\'utilisateur')
    })
    
    setTimeout(() => {
      if (autoUpdater) {
        autoUpdater.checkForUpdates().catch(err => {
          errorLog('[Updater] Erreur lors de la vérification:', err)
        })
      }
    }, 5000)
  } catch (err) {
    errorLog('[Updater] Impossible de charger electron-updater:', err)
  }
}

export function getAutoUpdater() {
  return autoUpdater
}
