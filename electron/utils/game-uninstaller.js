/**
 * Gestionnaire de désinstallation de jeux
 */
import fs from 'node:fs'
import { promises as fsPromises } from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { log, errorLog } from './logger.js'

const execPromise = promisify(exec)

/**
 * Suppression forcée avec commande système
 */
export async function forceDeleteFolder(folderPath) {
  log('[Uninstall] 🔨 Suppression forcée avec rmdir...')

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

/**
 * Compter le nombre total de fichiers dans un dossier (récursif)
 */
export function countFilesRecursive(dir) {
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
export async function deleteDirectoryWithProgress(dir, event, totalFiles) {
  async function deleteRecursive(currentPath) {
    try {
      const items = await fsPromises.readdir(currentPath)
      
      const filePromises = []
      const dirPromises = []
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item)
        
        try {
          const stat = await fsPromises.stat(fullPath)
          
          if (stat.isDirectory()) {
            dirPromises.push(fullPath)
          } else {
            filePromises.push(
              fsPromises.unlink(fullPath).catch(err => {
                console.warn('[Uninstall] ⚠️ Erreur suppression fichier:', fullPath, err.message)
              })
            )
          }
        } catch (itemError) {
          // Ignorer les erreurs
        }
      }
      
      await Promise.all(filePromises)
      
      for (const dirPath of dirPromises) {
        try {
          await deleteRecursive(dirPath)
          try {
            await fsPromises.rmdir(dirPath)
          } catch (rmdirError) {
            try {
              await fsPromises.rm(dirPath, { recursive: true, force: true })
            } catch (rmError) {
              if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true })
              }
            }
          }
        } catch (dirError) {
          console.warn('[Uninstall] ⚠️ Erreur suppression dossier:', dirPath, dirError.message)
          if (fs.existsSync(dirPath)) {
            try {
              fs.rmSync(dirPath, { recursive: true, force: true })
            } catch (rmSyncError) {
              // Ignorer
            }
          }
        }
      }
    } catch (error) {
      console.warn('[Uninstall] ⚠️ Erreur lors de la suppression récursive:', error.message)
    }
  }

  try {
    await deleteRecursive(dir)
    
    // Supprimer le dossier racine
    try {
      await fsPromises.rmdir(dir)
    } catch (rmdirError) {
      try {
        await fsPromises.rm(dir, { recursive: true, force: true })
      } catch (rmError) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true })
        }
      }
    }
    
    log('[Uninstall] ✅ Suppression terminée')
  } catch (error) {
    errorLog('[Uninstall] ❌ Erreur lors de la suppression:', error)
    throw error
  }
}
