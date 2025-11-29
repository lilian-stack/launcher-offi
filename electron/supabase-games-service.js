import https from 'https'
import { SUPABASE_CONFIG } from './supabase-config.js'

/**
 * Fait une requête à l'API Supabase REST
 */
function supabaseRequest(method, path, data = null, useServiceKey = false) {
  return new Promise((resolve, reject) => {
    const apiKey = useServiceKey ? SUPABASE_CONFIG.SERVICE_KEY : SUPABASE_CONFIG.ANON_KEY
    
    if (!SUPABASE_CONFIG.URL || !apiKey) {
      reject(new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY'))
      return
    }

    const url = new URL(`${SUPABASE_CONFIG.URL}/rest/v1${path}`)
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation', // Retourner les données après insertion/mise à jour
      },
      timeout: 10000, // Timeout de 10 secondes
    }

    const req = https.request(options, (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = body ? JSON.parse(body) : []
            resolve(parsed)
          } else {
            const error = body ? JSON.parse(body) : { message: `HTTP ${res.statusCode}` }
            reject(new Error(`Supabase API Error: ${res.statusCode} - ${error.message || error.error_description || body}`))
          }
        } catch (error) {
          reject(new Error(`Parse Error: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })
    
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    // Ajouter un timeout global
    const timeout = setTimeout(() => {
      req.destroy()
      reject(new Error('Request timeout'))
    }, 10000)

    req.on('close', () => {
      clearTimeout(timeout)
    })

    if (data) {
      req.write(JSON.stringify(data))
    }

    req.end()
  })
}

/**
 * Convertit les données Supabase (snake_case) en format camelCase
 */
function convertFromSupabase(game) {
  const converted = { ...game }
  
  // Convertir added_at en addedAt
  if (converted.added_at) {
    converted.addedAt = converted.added_at
    delete converted.added_at
  }
  
  // Convertir updated_at en updatedAt
  if (converted.updated_at) {
    converted.updatedAt = converted.updated_at
    delete converted.updated_at
  }
  
  // Convertir system_requirements en systemRequirements
  if (converted.system_requirements) {
    converted.systemRequirements = converted.system_requirements
    delete converted.system_requirements
  }
  
  // Convertir pc_requirements en pc_requirements (garder le nom)
  if (converted.pc_requirements) {
    converted.pc_requirements = converted.pc_requirements
  }
  
  // Convertir download_url en downloadUrl
  if (converted.download_url) {
    converted.downloadUrl = converted.download_url
    delete converted.download_url
  }
  
  // Convertir release_date en releaseDate
  if (converted.release_date) {
    converted.releaseDate = converted.release_date
    delete converted.release_date
  }
  
  // Convertir header_image en headerImage (garder aussi header_image pour compatibilité)
  if (converted.header_image) {
    converted.headerImage = converted.header_image
    // Ne pas supprimer header_image pour compatibilité
  }
  
  // Convertir background_image en backgroundImage
  if (converted.background_image) {
    converted.backgroundImage = converted.background_image
    delete converted.background_image
  }
  
  // Convertir cover_image en coverImage ET header_image pour compatibilité
  if (converted.cover_image) {
    converted.coverImage = converted.cover_image
    converted.header_image = converted.cover_image // Utiliser cover_image comme header_image aussi
    // Ne pas supprimer cover_image pour compatibilité
  }
  
  // Convertir is_vip_only en isVipOnly
  if (converted.is_vip_only !== undefined) {
    converted.isVipOnly = converted.is_vip_only
    delete converted.is_vip_only
  }
  
  // Convertir is_favorite en isFavorite
  if (converted.is_favorite !== undefined) {
    converted.isFavorite = converted.is_favorite
    delete converted.is_favorite
  }
  
  // Convertir is_installed en isInstalled
  if (converted.is_installed !== undefined) {
    converted.isInstalled = converted.is_installed
    delete converted.is_installed
  }
  
  // Convertir file_size en fileSize
  if (converted.file_size) {
    converted.fileSize = converted.file_size
    delete converted.file_size
  }
  
  // Convertir short_description en shortDescription
  if (converted.short_description) {
    converted.shortDescription = converted.short_description
    delete converted.short_description
  }
  
  // Si title existe mais pas name, utiliser title comme name
  if (converted.title && !converted.name) {
    converted.name = converted.title
  }
  
  // Conserver category tel quel (déjà en minuscules, pas besoin de conversion)
  // category est déjà présent dans le spread { ...game }, mais on s'assure qu'il est bien là
  
  return converted
}

/**
 * Convertit les données camelCase en format Supabase (snake_case)
 */
function convertToSupabase(game) {
  const converted = { ...game }
  
  // Convertir addedAt en added_at
  if (converted.addedAt) {
    converted.added_at = converted.addedAt
    delete converted.addedAt
  }
  
  // Toujours mettre à jour updated_at
  converted.updated_at = new Date().toISOString()
  delete converted.updatedAt
  
  // Convertir systemRequirements en system_requirements
  if (converted.systemRequirements) {
    converted.system_requirements = converted.systemRequirements
    delete converted.systemRequirements
  }
  
  // Convertir downloadUrl en download_url (même si vide)
  if (converted.downloadUrl !== undefined) {
    converted.download_url = converted.downloadUrl
    delete converted.downloadUrl
  }
  
  // Convertir releaseDate en release_date
  if (converted.releaseDate) {
    converted.release_date = converted.releaseDate
    delete converted.releaseDate
  }
  
  // Convertir headerImage en header_image
  if (converted.headerImage) {
    converted.header_image = converted.headerImage
    delete converted.headerImage
  }
  
  // Convertir backgroundImage en background_image
  if (converted.backgroundImage) {
    converted.background_image = converted.backgroundImage
    delete converted.backgroundImage
  }
  
  // Convertir coverImage en cover_image
  if (converted.coverImage) {
    converted.cover_image = converted.coverImage
    delete converted.coverImage
  }
  
  // Convertir isVipOnly en is_vip_only
  if (converted.isVipOnly !== undefined) {
    converted.is_vip_only = converted.isVipOnly
    delete converted.isVipOnly
  }
  
  // Convertir isFavorite en is_favorite
  if (converted.isFavorite !== undefined) {
    converted.is_favorite = converted.isFavorite
    delete converted.isFavorite
  }
  
  // Convertir isInstalled en is_installed
  if (converted.isInstalled !== undefined) {
    converted.is_installed = converted.isInstalled
    delete converted.isInstalled
  }
  
  // Convertir fileSize en file_size
  if (converted.fileSize) {
    converted.file_size = converted.fileSize
    delete converted.fileSize
  }
  
  // Convertir shortDescription en short_description
  if (converted.shortDescription) {
    converted.short_description = converted.shortDescription
    delete converted.shortDescription
  }
  
  // Si title existe, le garder aussi (pour compatibilité)
  // title sera mappé directement
  
  return converted
}

/**
 * Récupère tous les jeux depuis Supabase
 */
export async function getGamesFromSupabase() {
  try {
    // Vérifier la configuration
    if (!SUPABASE_CONFIG.URL || SUPABASE_CONFIG.URL.includes('your-project') || !SUPABASE_CONFIG.ANON_KEY || SUPABASE_CONFIG.ANON_KEY.includes('your-anon-key')) {
      return { games: [] }
    }
    
    // Récupérer tous les jeux avec un ordre par date d'ajout (plus récents en premier)
    const path = `/${SUPABASE_CONFIG.GAMES_TABLE}?order=added_at.desc`
    const games = await supabaseRequest('GET', path)
    
    // Convertir les données de Supabase (snake_case) en camelCase
    const convertedGames = Array.isArray(games) ? games.map(convertFromSupabase) : []
    
    return { games: convertedGames }
  } catch (error) {
    // Ne logger que les erreurs critiques (timeout, etc.)
    if (!error.message.includes('Request timeout')) {
      console.error('[supabase-games-service] Error getting games from Supabase:', error)
    }
    // Si la table n'existe pas ou est vide, retourner un tableau vide
    if (error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      return { games: [] }
    }
    // Pour toutes les autres erreurs, retourner un tableau vide au lieu de throw
    return { games: [] }
  }
}

/**
 * Ajoute un jeu à la liste ou le met à jour s'il existe déjà
 */
export async function addGameToSupabase(gameData) {
  try {
    const gameId = gameData.id || `game_${Date.now()}`
    
    // Préparer les données pour Supabase (convertir en snake_case)
    const supabaseData = convertToSupabase({
      id: gameId,
      ...gameData,
      addedAt: gameData.addedAt || gameData.added_at || new Date().toISOString(),
    })
    
    // Vérifier si le jeu existe déjà
    try {
      const existingPath = `/${SUPABASE_CONFIG.GAMES_TABLE}?id=eq.${gameId}`
      const existing = await supabaseRequest('GET', existingPath)
      
      if (existing && existing.length > 0) {
        // Mettre à jour le jeu existant
        const updatePath = `/${SUPABASE_CONFIG.GAMES_TABLE}?id=eq.${gameId}`
        await supabaseRequest('PATCH', updatePath, supabaseData, true)
        return { success: true, updated: true }
      }
    } catch (error) {
      // Le jeu n'existe pas, on continue pour l'ajouter
    }
    
    // Ajouter le nouveau jeu
    const path = `/${SUPABASE_CONFIG.GAMES_TABLE}`
    await supabaseRequest('POST', path, supabaseData, true)
    
    return { success: true, updated: false }
  } catch (error) {
    console.error('[supabase-games-service] Error adding game to Supabase:', error)
    throw error
  }
}

/**
 * Met à jour un jeu
 */
export async function updateGameOnSupabase(gameId, updates) {
  try {
    // Préparer les données de mise à jour (convertir en snake_case)
    const supabaseData = convertToSupabase(updates)
    
    // S'assurer que category est conservé (pas de conversion nécessaire car déjà en minuscules)
    if (updates.category !== undefined) {
      supabaseData.category = updates.category
    }
    
    const path = `/${SUPABASE_CONFIG.GAMES_TABLE}?id=eq.${gameId}`
    await supabaseRequest('PATCH', path, supabaseData, true)
    
    return { success: true }
  } catch (error) {
    console.error('[supabase-games-service] Error updating game on Supabase:', error)
    throw error
  }
}

/**
 * Supprime un jeu
 */
export async function deleteGameFromSupabase(gameId) {
  try {
    const path = `/${SUPABASE_CONFIG.GAMES_TABLE}?id=eq.${gameId}`
    await supabaseRequest('DELETE', path, null, true)
    return true
  } catch (error) {
    console.error('[supabase-games-service] Error deleting game from Supabase:', error)
    throw error
  }
}

