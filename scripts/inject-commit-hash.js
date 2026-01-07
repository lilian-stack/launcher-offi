/**
 * Script pour injecter le commit hash dans l'application
 * À exécuter pendant le build pour tracer la version
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function getCurrentCommitHash() {
  try {
    // Récupérer le hash du commit actuel
    const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    console.log('✅ Commit hash récupéré:', commitHash.substring(0, 7))
    return commitHash
  } catch (error) {
    console.warn('⚠️ Impossible de récupérer le commit hash:', error.message)
    return 'unknown'
  }
}

function injectCommitHash() {
  const commitHash = getCurrentCommitHash()
  
  // Créer un fichier de version
  const versionFile = path.join(__dirname, '../src/version.js')
  const versionContent = `// Généré automatiquement - Ne pas modifier
export const COMMIT_HASH = '${commitHash}'
export const BUILD_DATE = '${new Date().toISOString()}'
export const SHORT_HASH = '${commitHash.substring(0, 7)}'
`

  fs.writeFileSync(versionFile, versionContent, 'utf8')
  console.log('✅ Fichier de version créé:', versionFile)

  // Mettre à jour le index.html pour injecter le hash globalement
  const indexPath = path.join(__dirname, '../public/index.html')
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8')
    
    // Injecter le script avec le commit hash
    const scriptTag = `<script>window.__COMMIT_HASH__ = '${commitHash}'; window.__BUILD_DATE__ = '${new Date().toISOString()}';</script>`
    
    if (indexContent.includes('window.__COMMIT_HASH__')) {
      // Remplacer l'existant
      indexContent = indexContent.replace(
        /<script>window\.__COMMIT_HASH__.*?<\/script>/,
        scriptTag
      )
    } else {
      // Ajouter avant la fermeture du head
      indexContent = indexContent.replace('</head>', `  ${scriptTag}\n</head>`)
    }
    
    fs.writeFileSync(indexPath, indexContent, 'utf8')
    console.log('✅ Commit hash injecté dans index.html')
  }

  // Créer un fichier de métadonnées pour Electron
  const metadataFile = path.join(__dirname, '../electron/build-metadata.json')
  const metadata = {
    commitHash,
    shortHash: commitHash.substring(0, 7),
    buildDate: new Date().toISOString(),
    branch: getCurrentBranch(),
    version: getPackageVersion()
  }

  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf8')
  console.log('✅ Métadonnées de build créées:', metadataFile)

  return commitHash
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  } catch (error) {
    return 'unknown'
  }
}

function getPackageVersion() {
  try {
    const packagePath = path.join(__dirname, '../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    return packageJson.version
  } catch (error) {
    return '0.0.0'
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  console.log('🔨 Injection du commit hash...')
  const commitHash = injectCommitHash()
  console.log('✅ Terminé! Commit:', commitHash.substring(0, 7))
}

module.exports = { injectCommitHash, getCurrentCommitHash }