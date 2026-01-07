/**
 * Helpers pour les téléchargements
 */

const https = require('node:https')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { USER_AGENT } = require('./constants.js')

/**
 * Détecte le provider à partir de l'URL
 */
function detectProvider(url) {
  if (url.includes('pixeldrain.com')) return 'pixeldrain'
  if (url.includes('buzzheavier.com')) return 'buzzheavier'
  if (url.includes('gofile.io')) return 'gofile'
  if (url.includes('vikingfile.site') || url.includes('vik1ngfile.site')) return 'vikingfile'
  if (url.includes('megadb.net') || url.includes('megadb.org') || url.includes('megadb')) return 'megadb'
  if (url.includes('mega.nz') || url.includes('mega.io')) return 'mega'
  if (url.includes('koyso.to')) return 'koyso'
  if (url.includes('rootz.so')) return 'rootz'
  return 'unknown'
}

/**
 * Outil générique pour appeler une API JSON
 */
function fetchJSON(url) {
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
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    }

    const req = httpModule.get(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + e.message))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
  })
}

/**
 * Convertit une URL PixelDrain en lien de téléchargement direct
 */
async function convertPixelDrain(url) {
  // Extraire l'ID depuis l'URL (format: pixeldrain.com/u/ID ou pixeldrain.com/f/ID)
  const match = url.match(/pixeldrain\.com\/[uf]\/([A-Za-z0-9]+)/)
  if (match) {
    const id = match[1]
    // Utiliser l'API directe de PixelDrain
    const apiUrl = `https://pixeldrain.com/api/file/${id}?download`
    console.log('[PixelDrain] URL API directe:', apiUrl)
    return apiUrl
  }
  
  // Si c'est déjà une URL API, la retourner telle quelle
  const apiMatch = url.match(/pixeldrain\.com\/api\/file\/([A-Za-z0-9]+)/)
  if (apiMatch) {
    console.log('[PixelDrain] URL API déjà correcte:', url)
    return url
  }
  
  throw new Error('PixelDrain: URL invalide')
}

/**
 * Télécharge un fichier HTTP avec suivi des redirections
 */
function downloadWithRedirect(url, filePath, redirectCount = 0, onProgress = null) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      return reject(new Error('Trop de redirections'))
    }

    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const httpModule = isHttps ? https : http

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
      },
    }

    const request = httpModule.get(options, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const nextUrl = response.headers.location.startsWith('http')
          ? response.headers.location
          : new URL(response.headers.location, url).toString()
        return downloadWithRedirect(nextUrl, filePath, redirectCount + 1, onProgress)
          .then(resolve)
          .catch(reject)
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}`))
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      const file = fs.createWriteStream(filePath)
      let receivedBytes = 0

      response.on('data', (chunk) => {
        receivedBytes += chunk.length
        if (onProgress) {
          const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0
          onProgress(receivedBytes, totalBytes, progress)
        }
      })

      response.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', (err) => {
        try { fs.unlinkSync(filePath) } catch(e) {}
        reject(err)
      })
    })

    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('Timeout'))
    })
  })
}

/**
 * Télécharge un fichier HTTP directement (avec redirections et headers personnalisés)
 */
function downloadHttpToFileWithHeaders(url, outPath, customHeaders = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const client = parsed.protocol === 'https:' ? https : http
    
    // Fusionner headers par défaut avec headers personnalisés
    const defaultHeaders = { 'User-Agent': USER_AGENT }
    const headers = { ...defaultHeaders, ...customHeaders }
    
    console.log('[Download] Téléchargement avec headers personnalisés:', Object.keys(customHeaders))
    
    const req = client.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString()
        return downloadHttpToFileWithHeaders(next, outPath, customHeaders, onProgress).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      const stream = fs.createWriteStream(outPath)
      res.on('data', (chunk) => {
        received += chunk.length
        if (onProgress) onProgress(received, total)
      })
      res.pipe(stream)
      stream.on('finish', () => stream.close(resolve))
      stream.on('error', (err) => {
        try { fs.unlinkSync(outPath) } catch(e) {}
        reject(err)
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
  })
}

/**
 * Télécharge un fichier HTTP directement (avec redirections)
 */
function downloadHttpToFile(url, outPath, onProgress) {
  return downloadHttpToFileWithHeaders(url, outPath, {}, onProgress)
}

/**
 * Télécharge depuis PixelDrain via l'API avec bypass avancé
 */
async function downloadFromPixelDrainUrl(pageUrl, destinationFolder, onProgress) {
  const m = pageUrl.match(/pixeldrain\.com\/[uf]\/([A-Za-z0-9]+)/)
  if (!m) throw new Error('PixelDrain: invalid URL')
  const id = m[1]
  
  // Utiliser l'API directe avec headers bypass
  const apiUrl = `https://pixeldrain.com/api/file/${id}?download`
  console.log('[PixelDrain] Téléchargement avec bypass avancé:', apiUrl)
  
  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder, { recursive: true })
  }
  
  const outPath = path.join(destinationFolder, `${id}.zip`)
  
  // Headers basiques pour le téléchargement
  const bypassHeaders = {
    'User-Agent': USER_AGENT,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
  console.log('[PixelDrain] Utilisation headers bypass pour téléchargement')
  
  await downloadHttpToFileWithHeaders(apiUrl, outPath, bypassHeaders, onProgress)
  return outPath
}

module.exports = {
  detectProvider,
  fetchJSON,
  convertPixelDrain,
  downloadWithRedirect,
  downloadHttpToFile,
  downloadFromPixelDrainUrl
}
