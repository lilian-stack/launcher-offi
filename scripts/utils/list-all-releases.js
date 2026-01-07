import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration GitHub (même que dans github-release.js)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_OWNER = 'lilian-stack'
const GITHUB_REPO = 'launcher-offi'

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN manquant')
  process.exit(1)
}

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

console.log('🔍 Scan de toutes les releases GitHub...\n')
console.log(`📦 Repository: ${GITHUB_OWNER}/${GITHUB_REPO}\n`)

try {
  // Récupérer toutes les releases (paginated)
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

  console.log(`✅ ${releases.length} release(s) trouvée(s)\n`)
  console.log('═'.repeat(80))
  console.log('📋 LISTE DES RELEASES')
  console.log('═'.repeat(80))
  console.log()

  if (releases.length === 0) {
    console.log('Aucune release trouvée.')
  } else {
    releases.forEach((release, index) => {
      const isDraft = release.draft ? '📝 DRAFT' : ''
      const isPrerelease = release.prerelease ? '🔶 PRERELEASE' : ''
      const isLatest = release.tag_name.includes('latest') ? '⭐ LATEST' : ''
      
      console.log(`${index + 1}. ${release.tag_name} ${isDraft} ${isPrerelease} ${isLatest}`)
      console.log(`   📅 Date: ${new Date(release.published_at || release.created_at).toLocaleString('fr-FR')}`)
      console.log(`   📝 Titre: ${release.name || release.tag_name}`)
      
      if (release.body) {
        const preview = release.body.substring(0, 100).replace(/\n/g, ' ')
        console.log(`   📄 Description: ${preview}${release.body.length > 100 ? '...' : ''}`)
      }
      
      console.log(`   📦 Assets: ${release.assets?.length || 0} fichier(s)`)
      if (release.assets && release.assets.length > 0) {
        release.assets.forEach(asset => {
          const sizeMB = (asset.size / (1024 * 1024)).toFixed(2)
          console.log(`      • ${asset.name} (${sizeMB} MB)`)
        })
      }
      
      console.log(`   🔗 URL: ${release.html_url}`)
      console.log()
    })
  }

  console.log('═'.repeat(80))
  console.log(`\n📊 RÉSUMÉ:`)
  console.log(`   • Total: ${releases.length} release(s)`)
  console.log(`   • Drafts: ${releases.filter(r => r.draft).length}`)
  console.log(`   • Prereleases: ${releases.filter(r => r.prerelease).length}`)
  console.log(`   • Releases finales: ${releases.filter(r => !r.draft && !r.prerelease).length}`)
  console.log()

} catch (error) {
  console.error('❌ Erreur lors du scan des releases:', error.message)
  if (error.response) {
    console.error('   Status:', error.response.status)
    console.error('   Message:', error.response.data?.message)
  }
  process.exit(1)
}

