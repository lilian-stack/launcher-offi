// Service pour gérer les utilisateurs dans Supabase
import https from 'https'
import { SUPABASE_CONFIG } from './supabase-config.mjs'

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
            // Ne pas créer d'erreur pour les erreurs 404 de table inexistante (comportement normal)
            // Vérifier le body en tant que string avant le parsing
            if (res.statusCode === 404 && typeof body === 'string' && (body.includes('schema cache') || body.includes('not exist') || body.includes('Could not find') || body.includes('relation') || body.includes('does not exist'))) {
              resolve([]) // Retourner un tableau vide au lieu de rejeter
              return
            }
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
 * Récupère tous les utilisateurs depuis Supabase
 */
export async function getUsersFromSupabase() {
  try {
    // Vérifier la configuration
    if (!SUPABASE_CONFIG.URL || SUPABASE_CONFIG.URL.includes('your-project') || !SUPABASE_CONFIG.ANON_KEY || SUPABASE_CONFIG.ANON_KEY.includes('your-anon-key')) {
      return { users: [] }
    }
    
    // Récupérer tous les utilisateurs avec un ordre par date d'inscription (plus récents en premier)
    const path = `/${SUPABASE_CONFIG.USERS_TABLE || 'users'}?order=created_at.desc`
    const users = await supabaseRequest('GET', path)
    
    // Convertir les données de Supabase (snake_case) en camelCase
    const convertedUsers = Array.isArray(users) ? users.map(convertFromSupabase) : []
    
    return { users: convertedUsers }
  } catch (error) {
    // Si la table n'existe pas, retourner silencieusement un tableau vide (comportement normal)
    if (error.message.includes('table') && (error.message.includes('not exist') || error.message.includes('schema cache') || error.message.includes('Could not find'))) {
      // Ne pas logger cette erreur car c'est normal que la table n'existe pas
      return { users: [] }
    }
    // Si la table n'existe pas ou est vide (autres variantes d'erreur), retourner un tableau vide
    if (error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      return { users: [] }
    }
    // Ne logger que les erreurs critiques (timeout, etc.) qui ne sont pas liées à l'absence de table
    if (!error.message.includes('Request timeout')) {
      console.error('[supabase-users-service] Error getting users from Supabase:', error)
    }
    // Pour toutes les autres erreurs, retourner un tableau vide au lieu de throw
    return { users: [] }
  }
}

/**
 * Convertit les données Supabase (snake_case) en format camelCase
 */
function convertFromSupabase(user) {
  const converted = { ...user }
  
  // Convertir created_at en createdAt
  if (converted.created_at) {
    converted.createdAt = converted.created_at
    delete converted.created_at
  }
  
  // Convertir last_login en lastLogin
  if (converted.last_login) {
    converted.lastLogin = converted.last_login
    delete converted.last_login
  }
  
  // Convertir is_admin en isAdmin
  if (converted.is_admin !== undefined) {
    converted.isAdmin = converted.is_admin
    delete converted.is_admin
  }
  
  // Convertir is_vip en isVip
  if (converted.is_vip !== undefined) {
    converted.isVip = converted.is_vip
    delete converted.is_vip
  }
  
  // Convertir is_boost en isBoost
  if (converted.is_boost !== undefined) {
    converted.isBoost = converted.is_boost
    delete converted.is_boost
  }
  
  return converted
}

/**
 * Convertit les données camelCase en format Supabase (snake_case)
 */
function convertToSupabase(user) {
  const converted = { ...user }
  
  // Convertir createdAt en created_at
  if (converted.createdAt) {
    converted.created_at = converted.createdAt
    delete converted.createdAt
  }
  
  // Convertir lastLogin en last_login
  if (converted.lastLogin) {
    converted.last_login = converted.lastLogin
    delete converted.lastLogin
  }
  
  // Toujours mettre à jour updated_at
  converted.updated_at = new Date().toISOString()
  delete converted.updatedAt
  
  // Convertir isAdmin en is_admin
  if (converted.isAdmin !== undefined) {
    converted.is_admin = converted.isAdmin
    delete converted.isAdmin
  }
  
  // Convertir isVip en is_vip
  if (converted.isVip !== undefined) {
    converted.is_vip = converted.isVip
    delete converted.isVip
  }
  
  // Convertir isBoost en is_boost
  if (converted.isBoost !== undefined) {
    converted.is_boost = converted.isBoost
    delete converted.isBoost
  }
  
  return converted
}

/**
 * Crée ou met à jour un utilisateur dans Supabase
 * Si l'utilisateur existe déjà (par ID Discord), met à jour last_login
 * Sinon, crée un nouvel utilisateur
 */
export async function upsertUserToSupabase(userData) {
  try {
    // Vérifier si la table users existe (si elle n'existe pas, on ignore silencieusement)
    if (!SUPABASE_CONFIG.URL || SUPABASE_CONFIG.URL.includes('your-project') || !SUPABASE_CONFIG.SERVICE_KEY || SUPABASE_CONFIG.SERVICE_KEY.includes('your-service-key')) {
      console.warn('[supabase-users-service] ⚠️ Configuration Supabase manquante, ignoré')
      return { success: false, error: 'Configuration manquante' }
    }
    
    const userId = userData.id // ID Discord
    
    // Préparer les données pour Supabase
    const supabaseData = convertToSupabase({
      id: userId,
      username: userData.username,
      email: userData.email || null,
      avatar: userData.avatar || null,
      discriminator: userData.discriminator || null,
      role: userData.role || 'member',
      is_admin: userData.isAdmin || false,
      is_vip: userData.isVip || false,
      is_boost: userData.isBoost || false,
      last_login: new Date().toISOString(),
      created_at: userData.createdAt || new Date().toISOString() // Utiliser createdAt si fourni, sinon maintenant
    })
    
    // Vérifier si l'utilisateur existe déjà
    const existingPath = `/${SUPABASE_CONFIG.USERS_TABLE || 'users'}?id=eq.${userId}`
    let existing = null
    
    try {
      const existingResult = await supabaseRequest('GET', existingPath, null, true)
      if (existingResult && existingResult.length > 0) {
        existing = existingResult[0]
      }
    } catch (error) {
      // Si la table n'existe pas, on ignore silencieusement
      if (error.message.includes('table') && error.message.includes('not exist') || error.message.includes('schema cache')) {
        console.warn('[supabase-users-service] ⚠️ Table users n\'existe pas dans Supabase, ignoré')
        return { success: false, error: 'Table users n\'existe pas', ignored: true }
      }
      // Si l'utilisateur n'existe pas, on continue pour le créer
    }
    
    if (existing) {
      // Mettre à jour l'utilisateur existant (principalement last_login)
      const updatePath = `/${SUPABASE_CONFIG.USERS_TABLE || 'users'}?id=eq.${userId}`
      // Ne mettre à jour que last_login et les champs qui peuvent avoir changé
      const updateData = {
        last_login: new Date().toISOString(),
        username: userData.username,
        avatar: userData.avatar || null,
        role: userData.role || 'member',
        is_admin: userData.isAdmin || false,
        is_vip: userData.isVip || false,
        is_boost: userData.isBoost || false,
        updated_at: new Date().toISOString()
      }
      
      await supabaseRequest('PATCH', updatePath, updateData, true)
      return { success: true, updated: true, user: { ...existing, ...updateData } }
    } else {
      // Créer un nouvel utilisateur
      const path = `/${SUPABASE_CONFIG.USERS_TABLE || 'users'}`
      try {
        const result = await supabaseRequest('POST', path, supabaseData, true)
        return { success: true, updated: false, user: result[0] || supabaseData }
      } catch (createError) {
        // Si la table n'existe pas, on ignore silencieusement
        if (createError.message.includes('table') && createError.message.includes('not exist') || createError.message.includes('schema cache')) {
          console.warn('[supabase-users-service] ⚠️ Table users n\'existe pas dans Supabase, ignoré')
          return { success: false, error: 'Table users n\'existe pas', ignored: true }
        }
        throw createError
      }
    }
  } catch (error) {
    // Si la table n'existe pas, ne pas faire échouer l'authentification
    if (error.message.includes('table') && error.message.includes('not exist') || error.message.includes('schema cache')) {
      console.warn('[supabase-users-service] ⚠️ Table users n\'existe pas dans Supabase, ignoré')
      return { success: false, error: 'Table users n\'existe pas', ignored: true }
    }
    console.error('[supabase-users-service] ❌ Erreur lors de l\'upsert:', error.message)
    return { success: false, error: error.message }
  }
}

