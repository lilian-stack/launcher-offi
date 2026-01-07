/**
 * Script de déploiement automatique basé sur les commits
 * Push les changements vers GitHub pour déclencher les mises à jour
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function getCurrentCommitHash() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch (error) {
    console.error('❌ Impossible de récupérer le commit hash:', error.message)
    return null
  }
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  } catch (error) {
    console.error('❌ Impossible de récupérer la branche:', error.message)
    return 'main'
  }
}

function hasUncommittedChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
    return status.length > 0
  } catch (error) {
    return false
  }
}

function commitAndPush(message) {
  try {
    console.log('📝 Ajout des fichiers modifiés...')
    execSync('git add .', { stdio: 'inherit' })
    
    console.log('💾 Création du commit...')
    execSync(`git commit -m "${message}"`, { stdio: 'inherit' })
    
    const branch = getCurrentBranch()
    console.log(`🚀 Push vers ${branch}...`)
    execSync(`git push origin ${branch}`, { stdio: 'inherit' })
    
    return true
  } catch (error) {
    console.error('❌ Erreur lors du commit/push:', error.message)
    return false
  }
}

function updateVersionFile() {
  const versionFile = path.join(__dirname, '../src/version.js')
  const commitHash = getCurrentCommitHash()
  
  if (!commitHash) return false
  
  const versionContent = `// Généré automatiquement - Ne pas modifier
export const COMMIT_HASH = '${commitHash}'
export const BUILD_DATE = '${new Date().toISOString()}'
export const SHORT_HASH = '${commitHash.substring(0, 7)}'
`

  fs.writeFileSync(versionFile, versionContent, 'utf8')
  console.log('✅ Fichier de version mis à jour')
  return true
}

function createDeploymentInfo() {
  const deploymentFile = path.join(__dirname, '../deployment-info.json')
  const commitHash = getCurrentCommitHash()
  const branch = getCurrentBranch()
  
  const deploymentInfo = {
    commitHash,
    shortHash: commitHash ? commitHash.substring(0, 7) : 'unknown',
    branch,
    deployedAt: new Date().toISOString(),
    version: getPackageVersion(),
    deploymentType: 'commit-based'
  }
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2), 'utf8')
  console.log('✅ Informations de déploiement créées')
  return deploymentInfo
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

function main() {
  console.log('🚀 Déploiement automatique basé sur les commits')
  console.log('=' .repeat(50))
  
  // Vérifier s'il y a des changements
  if (!hasUncommittedChanges()) {
    console.log('ℹ️ Aucun changement à déployer')
    return
  }
  
  // Mettre à jour le fichier de version
  if (!updateVersionFile()) {
    console.error('❌ Impossible de mettre à jour le fichier de version')
    return
  }
  
  // Créer les informations de déploiement
  const deploymentInfo = createDeploymentInfo()
  
  // Demander le message de commit
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  rl.question('📝 Message de commit (ou Entrée pour message auto): ', (message) => {
    const commitMessage = message.trim() || `🚀 Auto-deploy: ${deploymentInfo.shortHash} - ${new Date().toLocaleString('fr-FR')}`
    
    console.log(`\n💾 Commit: "${commitMessage}"`)
    
    if (commitAndPush(commitMessage)) {
      console.log('\n✅ Déploiement réussi!')
      console.log(`🔗 Commit: ${deploymentInfo.commitHash}`)
      console.log(`📅 Déployé: ${deploymentInfo.deployedAt}`)
      console.log('\n🎯 Les utilisateurs recevront automatiquement la mise à jour')
    } else {
      console.log('\n❌ Échec du déploiement')
    }
    
    rl.close()
  })
}

// Exécuter si appelé directement
if (require.main === module) {
  main()
}

module.exports = { 
  getCurrentCommitHash, 
  hasUncommittedChanges, 
  commitAndPush, 
  createDeploymentInfo 
}