// Service pour gérer les publicités et leur validation
import https from 'node:https'
import http from 'node:http'
import { promisify } from 'node:util'
import { getRedirectUrl as getVercelRedirectUrlBase } from './vercel-config.js'

// Configuration des URLs (à adapter selon vos besoins)
const ADS_URL = process.env.ADS_URL || 'https://tonsite.com/pub'
const ADS_VALIDATION_API = process.env.ADS_VALIDATION_API || 'https://tonsite.com/api/ads-status'

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
 * Obtenir l'URL de redirection après validation (avec token généré via API Vercel)
 * @param {string} gameName - Nom du jeu
 * @param {string} exePath - Chemin de l'exécutable (optionnel)
 * @param {string} gameId - ID du jeu (requis)
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {Promise<string>} URL de redirection avec token sécurisé
 */
export async function getRedirectUrl(gameName, exePath = null, gameId = null, userId = null) {
  if (!gameId) {
    console.error('[AdsService] ❌ gameId est requis pour générer un token')
    // Fallback vers l'ancienne méthode si pas de gameId
    return getVercelRedirectUrlBase(gameName, gameId)
  }
  
  try {
    // Générer un token via l'API Vercel pour un lien sécurisé et unique
    const { generateRedirectToken } = await import('./vercel-token-service.js')
    const tokenResult = await generateRedirectToken(gameId, gameName, userId)
    
    if (tokenResult.success && tokenResult.redirectUrl) {
      return tokenResult.redirectUrl
    } else {
      console.error('[AdsService] ❌ Échec de la génération du token:', tokenResult.error)
      // Fallback vers l'ancienne méthode
      return getVercelRedirectUrlBase(gameName, gameId)
    }
  } catch (err) {
    console.error('[AdsService] ❌ Erreur lors de la génération du token:', err)
    // Fallback vers l'ancienne méthode
    return getVercelRedirectUrlBase(gameName, gameId)
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

