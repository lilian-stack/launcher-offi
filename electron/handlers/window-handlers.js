/**
 * Handlers IPC pour la gestion des fenêtres et de l'application
 */

import { BrowserWindow, app } from 'electron'

let mainWindow = null

/**
 * Initialise les handlers de fenêtre
 * @param {BrowserWindow} window - La fenêtre principale
 */
export function registerWindowHandlers(window) {
  mainWindow = window

  // Les handlers seront enregistrés via ipcMain dans main.js
  // Cette fonction permet juste de passer la référence de la fenêtre
}

/**
 * Récupère la fenêtre principale
 */
function getMainWindow() {
  return mainWindow || BrowserWindow.getFocusedWindow()
}

/**
 * Handlers IPC pour les fenêtres
 * À appeler depuis main.js avec ipcMain.handle()
 */
export const windowHandlers = {
  'window:minimize': async () => {
    try {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.minimize()
        return { success: true }
      }
      return { success: false, error: 'Window not available' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  'window:maximize': async () => {
    try {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.maximize()
        return { success: true }
      }
      return { success: false, error: 'Window not available' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  'window:unmaximize': async () => {
    try {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.unmaximize()
        return { success: true }
      }
      return { success: false, error: 'Window not available' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  'window:close': async () => {
    try {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.close()
        return { success: true }
      }
      return { success: false, error: 'Window not available' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  'window:isMaximized': async () => {
    try {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        return win.isMaximized()
      }
      return false
    } catch (err) {
      return false
    }
  }
}

/**
 * Handlers IPC pour l'application
 */
export const appHandlers = {
  'app:quit': async () => {
    try {
      // Fermer toutes les fenêtres
      const allWindows = BrowserWindow.getAllWindows()
      for (const win of allWindows) {
        if (win && !win.isDestroyed()) {
          win.destroy()
        }
      }
      
      // Tuer tous les processus enfants
      // TODO: Importer childProcesses depuis un module de gestion d'état
      
      app.exit(0)
      return { success: true }
    } catch (err) {
      app.exit(0)
      return { success: false, error: err.message }
    }
  },

  'app:getVersion': async () => {
    try {
      return { success: true, version: app.getVersion() }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  'app:restart': async () => {
    try {
      app.relaunch()
      app.exit(0)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  'app:getAutoLaunch': async () => {
    try {
      const settings = app.getLoginItemSettings()
      return { success: true, enabled: settings?.openAtLogin || false }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  'app:setAutoLaunch': async (_event, enabled) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: false
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
}
