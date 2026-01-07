import https from 'https'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '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'
const GITHUB_OWNER = 'lilian-stack'
const GITHUB_REPO = 'launcher-offi'

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
        } else if (res.statusCode === 204) {
          resolve(null)
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

async function deleteAsset(assetId) {
  return githubRequest(`/releases/assets/${assetId}`, {
    method: 'DELETE'
  })
}

async function main() {
  console.log('🧹 Nettoyage des assets de la release v1.0.0...\n')
  
  try {
    // Récupérer la release v1.0.0
    const releases = await githubRequest('/releases?per_page=100')
    const release = releases.find(r => r.tag_name === 'v1.0.0')
    
    if (!release) {
      console.error('❌ Release v1.0.0 non trouvée')
      process.exit(1)
    }
    
    console.log(`✅ Release trouvée: ${release.tag_name}`)
    console.log(`   📦 Assets actuels: ${release.assets?.length || 0}\n`)
    
    if (!release.assets || release.assets.length === 0) {
      console.log('✅ Aucun asset à nettoyer')
      return
    }
    
    // Afficher les assets
    release.assets.forEach((asset, index) => {
      const sizeMB = (asset.size / (1024 * 1024)).toFixed(2)
      console.log(`   ${index + 1}. ${asset.name} (${sizeMB} MB)`)
    })
    console.log()
    
    // Supprimer tous les assets sauf Actoris-Setup-1.0.0.exe
    const assetsToDelete = release.assets.filter(asset => 
      asset.name !== 'Actoris-Setup-1.0.0.exe'
    )
    
    if (assetsToDelete.length === 0) {
      console.log('✅ Aucun asset à supprimer (seul Actoris-Setup-1.0.0.exe est présent)')
      return
    }
    
    console.log(`🗑️  Suppression de ${assetsToDelete.length} asset(s) incorrect(s)...\n`)
    
    for (const asset of assetsToDelete) {
      try {
        console.log(`   🗑️  Suppression de ${asset.name}...`)
        await deleteAsset(asset.id)
        console.log(`   ✅ ${asset.name} supprimé`)
      } catch (error) {
        console.error(`   ❌ Erreur lors de la suppression de ${asset.name}:`, error.message)
      }
    }
    
    console.log('\n✅ Nettoyage terminé !')
    console.log(`   📦 Asset restant: Actoris-Setup-1.0.0.exe`)
    console.log(`   🔗 URL: ${release.html_url}`)
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

main()

