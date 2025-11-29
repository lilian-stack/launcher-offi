// game-extractor.js - Extraction automatique et création de marqueur
import path from 'node:path'
import fs from 'node:fs'
import { exec, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'

// Importer les packages CommonJS avec createRequire
const require = createRequire(import.meta.url)
const Seven = require('node-7z')
const sevenBin = require('7zip-bin')

// Fonction pour résoudre le chemin correct de 7za.exe même dans app.asar
function get7zipPath() {
  let binPath = sevenBin.path7za
  
  // Si on est dans une application packagée (app.asar), le chemin doit pointer vers app.asar.unpacked
  if (binPath && binPath.includes('app.asar')) {
    // Remplacer app.asar par app.asar.unpacked
    binPath = binPath.replace(/app\.asar/g, 'app.asar.unpacked')
    console.log('[7zip] Chemin ajusté pour app.asar.unpacked:', binPath)
  }
  
  // Vérifier que le fichier existe
  if (!fs.existsSync(binPath)) {
    console.warn('[7zip] ⚠️ Chemin 7za non trouvé:', binPath)
    console.warn('[7zip] ⚠️ Essai du chemin original:', sevenBin.path7za)
    // Essayer le chemin original
    if (fs.existsSync(sevenBin.path7za)) {
      binPath = sevenBin.path7za
    } else {
      throw new Error(`7za.exe introuvable. Chemin testé: ${binPath}`)
    }
  }
  
  console.log('[7zip] ✅ Chemin 7za valide:', binPath)
  return binPath
}

// Sanitize game names to create valid folder paths on all platforms
function sanitizeGameName(name = 'Game') {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ') // remove forbidden chars
    .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // remove special symbols (® © ™ etc.)
    .replace(/[^\x20-\x7E]/g, '') // remove all non-ASCII characters (keep only printable ASCII)
    .replace(/\.+$/g, '') // remove trailing dots
    .replace(/\s+/g, ' ') // collapse spaces
    .trim() || 'Game'
}

/**
 * Extrait une archive et crée un fichier marqueur pour le jeu
 * @param {string} archiveFile - Chemin de l'archive à extraire
 * @param {string} destFolder - Dossier de destination
 * @param {string} gameName - Nom du jeu
 * @param {object} webContents - WebContents pour envoyer des événements (optionnel)
 * @param {string} gameId - ID du jeu dans le catalogue (utilisé comme launcherId)
 */
export async function extractAndMarkGame(archiveFile, destFolder, gameName, webContents = null, gameId = null) {
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

  // ⏳ ATTENDRE QUE LE FICHIER SOIT DISPONIBLE (peut être verrouillé par le téléchargement)
  console.log('[Extract] ⏳ Vérification de la disponibilité du fichier...')
  let fileAvailable = false
  let attempts = 0
  const maxAttempts = 50 // 5 secondes max (50 * 100ms)
  
  while (!fileAvailable && attempts < maxAttempts) {
    try {
      // Essayer d'ouvrir le fichier en mode lecture seule pour vérifier qu'il n'est pas verrouillé
      const testFd = fs.openSync(archiveFile, 'r')
      // Essayer de lire un octet pour s'assurer que le fichier est vraiment accessible
      const testBuffer = Buffer.alloc(1)
      fs.readSync(testFd, testBuffer, 0, 1, 0)
      fs.closeSync(testFd)
      fileAvailable = true
      if (attempts > 0) {
        console.log('[Extract] ✅ Fichier disponible après', attempts, 'tentatives')
      }
    } catch (err) {
      attempts++
      if (attempts < maxAttempts) {
        // Attendre 100ms avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 100))
        if (attempts % 10 === 0) {
          console.log('[Extract] ⏳ Attente de la libération du fichier... (tentative', attempts, '/', maxAttempts, ')')
        }
      } else {
        console.error('[Extract] ❌ Fichier toujours verrouillé après', maxAttempts, 'tentatives')
        throw new Error(`Le fichier est verrouillé et ne peut pas être ouvert. Le téléchargement est peut-être encore en cours. Erreur: ${err.message}`)
      }
    }
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

  // Nettoyer le nom AVANT de créer le dossier pour éviter les caractères spéciaux
  let safeGameName = sanitizeGameName(gameName)
  
  // Supprimer TOUS les caractères spéciaux du nom
  safeGameName = safeGameName
    .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // Supprimer les symboles spéciaux
    .replace(/[^\x20-\x7E]/g, '') // Supprimer tous les caractères non-ASCII
    .trim()
  
  // Si le nom est vide après nettoyage, utiliser une version nettoyée du nom original
  if (!safeGameName || safeGameName.length === 0) {
    safeGameName = gameName
      .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\.+$/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Game'
  }
  
  console.log('[Extract] Nom nettoyé:', gameName, '->', safeGameName)

  // Créer le dossier du jeu (utiliser let car on peut le réassigner lors du renommage)
  let gameFolder = path.join(destFolder, safeGameName)
  
  console.log('[Extract] Création du dossier du jeu:', gameFolder)
  
  // Vérifier si un dossier avec des caractères spéciaux existe déjà
  const originalGameName = gameName
  const hasSpecialCharsInOriginal = /[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/.test(originalGameName) || /[^\x20-\x7E]/.test(originalGameName)
  
  if (hasSpecialCharsInOriginal && fs.existsSync(destFolder)) {
    // Chercher un dossier existant avec le nom original (avec caractères spéciaux)
    const originalFolderName = sanitizeGameName(originalGameName) // Utiliser sanitizeGameName mais sans supprimer les caractères spéciaux
    const originalFolder = path.join(destFolder, originalFolderName)
    
    // Si le dossier original existe mais pas le dossier nettoyé, renommer
    if (fs.existsSync(originalFolder) && !fs.existsSync(gameFolder)) {
      try {
        fs.renameSync(originalFolder, gameFolder)
        console.log('[Extract] ✅ Dossier existant renommé (caractères spéciaux supprimés):', originalFolderName, '->', safeGameName)
      } catch (renameErr) {
        console.warn('[Extract] ⚠️ Impossible de renommer le dossier existant:', renameErr.message)
        // Utiliser le dossier existant
        gameFolder = originalFolder
      }
    } else if (fs.existsSync(originalFolder) && fs.existsSync(gameFolder) && originalFolder !== gameFolder) {
      // Les deux dossiers existent, fusionner
      console.log('[Extract] 🔄 Fusion des dossiers (original et nettoyé)...')
      try {
        const originalFiles = fs.readdirSync(originalFolder)
        for (const file of originalFiles) {
          const sourcePath = path.join(originalFolder, file)
          const destPath = path.join(gameFolder, file)
          if (!fs.existsSync(destPath)) {
            fs.renameSync(sourcePath, destPath)
          }
        }
        // Supprimer le dossier original vide
        const remainingFiles = fs.readdirSync(originalFolder)
        if (remainingFiles.length === 0) {
          fs.rmdirSync(originalFolder)
        }
      } catch (mergeErr) {
        console.warn('[Extract] ⚠️ Impossible de fusionner les dossiers:', mergeErr.message)
      }
    }
  }
  
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
        const sevenZipPath = get7zipPath()
        console.log('[Extract] WinRAR non trouvé, utilisation de 7-Zip:', sevenZipPath)
        await extractWith7ZipBin(archiveFile, gameFolder, webContents, gameName)
      }
    } else {
      const sevenZipPath = get7zipPath()
      console.log('[Extract] Utilisation de 7-Zip:', sevenZipPath)
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
  
  // 🔧 CORRIGER LA STRUCTURE DE DOSSIERS (éviter les doublons)
  // Normaliser les noms pour la comparaison (enlever caractères spéciaux, espaces, etc.)
  const normalizeForComparison = (name) => {
    return name.toLowerCase()
      .replace(/[®©™]/g, '') // Enlever symboles de marque
      .replace(/[-_]/g, ' ') // Remplacer tirets par espaces
      .replace(/\s+/g, ' ') // Normaliser espaces
      .trim()
  }
  
  const normalizedSafeName = normalizeForComparison(safeGameName)
  
  // Si l'archive contient un seul dossier, vérifier s'il correspond au nom du jeu
  if (extractedFiles.length === 1) {
    const singleItem = extractedFiles[0]
    const singleItemPath = path.join(gameFolder, singleItem)
    const singleItemStats = fs.statSync(singleItemPath)
    
    if (singleItemStats.isDirectory()) {
      const normalizedItemName = normalizeForComparison(singleItem)
      // Vérifier si le nom correspond (avec ou sans AnkerGames)
      const matches = normalizedItemName === normalizedSafeName || 
                     normalizedItemName.includes(normalizedSafeName.replace(/ankergames/g, '').trim()) ||
                     normalizedSafeName.replace(/ankergames/g, '').trim().includes(normalizedItemName)
      
      if (matches) {
        console.log('[Extract] 🔧 Détection d\'un dossier dupliqué:', singleItem)
        console.log('[Extract] 🔧 Déplacement du contenu vers le dossier parent...')
        
        const nestedFolder = singleItemPath
        const nestedFiles = fs.readdirSync(nestedFolder)
        
        // Déplacer tous les fichiers et dossiers du sous-dossier vers le dossier parent
        for (const item of nestedFiles) {
          const sourcePath = path.join(nestedFolder, item)
          const destPath = path.join(gameFolder, item)
          
          // Vérifier si le fichier/dossier existe déjà
          if (fs.existsSync(destPath)) {
            console.log('[Extract] ⚠️ Élément existe déjà, on le saute:', item)
            continue
          }
          
          try {
            fs.renameSync(sourcePath, destPath)
            console.log('[Extract] 🔧 Déplacé:', item)
          } catch (error) {
            console.warn('[Extract] ⚠️ Impossible de déplacer:', item, error.message)
          }
        }
        
        // Supprimer le dossier vide
        try {
          const remainingFiles = fs.readdirSync(nestedFolder)
          if (remainingFiles.length === 0) {
            fs.rmdirSync(nestedFolder)
            console.log('[Extract] 🔧 Dossier dupliqué supprimé')
          } else {
            console.log('[Extract] ⚠️ Dossier non vide, on le garde:', remainingFiles.length, 'éléments restants')
          }
        } catch (error) {
          console.warn('[Extract] ⚠️ Impossible de supprimer le dossier dupliqué:', error.message)
        }
        
        // Re-lister les fichiers après correction
        const correctedFiles = fs.readdirSync(gameFolder)
        console.log('[Extract] 📁 Fichiers après correction:', correctedFiles.length)
      }
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

  // 🔄 RENOMMER LE DOSSIER POUR ENLEVER "-AnkerGames" ET LES CARACTÈRES SPÉCIAUX
  let finalGameFolder = gameFolder
  // Vérifier si le nom ORIGINAL contient des caractères spéciaux ou "-AnkerGames"
  // (pas safeGameName qui a déjà été nettoyé)
  const hasSpecialChars = /[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/.test(gameName) || /[^\x20-\x7E]/.test(gameName)
  const hasAnkerGames = safeGameName.includes('-AnkerGames') || safeGameName.includes('-Anker') || gameName.includes('-AnkerGames') || gameName.includes('-Anker')
  
  // TOUJOURS nettoyer les caractères spéciaux, même sans "-AnkerGames"
  if (hasAnkerGames || hasSpecialChars) {
    console.log('[Extract] 🔄 Renommage du dossier pour enlever les caractères spéciaux et "-AnkerGames"...')
    let cleanGameName = safeGameName
      .split('-AnkerGames')[0]
      .split('-Anker')[0]
      .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // Supprimer les symboles spéciaux
      .replace(/[^\x20-\x7E]/g, '') // Supprimer tous les caractères non-ASCII
      .trim()
    
    // Si le nom est vide après nettoyage, utiliser le nom original sans caractères spéciaux
    if (!cleanGameName || cleanGameName.length === 0) {
      cleanGameName = gameName
        .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
        .replace(/\.+$/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Game'
    }
    
    if (cleanGameName && cleanGameName !== safeGameName) {
      const newGameFolder = path.join(destFolder, cleanGameName)
      
      // Normaliser pour la comparaison
      const normalizeForComparison = (name) => {
        return name.toLowerCase()
          .replace(/[®©™]/g, '')
          .replace(/[-_]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
      
      const normalizedCleanName = normalizeForComparison(cleanGameName)
      
      try {
        // Vérifier si un dossier similaire existe déjà
        let existingSimilarFolder = null
        if (fs.existsSync(destFolder)) {
          const folders = fs.readdirSync(destFolder).filter(item => {
            const itemPath = path.join(destFolder, item)
            return fs.statSync(itemPath).isDirectory()
          })
          
          for (const folder of folders) {
            const normalizedFolderName = normalizeForComparison(folder)
            if (normalizedFolderName === normalizedCleanName || 
                normalizedFolderName.includes(normalizedCleanName) ||
                normalizedCleanName.includes(normalizedFolderName)) {
              existingSimilarFolder = path.join(destFolder, folder)
              console.log('[Extract] 🔍 Dossier similaire trouvé:', folder)
              break
            }
          }
        }
        
        if (existingSimilarFolder && existingSimilarFolder !== gameFolder) {
          // Fusionner les contenus au lieu de créer un doublon
          console.log('[Extract] 🔄 Fusion avec le dossier existant...')
          const existingFiles = fs.readdirSync(existingSimilarFolder)
          const newFiles = fs.readdirSync(gameFolder)
          
          // Déplacer les fichiers du nouveau dossier vers l'ancien
          for (const file of newFiles) {
            const sourcePath = path.join(gameFolder, file)
            const destPath = path.join(existingSimilarFolder, file)
            
            if (fs.existsSync(destPath)) {
              console.log('[Extract] ⚠️ Fichier existe déjà, on le saute:', file)
              continue
            }
            
            try {
              fs.renameSync(sourcePath, destPath)
              console.log('[Extract] 🔧 Déplacé vers dossier existant:', file)
            } catch (err) {
              console.warn('[Extract] ⚠️ Impossible de déplacer:', file, err.message)
            }
          }
          
          // Supprimer l'ancien dossier vide
          try {
            const remainingFiles = fs.readdirSync(gameFolder)
            if (remainingFiles.length === 0) {
              fs.rmdirSync(gameFolder)
              console.log('[Extract] ✅ Ancien dossier supprimé après fusion')
            }
          } catch (err) {
            console.warn('[Extract] ⚠️ Impossible de supprimer l\'ancien dossier:', err.message)
          }
          
          finalGameFolder = existingSimilarFolder
          gameFolder = existingSimilarFolder
        } else if (fs.existsSync(newGameFolder)) {
          console.warn('[Extract] ⚠️ Le dossier propre existe déjà, on garde l\'ancien nom')
        } else {
          try {
            fs.renameSync(gameFolder, newGameFolder)
            finalGameFolder = newGameFolder
            gameFolder = newGameFolder
            console.log('[Extract] ✅ Dossier renommé:', safeGameName, '->', cleanGameName)
          } catch (renameErr) {
            console.warn('[Extract] ⚠️ Impossible de renommer le dossier:', renameErr.message)
            // Continuer avec le nom original si le renommage échoue
          }
        }
      } catch (err) {
        console.warn('[Extract] ⚠️ Impossible de renommer le dossier:', err.message)
      }
    } else if (hasSpecialChars) {
      // Si seulement des caractères spéciaux (sans -AnkerGames), renommer quand même
      console.log('[Extract] 🔄 Renommage du dossier pour enlever les caractères spéciaux...')
      let cleanGameName = safeGameName
        .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // Supprimer les symboles spéciaux
        .replace(/[^\x20-\x7E]/g, '') // Supprimer tous les caractères non-ASCII
        .trim()
      
      if (!cleanGameName || cleanGameName.length === 0) {
        cleanGameName = gameName
          .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '')
          .replace(/[^\x20-\x7E]/g, '')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
          .replace(/\.+$/g, '')
          .replace(/\s+/g, ' ')
          .trim() || 'Game'
      }
      
      if (cleanGameName && cleanGameName !== safeGameName) {
        const newGameFolder = path.join(destFolder, cleanGameName)
        
        if (!fs.existsSync(newGameFolder)) {
          try {
            fs.renameSync(gameFolder, newGameFolder)
            finalGameFolder = newGameFolder
            gameFolder = newGameFolder
            console.log('[Extract] ✅ Dossier renommé (caractères spéciaux supprimés):', safeGameName, '->', cleanGameName)
          } catch (renameErr) {
            console.warn('[Extract] ⚠️ Impossible de renommer le dossier:', renameErr.message)
          }
        } else {
          console.warn('[Extract] ⚠️ Le dossier propre existe déjà:', newGameFolder)
        }
      }
    }
  }

  // 🗑️ SUPPRIMER LES FICHIERS ANKERGAMES (après le renommage)
  console.log('[Extract] 🗑️ Suppression des fichiers AnkerGames...')
  try {
    const files = fs.readdirSync(finalGameFolder)
    const ankerGamesFiles = files.filter(file => {
      const fileName = file.toLowerCase()
      return fileName.includes('ankergames') || 
             fileName.includes('free pre-installed') ||
             (fileName.endsWith('.url') && fileName.includes('ankergames'))
    })
    
    for (const file of ankerGamesFiles) {
      try {
        const filePath = path.join(finalGameFolder, file)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          console.log('[Extract] ✅ Fichier AnkerGames supprimé:', file)
        }
      } catch (err) {
        console.warn('[Extract] ⚠️ Impossible de supprimer:', file, err.message)
      }
    }
  } catch (error) {
    console.warn('[Extract] ⚠️ Erreur lors de la suppression des fichiers AnkerGames:', error.message)
  }

  // 🎯 TROUVER L'EXÉCUTABLE PRINCIPAL DU JEU
  console.log('[Extract] 🔍 Recherche de l\'exécutable principal...')
  const gameExe = findGameExecutable(finalGameFolder, gameName)
  
  if (gameExe) {
    console.log('[Extract] ✅ Exécutable trouvé:', gameExe)
  } else {
    console.warn('[Extract] ⚠️ Aucun exécutable trouvé automatiquement')
  }

  // 🎯 CRÉER LE FICHIER MARQUEUR .crklauncher
  let markerFile = path.join(finalGameFolder, '.crklauncher')
  // Utiliser le nom propre du jeu (sans AnkerGames) pour le marqueur
  const cleanGameNameForMarker = gameName.includes('-AnkerGames') || gameName.includes('-Anker')
    ? gameName.split('-AnkerGames')[0].split('-Anker')[0].trim()
    : gameName
  const gameData = {
    gameName: cleanGameNameForMarker,
    installDate: new Date().toISOString(),
    launcherId: gameId || generateUniqueId(), // ⚠️ Utiliser gameId si fourni, sinon générer un ID unique
    version: '1.0',
    folder: finalGameFolder,
    executable: gameExe || null, // Chemin de l'exe principal
    executableName: gameExe ? path.basename(gameExe) : null
  }

  console.log('[Extract] 🎯 Création du fichier marqueur...')
  
  // Vérifier si le fichier existe déjà et le supprimer si nécessaire
  if (fs.existsSync(markerFile)) {
    try {
      // Essayer de supprimer les attributs cachés avant de supprimer le fichier
      if (process.platform === 'win32') {
        try {
          execSync(`attrib -h "${markerFile}"`, { timeout: 2000 })
          console.log('[Extract] 🔓 Attribut caché retiré')
        } catch (err) {
          console.warn('[Extract] ⚠️ Impossible de retirer l\'attribut caché:', err.message)
          // Continuer quand même, on essaiera de supprimer le fichier
        }
      }
      fs.unlinkSync(markerFile)
      console.log('[Extract] 🔄 Ancien fichier marqueur supprimé')
    } catch (err) {
      console.warn('[Extract] ⚠️ Impossible de supprimer l\'ancien fichier marqueur:', err.message)
      // Essayer avec un nom différent
      const timestamp = Date.now()
      markerFile = path.join(finalGameFolder, `.crklauncher.${timestamp}`)
      console.log('[Extract] 🔄 Utilisation d\'un nom alternatif:', markerFile)
    }
  }
  
  // Créer le fichier marqueur avec gestion d'erreur et retry
  let markerCreated = false
  let retries = 3
  let lastError = null
  
  while (!markerCreated && retries > 0) {
    try {
      // Attendre un court délai avant chaque tentative (sauf la première)
      if (retries < 3) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      fs.writeFileSync(markerFile, JSON.stringify(gameData, null, 2), 'utf8')
      console.log('[Extract] ✅ Fichier marqueur créé:', markerFile)
      markerCreated = true
    } catch (err) {
      lastError = err
      retries--
      
      if (err.code === 'EPERM' || err.code === 'EACCES') {
        console.warn(`[Extract] ⚠️ Erreur de permission (${err.code}), tentative ${3 - retries}/3...`)
        
        if (retries > 0) {
          // Essayer de libérer le fichier en vérifiant s'il est verrouillé
          try {
            // Vérifier si le fichier existe et essayer de le supprimer
            if (fs.existsSync(markerFile)) {
              // Attendre un peu plus longtemps
              await new Promise(resolve => setTimeout(resolve, 1000))
              try {
                if (process.platform === 'win32') {
                  execSync(`attrib -h -r "${markerFile}"`, { timeout: 2000 })
                }
                fs.unlinkSync(markerFile)
                console.log('[Extract] 🔄 Fichier verrouillé supprimé, nouvelle tentative...')
              } catch (unlinkErr) {
                console.warn('[Extract] ⚠️ Impossible de supprimer le fichier verrouillé:', unlinkErr.message)
              }
            }
          } catch (checkErr) {
            console.warn('[Extract] ⚠️ Erreur lors de la vérification:', checkErr.message)
          }
        }
      } else {
        console.error('[Extract] ❌ Erreur inattendue lors de la création du marqueur:', err)
        retries = 0 // Arrêter les tentatives pour les autres erreurs
      }
    }
  }
  
  if (!markerCreated) {
    const errorMsg = lastError?.message || 'Erreur inconnue'
    const errorCode = lastError?.code || 'UNKNOWN'
    
    if (errorCode === 'EPERM' || errorCode === 'EACCES') {
      console.warn('[Extract] ⚠️ Permission refusée pour créer le fichier marqueur après 3 tentatives.')
      console.warn('[Extract] ⚠️ Le jeu est installé mais le marqueur ne peut pas être créé.')
      console.warn('[Extract] ⚠️ Le jeu sera toujours détectable par scan mais sans métadonnées.')
      // Ne pas faire échouer l'installation pour ça, continuer sans le marqueur
    } else {
      console.error('[Extract] ❌ Impossible de créer le fichier marqueur après 3 tentatives:', errorMsg)
      // Pour les autres erreurs, on continue quand même (le jeu est installé)
      console.warn('[Extract] ⚠️ Continuation sans fichier marqueur.')
    }
  }

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
  console.log('[Extract] Dossier du jeu:', finalGameFolder)
  console.log('[Extract] Exécutable:', gameExe || 'Non trouvé')
  console.log('[Extract] ============================================')

  return {
    gameFolder: finalGameFolder,
    exePath: gameExe || null
  }
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

  // Extraire le nom réel du jeu (sans "-AnkerGames" ou autres suffixes)
  let gameNameClean = gameName.toLowerCase().replace(/[^a-z0-9]/g, '')
  // Enlever les suffixes communs comme "ankergames"
  gameNameClean = gameNameClean.replace(/ankergames$/, '').replace(/crack$/, '').replace(/repack$/, '')
  
  // Mots-clés qui indiquent que c'est probablement le bon exe
  const goodKeywords = [
    gameNameClean,
    'game',
    'client',
    'play'
  ]
  
  // Si le nom du jeu contient "-AnkerGames", extraire la partie avant
  let baseGameName = gameName
  if (gameName.includes('-AnkerGames') || gameName.includes('-Anker')) {
    baseGameName = gameName.split('-AnkerGames')[0].split('-Anker')[0].trim()
    const baseGameNameClean = baseGameName.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (baseGameNameClean) {
      goodKeywords.unshift(baseGameNameClean) // Priorité au nom de base
    }
  }

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

            // Bonus si c'est dans le dossier racine ou dans un sous-dossier de niveau 1
            if (depth === 0) {
              score += 5
            } else if (depth === 1) {
              score += 2 // Petit bonus pour les sous-dossiers de niveau 1 (comme "Castle Crashers")
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
      // Vérifier si l'erreur est due à un fichier verrouillé (fichier déjà extrait)
      const isFileLockedError = stderr && (
        stderr.includes('Le processus ne peut pas accéder au fichier') ||
        stderr.includes('est utilisé par un autre processus') ||
        stderr.includes('cannot access the file') ||
        stderr.includes('is being used by another process')
      )
      
      if (error && !isFileLockedError) {
        console.error('[WinRAR] ❌ Erreur:', error)
        console.error('[WinRAR] stderr:', stderr)
        reject(new Error(`Échec extraction WinRAR: ${error.message || stderr}`))
        return
      }
      
      // Si c'est une erreur de fichier verrouillé, vérifier si l'extraction a quand même réussi
      if (isFileLockedError) {
        console.warn('[WinRAR] ⚠️ Certains fichiers sont verrouillés (peut-être déjà extraits)')
        console.warn('[WinRAR] Vérification si l\'extraction a réussi quand même...')
        
        // Vérifier si des fichiers ont été extraits
        try {
          const extractedFiles = fs.readdirSync(destPath)
          if (extractedFiles.length > 0) {
            console.log('[WinRAR] ✅ Des fichiers ont été extraits malgré l\'erreur:', extractedFiles.length)
            // Considérer comme un succès partiel
            if (stdout) {
              const lines = stdout.split('\n').filter(l => l.trim())
              if (lines.length > 0) {
                console.log('[WinRAR] Dernières lignes:', lines.slice(-3).join('\n'))
              }
            }
            resolve()
            return
          }
        } catch (dirError) {
          console.error('[WinRAR] ❌ Erreur lors de la vérification du dossier:', dirError)
        }
        
        // Si aucun fichier n'a été extrait, c'est une vraie erreur
        console.error('[WinRAR] ❌ Aucun fichier extrait, erreur réelle')
        reject(new Error(`Échec extraction WinRAR: Fichiers verrouillés et aucune extraction réussie`))
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

    // Résoudre le chemin correct de 7za.exe
    const sevenZipPath = get7zipPath()

    const seven = Seven.extractFull(archivePath, destPath, {
      $bin: sevenZipPath,
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
    // Fonction récursive pour scanner les sous-dossiers (profondeur max 2 niveaux pour éviter de scanner trop profondément)
    const scanDirectory = (dir, depth = 0) => {
      if (depth > 2) return // Limiter la profondeur pour éviter de scanner trop profondément
      
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true })

        for (const item of items) {
          if (item.isDirectory()) {
            const itemPath = path.join(dir, item.name)
            const markerPath = path.join(itemPath, '.crklauncher')

            // Vérifier si ce dossier contient un marqueur de jeu
            if (fs.existsSync(markerPath)) {
              try {
                const gameData = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
                let gameFolder = itemPath
                const executable = gameData.executable || null
                const hasExecutable = executable && fs.existsSync(executable)
                
                // Log pour déboguer
                console.log('[Scan] 🎮 Jeu trouvé:', gameData.gameName || item.name, 'dans:', itemPath)
                
                // 🔄 Renommer automatiquement les dossiers avec des caractères spéciaux
                const hasSpecialChars = /[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/.test(item.name) || /[^\x20-\x7E]/.test(item.name)
                if (hasSpecialChars) {
                  const cleanFolderName = item.name
                    .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // Supprimer les symboles spéciaux
                    .replace(/[^\x20-\x7E]/g, '') // Supprimer tous les caractères non-ASCII
                    .trim()
                  
                  if (cleanFolderName && cleanFolderName !== item.name) {
                    const newGameFolder = path.join(dir, cleanFolderName)
                    if (!fs.existsSync(newGameFolder)) {
                      try {
                        fs.renameSync(gameFolder, newGameFolder)
                        gameFolder = newGameFolder
                        console.log('[Scan] ✅ Dossier renommé (caractères spéciaux supprimés):', item.name, '->', cleanFolderName)
                        // Mettre à jour le chemin de l'exécutable si nécessaire
                        let updatedExecutable = executable
                        if (executable && executable.includes(item.name)) {
                          updatedExecutable = executable.replace(item.name, cleanFolderName)
                          if (fs.existsSync(updatedExecutable)) {
                            gameData.executable = updatedExecutable
                          }
                        }
                        
                        // Mettre à jour le fichier marqueur dans le nouveau dossier
                        const newMarkerPath = path.join(newGameFolder, '.crklauncher')
                        try {
                          fs.writeFileSync(newMarkerPath, JSON.stringify(gameData, null, 2), 'utf8')
                          // Supprimer l'ancien marqueur
                          try {
                            fs.unlinkSync(markerPath)
                          } catch (e) {
                            // Ignorer
                          }
                          // Mettre à jour la variable executable pour l'utiliser plus bas
                          if (updatedExecutable) {
                            gameData.executable = updatedExecutable
                          }
                        } catch (markerErr) {
                          console.warn('[Scan] ⚠️ Impossible de mettre à jour le marqueur:', markerErr.message)
                        }
                      } catch (renameErr) {
                        console.warn('[Scan] ⚠️ Impossible de renommer le dossier:', renameErr.message)
                      }
                    } else {
                      console.warn('[Scan] ⚠️ Le dossier nettoyé existe déjà:', cleanFolderName)
                    }
                  }
                }
                
                // Utiliser l'exécutable mis à jour si disponible (après renommage)
                const finalExecutable = gameData.executable || executable
                const finalHasExecutable = finalExecutable && fs.existsSync(finalExecutable)
                
                // Construire l'objet jeu avec toutes les données du fichier .crklauncher
                const gameInfo = {
                  name: gameData.gameName || item.name,
                  folder: gameFolder,
                  folderPath: gameFolder, // Alias pour compatibilité
                  installDate: gameData.installDate,
                  launcherId: gameData.launcherId, // ⚠️ IMPORTANT : utilisé pour faire correspondre avec la base de jeux
                  version: gameData.version || '1.0',
                  executable: finalExecutable,
                  exePath: finalExecutable, // Alias pour compatibilité
                  executableName: gameData.executableName || (finalExecutable ? path.basename(finalExecutable) : null),
                  hasExecutable: finalHasExecutable,
                  isInstalled: true // Flag pour indiquer que le jeu est installé
                }
                installedGames.push(gameInfo)
                console.log('[Scan] ✅ Jeu trouvé:', gameInfo.name, 'launcherId:', gameInfo.launcherId, 'dans:', gameFolder, finalExecutable ? `(EXE: ${path.basename(finalExecutable)})` : '(pas d\'EXE)')
              } catch (error) {
                console.warn('[Scan] Erreur lors de la lecture du marqueur:', markerPath, error.message)
              }
            } else {
              // Si pas de marqueur, scanner récursivement dans les sous-dossiers (profondeur limitée)
              scanDirectory(itemPath, depth + 1)
            }
          }
        }
      } catch (error) {
        console.warn('[Scan] Erreur lors du scan du dossier:', dir, error.message)
      }
    }
    
    // Démarrer le scan récursif depuis le dossier racine
    scanDirectory(gamesFolder, 0)
  } catch (error) {
    console.error('[Scan] Erreur lors du scan:', error)
  }

  return installedGames
}

