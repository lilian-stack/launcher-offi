/**
 * Handlers IPC pour les mises à jour
 */
import electron from 'electron';
const { ipcMain, app, BrowserWindow } = electron
import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { downloadWithRedirect } from '../utils/download-helpers.mjs'
import { log, errorLog } from '../utils/logger.mjs'

let dependencies = {}
let autoUpdater = null

export function injectDependencies(deps) {
  dependencies = { ...dependencies, ...deps }
  autoUpdater = deps.autoUpdater
}

async function killAllActorisProcesses() {
  const { exec } = await import('node:child_process')
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('taskkill /F /IM Actoris.exe /T', (error) => {
        // Ignorer les erreurs
        resolve()
      })
    } else {
      resolve()
    }
  })
}

export function registerUpdatesHandlers() {
  ipcMain.handle('updates:download', async (event, url, filename) => {
    try {
      log('[Update] 📥 Handler updates:download appelé')
      log('[Update] URL:', url)
      log('[Update] Filename:', filename)
      
      const downloadsDir = app.getPath('downloads')
      const filePath = path.join(downloadsDir, filename || 'update.bin')
      
      log('[Update] 📁 Dossier de téléchargement:', downloadsDir)
      log('[Update] 📄 Chemin complet:', filePath)
      
      const { mainWindow } = dependencies
      
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
      
      if (!fs.existsSync(filePath)) {
        throw new Error('Le fichier téléchargé n\'existe pas')
      }
      
      const fileStats = fs.statSync(filePath)
      log('[Update] 📦 Taille du fichier:', fileStats.size, 'bytes')
      
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

  ipcMain.handle('updates:installInBackground', async (event, installerPath) => {
    try {
      log('[Updater] Installation en arrière-plan demandée...')
      log('[Updater] Chemin de l\'installateur:', installerPath)
      
      if (!installerPath || !fs.existsSync(installerPath)) {
        throw new Error('Chemin de l\'installateur invalide ou fichier introuvable')
      }
      
      if (!installerPath.toLowerCase().endsWith('.exe')) {
        throw new Error('Le fichier installateur doit être un fichier .exe')
      }
      
      const normalizedPath = path.normalize(installerPath)
      const quotedPath = normalizedPath.includes(' ') ? `"${normalizedPath}"` : normalizedPath
      const installCommand = `${quotedPath} /S`
      
      log('[Updater] Commande d\'installation:', installCommand)
      
      const installProcess = spawn(installCommand, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: true
      })
      
      installProcess.unref()
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (installProcess.killed) {
        throw new Error('L\'installation n\'a pas pu démarrer')
      }
      
      log('[Updater] Installation démarrée en arrière-plan (PID:', installProcess.pid, ')')
      
      const { mainWindow } = dependencies
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update:install-complete', { success: true })
        }
      }, 5000)
      
      return { success: true }
    } catch (error) {
      errorLog('[Updater] Erreur lors de l\'installation en arrière-plan:', error)
      const errorMessage = error.message || 'Erreur lors de l\'installation'
      const cleanErrorMessage = errorMessage.replace(/spawn\s+UNKNOWN/gi, 'Erreur lors du lancement de l\'installateur')
      
      const { mainWindow } = dependencies
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:install-complete', { 
          success: false, 
          error: cleanErrorMessage
        })
      }
      return { success: false, error: cleanErrorMessage }
    }
  })

  ipcMain.handle('updates:install', async (event) => {
    try {
      if (!autoUpdater) {
        throw new Error('Auto-updater non initialisé')
      }
      
      log('[Updater] Installation de la mise à jour demandée...')
      
      try {
        log('[Updater] Fermeture de tous les processus Actoris...')
        await killAllActorisProcesses()
        log('[Updater] Tous les processus Actoris fermés')
      } catch (err) {
        errorLog('[Updater] Erreur lors de la fermeture des processus:', err)
      }
      
      const allWindows = BrowserWindow.getAllWindows()
      for (const win of allWindows) {
        if (win && !win.isDestroyed()) {
          win.close()
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      log('[Updater] Lancement de l\'installation en mode silencieux...')
      
      try {
        if (process.platform === 'win32') {
          const { exec } = await import('node:child_process')
          exec('taskkill /F /IM Actoris.exe /T', (error) => {
            // Ignorer les erreurs
          })
        }
      } catch (err) {
        // Ignorer
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      autoUpdater.quitAndInstall(true, true)
      
      return { success: true }
    } catch (error) {
      errorLog('[Updater] Erreur lors de l\'installation:', error)
      return { success: false, error: error.message || 'Erreur lors de l\'installation' }
    }
  })
}
