/**
 * Script pour supprimer une release spécifique par tag
 */

import https from 'https'
import { GITHUB_CONFIG } from '../../electron/github-config.js'

const GITHUB_REPO = {
  OWNER: 'lilian-stack',
  REPO: 'launcher-offi'
}

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const token = process.env.GITHUB_TOKEN || GITHUB_CONFIG.TOKEN
    
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO.OWNER}/${GITHUB_REPO.REPO}${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Actoris-Launcher',
        'Accept': 'application/vnd.github.v3+json'
      }
    }
    
    if (data) {
      options.headers['Content-Type'] = 'application/json'
      options.headers['Content-Length'] = Buffer.byteLength(data, 'utf8')
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300 || res.statusCode === 204) {
          resolve(responseData ? JSON.parse(responseData) : null)
        } else {
          reject(new Error(`Erreur GitHub API: ${res.statusCode} - ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (data) {
      req.write(data)
    }
    
    req.end()
  })
}

async function deleteReleaseByTag(tagName) {
  try {
    console.log(`🔍 Recherche de la release avec le tag "${tagName}"...`)
    
    // Récupérer la release par tag
    const release = await makeRequest(`/releases/tags/${tagName}`)
    
    console.log(`✅ Release trouvée:`)
    console.log(`   Tag: ${release.tag_name}`)
    console.log(`   Nom: ${release.name}`)
    console.log(`   ID: ${release.id}`)
    console.log(`   URL: ${release.html_url}`)
    console.log('')
    
    console.log(`🗑️  Suppression de la release "${tagName}"...`)
    await makeRequest(`/releases/${release.id}`, 'DELETE')
    
    console.log(`✅ Release "${tagName}" supprimée avec succès !`)
    
  } catch (error) {
    if (error.message.includes('404')) {
      console.log(`❌ Release avec le tag "${tagName}" non trouvée`)
    } else {
      console.error(`❌ Erreur:`, error.message)
    }
    process.exit(1)
  }
}

const tagToDelete = process.argv[2]
if (!tagToDelete) {
  console.error('Usage: node scripts/deploy/delete-release.js <tag>')
  console.error('Exemple: node scripts/deploy/delete-release.js v1.0.22')
  process.exit(1)
}

deleteReleaseByTag(tagToDelete)

