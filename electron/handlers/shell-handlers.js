/**
 * Handlers IPC pour les opérations shell
 */
import { ipcMain, shell } from 'electron'
import { log, errorLog } from '../utils/logger.js'

export function registerShellHandlers() {
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

  ipcMain.handle('shell:openPath', async (event, filePath) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      errorLog('[Shell] Erreur lors de l\'ouverture du chemin:', error)
      throw error
    }
  })
}
