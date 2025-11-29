/**
 * Script pour supprimer toutes les releases sauf les versions spécifiées
 */

import https from 'https'
import { GITHUB_CONFIG } from '../../electron/github-config.js'

const GITHUB_REPO = {
  OWNER: 'lilian-stack',
  REPO: 'launcher-offi'
}

// Versions à garder
const KEEP_VERSIONS = ['v1.0.25', '1.0.25', 'v1.0.22', '1.0.22']

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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (method === 'DELETE' && res.statusCode === 204) {
            resolve(null) // DELETE retourne 204 No Content
          } else {
            resolve(responseData ? JSON.parse(responseData) : null)
          }
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

async function deleteRelease(releaseId, tagName) {
  try {
    console.log(`   🗑️  Suppression de la release ${tagName} (ID: ${releaseId})...`)
    await makeRequest(`/releases/${releaseId}`, 'DELETE')
    console.log(`   ✅ Release ${tagName} supprimée`)
    return true
  } catch (error) {
    console.error(`   ❌ Erreur lors de la suppression de ${tagName}:`, error.message)
    return false
  }
}

async function cleanupReleases() {
  try {
    console.log('🔍 Récupération de toutes les releases...\n')
    
    // Récupérer toutes les releases
    const releases = await makeRequest('/releases?per_page=100')
    
    console.log(`📦 ${releases.length} release(s) trouvée(s)\n`)
    
    // Filtrer les releases à supprimer
    const releasesToDelete = releases.filter(release => {
      const tagName = release.tag_name
      const shouldKeep = KEEP_VERSIONS.includes(tagName)
      return !shouldKeep
    })
    
    const releasesToKeep = releases.filter(release => {
      const tagName = release.tag_name
      return KEEP_VERSIONS.includes(tagName)
    })
    
    console.log(`✅ Releases à conserver (${releasesToKeep.length}):`)
    releasesToKeep.forEach(r => {
      console.log(`   - ${r.tag_name}: ${r.name}`)
    })
    console.log('')
    
    console.log(`🗑️  Releases à supprimer (${releasesToDelete.length}):`)
    releasesToDelete.forEach(r => {
      console.log(`   - ${r.tag_name}: ${r.name}`)
    })
    console.log('')
    
    if (releasesToDelete.length === 0) {
      console.log('✅ Aucune release à supprimer !')
      return
    }
    
    // Demander confirmation
    console.log('⚠️  ATTENTION: Cette action est irréversible !')
    console.log('   Les releases seront définitivement supprimées de GitHub.\n')
    
    // Supprimer les releases
    let successCount = 0
    let failCount = 0
    
    for (const release of releasesToDelete) {
      const success = await deleteRelease(release.id, release.tag_name)
      if (success) {
        successCount++
      } else {
        failCount++
      }
      // Attendre un peu entre chaque suppression pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('')
    console.log('📊 Résumé:')
    console.log(`   ✅ ${successCount} release(s) supprimée(s) avec succès`)
    if (failCount > 0) {
      console.log(`   ❌ ${failCount} release(s) n'ont pas pu être supprimée(s)`)
    }
    console.log('')
    console.log('✅ Nettoyage terminé !')
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error.message)
    process.exit(1)
  }
}

cleanupReleases()

