/**
 * Script pour publier une release sur GitHub
 * Usage: node scripts/deploy/github-release.js <version> <exe-path>
 */

import fs from 'fs'
import https from 'https'
import path from 'path'
import { fileURLToPath } from 'url'
import { GITHUB_CONFIG } from '../../electron/github-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration GitHub pour les releases
// Le nom du repo peut être défini via la variable d'environnement GITHUB_REPO
// Sinon, on utilise 'launcher-offi' par défaut (détecté depuis git remote)
const GITHUB_REPO = {
  OWNER: 'lilian-stack',
  REPO: process.env.GITHUB_REPO || 'launcher-offi' // Nom du repo GitHub pour les releases
}

/**
 * Récupérer la release "latest"
 */
function getLatestRelease(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO.OWNER}/${GITHUB_REPO.REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Actoris-Launcher',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const release = JSON.parse(responseData)
          resolve(release)
        } else if (res.statusCode === 404) {
          resolve(null) // Aucune release latest
        } else {
          reject(new Error(`Erreur GitHub API: ${res.statusCode} - ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

/**
 * Récupérer une release existante par tag
 */
function getReleaseByTag(version, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO.OWNER}/${GITHUB_REPO.REPO}/releases/tags/v${version}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Actoris-Launcher',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const release = JSON.parse(responseData)
          resolve(release)
        } else if (res.statusCode === 404) {
          resolve(null) // Release n'existe pas
        } else {
          reject(new Error(`Erreur GitHub API: ${res.statusCode} - ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

/**
 * Mettre à jour une release existante
 */
function updateGitHubRelease(releaseId, version, releaseNotes, token) {
  return new Promise((resolve, reject) => {
    const body = typeof releaseNotes === 'string' ? releaseNotes : JSON.stringify(releaseNotes)
    
    const payload = {
      name: `Version ${version}`,
      body: body,
      draft: false,
      prerelease: false
    }
    
    const data = JSON.stringify(payload)

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO.OWNER}/${GITHUB_REPO.REPO}/releases/${releaseId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Actoris-Launcher',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const release = JSON.parse(responseData)
          resolve(release)
        } else {
          reject(new Error(`Erreur GitHub API: ${res.statusCode} - ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(data)
    req.end()
  })
}

/**
 * Créer une release sur GitHub
 */
function createGitHubRelease(version, releaseNotes, token) {
  return new Promise((resolve, reject) => {
    // S'assurer que releaseNotes est une chaîne valide
    const body = typeof releaseNotes === 'string' ? releaseNotes : JSON.stringify(releaseNotes)
    
    const payload = {
      tag_name: `v${version}`,
      name: `Version ${version}`,
      body: body,
      draft: false,
      prerelease: false
    }
    
    const data = JSON.stringify(payload)

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO.OWNER}/${GITHUB_REPO.REPO}/releases`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Actoris-Launcher',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const release = JSON.parse(responseData)
          resolve(release)
        } else {
          reject(new Error(`Erreur GitHub API: ${res.statusCode} - ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(data)
    req.end()
  })
}

/**
 * Supprimer un asset existant d'une release
 */
function deleteReleaseAsset(assetId, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO.OWNER}/${GITHUB_REPO.REPO}/releases/assets/${assetId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Actoris-Launcher',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
        } else {
          reject(new Error(`Erreur suppression asset GitHub: ${res.statusCode} - ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

/**
 * Uploader un fichier sur une release GitHub
 */
function uploadReleaseAsset(releaseId, filePath, token) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath)
    const fileStats = fs.statSync(filePath)
    const fileStream = fs.createReadStream(filePath)

    const options = {
      hostname: 'uploads.github.com',
      path: `/repos/${GITHUB_REPO.OWNER}/${GITHUB_REPO.REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileStats.size,
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Actoris-Launcher',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const asset = JSON.parse(responseData)
          resolve(asset)
        } else {
          reject(new Error(`Erreur upload GitHub: ${res.statusCode} - ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    fileStream.pipe(req)
  })
}

/**
 * Lire les patch notes
 */
function readPatchNotes(version) {
  try {
    const patchNotesPath = path.join(__dirname, '..', '..', 'docs', 'patch-notes', `PATCH_NOTES_${version}.md`)
    if (fs.existsSync(patchNotesPath)) {
      return fs.readFileSync(patchNotesPath, 'utf-8')
    }
    return `# Version ${version}\n\nNouvelle version du launcher Actoris.`
  } catch (error) {
    console.warn(`⚠️  Impossible de lire les patch notes: ${error.message}`)
    return `# Version ${version}\n\nNouvelle version du launcher Actoris.`
  }
}

/**
 * Fonction principale
 */
async function publishToGitHub(version, exePath) {
  try {
    console.log('🚀 Publication sur GitHub...')
    console.log('')

    // Vérifier le token GitHub
    const token = process.env.GITHUB_TOKEN || GITHUB_CONFIG.TOKEN
    if (!token) {
      throw new Error('GITHUB_TOKEN n\'est pas défini. Définissez la variable d\'environnement GITHUB_TOKEN ou configurez-la dans electron/github-config.js')
    }

    // Vérifier que le fichier .exe existe
    if (!fs.existsSync(exePath)) {
      throw new Error(`Le fichier .exe n'existe pas: ${exePath}`)
    }

    console.log(`📦 Version: ${version}`)
    console.log(`📁 Fichier: ${exePath}`)
    console.log(`📂 Repository: ${GITHUB_REPO.OWNER}/${GITHUB_REPO.REPO}`)
    console.log('')

    // Lire les patch notes
    const releaseNotes = readPatchNotes(version)
    console.log('📝 Patch notes chargées')

    // Vérifier quelle release est marquée comme "latest"
    console.log('🔍 Vérification de la release "latest"...')
    const latestRelease = await getLatestRelease(token).catch(() => null)
    if (latestRelease) {
      const latestVersion = latestRelease.tag_name.replace(/^v/, '')
      console.log(`   Release "latest" actuelle: ${latestVersion}`)
      if (latestVersion !== version) {
        console.log(`   ⚠️  La version ${version} n'est pas marquée comme "latest"`)
        console.log(`   ℹ️  GitHub marque automatiquement la release la plus récente comme "latest"`)
      }
    }

    // Vérifier si la release existe déjà
    console.log('🔍 Vérification de l\'existence de la release...')
    let release = await getReleaseByTag(version, token).catch(() => null)
    
    if (release) {
      console.log(`✅ Release existante trouvée: ${release.html_url}`)
      console.log('📤 Mise à jour de la release...')
      await updateGitHubRelease(release.id, version, releaseNotes, token)
      // Récupérer à nouveau la release pour avoir les assets
      release = await getReleaseByTag(version, token)
      console.log(`✅ Release mise à jour: ${release.html_url}`)
    } else {
      console.log('📤 Création d\'une nouvelle release sur GitHub...')
      release = await createGitHubRelease(version, releaseNotes, token)
      console.log(`✅ Release créée: ${release.html_url}`)
    }
    console.log('')

    // Vérifier si un asset avec le même nom existe déjà
    const fileName = path.basename(exePath)
    console.log(`🔍 Recherche d'assets existants (nom: ${fileName})...`)
    
    if (release.assets && release.assets.length > 0) {
      console.log(`📦 ${release.assets.length} asset(s) trouvé(s) dans la release`)
      // Afficher les noms des assets existants pour debug
      console.log(`   Assets existants: ${release.assets.map(a => a.name).join(', ')}`)
      // Supprimer tous les assets avec le même nom (au cas où il y en aurait plusieurs)
      const existingAssets = release.assets.filter(asset => asset.name === fileName)
      if (existingAssets.length > 0) {
        console.log(`🗑️  Suppression de ${existingAssets.length} asset(s) existant(s) avec le nom "${fileName}"...`)
        for (const asset of existingAssets) {
          try {
            console.log(`   Suppression de: ${asset.name} (ID: ${asset.id})`)
            await deleteReleaseAsset(asset.id, token)
            console.log(`   ✅ Asset supprimé`)
          } catch (error) {
            console.error(`   ❌ Erreur lors de la suppression: ${error.message}`)
          }
        }
        // Attendre que GitHub traite les suppressions
        console.log(`⏳ Attente de la propagation des suppressions...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
        // Récupérer à nouveau la release pour vérifier
        release = await getReleaseByTag(version, token)
        console.log(`✅ Vérification: ${release.assets ? release.assets.length : 0} asset(s) restant(s)`)
      } else {
        // Si aucun asset avec le nom exact n'est trouvé, chercher des assets .exe similaires
        const exeAssets = release.assets.filter(asset => asset.name.endsWith('.exe') && asset.name.includes(version))
        if (exeAssets.length > 0) {
          console.log(`⚠️  Assets .exe similaires trouvés, suppression...`)
          for (const asset of exeAssets) {
            try {
              console.log(`   Suppression de: ${asset.name} (ID: ${asset.id})`)
              await deleteReleaseAsset(asset.id, token)
              console.log(`   ✅ Asset supprimé`)
            } catch (error) {
              console.error(`   ❌ Erreur lors de la suppression: ${error.message}`)
            }
          }
          await new Promise(resolve => setTimeout(resolve, 3000))
          release = await getReleaseByTag(version, token)
        } else {
          console.log(`✅ Aucun asset existant avec le nom "${fileName}"`)
        }
      }
    } else {
      console.log(`✅ Aucun asset existant dans la release`)
    }

    // Uploader le fichier .exe
    console.log('📤 Upload du fichier .exe...')
    const fileSize = (fs.statSync(exePath).size / (1024 * 1024)).toFixed(2)
    console.log(`   Taille: ${fileSize} MB`)
    
    const asset = await uploadReleaseAsset(release.id, exePath, token)
    console.log(`✅ Fichier uploadé: ${asset.browser_download_url}`)
    console.log('')

    console.log('✅ Publication GitHub terminée avec succès!')
    console.log('')
    console.log(`🔗 Release: ${release.html_url}`)
    console.log(`📥 Téléchargement: ${asset.browser_download_url}`)
    console.log('')

    return { release, asset }
  } catch (error) {
    console.error('❌ Erreur lors de la publication GitHub:', error.message)
    throw error
  }
}

// Exécuter si appelé directement (pas en tant que module)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
if (isMainModule) {
  const version = process.argv[2]
  const exePath = process.argv[3]

  if (!version || !exePath) {
    console.error('Usage: node scripts/deploy/github-release.js <version> <exe-path>')
    process.exit(1)
  }

  publishToGitHub(version, exePath)
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export { publishToGitHub }

