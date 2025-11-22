import https from 'https'
import { Buffer } from 'buffer'
import { GITHUB_CONFIG } from './github-config.js'

/**
 * Fait une requête à l'API GitHub
 */
function githubRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${GITHUB_CONFIG.TOKEN}`,
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
 * Récupère le contenu du fichier user.json depuis GitHub
 */
export async function getUsersFromGitHub() {
  try {
    const path = `/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.USERS_FILE_PATH}`
    const file = await githubRequest('GET', path)
    
    // Décoder le contenu base64
    const content = Buffer.from(file.content, 'base64').toString('utf-8')
    const parsed = JSON.parse(content)
    
    // Gérer différents formats de fichier
    // Format 1: { users: [...] }
    if (parsed.users && Array.isArray(parsed.users)) {
      return parsed
    }
    // Format 2: [...] (tableau direct)
    if (Array.isArray(parsed)) {
      return { users: parsed }
    }
    // Format par défaut
    return { users: [] }
  } catch (error) {
    console.error('Error getting users from GitHub:', error)
    // Si le fichier n'existe pas, retourner un tableau vide
    if (error.message.includes('404')) {
      return { users: [] }
    }
    throw error
  }
}

/**
 * Met à jour le fichier users.json sur GitHub
 */
export async function updateUsersOnGitHub(users) {
  try {
    // Récupérer le SHA du fichier actuel (nécessaire pour la mise à jour)
    let sha = null
    try {
      const path = `/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.USERS_FILE_PATH}`
      const file = await githubRequest('GET', path)
      sha = file.sha
    } catch (error) {
      // Le fichier n'existe pas encore, on va le créer
    }

    // Encoder le contenu en base64
    const content = JSON.stringify(users, null, 2)
    const encodedContent = Buffer.from(content).toString('base64')

    const path = `/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.USERS_FILE_PATH}`
    const data = {
      message: `Update users - ${new Date().toISOString()}`,
      content: encodedContent,
    }

    if (sha) {
      data.sha = sha
    }

    await githubRequest('PUT', path, data)
    return true
  } catch (error) {
    throw error
  }
}

/**
 * Trouve un utilisateur par email ou username
 */
export async function findUser(email, username = null) {
  const data = await getUsersFromGitHub()
  const users = data.users || []
  
  return users.find(
    (user) => user.email === email || (username && user.username === username)
  )
}

/**
 * Crée un nouvel utilisateur
 */
export async function createUser(userData) {
  const data = await getUsersFromGitHub()
  const users = data.users || []

  // Vérifier si l'utilisateur existe déjà
  const existingUser = await findUser(userData.email, userData.username)
  if (existingUser) {
    throw new Error('Un utilisateur avec cet email ou ce nom d\'utilisateur existe déjà')
  }

  // Créer le nouvel utilisateur
  const newUser = {
    id: Date.now().toString(),
    username: userData.username,
    email: userData.email,
    password: userData.password, // En production, il faudrait hasher le mot de passe
    avatar: userData.avatar || null,
    isVip: false,
    createdAt: new Date().toISOString(),
  }

  users.push(newUser)
  await updateUsersOnGitHub({ users })

  return newUser
}

/**
 * Met à jour un utilisateur existant
 */
export async function updateUser(email, updates) {
  try {
    const data = await getUsersFromGitHub()
    const users = data.users || []
    
    const userIndex = users.findIndex(u => u.email === email)
    if (userIndex === -1) {
      throw new Error('Utilisateur non trouvé')
    }
    
    // Mettre à jour l'utilisateur
    users[userIndex] = { ...users[userIndex], ...updates }
    
    await updateUsersOnGitHub({ users })
    return users[userIndex]
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

/**
 * Supprime un utilisateur
 */
export async function deleteUser(email) {
  try {
    console.log('[github-service] deleteUser called for:', email)
    const data = await getUsersFromGitHub()
    const users = data.users || []
    
    console.log('[github-service] Current users count:', users.length)
    
    const userIndex = users.findIndex(u => u.email === email)
    if (userIndex === -1) {
      console.error('[github-service] User not found:', email)
      throw new Error('Utilisateur non trouvé')
    }
    
    console.log('[github-service] User found at index:', userIndex)
    
    // Supprimer l'utilisateur
    users.splice(userIndex, 1)
    console.log('[github-service] User removed, new count:', users.length)
    
    await updateUsersOnGitHub({ users })
    console.log('[github-service] Users updated on GitHub')
    
    return true
  } catch (error) {
    console.error('[github-service] Error deleting user:', error)
    throw error
  }
}

/**
 * Vérifie les identifiants de connexion
 */
export async function loginUser(email, password) {
  try {
    console.log('loginUser called with:', { email, password: '***' })
    
    const user = await findUser(email)
    console.log('User found:', user ? { id: user.id, email: user.email, username: user.username } : 'null')
    
    if (!user) {
      throw new Error('Email ou mot de passe incorrect')
    }

    if (user.password !== password) {
      console.log('Password mismatch')
      throw new Error('Email ou mot de passe incorrect')
    }

    // Définir automatiquement l'admin pour l'email spécifique
    const ADMIN_EMAIL = 'lilianlesieur82@gmail.com'
    if (email === ADMIN_EMAIL && !user.isAdmin) {
      console.log('Setting admin status for:', email)
      await updateUser(email, { isAdmin: true })
      user.isAdmin = true
    }

    // Ne pas retourner le mot de passe
    const { password: _, ...userWithoutPassword } = user
    console.log('Login successful for user:', userWithoutPassword.id)
    return userWithoutPassword
  } catch (error) {
    console.error('Error in loginUser:', error)
    throw error
  }
}

