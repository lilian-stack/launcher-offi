/**
 * Service Discord sécurisé - Client uniquement
 * Communique avec le serveur backend pour l'authentification
 * AUCUN secret stocké ici
 */

import axios from 'axios'

// URL de l'API backend (configurée depuis main.js)
// Forcer IPv4 pour éviter les problèmes IPv6 vs IPv4 (::1 vs 127.0.0.1)
let API_URL = 'http://127.0.0.1:3001'

/**
 * Initialiser l'URL de l'API
 */
export function setApiUrl(url) {
  API_URL = url
}

/**
 * Obtenir l'URL d'autorisation Discord depuis le serveur
 * Fallback: génère l'URL directement si le serveur n'est pas disponible
 */
export async function getDiscordAuthUrl(redirectUri = null) {
  try {
    const url = `${API_URL}/api/discord/auth-url`
    
    // Nettoyer et valider le redirect_uri avant de l'envoyer
    let cleanRedirectUri = redirectUri
    if (cleanRedirectUri) {
      // Décoder s'il est déjà encodé
      try {
        const decoded = decodeURIComponent(cleanRedirectUri)
        if (decoded !== cleanRedirectUri && decoded.match(/^https?:\/\//)) {
          cleanRedirectUri = decoded
        }
      } catch (e) {
        // Si le décodage échoue, utiliser la valeur originale
      }
      
      // Vérifier que le redirect_uri commence par http:// ou https://
      cleanRedirectUri = String(cleanRedirectUri).trim()
      if (!cleanRedirectUri.match(/^https?:\/\//)) {
        // Si le redirect_uri ne commence pas par http:// ou https://, essayer de le corriger
        if (cleanRedirectUri.startsWith('//')) {
          cleanRedirectUri = 'http:' + cleanRedirectUri
        } else if (cleanRedirectUri.startsWith('localhost') || cleanRedirectUri.startsWith('127.0.0.1')) {
          cleanRedirectUri = 'http://' + cleanRedirectUri
        } else {
          // Utiliser null pour que le serveur utilise la valeur par défaut
          cleanRedirectUri = null
        }
      }
    }
    
    const response = await axios.get(url, {
      params: cleanRedirectUri ? { redirect_uri: cleanRedirectUri } : {},
      timeout: 3000
    })
    
    const authUrl = response.data?.url || response.data
    
    // Vérifier que l'URL est valide
    if (!authUrl || authUrl === 'undefined' || authUrl === 'null' || typeof authUrl !== 'string') {
      throw new Error('URL invalide reçue du serveur backend')
    }
    
    // Vérifier que l'URL contient un client_id valide
    if (authUrl.includes('client_id=undefined') || authUrl.includes('client_id=null')) {
      throw new Error('L\'URL du serveur contient client_id=undefined')
    }
    
    return authUrl
  } catch (error) {
    // Si le serveur n'est pas disponible, générer l'URL directement (fallback)
    try {
      const HARDCODED_CLIENT_ID = '1398485031189483642'
      // IMPORTANT : Utiliser EXACTEMENT le même redirect_uri que le backend
      let finalRedirectUri = redirectUri || 'http://localhost:5173/auth/callback'
      
      try {
        const { DISCORD_CONFIG } = await import('./discord-config.mjs')
        if (DISCORD_CONFIG?.REDIRECT_URI && DISCORD_CONFIG.REDIRECT_URI !== 'undefined') {
          finalRedirectUri = redirectUri || DISCORD_CONFIG.REDIRECT_URI || 'http://localhost:5173/auth/callback'
        }
      } catch (err) {
        // Utiliser les valeurs par défaut
      }
      
      // Décoder le redirect_uri s'il est déjà encodé
      if (typeof finalRedirectUri === 'string') {
        try {
          const decoded = decodeURIComponent(finalRedirectUri)
          if (decoded !== finalRedirectUri && decoded.match(/^https?:\/\//)) {
            finalRedirectUri = decoded
          }
        } catch (e) {
          // Si le décodage échoue, utiliser la valeur originale
        }
      }
      
      // Nettoyer et valider le redirect_uri
      finalRedirectUri = String(finalRedirectUri).trim().replace(/\/$/, '')
      
      // Vérifier que le redirect_uri commence par http:// ou https://
      if (!finalRedirectUri.match(/^https?:\/\//)) {
        // Si le redirect_uri ne commence pas par http:// ou https://, essayer de le corriger
        if (finalRedirectUri.startsWith('//')) {
          finalRedirectUri = 'http:' + finalRedirectUri
        } else if (finalRedirectUri.startsWith('localhost') || finalRedirectUri.startsWith('127.0.0.1')) {
          finalRedirectUri = 'http://' + finalRedirectUri
        } else {
          // Utiliser la valeur par défaut si le format est invalide
          finalRedirectUri = 'http://localhost:5173/auth/callback'
        }
      }
      
      // Nettoyer les caractères invisibles
      finalRedirectUri = finalRedirectUri.replace(/[\u200B-\u200D\uFEFF]/g, '')
      
      // Vérification finale que le redirect_uri est valide
      if (!finalRedirectUri.match(/^https?:\/\/[^\s]+$/)) {
        throw new Error(`redirect_uri invalide: "${finalRedirectUri}"`)
      }
      
      // Scopes OAuth utilisateur valides (guilds.members.read nécessite bot scope)
      const scopes = ['identify', 'email', 'guilds']
      // Utiliser le redirect_uri tel quel (ne PAS ajouter /auth/callback)
      const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${HARDCODED_CLIENT_ID}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&integration_type=0&prompt=consent`
      
      // Vérification finale
      if (!authUrl.includes(`client_id=${HARDCODED_CLIENT_ID}`) || authUrl.includes('client_id=undefined') || authUrl.includes('client_id=null')) {
        throw new Error('Impossible de générer une URL valide avec un client_id')
      }
      
      return authUrl
    } catch (fallbackError) {
      throw new Error('Impossible d\'obtenir l\'URL d\'autorisation Discord. Vérifiez que le serveur backend est démarré ou que DISCORD_CLIENT_ID est configuré.')
    }
  }
}

/**
 * Échanger un code OAuth contre un token (via le serveur)
 */
export async function exchangeCodeForToken(code, redirectUri = null) {
  try {
    // IMPORTANT : Utiliser EXACTEMENT le même redirect_uri que l'autorisation
    const finalRedirectUri = (redirectUri || 'http://localhost:5173/auth/callback').replace(/\/$/, '')
    
    // Vérifier d'abord si le serveur backend est accessible
    let healthCheckSuccess = false
    const maxRetries = 10
    let retryCount = 0
    
    while (!healthCheckSuccess && retryCount < maxRetries) {
      try {
        await axios.get(`${API_URL}/health`, {
          timeout: 2000,
          baseURL: API_URL.replace('localhost', '127.0.0.1')
        })
        healthCheckSuccess = true
      } catch (healthErr) {
        retryCount++
        if (retryCount < maxRetries) {
          const waitTime = Math.min(1000 * retryCount, 2000)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        } else {
          throw new Error('Le serveur backend n\'est pas accessible. Vérifiez qu\'il est démarré sur le port 3001.')
        }
      }
    }
    
    const response = await axios.post(`${API_URL}/api/discord/exchange-code`, {
      code,
      redirectUri: finalRedirectUri
    }, {
      timeout: 15000
    })
    
    if (!response.data.tokenData) {
      throw new Error('tokenData manquant dans la réponse du serveur')
    }
    
    return response.data.tokenData
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Timeout: Le serveur backend ne répond pas. Vérifiez que le serveur est démarré.')
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Le serveur backend n\'est pas accessible. Vérifiez qu\'il est démarré sur le port 3001.')
    }
    
    // Préserver tous les détails de l'erreur du backend
    const errorData = error.response?.data || {}
    const errorMessage = errorData.error || 
                        errorData.error_description || 
                        error.message || 
                        'Erreur lors de l\'échange du code'
    
    // Créer une erreur enrichie avec tous les détails
    const enrichedError = new Error(errorMessage)
    enrichedError.errorCode = errorData.errorCode || (errorData.error ? errorData.error.toUpperCase() : undefined)
    enrichedError.message = errorData.message || errorData.error_description || errorMessage
    enrichedError.details = errorData.details
    enrichedError.response = error.response // Préserver la réponse complète
    
    throw enrichedError
  }
}

/**
 * Rafraîchir un token Discord via session (via le serveur)
 */
export async function refreshDiscordToken(sessionToken) {
  try {
    const response = await axios.post(`${API_URL}/api/discord/refresh-token`, {
      sessionToken
    })
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Erreur lors du rafraîchissement')
    }

    // Le serveur met à jour les tokens en interne
    // On retourne juste le token de session (qui reste le même)
    return {
      success: true,
      sessionToken: response.data.sessionToken || sessionToken
    }
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Erreur lors du rafraîchissement du token')
  }
}

/**
 * Récupérer les informations de session (via le serveur)
 */
export async function getSession(sessionToken) {
  try {
    const response = await axios.post(`${API_URL}/api/discord/session`, {
      sessionToken
    })
    return response.data
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erreur lors de la récupération de la session'
    }
  }
}

/**
 * Supprimer une session (déconnexion)
 */
export async function logout(sessionToken) {
  try {
    const response = await axios.post(`${API_URL}/api/discord/logout`, {
      sessionToken
    })
    return response.data
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || 'Erreur lors de la déconnexion'
    }
  }
}

/**
 * Authentifier un utilisateur via Discord OAuth2 (flux complet)
 * Retourne maintenant un token de session au lieu des tokens Discord
 */
export async function authenticateWithDiscord(code, redirectUri = null) {
  try {
    // 1. Échanger le code contre un token et créer une session (via le serveur)
    // IMPORTANT : Utiliser EXACTEMENT le même redirect_uri que l'autorisation
    const response = await axios.post(`${API_URL}/api/discord/exchange-code`, {
      code,
      redirectUri: redirectUri || 'http://localhost:5173/auth/callback'
    }, {
      timeout: 15000
    })
    
    if (!response.data.success) {
      // Préserver tous les détails de l'erreur du backend
      const errorData = response.data
      const error = new Error(errorData.error || 'Erreur lors de l\'authentification')
      error.errorCode = errorData.errorCode
      error.message = errorData.message || errorData.error_description || errorData.error
      error.details = errorData.details
      throw error
    }

    // 2. Le serveur retourne un token de session (non-sensible) et les données utilisateur
    // Les tokens Discord sont stockés côté serveur uniquement
    const { sessionToken, user } = response.data

    return {
      success: true,
      sessionToken, // Token non-sensible à stocker côté client
      user, // Données utilisateur (sans tokens Discord)
    }
  } catch (error) {
    // Préserver tous les détails de l'erreur pour le frontend
    const errorData = error.response?.data || {}
    return {
      success: false,
      error: errorData.error || error.message || 'Erreur lors de l\'authentification Discord',
      errorCode: errorData.errorCode || error.errorCode || (errorData.error ? errorData.error.toUpperCase() : undefined),
      message: errorData.message || error.message || errorData.error_description || errorData.error,
      details: errorData.details || error.details
    }
  }
}

/**
 * Synchroniser les rôles Discord (vérification périodique)
 * Met à jour les rôles de l'utilisateur sans nécessiter une nouvelle connexion
 */
export async function syncRoles(sessionToken) {
  try {
    const response = await axios.post(`${API_URL}/api/discord/sync-roles`, {
      sessionToken
    }, {
      timeout: 10000
    })
    
    if (!response.data.success) {
      return {
        success: false,
        error: response.data.error || 'Erreur lors de la synchronisation des rôles'
      }
    }

    return {
      success: true,
      user: response.data.user,
      rolesChanged: response.data.rolesChanged || false,
      oldRoles: response.data.oldRoles,
      newRoles: response.data.newRoles
    }
  } catch (error) {
    const errorData = error.response?.data || {}
    return {
      success: false,
      error: errorData.error || error.message || 'Erreur lors de la synchronisation des rôles'
    }
  }
}

