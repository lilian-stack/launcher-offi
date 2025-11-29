// Service pour gérer les liens Lockr (publicités pour utilisateurs gratuits)
import https from 'node:https'
import http from 'node:http'

const LOCKR_API_URL = 'https://lockr.so/api/v1/lockers'
const LOCKR_SECRET_KEY = process.env.LOCKR_SECRET_KEY || '8d800f0650a9b6aa2091704ee8' // À remplacer par votre clé API

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
    
    if (response && response.url) {
      return {
        success: true,
        lockerUrl: response.url
      }
    } else {
      return {
        success: false,
        error: response?.message || 'Erreur inconnue lors de la création du casier Lockr'
      }
    }
  } catch (err) {
    console.error('[LockrService] Erreur lors de la création du casier Lockr:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Fonction utilitaire pour faire des requêtes HTTP
 * @param {'GET'|'POST'} method
 * @param {string} url
 * @param {object} data
 * @returns {Promise<object>}
 */
function makeRequest(method, url, data = {}) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(data)
    const urlObj = new URL(url)

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
        'Authorization': `Bearer ${LOCKR_SECRET_KEY}`
      }
    }

    const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
      let responseData = ''
      res.on('data', (chunk) => {
        responseData += chunk
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData))
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${responseData}`))
        }
      })
    })

    req.on('error', (e) => {
      reject(e)
    })

    req.write(dataString)
    req.end()
  })
}
