/**
 * Gestionnaire de lancement de jeux
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { log, errorLog } from './logger.mjs'

const execPromise = promisify(exec)

/**
 * Lancer un jeu directement
 */
export async function launchGameDirectly(exePath) {
  if (!exePath) {
    throw new Error('Le chemin de l\'exécutable est vide')
  }
  
  if (!fs.existsSync(exePath)) {
    throw new Error('Le fichier exécutable est introuvable: ' + exePath)
  }
  
  const workingDirectory = path.dirname(exePath)
  const exeName = path.basename(exePath)
  
  log('[Games] 📁 Répertoire de travail:', workingDirectory)
  log('[Games] 📄 Exécutable:', exeName)
  
  const absoluteExePath = path.resolve(exePath)
  const absoluteWorkingDir = path.resolve(workingDirectory)
  
  log('[Games] 🔍 Chemin absolu exe:', absoluteExePath)
  log('[Games] 🔍 Chemin absolu working dir:', absoluteWorkingDir)
  
  if (!fs.existsSync(absoluteExePath)) {
    throw new Error('Le fichier exécutable est introuvable: ' + absoluteExePath)
  }
  
  if (!fs.existsSync(absoluteWorkingDir)) {
    throw new Error('Le répertoire de travail est introuvable: ' + absoluteWorkingDir)
  }
  
  return new Promise((resolve, reject) => {
    log('[Games] 🚀 Lancement avec spawn...')
    
    const gameProcess = spawn(absoluteExePath, [], {
      cwd: absoluteWorkingDir,
      detached: true,
      stdio: 'ignore',
      shell: false
    })
    
    gameProcess.on('error', (error) => {
      errorLog('[Games] ❌ Erreur lors du lancement:', error)
      reject(error)
    })
    
    gameProcess.on('spawn', () => {
      log('[Games] ✅ Processus spawné (PID:', gameProcess.pid, ')')
      
      gameProcess.unref()
      
      setTimeout(() => {
        try {
          process.kill(gameProcess.pid, 0)
          log('[Games] ✅ Processus toujours actif après vérification')
          resolve({ success: true, pid: gameProcess.pid })
        } catch (checkErr) {
          if (gameProcess.exitCode !== null) {
            errorLog('[Games] ❌ Le processus s\'est terminé immédiatement avec le code:', gameProcess.exitCode)
            reject(new Error(`Le jeu s'est terminé immédiatement avec le code ${gameProcess.exitCode}. Vérifiez les logs Windows pour plus de détails.`))
          } else {
            log('[Games] ⚠️ Processus peut-être terminé, mais on considère le lancement comme réussi')
            resolve({ success: true, pid: gameProcess.pid })
          }
        }
      }, 300)
    })
    
    gameProcess.on('exit', (code, signal) => {
      if (code !== null && code !== 0) {
        errorLog('[Games] ❌ Le processus s\'est terminé avec le code:', code, 'signal:', signal)
      }
    })
  })
}

/**
 * Tuer les processus d'un jeu
 */
export async function killGameProcesses(gameFolder) {
  log('[Uninstall] 🔍 Recherche de processus actifs...')
  
  try {
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

    for (const exeName of exeFiles) {
      try {
        await execPromise(`taskkill /F /IM "${exeName}" /T`)
        log(`[Uninstall] ✅ Processus ${exeName} terminé`)
      } catch (err) {
        log(`[Uninstall] ℹ️ Processus ${exeName} non actif`)
      }
    }
  } catch (err) {
    log('[Uninstall] ⚠️ Erreur lors de la recherche de processus:', err.message)
  }
}

/**
 * Tuer tous les processus Actoris
 */
export async function killAllActorisProcesses() {
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
