import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

async function main() {
  console.log('🔧 Correction de la visibilité de la release v1.0.0...\n')
  
  try {
    // Récupérer toutes les releases
    const releases = await githubRequest('/releases?per_page=100')
    const targetRelease = releases.find(r => r.tag_name === 'v1.0.0')
    
    if (!targetRelease) {
      console.error('❌ Release v1.0.0 non trouvée')
      process.exit(1)
    }
    
    console.log('📋 État actuel de la release:')
    console.log(`   • Tag: ${targetRelease.tag_name}`)
    console.log(`   • Draft: ${targetRelease.draft}`)
    console.log(`   • Prerelease: ${targetRelease.prerelease}`)
    console.log(`   • Published: ${targetRelease.published_at ? 'Oui' : 'Non'}`)
    console.log(`   • Created: ${targetRelease.created_at}`)
    console.log()
    
    // Mettre à jour la release pour s'assurer qu'elle n'est pas draft/prerelease
    console.log('🔄 Mise à jour de la release...')
    
    const updateData = {
      tag_name: 'v1.0.0',
      name: 'Version 1.0.0 - Actoris Launcher Stable',
      body: targetRelease.body || `# Version 1.0.0 - Actoris Launcher Stable

Cette version marque le lancement officiel d'Actoris Launcher.

## 🎯 Fonctionnalités principales

- ✅ Interface moderne et intuitive
- ✅ Téléchargement et installation automatique des jeux
- ✅ Gestion de bibliothèque complète
- ✅ Mises à jour automatiques
- ✅ Support Discord OAuth2
- ✅ Extraction automatique des archives (ZIP, RAR, 7Z, etc.)

## 📦 Installation

Téléchargez le fichier \`Actoris-Setup-1.0.0.exe\` et lancez l'installation.

## 🔗 Liens

- [Télécharger](https://github.com/lilian-stack/launcher-offi/releases/download/v1.0.0/Actoris-Setup-1.0.0.exe)
`,
      draft: false,
      prerelease: false
    }
    
    const updated = await githubRequest(`/releases/${targetRelease.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: updateData
    })
    
    console.log('✅ Release mise à jour !\n')
    console.log('📊 Nouvel état:')
    console.log(`   • Tag: ${updated.tag_name}`)
    console.log(`   • Draft: ${updated.draft}`)
    console.log(`   • Prerelease: ${updated.prerelease}`)
    console.log(`   • Published: ${updated.published_at ? 'Oui' : 'Non'}`)
    console.log(`   • URL: ${updated.html_url}\n`)
    
    // Vérifier si elle est maintenant "latest"
    console.log('🔍 Vérification de la release "latest"...')
    await new Promise(resolve => setTimeout(resolve, 2000)) // Attendre 2 secondes
    
    try {
      const latest = await githubRequest('/releases/latest')
      if (latest && latest.tag_name === 'v1.0.0') {
        console.log('✅ La release v1.0.0 est maintenant marquée comme "latest" !')
      } else {
        console.log('⚠️  La release n\'est pas encore marquée comme "latest"')
        console.log('   GitHub peut prendre quelques minutes pour mettre à jour.')
        console.log('   Vérifiez sur: https://github.com/lilian-stack/launcher-offi/releases')
      }
    } catch (err) {
      console.log('⚠️  Impossible de vérifier la release "latest"')
      console.log('   Cela peut prendre quelques minutes pour que GitHub mette à jour.')
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

main()

