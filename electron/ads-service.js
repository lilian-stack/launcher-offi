// Service pour gérer les publicités et leur validation
import https from 'node:https'
import http from 'node:http'
import { promisify } from 'node:util'

// Configuration des URLs (à adapter selon vos besoins)
const ADS_URL = process.env.ADS_URL || 'https://tonsite.com/pub'
const ADS_VALIDATION_API = process.env.ADS_VALIDATION_API || 'https://tonsite.com/api/ads-status'
// URL de redirection vers le site Vercel (ou local pour développement)
const REDIRECT_URL = process.env.REDIRECT_URL || 'https://actoris-qneqonl9k-boyka47348-glitchs-projects.vercel.app'

/**
 * Vérifier si l'utilisateur doit voir une publicité
 * @param {object} userStatus - Statut de l'utilisateur { isVip: boolean, isBoost: boolean }
 * @returns {boolean} true si l'utilisateur doit voir une pub
 */
export function shouldShowAds(userStatus) {
  // VIP et Boost ne voient pas de pub
  if (userStatus?.isVip || userStatus?.isBoost) {
    return false
  }
  // Les membres gratuits voient des pubs
  return true
}

/**
 * Vérifier si la publicité a été validée (via API)
 * @param {string} userId - ID de l'utilisateur (optionnel, pour tracking)
 * @returns {Promise<boolean>} true si la pub est validée
 */
export async function checkAdsValidation(userId = null) {
  try {
    const url = new URL(ADS_VALIDATION_API)
    if (userId) {
      url.searchParams.append('userId', userId)
    }
    
    const response = await makeRequest('GET', url.toString())
    
    // La réponse doit contenir { completed: true } pour être valide
    return response?.completed === true || response?.validated === true
  } catch (err) {
    console.error('[AdsService] Erreur lors de la vérification de validation:', err)
    return false
  }
}

/**
 * Obtenir l'URL de la publicité
 * @param {string} gameName - Nom du jeu (optionnel, pour tracking)
 * @returns {string} URL de la publicité
 */
export function getAdsUrl(gameName = null) {
  const url = new URL(ADS_URL)
  if (gameName) {
    url.searchParams.append('game', encodeURIComponent(gameName))
  }
  return url.toString()
}

/**
 * Obtenir l'URL de redirection après validation
 * @param {string} gameName - Nom du jeu
 * @param {string} exePath - Chemin de l'exécutable (optionnel)
 * @param {string} gameId - ID du jeu (optionnel)
 * @returns {string} URL de redirection (utilise le protocole actoris:// pour ouvrir le launcher)
 */
export function getRedirectUrl(gameName, exePath = null, gameId = null) {
  // 🎯 PRIORITÉ : Utiliser le protocole personnalisé actoris:// directement
  // Cela garantit que le launcher s'ouvre correctement avec les bons paramètres
  let protocolUrl = `actoris://launch?game=${encodeURIComponent(gameName)}`
  if (gameId) {
    protocolUrl += `&gameId=${encodeURIComponent(gameId)}`
  }
  
  // Si REDIRECT_URL est un fichier local, construire l'URL avec les paramètres
  if (REDIRECT_URL.startsWith('file://')) {
    const url = new URL(REDIRECT_URL)
    url.searchParams.append('game', encodeURIComponent(gameName))
    if (gameId) {
      url.searchParams.append('gameId', encodeURIComponent(gameId))
    }
    if (exePath) {
      url.searchParams.append('exePath', encodeURIComponent(exePath))
    }
    return url.toString()
  } else if (REDIRECT_URL.startsWith('http://') || REDIRECT_URL.startsWith('https://')) {
    // Pour les URLs HTTP/HTTPS (comme Vercel), construire l'URL avec les paramètres
    // Le site web utilisera ensuite le protocole actoris://
    const url = new URL(REDIRECT_URL.endsWith('/') ? REDIRECT_URL : REDIRECT_URL + '/')
    url.searchParams.append('game', encodeURIComponent(gameName))
    if (gameId) {
      url.searchParams.append('gameId', encodeURIComponent(gameId))
    }
    if (exePath) {
      url.searchParams.append('exePath', encodeURIComponent(exePath))
    }
    return url.toString()
  } else {
    // Pour les autres cas, utiliser le protocole personnalisé actoris:// directement
    return protocolUrl
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
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    }
    
    if (method === 'POST' && Object.keys(data).length > 0) {
      const dataString = JSON.stringify(data)
      options.headers['Content-Length'] = Buffer.byteLength(dataString)
    }
    
    const req = (isHttps ? https : http).request(options, (res) => {
      let responseData = ''
      
      res.on('data', (chunk) => {
        responseData += chunk
      })
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(responseData))
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`))
          }
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${responseData}`))
        }
      })
    })
    
    req.on('error', (e) => {
      reject(e)
    })
    
    if (method === 'POST' && Object.keys(data).length > 0) {
      req.write(JSON.stringify(data))
    }
    
    req.end()
  })
}

