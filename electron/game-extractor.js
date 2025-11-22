// game-extractor.js - Extraction automatique et création de marqueur
import path from 'node:path'
import fs from 'node:fs'
import { exec } from 'node:child_process'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'

// Importer les packages CommonJS avec createRequire
const require = createRequire(import.meta.url)
const Seven = require('node-7z')
const sevenBin = require('7zip-bin')

/**
 * Extrait une archive et crée un fichier marqueur pour le jeu
 */
export async function extractAndMarkGame(archiveFile, destFolder, gameName, webContents = null) {
  console.log('[Extract] ============================================')
  console.log('[Extract] 📦 DÉMARRAGE DE L\'EXTRACTION')
  console.log('[Extract] Fichier archive:', archiveFile)
  console.log('[Extract] Dossier destination:', destFolder)
  console.log('[Extract] Nom du jeu:', gameName)
  console.log('[Extract] ============================================')

  // Vérifier que le fichier existe
  if (!fs.existsSync(archiveFile)) {
    throw new Error(`Fichier introuvable: ${archiveFile}`)
  }

  // Vérifier la taille du fichier
  const stats = fs.statSync(archiveFile)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
  console.log('[Extract] Taille:', sizeMB, 'MB')
  
  if (stats.size === 0) {
    throw new Error('Le fichier archive est vide !')
  }

  // 🔍 VÉRIFIER LES PREMIERS OCTETS DU FICHIER (signature d'archive)
  const buffer = Buffer.alloc(10)
  const fd = fs.openSync(archiveFile, 'r')
  fs.readSync(fd, buffer, 0, 10, 0)
  fs.closeSync(fd)

  const fileExtension = path.extname(archiveFile).toLowerCase()
  console.log('[Extract] Extension:', fileExtension)
  console.log('[Extract] 🔍 Signature du fichier:', buffer.toString('hex'))
  console.log('[Extract] 🔍 Premiers octets:', buffer.toString('ascii').replace(/[^\x20-\x7E]/g, '.'))

  // Vérifier la signature selon le format
  let isValidArchive = false
  let archiveType = 'inconnu'

  if (fileExtension === '.rar') {
    // Signature RAR : "Rar!\x1a\x07\x00" ou "Rar!\x1a\x07\x01"
    isValidArchive = buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21
    archiveType = 'RAR'
  } else if (fileExtension === '.zip') {
    // Signature ZIP : "PK\x03\x04" ou "PK\x05\x06" (empty) ou "PK\x07\x08" (spanned)
    isValidArchive = buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
    archiveType = 'ZIP'
  } else if (fileExtension === '.7z') {
    // Signature 7Z : "7z\xBC\xAF\x27\x1C"
    isValidArchive = buffer[0] === 0x37 && buffer[1] === 0x7A && buffer[2] === 0xBC && buffer[3] === 0xAF
    archiveType = '7Z'
  } else {
    // Pour les autres formats (TAR, GZ, BZ2), on fait confiance à l'extension
    isValidArchive = true
    archiveType = fileExtension.toUpperCase().substring(1)
  }
  
  console.log(`[Extract] Est un fichier ${archiveType} valide?`, isValidArchive)

  if (!isValidArchive) {
    console.error(`[Extract] ❌ Le fichier n'est PAS un fichier ${archiveType} valide !`)
    console.error('[Extract] Il s\'agit probablement d\'une page HTML ou d\'un fichier corrompu')
    
    // Lire les 500 premiers caractères pour voir ce que c'est
    const previewBuffer = Buffer.alloc(500)
    const fdPreview = fs.openSync(archiveFile, 'r')
    fs.readSync(fdPreview, previewBuffer, 0, 500, 0)
    fs.closeSync(fdPreview)
    
    const preview = previewBuffer.toString('utf8').substring(0, 500)
    console.error('[Extract] Contenu du fichier (preview):')
    console.error(preview)
    
    // Détecter si c'est du HTML
    if (preview.includes('<!DOCTYPE') || preview.includes('<html') || preview.includes('<HTML')) {
      throw new Error("Le fichier téléchargé est une page HTML de redirection, pas une archive. Le téléchargement n'a probablement pas eu le temps de se terminer.")
    } else {
      throw new Error(`Le fichier téléchargé n'est pas une archive ${archiveType} valide. Il est peut-être corrompu ou incomplet.`)
    }
  }

  // Créer le dossier du jeu
  const gameFolder = path.join(destFolder, gameName)
  
  console.log('[Extract] Création du dossier du jeu:', gameFolder)
  
  if (!fs.existsSync(gameFolder)) {
    fs.mkdirSync(gameFolder, { recursive: true })
    console.log('[Extract] ✅ Dossier créé')
  } else {
    console.log('[Extract] ℹ️ Dossier existe déjà')
  }

  console.log('[Extract] 🔄 Extraction en cours...')
  
  try {
    // Utiliser WinRAR pour les RAR si disponible, sinon 7-Zip
    if (fileExtension === '.rar') {
      const winrarPath = findWinRARPath()
      if (winrarPath) {
        console.log('[Extract] Utilisation de WinRAR:', winrarPath)
        await extractWithWinRAR(archiveFile, gameFolder, winrarPath, webContents, gameName)
      } else {
        console.log('[Extract] WinRAR non trouvé, utilisation de 7-Zip:', sevenBin.path7za)
        await extractWith7ZipBin(archiveFile, gameFolder, webContents, gameName)
      }
    } else {
      console.log('[Extract] Utilisation de 7-Zip:', sevenBin.path7za)
      await extractWith7ZipBin(archiveFile, gameFolder, webContents, gameName)
    }
    console.log('[Extract] ✅ Extraction terminée')
  } catch (error) {
    console.error('[Extract] ❌ Erreur:', error)
    throw new Error(`Échec de l'extraction: ${error.message}`)
  }

  // Vérifier que des fichiers ont été extraits
  const extractedFiles = fs.readdirSync(gameFolder)
  console.log('[Extract] 📁 Fichiers extraits:', extractedFiles.length)
  
  if (extractedFiles.length === 0) {
    throw new Error("Aucun fichier extrait ! L'archive est peut-être corrompue ou protégée par mot de passe.")
  }
  
  console.log('[Extract] Premiers fichiers:', extractedFiles.slice(0, 10).join(', '))
  
  // 🔧 CORRIGER LA STRUCTURE DE DOSSIERS (éviter Content Warning/Content Warning/)
  // Si l'archive contient un seul dossier avec le même nom que le jeu, déplacer son contenu
  if (extractedFiles.length === 1) {
    const singleItem = extractedFiles[0]
    const singleItemPath = path.join(gameFolder, singleItem)
    const singleItemStats = fs.statSync(singleItemPath)
    
    if (singleItemStats.isDirectory() && singleItem === gameName) {
      console.log('[Extract] 🔧 Détection d\'un dossier dupliqué:', singleItem)
      console.log('[Extract] 🔧 Déplacement du contenu vers le dossier parent...')
      
      const nestedFolder = singleItemPath
      const nestedFiles = fs.readdirSync(nestedFolder)
      
      // Déplacer tous les fichiers et dossiers du sous-dossier vers le dossier parent
      for (const item of nestedFiles) {
        const sourcePath = path.join(nestedFolder, item)
        const destPath = path.join(gameFolder, item)
        
        try {
          fs.renameSync(sourcePath, destPath)
          console.log('[Extract] 🔧 Déplacé:', item)
        } catch (error) {
          console.warn('[Extract] ⚠️ Impossible de déplacer:', item, error.message)
        }
      }
      
      // Supprimer le dossier vide
      try {
        fs.rmdirSync(nestedFolder)
        console.log('[Extract] 🔧 Dossier dupliqué supprimé')
      } catch (error) {
        console.warn('[Extract] ⚠️ Impossible de supprimer le dossier dupliqué:', error.message)
      }
      
      // Re-lister les fichiers après correction
      const correctedFiles = fs.readdirSync(gameFolder)
      console.log('[Extract] 📁 Fichiers après correction:', correctedFiles.length)
    }
  }

  // 🗑️ SUPPRIMER L'ARCHIVE
  console.log('[Extract] 🗑️ Suppression de l\'archive...')
  try {
    fs.unlinkSync(archiveFile)
    console.log('[Extract] ✅ Archive supprimée')
  } catch (error) {
    console.warn('[Extract] ⚠️ Impossible de supprimer l\'archive:', error.message)
  }

  // 🎯 TROUVER L'EXÉCUTABLE PRINCIPAL DU JEU
  console.log('[Extract] 🔍 Recherche de l\'exécutable principal...')
  const gameExe = findGameExecutable(gameFolder, gameName)
  
  if (gameExe) {
    console.log('[Extract] ✅ Exécutable trouvé:', gameExe)
  } else {
    console.warn('[Extract] ⚠️ Aucun exécutable trouvé automatiquement')
  }

  // 🎯 CRÉER LE FICHIER MARQUEUR .crklauncher
  const markerFile = path.join(gameFolder, '.crklauncher')
  const gameData = {
    gameName: gameName,
    installDate: new Date().toISOString(),
    launcherId: generateUniqueId(),
    version: '1.0',
    folder: gameFolder,
    executable: gameExe || null, // Chemin de l'exe principal
    executableName: gameExe ? path.basename(gameExe) : null
  }

  console.log('[Extract] 🎯 Création du fichier marqueur...')
  fs.writeFileSync(markerFile, JSON.stringify(gameData, null, 2), 'utf8')
  console.log('[Extract] ✅ Fichier marqueur créé:', markerFile)

  // 🔒 MASQUER LE FICHIER (Windows uniquement)
  if (process.platform === 'win32') {
    console.log('[Extract] 🔒 Masquage du fichier marqueur...')
    try {
      exec(`attrib +h "${markerFile}"`, (err) => {
        if (err) {
          console.warn('[Extract] ⚠️ Impossible de masquer:', err.message)
        } else {
          console.log('[Extract] ✅ Fichier marqueur masqué')
        }
      })
    } catch (error) {
      console.warn('[Extract] ⚠️ Impossible de masquer le fichier:', error.message)
    }
  }

  console.log('[Extract] ============================================')
  console.log('[Extract] 🎉 INSTALLATION TERMINÉE')
  console.log('[Extract] Dossier du jeu:', gameFolder)
  console.log('[Extract] ============================================')

  return gameFolder
}

/**
 * Fonction intelligente pour trouver l'exécutable principal du jeu
 */
function findGameExecutable(gameFolder, gameName) {
  console.log('[Finder] 🔍 Recherche de l\'exécutable dans:', gameFolder)

  // Liste des fichiers à ignorer (ne sont jamais le jeu principal)
  const ignoredExeNames = [
    'unins000.exe',
    'unins001.exe',
    'uninstall.exe',
    'uninst.exe',
    'setup.exe',
    'installer.exe',
    'updater.exe',
    'launcher.exe',
    'crashreporter.exe',
    'crashhandler.exe',
    'vcredist',
    'directx',
    'redist',
    'dotnet',
    '_commonredist',
    'unitycrashhandler',
    'steamoverlay'
  ]

  // Mots-clés qui indiquent que c'est probablement le bon exe
  const gameNameClean = gameName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const goodKeywords = [
    gameNameClean,
    'game',
    'client',
    'play'
  ]

  // 🔍 Scanner récursivement tous les .exe
  const allExeFiles = []
  
  function scanDirectory(dir, depth = 0) {
    if (depth > 3) return // Ne pas chercher trop profondément

    try {
      const files = fs.readdirSync(dir, { withFileTypes: true })

      for (const file of files) {
        const fullPath = path.join(dir, file.name)

        if (file.isDirectory()) {
          // Ignorer certains dossiers
          const dirName = file.name.toLowerCase()
          if (!dirName.includes('redist') && 
              !dirName.includes('_common') && 
              !dirName.includes('commonredist') &&
              !dirName.includes('__macosx')) {
            scanDirectory(fullPath, depth + 1)
          }
        } else if (file.isFile() && file.name.toLowerCase().endsWith('.exe')) {
          const exeName = file.name.toLowerCase()
          
          // Vérifier si c'est un fichier à ignorer
          const isIgnored = ignoredExeNames.some(ignored => 
            exeName.includes(ignored.toLowerCase())
          )

          if (!isIgnored) {
            // Calculer un score de pertinence
            let score = 0

            // Bonus si le nom contient le nom du jeu
            goodKeywords.forEach(keyword => {
              if (exeName.includes(keyword)) {
                score += 10
              }
            })

            // Bonus si c'est dans le dossier racine
            if (depth === 0) {
              score += 5
            }

            // Bonus si le fichier est gros (plus de 5 MB)
            try {
              const fileStats = fs.statSync(fullPath)
              if (fileStats.size > 5 * 1024 * 1024) {
                score += 3
              }

              allExeFiles.push({
                path: fullPath,
                name: file.name,
                score: score,
                size: fileStats.size,
                depth: depth
              })

              console.log(`[Finder] Trouvé: ${file.name} (score: ${score}, taille: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`)
            } catch (statError) {
              console.warn(`[Finder] Erreur stats pour ${file.name}:`, statError.message)
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Finder] Erreur lecture dossier ${dir}:`, err.message)
    }
  }

  scanDirectory(gameFolder)

  if (allExeFiles.length === 0) {
    console.warn('[Finder] ⚠️ Aucun exécutable trouvé')
    return null
  }

  // Trier par score (du plus élevé au plus bas)
  allExeFiles.sort((a, b) => b.score - a.score)

  console.log('[Finder] 🎯 Meilleur candidat:', allExeFiles[0].name)
  console.log('[Finder] 📋 Tous les candidats:')
  allExeFiles.slice(0, 5).forEach((exe, i) => {
    console.log(`  ${i + 1}. ${exe.name} (score: ${exe.score})`)
  })

  return allExeFiles[0].path
}

/**
 * Trouve le chemin de WinRAR (Rar.exe) sur le système
 * Utilise Rar.exe (ligne de commande) au lieu de WinRAR.exe (GUI) pour éviter les fenêtres
 */
function findWinRARPath() {
  if (process.platform !== 'win32') {
    return null
  }

  // Chercher d'abord Rar.exe (ligne de commande, pas de fenêtre)
  const rarPaths = [
    'C:\\Program Files\\WinRAR\\Rar.exe',
    'C:\\Program Files (x86)\\WinRAR\\Rar.exe',
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'WinRAR', 'Rar.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'Rar.exe')
  ]

  for (const p of rarPaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }

  // Fallback vers WinRAR.exe si Rar.exe n'est pas trouvé
  const winrarPaths = [
    'C:\\Program Files\\WinRAR\\WinRAR.exe',
    'C:\\Program Files (x86)\\WinRAR\\WinRAR.exe',
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'WinRAR', 'WinRAR.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'WinRAR.exe')
  ]

  for (const p of winrarPaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }

  return null
}

/**
 * Extrait une archive RAR avec WinRAR
 */
function extractWithWinRAR(archivePath, destPath, winrarPath, webContents = null, gameName = null) {
  return new Promise((resolve, reject) => {
    console.log('[WinRAR] Archive:', archivePath)
    console.log('[WinRAR] Destination:', destPath)

    // Commande WinRAR/Rar: 
    // x = extraire avec chemins complets
    // -o+ = écraser sans demander
    // -y = répondre oui à tout
    // -ibck = exécuter en arrière-plan (pas de fenêtre visible, seulement pour WinRAR.exe)
    // Note: Rar.exe n'affiche pas de fenêtre par défaut
    const isRarExe = winrarPath.toLowerCase().endsWith('rar.exe')
    const command = isRarExe 
      ? `"${winrarPath}" x -o+ -y "${archivePath}" "${destPath}\\"`
      : `"${winrarPath}" x -o+ -y -ibck "${archivePath}" "${destPath}\\"`
    console.log('[WinRAR] Commande:', command)

    exec(command, { 
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true // Cacher la fenêtre de console Windows
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('[WinRAR] ❌ Erreur:', error)
        console.error('[WinRAR] stderr:', stderr)
        reject(new Error(`Échec extraction WinRAR: ${error.message || stderr}`))
        return
      }

      console.log('[WinRAR] ✅ Extraction terminée')
      if (stdout) {
        // Afficher seulement les dernières lignes pour éviter le spam
        const lines = stdout.split('\n').filter(l => l.trim())
        if (lines.length > 0) {
          console.log('[WinRAR] Dernières lignes:', lines.slice(-3).join('\n'))
        }
      }
      resolve()
    })
  })
}

/**
 * Extrait une archive avec 7-Zip intégré (node-7z + 7zip-bin)
 * Supporte RAR, ZIP, 7Z, TAR, GZ, BZ2, etc.
 */
function extractWith7ZipBin(archivePath, destPath, webContents = null, gameName = null) {
  return new Promise((resolve, reject) => {
    console.log('[7zip] Archive:', archivePath)
    console.log('[7zip] Destination:', destPath)

    const seven = Seven.extractFull(archivePath, destPath, {
      $bin: sevenBin.path7za,
      recursive: true,
      $progress: true
    })

    let fileCount = 0

    seven.on('data', (data) => {
      if (data.file) {
        fileCount++
        console.log('[7zip] Fichier:', data.file)
        
        // Envoyer la progression tous les 10 fichiers
        if (webContents && !webContents.isDestroyed() && fileCount % 10 === 0) {
          webContents.send('extraction-progress', {
            gameName: gameName,
            fileCount: fileCount
          })
        }
      }
    })

    seven.on('progress', (progress) => {
      const percent = progress.percent || 0
      console.log('[7zip] Progression:', percent + '%')
    })

    seven.on('end', () => {
      console.log('[7zip] ✅ Extraction terminée -', fileCount, 'fichiers')
      resolve()
    })

    seven.on('error', (err) => {
      console.error('[7zip] ❌ Erreur:', err)
      reject(err)
    })
  })
}

/**
 * Génère un ID unique pour le launcher
 */
function generateUniqueId() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Scanne un dossier pour trouver les jeux installés (avec marqueur .crklauncher)
 */
export function scanInstalledGames(gamesFolder) {
  const installedGames = []

  if (!fs.existsSync(gamesFolder)) {
    console.log('[Scan] Dossier de jeux inexistant:', gamesFolder)
    return installedGames
  }

  try {
    const folders = fs.readdirSync(gamesFolder, { withFileTypes: true })

    for (const folder of folders) {
      if (folder.isDirectory()) {
        const markerPath = path.join(gamesFolder, folder.name, '.crklauncher')

        if (fs.existsSync(markerPath)) {
          try {
            const gameData = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
            const gameFolder = path.join(gamesFolder, folder.name)
            const executable = gameData.executable || null
            const hasExecutable = executable && fs.existsSync(executable)
            
            installedGames.push({
              name: gameData.gameName || folder.name,
              folder: gameFolder,
              installDate: gameData.installDate,
              launcherId: gameData.launcherId,
              version: gameData.version || '1.0',
              executable: executable,
              executableName: gameData.executableName || (executable ? path.basename(executable) : null),
              hasExecutable: hasExecutable
            })
            console.log('[Scan] Jeu trouvé:', gameData.gameName, executable ? `(EXE: ${path.basename(executable)})` : '(pas d\'EXE)')
          } catch (error) {
            console.warn('[Scan] Erreur lors de la lecture du marqueur:', markerPath, error.message)
          }
        }
      }
    }
  } catch (error) {
    console.error('[Scan] Erreur lors du scan:', error)
  }

  return installedGames
}

