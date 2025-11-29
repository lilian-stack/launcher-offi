import https from 'https'
import { Buffer } from 'buffer'
import { GITHUB_CONFIG } from './github-config.js'

const GITHUB_GAMES_OWNER = 'lilian-stack'
const GITHUB_GAMES_REPO = 'ACTORIS.games'
const GITHUB_GAMES_FILE_PATH = 'game.json'

/**
 * Fait une requête à l'API GitHub
 */
function githubRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const githubToken = token || GITHUB_CONFIG.TOKEN || process.env.GITHUB_TOKEN
    
    if (!githubToken) {
      reject(new Error('GitHub token is not configured'))
      return
    }

    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'ACTORIS-Launcher',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
    }

    if (data) {
      const postData = JSON.stringify(data)
      options.headers['Content-Length'] = Buffer.byteLength(postData)
    }

    const req = https.request(options, (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
          } else {
            reject(new Error(`GitHub API Error: ${res.statusCode} - ${parsed.message || body}`))
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
 * Récupère tous les jeux depuis GitHub
 */
export async function getGamesFromGitHub(token = null) {
  try {
    console.log('[github-games-service] getGamesFromGitHub called')
    const path = `/repos/${GITHUB_GAMES_OWNER}/${GITHUB_GAMES_REPO}/contents/${GITHUB_GAMES_FILE_PATH}`
    const file = await githubRequest('GET', path, null, token)
    
    // Décoder le contenu base64
    const content = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf-8')
    const parsed = JSON.parse(content)
    
    // Gérer différents formats de fichier
    // Format 1: { games: [...] }
    if (parsed.games && Array.isArray(parsed.games)) {
      console.log(`[github-games-service] ${parsed.games.length} jeux récupérés depuis GitHub`)
      return parsed
    }
    // Format 2: [...] (tableau direct)
    if (Array.isArray(parsed)) {
      console.log(`[github-games-service] ${parsed.length} jeux récupérés depuis GitHub (format tableau)`)
      return { games: parsed }
    }
    // Format par défaut
    console.log('[github-games-service] Aucun jeu trouvé')
    return { games: [] }
  } catch (error) {
    console.error('[github-games-service] Error getting games from GitHub:', error)
    // Si le fichier n'existe pas, retourner un tableau vide
    if (error.message.includes('404')) {
      console.log('[github-games-service] Fichier game.json n\'existe pas encore, retour d\'un tableau vide')
      return { games: [] }
    }
    throw error
  }
}

/**
 * Met à jour le fichier game.json sur GitHub
 */
export async function updateGamesOnGitHub(gamesData, token = null) {
  try {
    console.log('[github-games-service] updateGamesOnGitHub called')
    
    // Récupérer le SHA du fichier actuel (nécessaire pour la mise à jour)
    let sha = null
    try {
      const path = `/repos/${GITHUB_GAMES_OWNER}/${GITHUB_GAMES_REPO}/contents/${GITHUB_GAMES_FILE_PATH}`
      const file = await githubRequest('GET', path, null, token)
      sha = file.sha
      console.log('[github-games-service] SHA du fichier existant récupéré')
    } catch (error) {
      // Le fichier n'existe pas encore, on va le créer
      console.log('[github-games-service] Fichier n\'existe pas encore, création')
    }

    // S'assurer que gamesData a le format { games: [...] }
    const formattedData = gamesData.games ? gamesData : { games: gamesData }

    // Encoder le contenu en base64
    const content = JSON.stringify(formattedData, null, 2)
    const encodedContent = Buffer.from(content).toString('base64')

    const path = `/repos/${GITHUB_GAMES_OWNER}/${GITHUB_GAMES_REPO}/contents/${GITHUB_GAMES_FILE_PATH}`
    const data = {
      message: `Update games - ${new Date().toISOString()}`,
      content: encodedContent,
      branch: 'main',
    }

    if (sha) {
      data.sha = sha
    }

    await githubRequest('PUT', path, data, token)
    console.log('[github-games-service] Jeux mis à jour sur GitHub avec succès')
    return { success: true, updated: true }
  } catch (error) {
    console.error('[github-games-service] Error updating games on GitHub:', error)
    throw error
  }
}

/**
 * Ajoute un jeu à la liste ou le met à jour s'il existe déjà
 */
export async function addGameToGitHub(gameData, token = null) {
  try {
    console.log('[github-games-service] addGameToGitHub called')
    
    // Récupérer les jeux existants
    const existingData = await getGamesFromGitHub(token)
    const games = existingData.games || []
    
    // Vérifier si le jeu existe déjà (par ID)
    const gameId = gameData.id || `game_${Date.now()}`
    const existingIndex = games.findIndex(g => g.id === gameId)
    
    if (existingIndex >= 0) {
      // Mettre à jour le jeu existant
      games[existingIndex] = {
        ...games[existingIndex],
        ...gameData,
        id: gameId,
        updatedAt: new Date().toISOString(),
      }
      console.log(`[github-games-service] Jeu ${gameId} mis à jour`)
    } else {
      // Ajouter le nouveau jeu
      const newGame = {
        ...gameData,
        id: gameId,
        addedAt: gameData.addedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      games.push(newGame)
      console.log(`[github-games-service] Nouveau jeu ${gameId} ajouté`)
    }
    
    // Mettre à jour sur GitHub
    await updateGamesOnGitHub({ games }, token)
    
    return { success: true, updated: existingIndex >= 0 }
  } catch (error) {
    console.error('[github-games-service] Error adding game to GitHub:', error)
    throw error
  }
}

/**
 * Met à jour un jeu
 */
export async function updateGameOnGitHub(gameId, updates, token = null) {
  try {
    console.log('[github-games-service] updateGameOnGitHub called for gameId:', gameId)
    
    // Récupérer les jeux existants
    const existingData = await getGamesFromGitHub(token)
    const games = existingData.games || []
    
    // Trouver le jeu
    const gameIndex = games.findIndex(g => g.id === gameId)
    if (gameIndex === -1) {
      throw new Error(`Jeu avec l'ID ${gameId} non trouvé`)
    }
    
    // Mettre à jour le jeu
    games[gameIndex] = {
      ...games[gameIndex],
      ...updates,
      id: gameId,
      updatedAt: new Date().toISOString(),
    }
    
    // Mettre à jour sur GitHub
    await updateGamesOnGitHub({ games }, token)
    
    console.log(`[github-games-service] Jeu ${gameId} mis à jour avec succès`)
    return { success: true }
  } catch (error) {
    console.error('[github-games-service] Error updating game on GitHub:', error)
    throw error
  }
}

/**
 * Supprime un jeu
 */
export async function deleteGameFromGitHub(gameId, token = null) {
  try {
    console.log('[github-games-service] deleteGameFromGitHub called for gameId:', gameId)
    
    // Récupérer les jeux existants
    const existingData = await getGamesFromGitHub(token)
    const games = existingData.games || []
    
    // Trouver et supprimer le jeu
    const gameIndex = games.findIndex(g => g.id === gameId)
    if (gameIndex === -1) {
      throw new Error(`Jeu avec l'ID ${gameId} non trouvé`)
    }
    
    games.splice(gameIndex, 1)
    
    // Mettre à jour sur GitHub
    await updateGamesOnGitHub({ games }, token)
    
    console.log(`[github-games-service] Jeu ${gameId} supprimé avec succès`)
    return true
  } catch (error) {
    console.error('[github-games-service] Error deleting game from GitHub:', error)
    throw error
  }
}

