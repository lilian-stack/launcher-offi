/**
 * Script pour vérifier les mises à jour disponibles
 * Utilise l'API GitHub pour comparer les commits
 */

const https = require('https')

const REPO_OWNER = 'lilian-stack'
const REPO_NAME = 'launcher-offi'
const BRANCH = 'main'

function makeGitHubRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'User-Agent': 'Actoris-Launcher-Updater',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
          } else {
            reject(new Error(`GitHub API Error: ${res.statusCode} - ${parsed.message || data}`))
          }
        } catch (error) {
          reject(new Error(`Parse Error: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

async function getLatestCommit() {
  try {
    const endpoint = `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`
    const commit = await makeGitHubRequest(endpoint)
    
    return {
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      date: commit.commit.author.date,
      author: commit.commit.author.name,
      url: commit.html_url
    }
  } catch (error) {
    console.error('❌ Erreur récupération dernier commit:', error.message)
    throw error
  }
}

async function getCommitComparison(fromCommit, toCommit) {
  try {
    const endpoint = `/repos/${REPO_OWNER}/${REPO_NAME}/compare/${fromCommit}...${toCommit}`
    const comparison = await makeGitHubRequest(endpoint)
    
    return {
      ahead_by: comparison.ahead_by,
      behind_by: comparison.behind_by,
      total_commits: comparison.total_commits,
      files: comparison.files.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes
      }))
    }
  } catch (error) {
    console.error('❌ Erreur comparaison commits:', error.message)
    throw error
  }
}

async function getCommitHistory(limit = 10) {
  try {
    const endpoint = `/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=${limit}&sha=${BRANCH}`
    const commits = await makeGitHubRequest(endpoint)
    
    return commits.map(commit => ({
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      date: commit.commit.author.date,
      author: commit.commit.author.name,
      url: commit.html_url
    }))
  } catch (error) {
    console.error('❌ Erreur récupération historique:', error.message)
    throw error
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function estimateUpdateSize(files) {
  const totalChanges = files.reduce((sum, file) => sum + (file.changes || 0), 0)
  const estimatedBytes = totalChanges * 50 // Estimation approximative
  
  return {
    bytes: estimatedBytes,
    formatted: formatBytes(estimatedBytes),
    fileCount: files.length
  }
}

async function checkForUpdates(currentCommit) {
  try {
    console.log('🔍 Vérification des mises à jour...')
    console.log(`📍 Commit actuel: ${currentCommit ? currentCommit.substring(0, 7) : 'inconnu'}`)
    
    const latestCommit = await getLatestCommit()
    console.log(`📍 Dernier commit: ${latestCommit.shortSha}`)
    
    if (!currentCommit) {
      console.log('ℹ️ Premier lancement - aucune mise à jour nécessaire')
      return {
        hasUpdate: false,
        reason: 'first_run',
        latestCommit
      }
    }
    
    if (currentCommit === latestCommit.sha) {
      console.log('✅ Application à jour')
      return {
        hasUpdate: false,
        reason: 'up_to_date',
        latestCommit
      }
    }
    
    console.log('🔄 Analyse des changements...')
    const comparison = await getCommitComparison(currentCommit, latestCommit.sha)
    const updateSize = estimateUpdateSize(comparison.files)
    
    console.log('🆕 Mise à jour disponible!')
    console.log(`📊 ${comparison.total_commits} nouveau(x) commit(s)`)
    console.log(`📁 ${updateSize.fileCount} fichier(s) modifié(s)`)
    console.log(`💾 Taille estimée: ${updateSize.formatted}`)
    
    return {
      hasUpdate: true,
      currentCommit,
      latestCommit,
      comparison,
      updateSize,
      changedFiles: comparison.files
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message)
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  const currentCommit = args[0] || null
  
  console.log('🚀 Vérificateur de mises à jour basé sur les commits')
  console.log('=' .repeat(50))
  
  try {
    const result = await checkForUpdates(currentCommit)
    
    if (result.hasUpdate) {
      console.log('\n📋 Détails de la mise à jour:')
      console.log(`📝 Message: ${result.latestCommit.message}`)
      console.log(`👤 Auteur: ${result.latestCommit.author}`)
      console.log(`📅 Date: ${new Date(result.latestCommit.date).toLocaleString('fr-FR')}`)
      
      if (result.changedFiles.length > 0) {
        console.log('\n📁 Fichiers modifiés:')
        result.changedFiles.slice(0, 10).forEach(file => {
          const statusIcon = file.status === 'added' ? '➕' : 
                           file.status === 'modified' ? '📝' : '❌'
          console.log(`  ${statusIcon} ${file.filename}`)
        })
        
        if (result.changedFiles.length > 10) {
          console.log(`  ... et ${result.changedFiles.length - 10} autre(s) fichier(s)`)
        }
      }
    }
    
    // Afficher l'historique récent
    console.log('\n📚 Commits récents:')
    const history = await getCommitHistory(5)
    history.forEach((commit, index) => {
      const isCurrent = currentCommit && commit.sha === currentCommit
      const isLatest = index === 0
      const prefix = isCurrent ? '👉' : isLatest ? '🆕' : '  '
      console.log(`${prefix} ${commit.shortSha} - ${commit.message} (${commit.author})`)
    })
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message)
    process.exit(1)
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main()
}

module.exports = {
  getLatestCommit,
  getCommitComparison,
  getCommitHistory,
  checkForUpdates,
  estimateUpdateSize
}