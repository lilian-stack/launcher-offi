/**
 * Utilitaires pour la gestion de la connexion au backend
 */

const BACKEND_URL = 'http://127.0.0.1:3001'
const MAX_RETRIES = 30 // 30 tentatives = ~15 secondes max
const RETRY_DELAY = 500 // 500ms entre chaque tentative

/**
 * Vérifie si le backend est accessible
 */
export async function checkBackendHealth() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1000) // Timeout de 1 seconde
    
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Attend que le backend soit prêt avant de continuer
 * @param {number} maxRetries - Nombre maximum de tentatives
 * @param {number} retryDelay - Délai entre chaque tentative (ms)
 * @returns {Promise<boolean>} - true si le backend est prêt, false sinon
 */
export async function waitForBackend(maxRetries = MAX_RETRIES, retryDelay = RETRY_DELAY) {
  for (let i = 0; i < maxRetries; i++) {
    const isReady = await checkBackendHealth()
    if (isReady) {
      return true
    }
    
    // Attendre avant la prochaine tentative
    await new Promise(resolve => setTimeout(resolve, retryDelay))
  }
  
  console.warn('[Backend] ⚠️ Le backend n\'est pas prêt après', maxRetries, 'tentatives')
  return false
}

/**
 * Fait un appel API avec retry automatique si le backend n'est pas prêt
 * @param {string} endpoint - Endpoint de l'API (ex: '/api/discord/bot-status')
 * @param {RequestInit} options - Options de fetch
 * @returns {Promise<Response>}
 */
export async function fetchWithBackendCheck(endpoint, options = {}) {
  // Attendre que le backend soit prêt
  const isReady = await waitForBackend()
  
  if (!isReady) {
    throw new Error('Le backend n\'est pas disponible. Veuillez redémarrer l\'application.')
  }
  
  // Faire l'appel API
  const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // Timeout de 10 secondes
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * URL de base du backend
 */
export { BACKEND_URL }
