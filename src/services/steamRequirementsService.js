/**
 * Service pour récupérer les configurations système depuis Steam API
 */

// Cache pour éviter les appels répétés
const requirementsCache = new Map()

/**
 * Récupère les configurations système d'un jeu depuis Steam
 * @param {string|number} steamId - ID Steam du jeu
 * @returns {Promise<Object|null>} - Objet avec minimum et recommended, ou null
 */
export async function getSteamRequirements(steamId) {
  if (!steamId) {
    console.warn('[Steam Requirements] ⚠️ Pas de Steam ID fourni')
    return null
  }

  // Vérifier le cache
  const cacheKey = `steam_req_${steamId}`
  if (requirementsCache.has(cacheKey)) {
    return requirementsCache.get(cacheKey)
  }

  try {
    // Utiliser le proxy Electron pour éviter les problèmes CORS
    if (window.electron?.steam?.getGameData) {
      const steamData = await window.electron.steam.getGameData(steamId)
      
      if (steamData && steamData.pc_requirements) {
        const requirements = steamData.pc_requirements
        
        // Steam peut retourner soit un objet avec minimum/recommended
        // soit juste une string pour minimum
        let formattedRequirements = null
        
        if (typeof requirements === 'string') {
          formattedRequirements = {
            minimum: requirements,
            recommended: null
          }
        } else if (typeof requirements === 'object') {
          formattedRequirements = {
            minimum: requirements.minimum || null,
            recommended: requirements.recommended || null
          }
        }
        
        if (formattedRequirements && (formattedRequirements.minimum || formattedRequirements.recommended)) {
          requirementsCache.set(cacheKey, formattedRequirements)
          return formattedRequirements
        }
      }
      
      requirementsCache.set(cacheKey, null)
      return null
    }
    
    return null
    
  } catch (error) {
    console.error('[Steam Requirements] ❌ Erreur:', error.message)
    requirementsCache.set(cacheKey, null)
    return null
  }
}

/**
 * Nettoie le HTML des requirements Steam pour un affichage plus propre
 * @param {string} html - HTML brut de Steam
 * @returns {string} - HTML nettoyé
 */
export function cleanSteamRequirementsHTML(html) {
  if (!html) return ''
  
  return html
    .replace(/<br\s*\/?>/gi, '<br/>') // Normaliser les <br>
    .replace(/\n/g, '<br/>') // Remplacer les sauts de ligne
    .replace(/\t/g, '') // Retirer les tabulations
    .trim()
}

/**
 * Vide le cache des requirements
 */
export function clearRequirementsCache() {
  requirementsCache.clear()
}
