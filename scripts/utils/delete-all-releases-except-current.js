import https from 'https'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_OWNER = 'lilian-stack'
const GITHUB_REPO = 'launcher-offi'
const KEEP_VERSION = 'v1.0.0' // Version à garder

// Fonction pour faire une requête GitHub API
function githubRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}${endpoint}`
    
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers
      }
    }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            resolve(data)
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })
    
    req.on('error', reject)
    
    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    
    req.end()
  })
}

// Fonction pour supprimer une release
async function deleteRelease(releaseId) {
  return githubRequest(`/releases/${releaseId}`, {
    method: 'DELETE'
  })
}

async function main() {
  console.log('🗑️  Suppression de toutes les releases sauf la version actuelle...\n')
  console.log(`📦 Repository: ${GITHUB_OWNER}/${GITHUB_REPO}`)
  console.log(`✅ Version à garder: ${KEEP_VERSION}\n`)
  console.log('═'.repeat(80))

  try {
    // Récupérer toutes les releases
    const releases = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const data = await githubRequest(`/releases?per_page=100&page=${page}`)

      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false
      } else {
        releases.push(...data)
        page++
        if (data.length < 100) {
          hasMore = false
        }
      }
    }

    console.log(`\n📋 ${releases.length} release(s) trouvée(s)\n`)

    // Filtrer les releases à supprimer (toutes sauf KEEP_VERSION)
    const releasesToDelete = releases.filter(release => release.tag_name !== KEEP_VERSION)
    const keepRelease = releases.find(release => release.tag_name === KEEP_VERSION)

    if (!keepRelease) {
      console.error(`❌ La version ${KEEP_VERSION} n'a pas été trouvée !`)
      console.error('⚠️  Annulation de la suppression pour éviter de tout supprimer.')
      process.exit(1)
    }

    console.log(`✅ Version à garder trouvée: ${keepRelease.tag_name}`)
    console.log(`   📅 Date: ${new Date(keepRelease.published_at || keepRelease.created_at).toLocaleString('fr-FR')}`)
    console.log(`   🔗 URL: ${keepRelease.html_url}\n`)
    console.log(`🗑️  Releases à supprimer: ${releasesToDelete.length}\n`)

    if (releasesToDelete.length === 0) {
      console.log('✅ Aucune release à supprimer.')
      return
    }

    // Demander confirmation
    console.log('⚠️  ATTENTION: Cette action est irréversible !')
    console.log(`   Vous allez supprimer ${releasesToDelete.length} release(s).\n`)
    
    // Afficher les releases qui seront supprimées
    console.log('📋 Releases qui seront supprimées:')
    releasesToDelete.forEach((release, index) => {
      const isDraft = release.draft ? '📝 DRAFT' : ''
      const isPrerelease = release.prerelease ? '🔶 PRERELEASE' : ''
      console.log(`   ${index + 1}. ${release.tag_name} ${isDraft} ${isPrerelease}`)
    })
    console.log()

    // Supprimer les releases
    let deleted = 0
    let errors = 0

    for (const release of releasesToDelete) {
      try {
        console.log(`🗑️  Suppression de ${release.tag_name}...`)
        await deleteRelease(release.id)
        deleted++
        console.log(`   ✅ ${release.tag_name} supprimée`)
      } catch (error) {
        errors++
        console.error(`   ❌ Erreur lors de la suppression de ${release.tag_name}:`, error.message)
      }
    }

    console.log('\n' + '═'.repeat(80))
    console.log('📊 RÉSUMÉ:')
    console.log(`   ✅ Supprimées: ${deleted}`)
    console.log(`   ❌ Erreurs: ${errors}`)
    console.log(`   🔒 Conservée: ${KEEP_VERSION}`)
    console.log('═'.repeat(80))

  } catch (error) {
    console.error('❌ Erreur lors de la suppression des releases:', error.message)
    if (error.response) {
      console.error('   Status:', error.response.status)
      console.error('   Message:', error.response.data?.message)
    }
    process.exit(1)
  }
}

main()

