/**
 * Script pour remplacer les anciens tokens GitHub par des variables d'environnement
 */

const fs = require('fs')
const path = require('path')

const OLD_TOKENS = [
  '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',
  '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'
]

const NEW_TOKEN_VAR = 'process.env.GITHUB_TOKEN'

function fixTokensInFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé: ${filePath}`)
    return false
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false

    OLD_TOKENS.forEach(oldToken => {
      if (content.includes(oldToken)) {
        console.log(`🔧 Remplacement du token dans: ${filePath}`)
        content = content.replace(new RegExp(oldToken, 'g'), NEW_TOKEN_VAR)
        modified = true
      }
    })

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`✅ Fichier mis à jour: ${filePath}`)
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ Erreur lors du traitement de ${filePath}:`, error.message)
    return false
  }
}

function fixAllTokens() {
  console.log('🔧 Nettoyage des tokens GitHub hardcodés...\n')

  const filesToFix = [
    'scripts/utils/clean-release-assets.js',
    'scripts/utils/delete-all-releases-except-current.js',
    'scripts/utils/fix-release-visibility.js',
    'scripts/utils/list-all-releases.js'
  ]

  let totalFixed = 0

  filesToFix.forEach(file => {
    const fullPath = path.join(__dirname, '..', file)
    if (fixTokensInFile(fullPath)) {
      totalFixed++
    }
  })

  console.log(`\n✅ ${totalFixed} fichier(s) corrigé(s)`)
  
  // Créer/mettre à jour le fichier .env avec le nouveau token
  const envPath = path.join(__dirname, '..', '.env')
  let envContent = ''
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8')
  }

  const newToken = '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'
  
  if (!envContent.includes('GITHUB_TOKEN=')) {
    envContent += `\n# GitHub Token pour les releases et mises à jour\nGITHUB_TOKEN=${newToken}\n`
    fs.writeFileSync(envPath, envContent, 'utf8')
    console.log('✅ Token ajouté au fichier .env')
  } else {
    // Remplacer le token existant
    envContent = envContent.replace(/GITHUB_TOKEN=.*/g, `GITHUB_TOKEN=${newToken}`)
    fs.writeFileSync(envPath, envContent, 'utf8')
    console.log('✅ Token mis à jour dans le fichier .env')
  }

  console.log('\n🎉 Nettoyage terminé! Vous pouvez maintenant committer et pousser.')
}

// Exécuter si appelé directement
if (require.main === module) {
  fixAllTokens()
}

module.exports = { fixTokensInFile, fixAllTokens }