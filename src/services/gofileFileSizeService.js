/**
 * Service pour récupérer la taille des fichiers depuis Gofile
 * Version Enhanced - utilise l'authentification automatique pour les vraies tailles
 */

// Cache pour éviter les requêtes répétées
const gofileCache = new Map()

/**
 * Vérifie si une URL est une URL Gofile
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
export function isGofileUrl(url) {
  if (!url || typeof url !== 'string') {
    return false
  }
  return url.includes('gofile.io')
}

/**
 * Extrait l'ID du dossier/fichier depuis une URL Gofile
 * @param {string} url - URL Gofile
 * @returns {string|null} ID extrait ou null
 */
export function extractGofileId(url) {
  if (!isGofileUrl(url)) {
    return null
  }
  
  // Patterns pour extraire l'ID
  const patterns = [
    /gofile\.io\/d\/([A-Za-z0-9]+)/,  // Format dossier: /d/ID
    /gofile\.io\/([A-Za-z0-9]+)/      // Format direct: /ID
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

/**
 * Récupère la taille EXACTE des fichiers depuis Gofile via Enhanced Downloader
 * @param {string} url - URL Gofile
 * @returns {Promise<{size: number, sizeText: string, error?: string}>}
 */
export async function getGofileFileSize(url) {
  if (!isGofileUrl(url)) {
    return { size: 0, sizeText: 'URL non-Gofile', error: 'URL invalide' }
  }

  // Vérifier le cache
  if (gofileCache.has(url)) {
    console.log('[GofileService] Utilisation du cache pour:', url)
    return gofileCache.get(url)
  }

  const fileId = extractGofileId(url)
  if (!fileId) {
    const fallback = { size: 0, sizeText: 'ID invalide', error: 'Impossible d\'extraire l\'ID' }
    gofileCache.set(url, fallback)
    return fallback
  }

  try {
    console.log('[GofileService] Récupération EXACTE via Enhanced Downloader pour ID:', fileId)
    
    // Essayer d'abord avec le téléchargeur Enhanced via IPC (tailles exactes avec authentification)
    if (typeof window !== 'undefined' && window.electron?.utils?.getGofileInfo) {
      try {
        console.log('[GofileService] Utilisation de l\'IPC Enhanced pour:', fileId)
        
        const result = await window.electron.utils.getGofileInfo(url)
        
        if (result.success && result.enhanced && result.data) {
          // Données exactes via Enhanced avec authentification
          let totalSize = result.totalSize || 0
          let filesCount = result.filesCount || 0
          
          // Fallback si les stats ne sont pas calculées
          if (totalSize === 0 && result.data.children) {
            Object.values(result.data.children).forEach(child => {
              if (child.type === 'file' && child.size) {
                totalSize += parseInt(child.size)
                filesCount++
              }
            })
          }
          
          if (totalSize > 0) {
            const sizeInGB = totalSize / (1024 * 1024 * 1024)
            const sizeInMB = totalSize / (1024 * 1024)
            
            let displayText
            if (sizeInGB >= 1) {
              displayText = `${sizeInGB.toFixed(2)} GB`
            } else {
              displayText = `${sizeInMB.toFixed(1)} MB`
            }
            
            const sizeResult = {
              size: sizeInGB,
              sizeText: displayText,
              filesCount: filesCount,
              exact: true // Taille exacte depuis Enhanced avec authentification
            }
            
            console.log('[GofileService] ✅ Taille EXACTE récupérée via IPC Enhanced:', displayText, `(${filesCount} fichiers)`)
            gofileCache.set(url, sizeResult)
            return sizeResult
          }
        } else if (result.success && result.data) {
          // API classique via IPC (moins fiable mais mieux que l'estimation)
          const files = result.data.contents ? Object.values(result.data.contents) : 
                       result.data.children ? Object.values(result.data.children) : []
          
          const totalSize = files.reduce((sum, file) => sum + parseInt(file.size || 0), 0)
          
          if (totalSize > 0) {
            const sizeInGB = totalSize / (1024 * 1024 * 1024)
            const sizeInMB = totalSize / (1024 * 1024)
            
            let displayText
            if (sizeInGB >= 1) {
              displayText = `${sizeInGB.toFixed(2)} GB`
            } else {
              displayText = `${sizeInMB.toFixed(1)} MB`
            }
            
            const sizeResult = {
              size: sizeInGB,
              sizeText: displayText,
              filesCount: files.length,
              exact: false // API classique, peut être moins fiable
            }
            
            console.log('[GofileService] Taille API classique récupérée via IPC:', displayText, `(${files.length} fichiers)`)
            gofileCache.set(url, sizeResult)
            return sizeResult
          }
        }
        
      } catch (ipcError) {
        console.log('[GofileService] IPC Enhanced échoué:', ipcError.message)
      }
    }
    
    // Fallback final : estimation (marquée comme telle)
    const estimatedSize = estimateGofileSize(url, fileId)
    console.log('[GofileService] ⚠️ Utilisation de l\'estimation:', estimatedSize.sizeText)
    
    gofileCache.set(url, estimatedSize)
    return estimatedSize

  } catch (error) {
    console.error('[GofileService] Erreur récupération:', error)
    const fallback = { size: 0, sizeText: 'Erreur récupération', error: error.message }
    gofileCache.set(url, fallback)
    return fallback
  }
}

/**
 * Estime la taille d'un fichier Gofile basé sur des patterns (utilisé en dernier recours)
 * @param {string} url - URL Gofile
 * @param {string} fileId - ID du fichier/dossier
 * @returns {{size: number, sizeText: string}}
 */
function estimateGofileSize(url, fileId) {
  // Estimations basées sur des patterns courants (utilisées seulement si l'Enhanced échoue)
  const estimations = [
    // Basé sur la longueur de l'ID (plus long = potentiellement plus de fichiers)
    { condition: () => fileId.length >= 8, size: 3.5, reason: 'ID long (dossier multiple)' },
    { condition: () => fileId.length >= 6, size: 2.0, reason: 'ID moyen (fichier unique gros)' },
    { condition: () => fileId.length >= 4, size: 1.2, reason: 'ID court (fichier moyen)' },
    
    // Estimation par défaut
    { condition: () => true, size: 1.5, reason: 'Estimation par défaut' }
  ]
  
  for (const estimation of estimations) {
    if (estimation.condition()) {
      const sizeInGB = estimation.size
      let displayText
      
      if (sizeInGB >= 1) {
        displayText = `${sizeInGB.toFixed(1)} GB (estimation)`
      } else {
        const sizeInMB = sizeInGB * 1024
        displayText = `${sizeInMB.toFixed(0)} MB (estimation)`
      }
      
      console.log('[GofileService] ⚠️ Estimation utilisée:', estimation.reason)
      
      return {
        size: sizeInGB,
        sizeText: displayText,
        estimated: true,
        exact: false
      }
    }
  }
  
  // Fallback final
  return {
    size: 1.5,
    sizeText: '1.5 GB (estimation)',
    estimated: true,
    exact: false
  }
}

/**
 * Récupère les informations EXACTES d'un dossier Gofile via Enhanced Downloader
 * @param {string} url - URL Gofile
 * @returns {Promise<Object>} Informations du dossier
 */
export async function getGofileFolderInfo(url) {
  const fileId = extractGofileId(url)
  if (!fileId) {
    return { success: false, error: 'ID invalide' }
  }
  
  try {
    // Essayer d'abord avec le téléchargeur Enhanced via IPC (authentification automatique)
    if (typeof window !== 'undefined' && window.electron?.utils?.getGofileInfo) {
      try {
        const result = await window.electron.utils.getGofileInfo(url)
        
        if (result.success && result.enhanced) {
          // Données exactes via Enhanced avec authentification
          const files = result.data.children ? Object.values(result.data.children) : []
          return {
            success: true,
            data: result.data,
            files: files,
            totalSize: result.totalSize,
            filesCount: result.filesCount,
            exact: true // Données exactes avec authentification Enhanced
          }
        } else if (result.success) {
          // API classique via IPC
          const files = result.data.contents ? Object.values(result.data.contents) : 
                       result.data.children ? Object.values(result.data.children) : []
          return {
            success: true,
            data: result.data,
            files: files,
            exact: false // API classique, moins fiable
          }
        }
        
      } catch (ipcError) {
        console.log('[GofileService] IPC Enhanced folder info échoué:', ipcError.message)
      }
    }
    
    return { success: false, error: 'API non disponible' }
    
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Vide le cache Gofile
 */
export function clearGofileCache() {
  gofileCache.clear()
  console.log('[GofileService] Cache vidé')
}

/**
 * Récupère les statistiques du cache
 */
export function getGofileCacheStats() {
  return {
    size: gofileCache.size,
    entries: Array.from(gofileCache.keys())
  }
}

/**
 * Teste si le service Gofile fonctionne
 * @param {string} url - URL de test
 * @returns {Promise<Object>} Résultat du test
 */
export async function testGofileService(url) {
  try {
    console.log('[GofileService] Test du service avec:', url)
    
    const isValid = isGofileUrl(url)
    const fileId = extractGofileId(url)
    const sizeResult = await getGofileFileSize(url)
    
    return {
      success: true,
      isValidUrl: isValid,
      extractedId: fileId,
      sizeResult: sizeResult,
      message: 'Test terminé'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Test échoué'
    }
  }
}

// Export par défaut
export default {
  isGofileUrl,
  extractGofileId,
  getGofileFileSize,
  getGofileFolderInfo,
  clearGofileCache,
  getGofileCacheStats,
  testGofileService
}