// Service pour gérer les liens Lockr (publicités pour utilisateurs gratuits)
import https from 'node:https'
import http from 'node:http'

const LOCKR_API_URL = 'https://lockr.so/api/v1/lockers'
const LOCKR_SECRET_KEY = process.env.LOCKR_SECRET_KEY || '8d800f0650a9b6aa2091704ee884d8bbe45387e64b0d57cbcf6fee3da' // Clé API Lockr

/**
 * Créer un casier Lockr (lien avec publicité)
 * @param {string} targetUrl - URL de destination
 * @param {string} title - Titre du casier
 * @returns {Promise<{success: boolean, lockerUrl?: string, error?: string}>}
 */
export async function createLocker(targetUrl, title = 'Téléchargement') {
  try {
    
    const data = {
      title: title,
      target: targetUrl
    }

    
    const response = await makeRequest('POST', LOCKR_API_URL, data)
    
    
    // L'API Lockr retourne l'URL dans response.data.url
    const lockerUrl = response?.data?.url || response?.url
    
    if (response && lockerUrl) {
      return {
        success: true,
        lockerUrl: lockerUrl
      }
    } else {
      console.error('[LockrService] ❌ Échec de la création du casier')
      console.error('[LockrService] ❌ Message d\'erreur:', response?.message || response?.data?.message || 'Erreur inconnue')
      console.error('[LockrService] ❌ Réponse complète:', response)
      return {
        success: false,
        error: response?.message || response?.data?.message || 'Erreur inconnue lors de la création du casier Lockr'
      }
    }
  } catch (err) {
    console.error('[LockrService] ============================================')
    console.error('[LockrService] ❌ ERREUR CRITIQUE LORS DE LA CRÉATION')
    console.error('[LockrService] ============================================')
    console.error('[LockrService] ❌ Message:', err.message)
    console.error('[LockrService] ❌ Stack trace:', err.stack)
    console.error('[LockrService] ============================================')
    return { success: false, error: err.message }
  }
}

/**
 * Mettre à jour un casier Lockr existant
 * @param {string} lockerId - ID du casier (extrait de l'URL, ex: "UVb8bjEm2")
 * @param {string} targetUrl - Nouvelle URL de destination
 * @param {string} title - Nouveau titre du casier
 * @returns {Promise<{success: boolean, lockerUrl?: string, error?: string}>}
 */
export async function updateLocker(lockerId, targetUrl, title = 'Téléchargement') {
  try {
    
    const updateUrl = `${LOCKR_API_URL}/${lockerId}`
    const data = {
      title: title,
      target: targetUrl
    }

    
    const response = await makeRequest('PATCH', updateUrl, data)
    
    
    // L'API Lockr retourne l'URL dans response.data.url, sinon construire à partir de l'ID
    const lockerUrl = response?.data?.url || (response?.data?.id ? `https://lockr.so/${response.data.id}` : null) || response?.url
    
    if (response && response.data && (lockerUrl || response.data.id)) {
      const finalLockerUrl = lockerUrl || `https://lockr.so/${response.data.id}`
      return {
        success: true,
        lockerUrl: finalLockerUrl
      }
    } else {
      console.error('[LockrService] ❌ Échec de la mise à jour du casier')
      console.error('[LockrService] ❌ Message d\'erreur:', response?.message || response?.data?.message || 'Erreur inconnue')
      console.error('[LockrService] ❌ Réponse complète:', response)
      return {
        success: false,
        error: response?.message || response?.data?.message || 'Erreur inconnue lors de la mise à jour du casier Lockr'
      }
    }
  } catch (err) {
    console.error('[LockrService] ============================================')
    console.error('[LockrService] ❌ ERREUR CRITIQUE LORS DE LA MISE À JOUR')
    console.error('[LockrService] ============================================')
    console.error('[LockrService] ❌ Message:', err.message)
    console.error('[LockrService] ❌ Stack trace:', err.stack)
    console.error('[LockrService] ============================================')
    return { success: false, error: err.message }
  }
}

/**
 * Récupérer les informations d'un casier Lockr
 * @param {string} lockerId - ID du casier (ex: "UVb8bjEm2")
 * @returns {Promise<{success: boolean, title?: string, target?: string, error?: string}>}
 */
export async function getLockerInfo(lockerId) {
  try {
    
    const getUrl = `${LOCKR_API_URL}/${lockerId}`

    
    const response = await makeRequest('GET', getUrl, {})
    
    
    // L'API Lockr retourne les infos dans response.data
    const lockerData = response?.data || response
    
    if (response && lockerData) {
      const title = lockerData.title
      const target = lockerData.target
      
      return {
        success: true,
        title: title,
        target: target
      }
    } else {
      console.error('[LockrService] ❌ Échec de la récupération des infos')
      console.error('[LockrService] ❌ Message d\'erreur:', response?.message || response?.data?.message || 'Erreur inconnue')
      console.error('[LockrService] ❌ Réponse complète:', response)
      return {
        success: false,
        error: response?.message || response?.data?.message || 'Erreur inconnue lors de la récupération des infos du casier Lockr'
      }
    }
  } catch (err) {
    console.error('[LockrService] ============================================')
    console.error('[LockrService] ❌ ERREUR CRITIQUE LORS DE LA RÉCUPÉRATION')
    console.error('[LockrService] ============================================')
    console.error('[LockrService] ❌ Message:', err.message)
    console.error('[LockrService] ❌ Stack trace:', err.stack)
    console.error('[LockrService] ============================================')
    return { success: false, error: err.message }
  }
}

/**
 * Extraire l'ID du casier depuis une URL Lockr
 * @param {string} lockerUrl - URL complète du casier (ex: "https://lockr.net/UVb8bjEm2")
 * @returns {string|null} - ID du casier ou null si l'URL est invalide
 */
export function extractLockerId(lockerUrl) {
  if (!lockerUrl || typeof lockerUrl !== 'string') {
    return null
  }
  
  try {
    // Extraire l'ID depuis l'URL (partie après le dernier /)
    const match = lockerUrl.match(/lockr\.(?:so|net)\/([^\/\?]+)/i)
    if (match && match[1]) {
      return match[1]
    }
    
    // Fallback: extraire la partie après le dernier /
    const parts = lockerUrl.split('/')
    const lastPart = parts[parts.length - 1]
    if (lastPart && lastPart.length > 0) {
      // Enlever les paramètres de requête si présents
      return lastPart.split('?')[0]
    }
    
    return null
  } catch (err) {
    console.error('[LockrService] Erreur lors de l\'extraction de l\'ID:', err)
    return null
  }
}

/**
 * Fonction utilitaire pour faire des requêtes HTTP
 * @param {'GET'|'POST'|'PATCH'} method
 * @param {string} url
 * @param {object} data
 * @returns {Promise<object>}
 */
function makeRequest(method, url, data = {}) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(data)
    const urlObj = new URL(url)

    const headers = {
      'Authorization': `Bearer ${LOCKR_SECRET_KEY}`
    }
    
    // Pour GET, ne pas envoyer de body
    if (method !== 'GET' && Object.keys(data).length > 0) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(dataString)
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers
    }


    const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
      
      let responseData = ''
      res.on('data', (chunk) => {
        responseData += chunk
      })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData)
          
          // Vérifier le code de statut HTTP
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
          } else {
            console.error('[LockrService] ❌ Code HTTP d\'erreur:', res.statusCode)
            reject(new Error(`HTTP ${res.statusCode}: ${parsed?.message || responseData}`))
          }
        } catch (e) {
          console.error('[LockrService] ❌ Erreur de parsing JSON:', e.message)
          console.error('[LockrService] ❌ Données reçues:', responseData)
          reject(new Error(`Failed to parse JSON response: ${responseData}`))
        }
      })
    })

    req.on('error', (e) => {
      console.error('[LockrService] ❌ Erreur de requête HTTP:', e.message)
      console.error('[LockrService] ❌ Stack trace:', e.stack)
      reject(e)
    })

    // Pour GET, ne pas envoyer de body
    if (method !== 'GET' && Object.keys(data).length > 0) {
      req.write(dataString)
    }
    req.end()
  })
}
