// Service pour générer des tokens via l'API Vercel
import https from 'node:https'
import http from 'node:http'

const VERCEL_API_URL = process.env.VERCEL_API_URL || 'https://vercel-deploy-cv8wkd51t-boyka47348-glitchs-projects.vercel.app/api/redirect'

/**
 * Générer un token de redirection via l'API Vercel
 * @param {string} gameId - ID du jeu
 * @param {string} gameName - Nom du jeu
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {Promise<{success: boolean, redirectUrl?: string, token?: string, error?: string}>}
 */
export async function generateRedirectToken(gameId, gameName, userId = null) {
  try {
    
    const data = {
      gameId: gameId.toString(),
      gameName: gameName,
      userId: userId || null
    }
    
    
    const response = await makeRequest('POST', `${VERCEL_API_URL}/generate-token`, data)
    
    
    if (response && response.success && response.redirectUrl) {
      return {
        success: true,
        redirectUrl: response.redirectUrl,
        token: response.token
      }
    } else {
      console.error('[VercelTokenService] ❌ Échec de la génération du token')
      console.error('[VercelTokenService] ❌ Message d\'erreur:', response?.error || 'Erreur inconnue')
      return {
        success: false,
        error: response?.error || 'Erreur inconnue lors de la génération du token'
      }
    }
  } catch (err) {
    console.error('[VercelTokenService] ============================================')
    console.error('[VercelTokenService] ❌ ERREUR CRITIQUE LORS DE LA GÉNÉRATION')
    console.error('[VercelTokenService] ============================================')
    console.error('[VercelTokenService] ❌ Message:', err.message)
    console.error('[VercelTokenService] ❌ Stack trace:', err.stack)
    console.error('[VercelTokenService] ============================================')
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

    const headers = {
      'Content-Type': 'application/json'
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
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
          } else {
            console.error('[VercelTokenService] ❌ Code HTTP d\'erreur:', res.statusCode)
            reject(new Error(`HTTP ${res.statusCode}: ${parsed?.error || parsed?.message || responseData}`))
          }
        } catch (e) {
          console.error('[VercelTokenService] ❌ Erreur de parsing JSON:', e.message)
          console.error('[VercelTokenService] ❌ Données reçues:', responseData)
          reject(new Error(`Failed to parse JSON response: ${responseData}`))
        }
      })
    })

    req.on('error', (e) => {
      console.error('[VercelTokenService] ❌ Erreur de requête HTTP:', e.message)
      reject(e)
    })

    if (method === 'POST' && Object.keys(data).length > 0) {
      req.write(dataString)
    }
    req.end()
  })
}

