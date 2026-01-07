import https from 'https'
import { SUPABASE_CONFIG } from './supabase-config.mjs'

/**
 * Fait une requête à l'API Supabase REST
 */
function supabaseRequest(method, path, data = null, useServiceKey = false) {
  return new Promise((resolve, reject) => {
    const apiKey = useServiceKey ? SUPABASE_CONFIG.SERVICE_KEY : SUPABASE_CONFIG.ANON_KEY
    
    if (!SUPABASE_CONFIG.URL || !apiKey) {
      const error = new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY')
      console.error('[supabase-request] ❌', error.message)
      reject(error)
      return
    }

    const fullUrl = `${SUPABASE_CONFIG.URL}/rest/v1${path}`
    const url = new URL(fullUrl)
    
    // Logs désactivés pour réduire le bruit dans le terminal
    
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
      timeout: 60000, // Timeout de 60 secondes pour les grandes requêtes
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
            // Logs désactivés
            resolve(parsed)
          } else {
            const error = body ? JSON.parse(body) : { message: `HTTP ${res.statusCode}` }
            const errorMsg = `Supabase API Error: ${res.statusCode} - ${error.message || error.error_description || error.hint || body}`
            console.error('[supabase-request] ❌ Erreur API:', errorMsg)
            console.error('[supabase-request] ❌ Body:', body)
            reject(new Error(errorMsg))
          }
        } catch (error) {
          console.error('[supabase-request] ❌ Erreur de parsing:', error.message)
          console.error('[supabase-request] ❌ Body reçu:', body)
          reject(new Error(`Parse Error: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      console.error('[supabase-request] ❌ Erreur réseau:', error.message)
      console.error('[supabase-request] ❌ Code:', error.code)
      reject(error)
    })
    
    req.on('timeout', () => {
      console.error('[supabase-request] ❌ Timeout de la requête')
      req.destroy()
      reject(new Error('Request timeout'))
    })

    // Ajouter un timeout global (plus long pour les grandes requêtes)
    const timeoutDuration = method === 'GET' && path.includes('games') ? 60000 : 15000
    const timeout = setTimeout(() => {
      console.error('[supabase-request] ❌ Timeout global déclenché')
      req.destroy()
      reject(new Error('Request timeout'))
    }, timeoutDuration)

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
  
  // Convertir is_online en isOnline (gérer tous les cas possibles)
  // IMPORTANT: Vérifier is_online AVANT de le supprimer
  // Vérifier toutes les variantes possibles du nom de la colonne
  let isOnlineValue = null
  
  if (converted.hasOwnProperty('is_online')) {
    isOnlineValue = converted.is_online
  } else if (converted.hasOwnProperty('isOnline')) {
    isOnlineValue = converted.isOnline
  } else if (converted.hasOwnProperty('is_Online')) {
    isOnlineValue = converted.is_Online
  }
  
  if (isOnlineValue !== null && isOnlineValue !== undefined) {
    // Convertir en boolean : true, 'true', 1, etc.
    converted.isOnline = isOnlineValue === true || 
                         isOnlineValue === 'true' || 
                         isOnlineValue === 1 || 
                         isOnlineValue === '1'
    
    // Supprimer toutes les variantes
    delete converted.is_online
    delete converted.is_Online
    
    // Logs désactivés pour réduire le bruit dans le terminal
  } else {
    // Si is_online n'est pas défini, le définir à false par défaut
    converted.isOnline = false
  }
  
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
  
  // Garder pc_requirements tel quel s'il existe
  // (pas besoin de conversion snake_case -> camelCase car il est déjà en snake_case dans Supabase)
  
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
  
  // Convertir steam_id en steamId
  if (converted.steam_id !== undefined && converted.steam_id !== null) {
    converted.steamId = converted.steam_id
    delete converted.steam_id
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
  
  // NOTE: La conversion de is_online en isOnline est déjà faite plus haut (lignes 101-142)
  // Ne pas la refaire ici car cela écraserait la valeur correcte !
  
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
  
  // Convertir lockr_url en lockrUrl (gérer les deux cas : snake_case et camelCase)
  // IMPORTANT: Vérifier lockr_url en premier car c'est le nom de la colonne dans Supabase
  if (converted.lockr_url !== undefined && converted.lockr_url !== null) {
    converted.lockrUrl = converted.lockr_url
    // Ne pas supprimer lockr_url immédiatement pour compatibilité
  }
  // Gérer le cas où la propriété s'appelle LockrUrl (avec majuscule) dans la base de données
  if (converted.LockrUrl !== undefined && converted.LockrUrl !== null && !converted.lockrUrl) {
    converted.lockrUrl = converted.LockrUrl
  }
  // Si lockrUrl existe déjà (camelCase), le garder tel quel
  // (pas de log nécessaire)
  
  // Si title existe mais pas name, utiliser title comme name
  if (converted.title && !converted.name) {
    converted.name = converted.title
  }
  
  // NOTE: Les colonnes genre, genres, category, categories n'existent pas dans Supabase
  // Ne pas les extraire/converter, elles seront supprimées plus bas
  
  // Logs désactivés pour réduire le bruit dans le terminal
  
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
  
  // Convertir isOnline en is_online
  if (converted.isOnline !== undefined) {
    converted.is_online = converted.isOnline
    delete converted.isOnline
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
  
  // Convertir lockrUrl en lockr_url (snake_case - format Supabase)
  // Ne pas envoyer LockrUrl car cette colonne n'existe pas dans Supabase
  if (converted.lockrUrl !== undefined) {
    converted.lockr_url = converted.lockrUrl
    delete converted.lockrUrl
    // Ne pas envoyer LockrUrl car la colonne n'existe pas dans Supabase
    delete converted.LockrUrl
  }
  
  // Si title existe, le garder aussi (pour compatibilité)
  // title sera mappé directement
  
  // Gérer les screenshots (tableau JSON)
  if (converted.screenshots && Array.isArray(converted.screenshots)) {
    // Les screenshots sont déjà un tableau, pas besoin de conversion
    // Supabase peut stocker des tableaux JSON directement
  }
  
  // Gérer la vidéo (string)
  if (converted.video) {
    // La vidéo est déjà une string, pas besoin de conversion
  }
  
  // NOTE: Les colonnes suivantes n'existent pas dans Supabase
  // Les supprimer systématiquement pour éviter les erreurs 400
  delete converted.category
  delete converted.categories
  delete converted.genre
  delete converted.genres
  delete converted.developer
  delete converted.developers
  delete converted.publisher
  delete converted.publishers
  // Supprimer aussi les colonnes optionnelles qui peuvent ne pas exister
  delete converted.screenshots
  delete converted.video
  delete converted.movies
  delete converted.pc_requirements
  delete converted.systemRequirements
  
  return converted
}

/**
 * Récupère tous les jeux depuis Supabase
 */
export async function getGamesFromSupabase() {
  try {
    // Vérifier la configuration
    if (!SUPABASE_CONFIG.URL || SUPABASE_CONFIG.URL.includes('your-project') || !SUPABASE_CONFIG.ANON_KEY || SUPABASE_CONFIG.ANON_KEY.includes('your-anon-key')) {
      console.error('[supabase-games-service] ❌ Configuration Supabase manquante ou invalide')
      console.error('[supabase-games-service] ❌ URL:', SUPABASE_CONFIG.URL)
      console.error('[supabase-games-service] ❌ ANON_KEY:', SUPABASE_CONFIG.ANON_KEY ? 'Présente mais invalide' : 'Manquante')
      return { games: [] }
    }
    
    // OPTIMISATION: Sélectionner seulement les colonnes nécessaires au lieu de *
    // Stratégie progressive : essayer avec images et catégories, puis réduire si erreur
    // Colonnes essentielles (toujours présentes)
    const essentialColumns = 'id,name,title,download_url,lockr_url,is_online,added_at,updated_at,description'
    // Colonnes importantes pour l'affichage (images, catégories)
    const imageColumns = 'cover_image,header_image,background_image'
    const categoryColumn = 'category'
    
    // ✅ Essayer d'abord avec images + category (sans colonnes optionnelles qui n'existent pas)
    let path = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${essentialColumns},${imageColumns},${categoryColumn}`
    
    let games
    let successfulColumns = []
    
    try {
      games = await supabaseRequest('GET', path)
      successfulColumns = [essentialColumns, imageColumns, categoryColumn]
    } catch (firstError) {
      const errorMsg = firstError.message || ''
      
      // Vérifier quelles colonnes manquent
      const missingImage = errorMsg.includes('cover_image') || errorMsg.includes('header_image') || errorMsg.includes('background_image')
      const missingCategory = errorMsg.includes('category')
      
      if (missingImage && missingCategory) {
        path = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${essentialColumns}`
        games = await supabaseRequest('GET', path)
        successfulColumns = [essentialColumns]
      } else if (missingImage) {
        try {
          path = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${essentialColumns},${categoryColumn}`
          games = await supabaseRequest('GET', path)
          successfulColumns = [essentialColumns, categoryColumn]
        } catch (secondError) {
          path = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${essentialColumns}`
          games = await supabaseRequest('GET', path)
          successfulColumns = [essentialColumns]
        }
      } else if (missingCategory) {
        try {
          path = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${essentialColumns},${imageColumns}`
          games = await supabaseRequest('GET', path)
          successfulColumns = [essentialColumns, imageColumns]
        } catch (secondError) {
          path = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${essentialColumns}`
          games = await supabaseRequest('GET', path)
          successfulColumns = [essentialColumns]
        }
      } else {
        path = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${essentialColumns}`
        games = await supabaseRequest('GET', path)
        successfulColumns = [essentialColumns]
      }
    }
    
    // 🔍 Maintenant, essayer d'ajouter les colonnes optionnelles une par une
    if (Array.isArray(games) && games.length > 0 && successfulColumns.length > 0) {
      const optionalColumnsToTry = ['screenshots', 'pc_requirements', 'video']
      const workingOptionalColumns = []
      
      for (const optCol of optionalColumnsToTry) {
        try {
          const testPath = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${successfulColumns.join(',')},${optCol}&limit=1`
          await supabaseRequest('GET', testPath)
          workingOptionalColumns.push(optCol)
        } catch (optError) {
          // Colonne non disponible
        }
      }
      
      // Si on a trouvé des colonnes optionnelles, refaire la requête complète
      if (workingOptionalColumns.length > 0) {
        const finalPath = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${successfulColumns.join(',')},${workingOptionalColumns.join(',')}`
        games = await supabaseRequest('GET', finalPath)
      }
    }
    
    // Trier côté client si nécessaire (plus rapide pour les grandes tables)
    if (Array.isArray(games) && games.length > 0) {
      games.sort((a, b) => {
        const dateA = new Date(a.added_at || 0)
        const dateB = new Date(b.added_at || 0)
        return dateB - dateA // Plus récents en premier
      })
    }
    // Convertir les données de Supabase (snake_case) en camelCase
    const convertedGames = Array.isArray(games) ? games.map(convertFromSupabase) : []
    
    if (convertedGames.length === 0) {
      console.warn('[supabase-games-service] ⚠️ Aucun jeu trouvé dans Supabase')
    }
    
    return { games: convertedGames }
  } catch (error) {
    console.error('[supabase-games-service] ❌ Erreur lors de la récupération des jeux:', error.message)
    console.error('[supabase-games-service] ❌ Stack:', error.stack)
    
    // Gestion spéciale des timeouts Supabase (code 57014)
    if (error.message.includes('statement timeout') || error.message.includes('57014')) {
      console.error('[supabase-games-service] ⚠️ Timeout Supabase détecté')
      console.error('[supabase-games-service] 💡 La table est probablement trop grande ou la requête trop complexe')
      console.error('[supabase-games-service] 💡 Solution: Vérifier les index sur Supabase ou réduire le nombre de colonnes sélectionnées')
      // Retourner un tableau vide au lieu de faire planter l'application
      return { games: [] }
    }
    
    // Ne logger que les erreurs critiques (timeout client, etc.)
    if (!error.message.includes('Request timeout') && !error.message.includes('statement timeout')) {
      console.error('[supabase-games-service] Error getting games from Supabase:', error)
    }
    
    // Si la table n'existe pas ou est vide, retourner un tableau vide
    if (error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('[supabase-games-service] ❌ Problème de connexion ou table inexistante')
      return { games: [] }
    }
    
    // Gérer spécifiquement l'erreur "column does not exist"
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.error('[supabase-games-service] ❌ Colonne inexistante dans Supabase:', error.message)
      console.error('[supabase-games-service] 💡 Tentative de récupération avec colonnes de base uniquement...')
      // Réessayer avec seulement les colonnes de base garanties
      try {
        const baseColumns = 'id,name,title,download_url,lockr_url,is_online,added_at,updated_at,description'
        const retryPath = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=${baseColumns}`
        const retryGames = await supabaseRequest('GET', retryPath)
        const convertedGames = Array.isArray(retryGames) ? retryGames.map(convertFromSupabase) : []
        return { games: convertedGames }
      } catch (retryError) {
        console.error('[supabase-games-service] ❌ Échec même avec colonnes de base')
        return { games: [] }
      }
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
    
    // NOTE: La colonne 'category' peut ne pas exister dans Supabase
    // Ne pas l'envoyer pour éviter les erreurs 400
    // Si vous voulez l'activer, décommentez les lignes suivantes :
    // if (updates.category !== undefined && updates.category !== null) {
    //   supabaseData.category = updates.category
    // }
    delete supabaseData.category
    
    // Log pour debug
    // Logs désactivés pour réduire le bruit dans le terminal
    
    // S'assurer qu'on n'envoie que lockr_url (snake_case) car c'est le nom réel de la colonne dans Supabase
    // Supprimer LockrUrl si présent car cette colonne n'existe pas
    if (supabaseData.LockrUrl) {
      delete supabaseData.LockrUrl
    }
    
    const path = `/${SUPABASE_CONFIG.GAMES_TABLE}?id=eq.${gameId}`
    
    try {
      const result = await supabaseRequest('PATCH', path, supabaseData, true)
      // Logs désactivés
      
      // Vérifier que la mise à jour a bien fonctionné en récupérant le jeu
      const verifyPath = `/${SUPABASE_CONFIG.GAMES_TABLE}?id=eq.${gameId}&select=id,lockr_url`
      const verifyResult = await supabaseRequest('GET', verifyPath)
      if (verifyResult && verifyResult.length > 0) {
        const game = verifyResult[0]
        // Logs désactivés
      }
      
      return { success: true }
    } catch (patchError) {
      console.error('[supabase-games-service] ❌ Erreur lors de la mise à jour:', patchError)
      throw patchError
    }
  } catch (error) {
    console.error('[supabase-games-service] ❌ Error updating game on Supabase:', error)
    console.error('[supabase-games-service] ❌ GameId:', gameId)
    console.error('[supabase-games-service] ❌ Updates:', JSON.stringify(updates, null, 2))
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

/**
 * Récupère toutes les catégories distinctes depuis Supabase
 * @returns {Promise<string[]>} Liste des catégories uniques triées
 */
export async function getCategoriesFromSupabase() {
  try {
    // NOTE: La colonne 'category' peut ne pas exister dans Supabase
    // Si elle n'existe pas, retourner un tableau vide
    // Utiliser une requête pour récupérer uniquement les catégories distinctes
    // Supabase ne supporte pas directement DISTINCT dans l'API REST, donc on récupère tous les jeux avec category
    const path = `/${SUPABASE_CONFIG.GAMES_TABLE}?select=category&category=not.is.null&order=category.asc`
    
    // Logs désactivés pour réduire le bruit dans le terminal
    
    const games = await supabaseRequest('GET', path)
    
    // Extraire les catégories uniques et les trier
    const categories = [...new Set(games.map(game => game.category).filter(Boolean))].sort()
    
    return categories
  } catch (error) {
    // Si la colonne n'existe pas, retourner un tableau vide
    if (error.message && error.message.includes('category')) {
      console.warn('[supabase-games-service] ⚠️ Colonne category n\'existe pas dans Supabase, retour d\'un tableau vide')
      return []
    }
    console.error('[supabase-games-service] ❌ Erreur lors de la récupération des catégories:', error)
    // En cas d'erreur, retourner un tableau vide plutôt que de planter
    return []
  }
}

