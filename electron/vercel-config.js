/**
 * Configuration centralisée pour l'URL Vercel
 * Projet ID: prj_ijzOLxTRWNlP8IvIdLYOUlki79pp
 */

// URL de base Vercel - peut être modifiée via variable d'environnement
// URL de production Vercel
// Vérifier si process est disponible (pas disponible dans le renderer)
export const VERCEL_BASE_URL = (typeof process !== 'undefined' && process.env?.VERCEL_URL) || 'https://vercel-deploy-cv8wkd51t-boyka47348-glitchs-projects.vercel.app'

// URL de l'API Vercel pour générer les tokens
export const VERCEL_API_URL = (typeof process !== 'undefined' && process.env?.VERCEL_API_URL) || 'https://vercel-deploy-cv8wkd51t-boyka47348-glitchs-projects.vercel.app/api/redirect'

// URL de redirection complète avec le chemin redirect.html
export function getRedirectUrl(gameName, gameId = null, token = null, timestamp = null, userId = null) {
  const baseUrl = VERCEL_BASE_URL.endsWith('/') 
    ? VERCEL_BASE_URL.slice(0, -1) 
    : VERCEL_BASE_URL
  
  let url = `${baseUrl}/redirect.html?game=${encodeURIComponent(gameName)}`
  
  if (gameId) {
    url += `&gameId=${encodeURIComponent(gameId)}`
  }
  
  if (token) {
    url += `&token=${encodeURIComponent(token)}`
  }
  
  if (timestamp) {
    url += `&timestamp=${encodeURIComponent(timestamp)}`
  }
  
  if (userId) {
    url += `&userId=${encodeURIComponent(userId)}`
  }
  
  return url
}

// URL de redirection simple (sans redirect.html) - pour compatibilité
export function getSimpleRedirectUrl(gameName, gameId = null) {
  const baseUrl = VERCEL_BASE_URL.endsWith('/') 
    ? VERCEL_BASE_URL.slice(0, -1) 
    : VERCEL_BASE_URL
  
  let url = `${baseUrl}/?game=${encodeURIComponent(gameName)}`
  
  if (gameId) {
    url += `&gameId=${encodeURIComponent(gameId)}`
  }
  
  return url
}

export default {
  VERCEL_BASE_URL,
  getRedirectUrl,
  getSimpleRedirectUrl
}

