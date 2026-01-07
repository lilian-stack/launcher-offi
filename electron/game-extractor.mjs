import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { app } from 'electron'
import { randomBytes } from 'crypto'

// Obtenir __dirname en ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const log = (...args) => {
  if (typeof console !== 'undefined' && console.log) {
  }
}

const errorLog = (...args) => {
  if (typeof console !== 'undefined' && console.error) {
    console.error('[game-extractor]', ...args)
  }
}

/**
 * Trouve le chemin de 7zip portable
 */
function get7zipPath() {
  const isDev = !app.isPackaged
  
  if (isDev) {
    // En développement
    const devPath = path.join(__dirname, '..', 'resources', '7zip', '7z.exe')
    log('🔍 Vérification 7zip (dev):', devPath)
    if (fs.existsSync(devPath)) {
      log('✅ 7zip trouvé (dev):', devPath)
      return devPath
    }
  } else {
    // En production (packaged)
    // Avec asar: false, les fichiers sont dans resources/app/ ou directement dans resources/
    const execPathDir = path.dirname(process.execPath) // C:\Users\...\AppData\Local\Programs\Actoris
    const resourcesPath = process.resourcesPath || path.join(execPathDir, 'resources')
    
    // Essayer plusieurs chemins possibles en production
    const possiblePaths = [
      path.join(resourcesPath, '7zip', '7z.exe'), // resources/7zip/7z.exe
      path.join(execPathDir, 'resources', '7zip', '7z.exe'), // Chemin relatif depuis exe
      path.join(app.getAppPath(), 'resources', '7zip', '7z.exe'), // Depuis app.getAppPath()
      path.join(app.getAppPath(), '..', '7zip', '7z.exe') // Depuis app (si resources/7zip est au même niveau)
    ]
    
    for (const testPath of possiblePaths) {
      log('🔍 Vérification 7zip (prod):', testPath)
      if (fs.existsSync(testPath)) {
        log('✅ 7zip trouvé (prod):', testPath)
        return testPath
      }
    }
  }
  
  log('⚠️ 7zip portable non trouvé')
  return null
}

/**
 * Vérifie si 7zip est disponible
 */
async function check7zipAvailability() {
  const sevenZipPath = get7zipPath()
  
  if (!sevenZipPath) {
    errorLog('❌ 7zip non trouvé')
    return false
  }
  
  try {
    if (fs.existsSync(sevenZipPath)) {
      log('✅ 7zip disponible:', sevenZipPath)
      return true
    } else {
      errorLog('❌ 7zip non trouvé au chemin:', sevenZipPath)
      return false
    }
  } catch (error) {
    errorLog('❌ Erreur lors de la vérification de 7zip:', error)
    return false
  }
}

/**
 * Extrait une archive en utilisant 7zip portable ou node-7z
 */
async function extractArchive(archivePath, outputDir, onProgress = null) {
  return new Promise((resolve, reject) => {
    log('📦 Démarrage de l\'extraction:', archivePath)
    log('📦 Dossier de sortie:', outputDir)
    
    // Créer le dossier de sortie s'il n'existe pas
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
      log('📦 Dossier de sortie créé')
    }
    
    // Essayer d'abord 7zip portable
    const sevenZipPath = get7zipPath()
    
    if (sevenZipPath && fs.existsSync(sevenZipPath)) {
      log('📦 Utilisation de 7zip portable:', sevenZipPath)
      
      // Utiliser 7zip portable
      const sevenZipDir = path.dirname(sevenZipPath)
      // Ne pas utiliser shell: true avec des guillemets dans les args
      // Retirer les guillemets des args car spawn les gère automatiquement
      const cleanArgs = [
        'x', // Extraire avec chemins complets
        archivePath, // Archive à extraire (sans guillemets)
        `-o${outputDir}`, // Dossier de sortie (sans guillemets)
        '-y', // Accepter toutes les questions
        '-aoa' // Écraser tous les fichiers existants
      ]
      
      log('📦 Commande 7zip:', sevenZipPath, cleanArgs.join(' '))
      
      const process = spawn(sevenZipPath, cleanArgs, {
        cwd: sevenZipDir,
        shell: false, // Ne pas utiliser shell pour éviter les problèmes de guillemets
        stdio: ['ignore', 'pipe', 'pipe']
      })
      
      let output = ''
      let errorOutput = ''
      
      process.stdout.on('data', (data) => {
        const dataStr = data.toString()
        output += dataStr
        log('📦', dataStr.trim())
        
        // Parser la progression si possible
        if (onProgress && dataStr.includes('%')) {
          const match = dataStr.match(/(\d+)%/)
          if (match) {
            const percent = parseInt(match[1], 10)
            onProgress(percent)
          }
        }
      })
      
      process.stderr.on('data', (data) => {
        const dataStr = data.toString()
        errorOutput += dataStr
        errorLog('⚠️', dataStr.trim())
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          log('✅ Extraction terminée avec succès')
          resolve(outputDir)
        } else {
          errorLog('❌ Erreur d\'extraction, code:', code)
          errorLog('❌ Sortie:', output)
          errorLog('❌ Erreurs:', errorOutput)
          // Essayer avec node-7z en fallback
          log('📦 Tentative avec node-7z en fallback...')
          extractWithNode7z(archivePath, outputDir, onProgress).then(resolve).catch(reject)
        }
      })
      
      process.on('error', (err) => {
        errorLog('❌ Erreur de processus:', err)
        // Essayer avec node-7z en fallback
        log('📦 Tentative avec node-7z en fallback...')
        extractWithNode7z(archivePath, outputDir, onProgress).then(resolve).catch(reject)
      })
    } else {
      log('📦 7zip portable non trouvé, utilisation de node-7z')
      extractWithNode7z(archivePath, outputDir, onProgress).then(resolve).catch(reject)
    }
  })
}

/**
 * Extrait avec node-7z (fallback)
 */
async function extractWithNode7z(archivePath, outputDir, onProgress = null) {
  console.log('[game-extractor] 🔄 Extraction avec 7-Zip')
  
  // Chercher 7-Zip
  const sevenZipPaths = [
    get7zipPath(), // Chemin portable/embarqué
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe'
  ].filter(Boolean)
  
  let sevenZipExe = null
  for (const p of sevenZipPaths) {
    if (fs.existsSync(p)) {
      sevenZipExe = p
      break
    }
  }
  
  if (!sevenZipExe) {
    // Message d'erreur détaillé
    const errorMsg = `7-Zip non trouvé aux emplacements suivants:
- Chemin portable/embarqué: ${get7zipPath() || 'N/A'}
- C:\\Program Files\\7-Zip\\7z.exe
- C:\\Program Files (x86)\\7-Zip\\7z.exe

Veuillez installer 7-Zip depuis https://www.7-zip.org/
Ou placez 7z.exe dans le dossier resources/7zip/ de l'application.`
    console.error('[game-extractor] ❌', errorMsg)
    throw new Error('7-Zip non installé. Téléchargez-le sur https://www.7-zip.org/')
  }
  
  console.log(`[game-extractor] ✅ 7-Zip trouvé: ${sevenZipExe}`)
  
  // Créer le dossier de sortie
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  return new Promise((resolve, reject) => {
    const args = ['x', '-y', `-o${outputDir}`, archivePath]
    const process = spawn(sevenZipExe, args)
    
    let lastPercent = 0
    let outputBuffer = ''
    
    process.stdout.on('data', (data) => {
      outputBuffer += data.toString()
      const output = outputBuffer
      
      // Extraire le pourcentage si présent
      const match = output.match(/(\d+)%/)
      if (match && onProgress) {
        const percent = parseInt(match[1])
        if (percent > lastPercent) {
          lastPercent = percent
          onProgress(percent)
          console.log(`[7-Zip] ${percent}%`)
        }
      }
    })
    
    process.stderr.on('data', (data) => {
      const errorOutput = data.toString()
      console.error(`[7-Zip Error] ${errorOutput.trim()}`)
      
      // Certaines erreurs de 7-Zip passent par stderr mais ne sont pas fatales
      // On ignore les avertissements
      if (errorOutput.includes('ERROR') || errorOutput.includes('Can not open')) {
        reject(new Error(`7-Zip: ${errorOutput.trim()}`))
      }
    })
    
    process.on('close', (code) => {
      if (code === 0) {
        console.log('[game-extractor] ✅ Extraction réussie')
        if (onProgress) onProgress(100)
        resolve(outputDir)
      } else {
        reject(new Error(`7-Zip a échoué (code ${code})`))
      }
    })
    
    process.on('error', (error) => {
      reject(new Error(`Erreur 7-Zip: ${error.message}`))
    })
  })
}

/**
 * Trouve le dossier du jeu et l'exécutable
 */
function findGameFolderAndExe(extractedDir, gameName) {
  log('🔍 Recherche du dossier du jeu dans:', extractedDir)
  
  if (!fs.existsSync(extractedDir)) {
    throw new Error('Le dossier d\'extraction n\'existe pas')
  }
  
  const items = fs.readdirSync(extractedDir)
  log('🔍 Éléments trouvés:', items.length)
  
  // Dossiers à ignorer (redistributables, utilitaires, etc.)
  const ignoredFolders = [
    '_commonredist',
    'commonredist',
    '_redistributables',
    'redistributables',
    'redist',
    'common files',
    'directx',
    'vcredist',
    'dotnet',
    'visual c++',
    'dxwebsetup',
    'installer',
    'setup',
    'temp',
    'tmp'
  ]
  
  // Normaliser le nom du jeu pour la comparaison
  const normalizedGameName = gameName.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // Chercher un dossier qui contient un .exe
  const exeExtensions = ['.exe', '.bat', '.cmd']
  let gameFolder = null
  let exePath = null
  
  // Vérifier si un dossier doit être ignoré
  function shouldIgnoreFolder(folderName) {
    const normalized = folderName.toLowerCase()
    return ignoredFolders.some(ignored => normalized.includes(ignored))
  }
  
  // Vérifier si un dossier correspond au nom du jeu
  function matchesGameName(folderName) {
    const normalized = folderName.toLowerCase().replace(/[^a-z0-9]/g, '')
    return normalized.includes(normalizedGameName) || normalizedGameName.includes(normalized)
  }
  
  // Fonction récursive pour chercher un exe dans un dossier
  function searchForExeInDir(dir, depth = 0) {
    if (depth > 5) return null // Limiter la profondeur
    
    try {
      const entries = fs.readdirSync(dir)
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)
        
        if (stat.isFile()) {
          const ext = path.extname(entry).toLowerCase()
          if (exeExtensions.includes(ext)) {
            // Éviter les fichiers système
            if (!entry.toLowerCase().includes('unins') && 
                !entry.toLowerCase().includes('setup') &&
                !entry.toLowerCase().includes('install') &&
                !entry.toLowerCase().includes('dxsetup') &&
                !entry.toLowerCase().includes('vcredist')) {
              return { exePath: fullPath, gameFolder: dir }
            }
          }
        } else if (stat.isDirectory() && depth < 2) {
          // Chercher récursivement mais pas trop profond
          const result = searchForExeInDir(fullPath, depth + 1)
          if (result) return result
        }
      }
    } catch (err) {
      // Ignorer les erreurs de lecture
    }
    return null
  }
  
  // ÉTAPE 1 : Si un seul dossier, c'est probablement le dossier du jeu
  if (items.length === 1) {
    const singleItem = path.join(extractedDir, items[0])
    if (fs.statSync(singleItem).isDirectory()) {
      if (!shouldIgnoreFolder(items[0])) {
        gameFolder = singleItem
        log('🔍 Un seul dossier trouvé, utilisation:', gameFolder)
        const result = searchForExeInDir(gameFolder)
        if (result) {
          exePath = result.exePath
          gameFolder = result.gameFolder
        }
      }
    }
  } else {
    // ÉTAPE 2 : Chercher d'abord dans les dossiers qui correspondent au nom du jeu
    const matchingFolders = []
    const otherFolders = []
    
    for (const item of items) {
      const fullPath = path.join(extractedDir, item)
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          if (shouldIgnoreFolder(item)) {
            log('🔍 Dossier ignoré (redistributable):', item)
            continue
          }
          
          if (matchesGameName(item)) {
            matchingFolders.push(fullPath)
            log('🔍 Dossier correspondant au nom du jeu trouvé:', item)
          } else {
            otherFolders.push(fullPath)
          }
        }
      } catch (err) {
        // Ignorer les erreurs
      }
    }
    
    // Chercher d'abord dans les dossiers qui correspondent au nom du jeu
    for (const folder of matchingFolders) {
      const result = searchForExeInDir(folder)
      if (result) {
        exePath = result.exePath
        gameFolder = result.gameFolder
        log('✅ Dossier du jeu trouvé (correspond au nom):', gameFolder)
        break
      }
    }
    
    // Si pas trouvé, chercher dans les autres dossiers (mais pas dans les ignorés)
    if (!gameFolder) {
      for (const folder of otherFolders) {
        const result = searchForExeInDir(folder)
        if (result) {
          exePath = result.exePath
          gameFolder = result.gameFolder
          log('✅ Dossier du jeu trouvé:', gameFolder)
          break
        }
      }
    }
  }
  
  // Si pas trouvé, utiliser le dossier d'extraction
  if (!gameFolder) {
    gameFolder = extractedDir
    log('🔍 Aucun dossier spécifique trouvé, utilisation du dossier d\'extraction')
  }
  
  return { gameFolder, exePath }
}

/**
 * Génère un ID unique pour le launcher (UUID-like)
 */
function generateLauncherId() {
  return randomBytes(16).toString('hex')
}

/**
 * Lit un fichier .crklauncheur
 */
function readLauncherFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }
    
    const content = fs.readFileSync(filePath, 'utf8')
    const launcherData = JSON.parse(content)
    
    // Valider la structure
    if (!launcherData.gameName || !launcherData.folder) {
      errorLog('⚠️ Fichier .crklauncheur invalide:', filePath)
      return null
    }
    
    return launcherData
  } catch (error) {
    errorLog('⚠️ Erreur lors de la lecture du fichier .crklauncheur:', filePath, error)
    return null
  }
}

/**
 * Nettoie les fichiers inutiles dans le dossier du jeu
 */
function cleanupUnnecessaryFiles(gameFolder) {
  if (!fs.existsSync(gameFolder)) {
    return
  }
  
  const filesToRemove = [
    /\.url$/i, // Fichiers .url (raccourcis Internet)
    /readme/i, // Fichiers readme
    /read_me/i,
    /instructions/i,
    /license/i,
    /licence/i,
    /changelog/i,
    /steamrip/i, // Fichiers SteamRIP
    /free.*pre.*installed/i // Fichiers "Free Pre-installed"
  ]
  
  const foldersToRemove = [
    /_commonredist/i, // Dossier des redistributables communs
    /redist/i,
    /_redist/i
  ]
  
  function cleanDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir)
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)
        
        if (stat.isDirectory()) {
          // Vérifier si c'est un dossier à supprimer
          const shouldRemoveFolder = foldersToRemove.some(pattern => pattern.test(entry))
          if (shouldRemoveFolder) {
            log('🧹 Suppression du dossier:', fullPath)
            try {
              fs.rmSync(fullPath, { recursive: true, force: true })
              log('✅ Dossier supprimé:', entry)
            } catch (err) {
              errorLog('⚠️ Impossible de supprimer le dossier:', entry, err)
            }
          } else {
            // Nettoyer récursivement (mais limiter la profondeur)
            if (entry !== '..' && entry !== '.') {
              cleanDirectory(fullPath)
            }
          }
        } else if (stat.isFile()) {
          // Vérifier si c'est un fichier à supprimer
          const shouldRemoveFile = filesToRemove.some(pattern => pattern.test(entry))
          if (shouldRemoveFile) {
            log('🧹 Suppression du fichier:', fullPath)
            try {
              fs.unlinkSync(fullPath)
              log('✅ Fichier supprimé:', entry)
            } catch (err) {
              errorLog('⚠️ Impossible de supprimer le fichier:', entry, err)
            }
          }
        }
      }
    } catch (err) {
      errorLog('⚠️ Erreur lors du nettoyage du dossier:', dir, err)
    }
  }
  
  cleanDirectory(gameFolder)
  log('✅ Nettoyage terminé')
}

/**
 * Extrait et marque un jeu comme installé
 */
export async function extractAndMarkGame(archivePath, destFolder, gameName, webContents = null, gameId = null) {
  try {
    log('🚀 Démarrage de l\'extraction pour:', gameName)
    log('📦 Archive:', archivePath)
    log('📦 Destination:', destFolder)
    
    if (!fs.existsSync(archivePath)) {
      throw new Error(`L'archive n'existe pas: ${archivePath}`)
    }
    
    // Créer un dossier spécifique pour ce jeu
    const gameOutputDir = path.join(destFolder, gameName)
    
    // Fonction de progression
    const onProgress = (percent) => {
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('extraction:progress', {
          gameName,
          progress: percent
        })
      }
      log('📦 Progression:', percent + '%')
    }
    
    // Extraire l'archive
    await extractArchive(archivePath, gameOutputDir, onProgress)
    
    log('✅ Extraction terminée, recherche du dossier du jeu...')
    
    // Trouver le dossier du jeu et l'exécutable
    const { gameFolder, exePath } = findGameFolderAndExe(gameOutputDir, gameName)
    
    log('✅ Dossier du jeu trouvé:', gameFolder)
    if (exePath) {
      log('✅ Exécutable trouvé:', exePath)
    }
    
    // 🧹 NETTOYER LES FICHIERS INUTILES
    // Nettoyer dans le dossier d'extraction (gameOutputDir) pour supprimer les fichiers .url à la racine
    log('🧹 Nettoyage des fichiers inutiles...')
    try {
      // Nettoyer d'abord le dossier d'extraction (pour les fichiers .url à la racine)
      cleanupUnnecessaryFiles(gameOutputDir)
      // Ensuite nettoyer le dossier du jeu (pour les fichiers dans le jeu)
      if (gameFolder !== gameOutputDir) {
        cleanupUnnecessaryFiles(gameFolder)
      }
    } catch (cleanupError) {
      errorLog('⚠️ Erreur lors du nettoyage:', cleanupError)
      // Ne pas faire échouer l'extraction si le nettoyage échoue
    }
    
    // 🗑️ SUPPRIMER L'ARCHIVE APRÈS EXTRACTION RÉUSSIE
    log('🗑️ Suppression de l\'archive:', archivePath)
    try {
      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath)
        log('✅ Archive supprimée avec succès')
      }
    } catch (deleteError) {
      errorLog('⚠️ Impossible de supprimer l\'archive:', deleteError)
      // Ne pas faire échouer l'extraction si la suppression échoue
    }
    
    // 📝 CRÉER LE FICHIER .crklauncheur
    log('📝 Création du fichier .crklauncheur...')
    let launcherId = null
    try {
      launcherId = generateLauncherId()
      const executableName = exePath ? path.basename(exePath) : null
      
      const launcherFile = {
        gameName: gameName,
        installDate: new Date().toISOString(),
        launcherId: launcherId,
        gameId: gameId || null, // Ajouter le gameId du catalogue si disponible
        id: gameId || null, // Alias pour compatibilité
        version: '1.0',
        folder: gameFolder,
        executable: exePath || null,
        executableName: executableName
      }
      
      // Créer le fichier dans le dossier du jeu
      const launcherFilePath = path.join(gameFolder, `${gameName}.crklauncheur`)
      
      // S'assurer que le dossier existe avant d'écrire le fichier
      try {
        if (!fs.existsSync(gameFolder)) {
          log('📁 Création du dossier:', gameFolder)
          fs.mkdirSync(gameFolder, { recursive: true })
        }
        
        // Vérifier que le dossier parent existe aussi
        const parentDir = path.dirname(launcherFilePath)
        if (!fs.existsSync(parentDir)) {
          log('📁 Création du dossier parent:', parentDir)
          fs.mkdirSync(parentDir, { recursive: true })
        }
        
        fs.writeFileSync(launcherFilePath, JSON.stringify(launcherFile, null, 2), 'utf8')
      } catch (writeError) {
        errorLog('⚠️ Erreur lors de l\'écriture du fichier .crklauncheur:', writeError)
        // Essayer dans le dossier d'extraction si le dossier du jeu n'est pas accessible
        const fallbackPath = path.join(gameOutputDir, `${gameName}.crklauncheur`)
        try {
          fs.writeFileSync(fallbackPath, JSON.stringify(launcherFile, null, 2), 'utf8')
          log('✅ Fichier .crklauncheur créé dans le dossier d\'extraction:', fallbackPath)
        } catch (fallbackError) {
          errorLog('❌ Impossible de créer le fichier .crklauncheur même dans le dossier d\'extraction:', fallbackError)
          throw writeError
        }
      }
      log('✅ Fichier .crklauncheur créé:', launcherFilePath)
      
      // Vérifier que le fichier existe bien
      if (fs.existsSync(launcherFilePath)) {
        log('✅ Vérification: Le fichier .crklauncheur existe bien à:', launcherFilePath)
        const fileContent = fs.readFileSync(launcherFilePath, 'utf8')
        log('✅ Contenu du fichier:', fileContent.substring(0, 200) + '...')
      } else {
        errorLog('❌ ERREUR: Le fichier .crklauncheur n\'existe pas après création!')
      }
    } catch (launcherFileError) {
      errorLog('⚠️ Erreur lors de la création du fichier .crklauncheur:', launcherFileError)
      // Ne pas faire échouer l'extraction si la création du fichier échoue
    }
    
    // Envoyer la notification de fin
    if (webContents && !webContents.isDestroyed()) {
      webContents.send('extraction:complete', {
        gameName,
        gameFolder,
        exePath
      })
    }
    
    return {
      gameFolder,
      exePath,
      launcherId: launcherId
    }
  } catch (error) {
    errorLog('❌ Erreur lors de l\'extraction:', error)
    throw error
  }
}

/**
 * Scanne récursivement tous les fichiers .crklauncheur dans un dossier
 */
function scanLauncherFilesRecursive(dir, maxDepth = 10, currentDepth = 0) {
  const foundGames = []
  
  if (currentDepth > maxDepth || !fs.existsSync(dir)) {
    return foundGames
  }
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)
      
      try {
        // Chercher les fichiers .crklauncheur
        if (entry.isFile() && entry.name.endsWith('.crklauncheur')) {
          const launcherData = readLauncherFile(entryPath)
          if (launcherData) {
            // 🔍 FILTRER LES DOSSIERS QUI NE SONT PAS DES JEUX
            const gameName = launcherData.gameName || ''
            const folderName = path.basename(launcherData.folder || '')
            
            // Ignorer les dossiers de redistributables, utilitaires, installateurs et autres fichiers système
            const ignoredNames = [
              '_commonredist', 'commonredist', 'redist', '_redist',
              'readme', 'read me', 'license', 'licence',
              'steamrip', 'crack', 'patch', 'update',
              'temp', 'tmp', 'cache', 'logs',
              // Utilitaires et installateurs
              'setup', 'installer', 'install', 'uninstall',
              'tool', 'utility', 'utilitaire', 'helper',
              'afterburner', 'msi', 'filterkeys', 'keysetter',
              'driver', 'drivers', 'runtime', 'runtimes',
              'framework', 'net', 'dotnet', 'visual c++',
              'directx', 'vcredist', 'xna', 'physx',
              'config', 'settings', 'option', 'preference'
            ]
            
            const shouldIgnore = ignoredNames.some(ignored => 
              gameName.toLowerCase().includes(ignored) || 
              folderName.toLowerCase().includes(ignored)
            )
            
            if (shouldIgnore) {
              log('⚠️ Ignoré (utilitaire/installateur):', gameName)
              continue // Continuer avec le prochain fichier
            }
            
            // Vérifier que le dossier et l'exécutable existent toujours
            if (fs.existsSync(launcherData.folder)) {
              // Vérifier aussi que l'exécutable existe (si spécifié)
              if (launcherData.executable && !fs.existsSync(launcherData.executable)) {
                log('⚠️ Exécutable introuvable pour:', launcherData.gameName)
                continue // Ignorer ce jeu si l'exécutable n'existe pas
              }
              
              // Vérifier que l'exécutable n'est pas un installateur ou un utilitaire
              if (launcherData.executable) {
                const exeName = path.basename(launcherData.executable).toLowerCase()
                const exeIgnored = [
                  'setup', 'install', 'uninstall', 'installer',
                  'config', 'settings', 'tool', 'utility',
                  'afterburner', 'msi', 'filterkeys', 'keysetter'
                ]
                if (exeIgnored.some(ignored => exeName.includes(ignored))) {
                  log('⚠️ Ignoré (exécutable utilitaire):', launcherData.gameName, '-', exeName)
                  continue
                }
              }
              
              // Utiliser le gameId du fichier s'il existe, sinon utiliser le launcherId
              const gameIdFromFile = launcherData.gameId || launcherData.id
              
              const gameInfo = {
                id: gameIdFromFile || launcherData.launcherId,
                gameId: gameIdFromFile || launcherData.launcherId, // Utiliser le gameId du fichier s'il existe
                gameName: launcherData.gameName,
                name: launcherData.gameName,
                title: launcherData.gameName,
                path: launcherData.folder,
                gamePath: launcherData.folder,
                exePath: launcherData.executable && fs.existsSync(launcherData.executable) ? launcherData.executable : null,
                installDate: launcherData.installDate,
                version: launcherData.version,
                launcherId: launcherData.launcherId,
                // Les données sont maintenant stockées dans SimpleStore/SQLite, pas dans des fichiers .crklauncher
              }
              foundGames.push(gameInfo)
              log('✅ Jeu trouvé via .crklauncheur:', launcherData.gameName)
              log('   📁 Dossier:', launcherData.folder)
              log('   📄 Fichier .crklauncheur:', entryPath)
              log('   🎮 Exécutable:', launcherData.executable || 'Non trouvé')
              if (gameIdFromFile) {
                log('   🆔 gameId trouvé dans le fichier:', gameIdFromFile)
              } else {
                log('   ⚠️ Pas de gameId dans le fichier, utilisation du launcherId:', launcherData.launcherId)
              }
            } else {
              log('⚠️ Dossier du jeu introuvable pour:', launcherData.gameName)
            }
          }
        }
        
        // Scanner récursivement les sous-dossiers
        if (entry.isDirectory() && currentDepth < maxDepth) {
          const subGames = scanLauncherFilesRecursive(entryPath, maxDepth, currentDepth + 1)
          foundGames.push(...subGames)
        }
      } catch (err) {
        // Ignorer les erreurs de lecture (permissions, etc.)
      }
    }
  } catch (err) {
    // Ignorer les erreurs de lecture du dossier
  }
  
  return foundGames
}

/**
 * Scanne les jeux installés dans un dossier
 * Priorité : fichiers .crklauncheur (scan récursif), puis scan classique
 */
export function scanInstalledGames(gamesFolder, forceRefresh = false) {
  log('🔍 Scan des jeux installés dans:', gamesFolder)
  
  if (!fs.existsSync(gamesFolder)) {
    log('⚠️ Le dossier n\'existe pas')
    return []
  }
  
  const games = []
  const foundLauncherFiles = new Set() // Pour éviter les doublons
  
  try {
    // 🔍 ÉTAPE 1 : Scanner RÉCURSIVEMENT tous les fichiers .crklauncheur (priorité)
    log('🔍 Recherche récursive des fichiers .crklauncheur...')
    const launcherGames = scanLauncherFilesRecursive(gamesFolder, 10)
    
    // Éviter les doublons
    for (const game of launcherGames) {
      const key = game.path.toLowerCase()
      if (!foundLauncherFiles.has(key)) {
        games.push(game)
        foundLauncherFiles.add(key)
      }
    }
    
    log('✅', launcherGames.length, 'jeux trouvés via .crklauncheur')
    
    // 🔍 ÉTAPE 2 : Scan classique pour les jeux sans .crklauncheur
    // Toujours scanner pour créer les fichiers .crklauncheur manquants
    {
      log('🔍 Scan classique pour les jeux sans .crklauncheur...')
      const entries = fs.readdirSync(gamesFolder)
      
      for (const entry of entries) {
        const gamePath = path.join(gamesFolder, entry)
        const stat = fs.statSync(gamePath)
        
        if (stat.isDirectory()) {
          // 🔍 FILTRER LES DOSSIERS QUI NE SONT PAS DES JEUX
          const folderName = entry.toLowerCase()
          const ignoredFolders = [
            '_commonredist', 'commonredist', 'redist', '_redist',
            'readme', 'read me', 'license', 'licence',
            'steamrip', 'crack', 'patch', 'update',
            'temp', 'tmp', 'cache', 'logs', 'system',
            'windows', 'program files', 'programdata',
            // Utilitaires et installateurs
            'setup', 'installer', 'install', 'uninstall',
            'tool', 'utility', 'utilitaire', 'helper',
            'afterburner', 'msi', 'filterkeys', 'keysetter',
            'driver', 'drivers', 'runtime', 'runtimes',
            'framework', 'net', 'dotnet', 'visual c++',
            'directx', 'vcredist', 'xna', 'physx',
            'config', 'settings', 'option', 'preference'
          ]
          
          if (ignoredFolders.some(ignored => folderName.includes(ignored))) {
            log('⚠️ Ignoré (utilitaire/installateur):', entry)
            continue
          }
          
          // Ignorer si déjà trouvé via .crklauncheur
          if (foundLauncherFiles.has(gamePath.toLowerCase())) {
            continue
          }
          
          // Chercher un exécutable dans ce dossier
          const exeExtensions = ['.exe', '.bat', '.cmd']
          let exePath = null
          
          function findExe(dir) {
            try {
              const items = fs.readdirSync(dir)
              for (const item of items) {
                const itemPath = path.join(dir, item)
                const itemStat = fs.statSync(itemPath)
                
                if (itemStat.isDirectory()) {
                  findExe(itemPath)
                } else {
                  const ext = path.extname(item).toLowerCase()
                  const itemLower = item.toLowerCase()
                  // Ignorer les installateurs et utilitaires
                  const ignoredExe = ['setup', 'install', 'uninstall', 'installer', 'config', 'settings', 'tool', 'utility', 'afterburner', 'msi', 'filterkeys', 'keysetter']
                  if (exeExtensions.includes(ext) && 
                      !itemLower.includes('unins') &&
                      !ignoredExe.some(ignored => itemLower.includes(ignored))) {
                    exePath = itemPath
                    return
                  }
                }
              }
            } catch (err) {
              // Ignorer
            }
          }
          
          findExe(gamePath)
          
          if (exePath) {
            // Vérifier que l'exécutable n'est pas un installateur ou un utilitaire
            const exeName = path.basename(exePath).toLowerCase()
            const exeIgnored = [
              'setup', 'install', 'uninstall', 'installer',
              'config', 'settings', 'tool', 'utility',
              'afterburner', 'msi', 'filterkeys', 'keysetter'
            ]
            if (exeIgnored.some(ignored => exeName.includes(ignored))) {
              log('⚠️ Ignoré (exécutable utilitaire):', entry, '-', exeName)
              continue
            }
            
            // ❌ NE PLUS CRÉER DE FICHIER .crklauncheur ICI
            // Les fichiers .crklauncheur sont créés UNIQUEMENT lors de l'extraction
            // Si un jeu n'a pas de fichier .crklauncheur, c'est qu'il n'a pas été installé via le launcher
            // On l'ignore donc
            log('⚠️ Jeu sans fichier .crklauncheur ignoré (non installé via le launcher):', entry)
            continue
          }
        }
      }
    }
  } catch (error) {
    errorLog('❌ Erreur lors du scan:', error)
  }
  
  log('✅ Total jeux trouvés:', games.length)
  return games
}

// Exporter les fonctions utilitaires
export {
  get7zipPath,
  check7zipAvailability
}

