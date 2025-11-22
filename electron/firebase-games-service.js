import https from 'https'
import { FIREBASE_CONFIG } from './firebase-config.js'

const FIRESTORE_API_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`

/**
 * Fait une requête à l'API Firestore REST
 */
function firestoreRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(FIRESTORE_API_BASE + path)
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    }

    const req = https.request(options, (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = body ? JSON.parse(body) : {}
            resolve(parsed)
          } else {
            const error = body ? JSON.parse(body) : { message: `HTTP ${res.statusCode}` }
            reject(new Error(`Firestore API Error: ${res.statusCode} - ${error.error?.message || error.message || body}`))
          }
        } catch (error) {
          reject(new Error(`Parse Error: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (data) {
      req.write(JSON.stringify(data))
    }

    req.end()
  })
}

/**
 * Convertit un document Firestore en objet JavaScript (récursif)
 */
function firestoreToObject(doc) {
  if (!doc || !doc.fields) return null
  
  const obj = {}
  for (const [key, value] of Object.entries(doc.fields)) {
    obj[key] = convertFirestoreValue(value)
  }
  return obj
}

/**
 * Convertit une valeur Firestore en valeur JavaScript (récursif)
 */
function convertFirestoreValue(value) {
  if (!value || typeof value !== 'object') {
    console.warn('[firebase-games-service] convertFirestoreValue: invalid value:', value)
    return null
  }
  
  if (value.stringValue !== undefined) {
    return value.stringValue
  } else if (value.integerValue !== undefined) {
    return parseInt(value.integerValue)
  } else if (value.doubleValue !== undefined) {
    return parseFloat(value.doubleValue)
  } else if (value.booleanValue !== undefined) {
    return value.booleanValue === 'true' || value.booleanValue === true
  } else if (value.nullValue !== undefined) {
    return null
  } else if (value.arrayValue !== undefined && value.arrayValue.values) {
    return value.arrayValue.values.map(v => convertFirestoreValue(v)).filter(v => v !== null)
  } else if (value.mapValue !== undefined && value.mapValue.fields) {
    // Récursif pour tous les niveaux d'imbrication
    const nestedObj = {}
    for (const [nestedKey, nestedValue] of Object.entries(value.mapValue.fields)) {
      nestedObj[nestedKey] = convertFirestoreValue(nestedValue)
    }
    return nestedObj
  }
  
  // Log pour debug si aucune valeur n'est trouvée
  console.warn('[firebase-games-service] convertFirestoreValue: unknown value type:', Object.keys(value))
  return null
}

/**
 * Convertit un objet JavaScript en document Firestore (récursif)
 */
function objectToFirestore(obj) {
  const fields = {}
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = convertValueToFirestore(value, key)
  }
  return { fields }
}

/**
 * Convertit une valeur JavaScript en valeur Firestore (récursif)
 */
function convertValueToFirestore(value, key = '') {
  // Log pour debug si c'est pc_requirements
  if (key === 'pc_requirements') {
    console.log('[firebase-games-service] convertValueToFirestore: converting pc_requirements')
    console.log('[firebase-games-service] convertValueToFirestore: value type:', typeof value)
    console.log('[firebase-games-service] convertValueToFirestore: value is object:', typeof value === 'object' && value !== null)
    if (typeof value === 'object' && value !== null) {
      console.log('[firebase-games-service] convertValueToFirestore: value keys:', Object.keys(value))
    }
  }
  
  if (value === null || value === undefined) {
    return { nullValue: null }
  } else if (typeof value === 'string') {
    return { stringValue: value }
  } else if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() }
    } else {
      return { doubleValue: value.toString() }
    }
  } else if (typeof value === 'boolean') {
    return { booleanValue: value }
  } else if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(v => convertValueToFirestore(v))
      }
    }
  } else if (typeof value === 'object') {
    // Gérer les objets imbriqués récursivement
    const nestedFields = {}
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      nestedFields[nestedKey] = convertValueToFirestore(nestedValue, nestedKey)
    }
    const result = { mapValue: { fields: nestedFields } }
    if (key === 'pc_requirements') {
      console.log('[firebase-games-service] convertValueToFirestore: pc_requirements result keys:', Object.keys(nestedFields))
    }
    return result
  }
  return { nullValue: null }
}

/**
 * Récupère tous les jeux depuis Firestore
 */
export async function getGamesFromFirebase() {
  try {
    console.log('[firebase-games-service] getGamesFromFirebase called')
    const path = '/games'
    console.log('[firebase-games-service] Firestore path:', path)
    
    const response = await firestoreRequest('GET', path)
    console.log('[firebase-games-service] Firestore response:', response)
    
    if (!response.documents || !Array.isArray(response.documents)) {
      console.log('[firebase-games-service] No documents found, returning empty array')
      return { games: [] }
    }
    
    const games = response.documents.map(doc => {
      // Debug: log le document brut avant conversion
      if (doc.fields && doc.fields.pc_requirements) {
        console.log(`[firebase-games-service] Document ${doc.name} - pc_requirements found in raw document`)
        console.log(`[firebase-games-service] Document ${doc.name} - pc_requirements type:`, 
          doc.fields.pc_requirements.mapValue ? 'mapValue' : 
          doc.fields.pc_requirements.stringValue ? 'stringValue' : 
          'other')
        if (doc.fields.pc_requirements.mapValue && doc.fields.pc_requirements.mapValue.fields) {
          console.log(`[firebase-games-service] Document ${doc.name} - pc_requirements.mapValue.fields keys:`, 
            Object.keys(doc.fields.pc_requirements.mapValue.fields))
        }
      } else {
        console.log(`[firebase-games-service] Document ${doc.name} - NO pc_requirements in raw document`)
        console.log(`[firebase-games-service] Document ${doc.name} - Available fields:`, Object.keys(doc.fields || {}))
      }
      
      const game = firestoreToObject(doc)
      // Extraire l'ID du document (dernière partie du nom)
      if (doc.name) {
        const parts = doc.name.split('/')
        game.id = parts[parts.length - 1]
      }
      
      // Debug: log les requirements pour chaque jeu
      console.log(`[firebase-games-service] Game ${game.id} - has systemRequirements:`, !!game.systemRequirements)
      console.log(`[firebase-games-service] Game ${game.id} - has pc_requirements:`, !!game.pc_requirements)
      if (game.systemRequirements) {
        console.log(`[firebase-games-service] Game ${game.id} - systemRequirements:`, JSON.stringify(game.systemRequirements, null, 2))
      }
      if (game.pc_requirements) {
        console.log(`[firebase-games-service] Game ${game.id} - pc_requirements:`, JSON.stringify(game.pc_requirements, null, 2))
        if (game.pc_requirements.minimum) {
          console.log(`[firebase-games-service] Game ${game.id} - pc_requirements.minimum type:`, typeof game.pc_requirements.minimum)
          console.log(`[firebase-games-service] Game ${game.id} - pc_requirements.minimum (first 100 chars):`, 
            typeof game.pc_requirements.minimum === 'string' 
              ? game.pc_requirements.minimum.substring(0, 100) 
              : 'not a string')
        }
        if (game.pc_requirements.recommended) {
          console.log(`[firebase-games-service] Game ${game.id} - pc_requirements.recommended type:`, typeof game.pc_requirements.recommended)
          console.log(`[firebase-games-service] Game ${game.id} - pc_requirements.recommended (first 100 chars):`, 
            typeof game.pc_requirements.recommended === 'string' 
              ? game.pc_requirements.recommended.substring(0, 100) 
              : 'not a string')
        }
      } else {
        console.log(`[firebase-games-service] Game ${game.id} - NO pc_requirements found!`)
        console.log(`[firebase-games-service] Game ${game.id} - Available keys:`, Object.keys(game))
      }
      
      return game
    })
    
    console.log('[firebase-games-service] Returning games array, count:', games.length)
    return { games }
  } catch (error) {
    console.error('[firebase-games-service] Error getting games from Firebase:', error)
    if (error.message.includes('404') || error.message.includes('not found')) {
      console.log('[firebase-games-service] Collection not found (404), returning empty array')
      return { games: [] }
    }
    throw error
  }
}

/**
 * Ajoute ou met à jour un jeu dans Firestore
 */
export async function addGameToFirebase(gameData) {
  try {
    console.log('[firebase-games-service] addGameToFirebase called with game:', gameData)
    console.log('[firebase-games-service] Has pc_requirements:', !!gameData.pc_requirements)
    console.log('[firebase-games-service] Has systemRequirements:', !!gameData.systemRequirements)
    if (gameData.pc_requirements) {
      console.log('[firebase-games-service] pc_requirements keys:', Object.keys(gameData.pc_requirements))
      console.log('[firebase-games-service] pc_requirements structure:', JSON.stringify(gameData.pc_requirements, null, 2))
    }
    
    const gameId = gameData.id || `game_${Date.now()}`
    const path = `/games/${gameId}`
    
    // Préparer les données pour Firestore
    const firestoreData = {
      ...gameData,
      id: gameId,
      addedAt: gameData.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    // Vérification explicite que pc_requirements est bien copié
    if (gameData.pc_requirements && !firestoreData.pc_requirements) {
      console.error('[firebase-games-service] ❌ CRITICAL: pc_requirements was lost during spread!')
      firestoreData.pc_requirements = gameData.pc_requirements
    }
    
    console.log('[firebase-games-service] firestoreData keys:', Object.keys(firestoreData))
    console.log('[firebase-games-service] firestoreData has pc_requirements:', !!firestoreData.pc_requirements)
    if (firestoreData.pc_requirements) {
      console.log('[firebase-games-service] firestoreData.pc_requirements type:', typeof firestoreData.pc_requirements)
      console.log('[firebase-games-service] firestoreData.pc_requirements keys:', Object.keys(firestoreData.pc_requirements))
    }
    
    const document = objectToFirestore(firestoreData)
    
    // Vérifier que pc_requirements est bien dans le document
    if (document.fields && document.fields.pc_requirements) {
      console.log('[firebase-games-service] ✅ pc_requirements is in Firestore document')
      console.log('[firebase-games-service] pc_requirements type:', document.fields.pc_requirements.mapValue ? 'mapValue' : 'other')
      if (document.fields.pc_requirements.mapValue && document.fields.pc_requirements.mapValue.fields) {
        console.log('[firebase-games-service] pc_requirements.mapValue.fields keys:', Object.keys(document.fields.pc_requirements.mapValue.fields))
        if (document.fields.pc_requirements.mapValue.fields.minimum) {
          console.log('[firebase-games-service] pc_requirements.minimum type in document:', 
            document.fields.pc_requirements.mapValue.fields.minimum.stringValue ? 'stringValue' : 'other')
        }
        if (document.fields.pc_requirements.mapValue.fields.recommended) {
          console.log('[firebase-games-service] pc_requirements.recommended type in document:', 
            document.fields.pc_requirements.mapValue.fields.recommended.stringValue ? 'stringValue' : 'other')
        }
      }
    } else {
      console.error('[firebase-games-service] ❌ ERROR: pc_requirements is NOT in Firestore document!')
      console.log('[firebase-games-service] Available fields:', Object.keys(document.fields || {}))
      console.log('[firebase-games-service] firestoreData had pc_requirements:', !!firestoreData.pc_requirements)
      if (firestoreData.pc_requirements) {
        console.log('[firebase-games-service] firestoreData.pc_requirements type:', typeof firestoreData.pc_requirements)
        console.log('[firebase-games-service] firestoreData.pc_requirements keys:', Object.keys(firestoreData.pc_requirements))
      }
    }
    
    console.log('[firebase-games-service] Updating game in Firestore:', path)
    await firestoreRequest('PATCH', path, document)
    
    console.log('[firebase-games-service] Game added/updated successfully')
    return { success: true, updated: true }
  } catch (error) {
    console.error('[firebase-games-service] Error adding game to Firebase:', error)
    throw error
  }
}

/**
 * Met à jour un jeu dans Firestore
 */
export async function updateGameInFirebase(gameId, updates) {
  try {
    console.log('[firebase-games-service] updateGameInFirebase called with gameId:', gameId)
    const path = `/games/${gameId}`
    
    // Récupérer le jeu existant pour préserver tous les champs
    let existingGame = null
    try {
      const existingDoc = await firestoreRequest('GET', path)
      existingGame = firestoreToObject(existingDoc)
      console.log('[firebase-games-service] Existing game retrieved, preserving fields:', Object.keys(existingGame || {}))
    } catch (error) {
      // Si le jeu n'existe pas encore, on continue avec seulement les updates
      console.log('[firebase-games-service] Game does not exist yet, creating with updates only')
    }
    
    // Fusionner les données existantes avec les mises à jour
    const firestoreData = {
      ...(existingGame || {}),
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    
    // Préserver l'ID du jeu
    if (gameId) {
      firestoreData.id = gameId
    }
    
    const document = objectToFirestore(firestoreData)
    
    await firestoreRequest('PATCH', path, document)
    
    console.log('[firebase-games-service] Game updated successfully')
    return { success: true }
  } catch (error) {
    console.error('[firebase-games-service] Error updating game in Firebase:', error)
    throw error
  }
}

/**
 * Supprime un jeu de Firestore
 */
export async function deleteGameFromFirebase(gameId) {
  try {
    console.log('[firebase-games-service] deleteGameFromFirebase called with gameId:', gameId)
    const path = `/games/${gameId}`
    
    await firestoreRequest('DELETE', path)
    
    console.log('[firebase-games-service] Game deleted successfully')
    return true
  } catch (error) {
    console.error('[firebase-games-service] Error deleting game from Firebase:', error)
    throw error
  }
}

