/**
 * Service de cache d'images avec compression WebP
 * Stocke les images sur le disque et les convertit en WebP pour économiser de l'espace
 */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'
import crypto from 'node:crypto'
import { app } from 'electron'

// Lazy load sharp pour éviter de charger le module si pas nécessaire
let sharp = null
async function getSharp() {
  if (!sharp) {
    try {
      sharp = (await import('sharp')).default
    } catch (err) {
      console.warn('[ImageCache] Sharp non disponible, compression WebP désactivée:', err.message)
      return null
    }
  }
  return sharp
}

const CACHE_DIR_NAME = 'cache/images'
const MAX_CACHE_SIZE = 600 // Nombre maximum d'images en cache
const MAX_AGE_DAYS = 30 // Âge maximum en jours
const WEBP_QUALITY = 80 // Qualité WebP (0-100)

/**
 * Obtenir le chemin du dossier de cache
 */
function getCacheDir() {
  return path.join(app.getPath('userData'), CACHE_DIR_NAME)
}

/**
 * S'assurer que le dossier de cache existe
 */
function ensureCacheDir() {
  const cacheDir = getCacheDir()
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
  return cacheDir
}

/**
 * Générer un nom de fichier unique à partir de l'URL
 */
function getCacheFilePath(url, extension = 'webp') {
  ensureCacheDir()
  const hash = crypto.createHash('md5').update(url).digest('hex')
  return path.join(getCacheDir(), `${hash}.${extension}`)
}

/**
 * Vérifier si une image est en cache
 */
export function isImageCached(url) {
  try {
    const webpPath = getCacheFilePath(url, 'webp')
    const pngPath = getCacheFilePath(url, 'png')
    const jpgPath = getCacheFilePath(url, 'jpg')
    
    // Vérifier si le fichier WebP existe
    if (fs.existsSync(webpPath)) {
      const stats = fs.statSync(webpPath)
      const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)
      return ageDays < MAX_AGE_DAYS
    }
    
    // Vérifier les anciens formats (PNG, JPG) pour compatibilité
    if (fs.existsSync(pngPath) || fs.existsSync(jpgPath)) {
      return true
    }
    
    return false
  } catch (err) {
    console.error('[ImageCache] Erreur isImageCached:', err)
    return false
  }
}

/**
 * Obtenir le chemin de l'image en cache
 */
export function getCachedImagePath(url) {
  try {
    const webpPath = getCacheFilePath(url, 'webp')
    if (fs.existsSync(webpPath)) {
      return webpPath
    }
    
    // Fallback vers les anciens formats
    const pngPath = getCacheFilePath(url, 'png')
    const jpgPath = getCacheFilePath(url, 'jpg')
    
    if (fs.existsSync(pngPath)) return pngPath
    if (fs.existsSync(jpgPath)) return jpgPath
    
    return null
  } catch (err) {
    console.error('[ImageCache] Erreur getCachedImagePath:', err)
    return null
  }
}

/**
 * Télécharger une image depuis une URL
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const httpModule = isHttps ? https : http
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }
    
    const req = httpModule.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    })
    
    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
    req.end()
  })
}

/**
 * Compresser une image en WebP
 */
async function compressToWebP(imageBuffer, outputPath) {
  try {
    const sharpInstance = await getSharp()
    if (!sharpInstance) {
      // Si sharp n'est pas disponible, sauvegarder l'image originale
      fs.writeFileSync(outputPath, imageBuffer)
      return false
    }
    
    await sharpInstance(imageBuffer)
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(outputPath)
    
    return true
  } catch (err) {
    console.error('[ImageCache] Erreur compression WebP:', err)
    // Fallback: sauvegarder l'image originale
    try {
      fs.writeFileSync(outputPath, imageBuffer)
    } catch (writeErr) {
      console.error('[ImageCache] Erreur sauvegarde fallback:', writeErr)
    }
    return false
  }
}

/**
 * Mettre en cache une image
 */
export async function cacheImage(url) {
  try {
    // Vérifier si déjà en cache
    if (isImageCached(url)) {
      return getCachedImagePath(url)
    }
    
    // Télécharger l'image
    const imageBuffer = await downloadImage(url)
    
    // Déterminer le chemin de sortie (toujours WebP)
    const outputPath = getCacheFilePath(url, 'webp')
    
    // Compresser en WebP
    await compressToWebP(imageBuffer, outputPath)
    
    // Nettoyer le cache si nécessaire
    trimCache()
    
    return outputPath
  } catch (err) {
    console.error('[ImageCache] Erreur cacheImage:', err)
    return null
  }
}

/**
 * Précharger une image en arrière-plan
 */
export async function preloadImage(url) {
  try {
    if (isImageCached(url)) {
      return getCachedImagePath(url)
    }
    
    // Télécharger et compresser en arrière-plan
    cacheImage(url).catch(err => {
      console.warn('[ImageCache] Erreur préchargement:', err.message)
    })
    
    return null
  } catch (err) {
    console.error('[ImageCache] Erreur preloadImage:', err)
    return null
  }
}

/**
 * Nettoyer le cache (supprimer les anciennes images)
 */
function trimCache() {
  try {
    const cacheDir = getCacheDir()
    if (!fs.existsSync(cacheDir)) return
    
    const files = fs.readdirSync(cacheDir)
    const now = Date.now()
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    
    // Supprimer les fichiers trop anciens
    let deletedCount = 0
    for (const file of files) {
      const filePath = path.join(cacheDir, file)
      try {
        const stats = fs.statSync(filePath)
        const age = now - stats.mtime.getTime()
        if (age > maxAge) {
          fs.unlinkSync(filePath)
          deletedCount++
        }
      } catch (err) {
        // Ignorer les erreurs
      }
    }
    
    // Si on a encore trop de fichiers, supprimer les plus anciens
    if (files.length - deletedCount > MAX_CACHE_SIZE) {
      const remainingFiles = fs.readdirSync(cacheDir)
        .map(file => ({
          name: file,
          path: path.join(cacheDir, file),
          mtime: fs.statSync(path.join(cacheDir, file)).mtime.getTime()
        }))
        .sort((a, b) => a.mtime - b.mtime)
      
      const toDelete = remainingFiles.slice(0, remainingFiles.length - MAX_CACHE_SIZE)
      toDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path)
        } catch (err) {
          // Ignorer les erreurs
        }
      })
    }
  } catch (err) {
    console.error('[ImageCache] Erreur trimCache:', err)
  }
}

/**
 * Vider le cache
 */
export function clearCache() {
  try {
    const cacheDir = getCacheDir()
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir)
      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(cacheDir, file))
        } catch (err) {
          // Ignorer les erreurs
        }
      })
    }
  } catch (err) {
    console.error('[ImageCache] Erreur clearCache:', err)
  }
}

// Initialiser le nettoyage automatique
ensureCacheDir()
setInterval(trimCache, 60 * 60 * 1000) // Nettoyer toutes les heures

