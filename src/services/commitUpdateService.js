/**
 * Service de mise à jour basé sur les commits GitHub
 * Plus efficace que les releases - déploie seulement les fichiers modifiés
 */

class CommitUpdateService {
  constructor() {
    this.repoOwner = 'lilian-stack'
    this.repoName = 'launcher-offi'
    this.branch = 'main'
    this.currentCommit = null
    this.apiBase = 'https://api.github.com'
  }

  /**
   * Récupère le commit actuel de l'application
   */
  getCurrentCommit() {
    // Le commit hash sera injecté au build
    return window.__COMMIT_HASH__ || localStorage.getItem('app_commit_hash') || null
  }

  /**
   * Sauvegarde le commit actuel
   */
  setCurrentCommit(commitHash) {
    this.currentCommit = commitHash
    localStorage.setItem('app_commit_hash', commitHash)
  }

  /**
   * Récupère le dernier commit de la branche main
   */
  async getLatestCommit() {
    try {
      const response = await fetch(`${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/commits/${this.branch}`)
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const commit = await response.json()
      return {
        sha: commit.sha,
        message: commit.commit.message,
        date: commit.commit.author.date,
        author: commit.commit.author.name,
        url: commit.html_url
      }
    } catch (error) {
      console.error('[CommitUpdate] Erreur récupération dernier commit:', error)
      throw error
    }
  }

  /**
   * Compare les commits pour voir s'il y a une mise à jour
   */
  async checkForUpdates() {
    try {
      const currentCommit = this.getCurrentCommit()
      const latestCommit = await this.getLatestCommit()

      console.log('[CommitUpdate] Commit actuel:', currentCommit)
      console.log('[CommitUpdate] Dernier commit:', latestCommit.sha)

      if (!currentCommit) {
        // Premier lancement, sauvegarder le commit actuel
        this.setCurrentCommit(latestCommit.sha)
        return {
          hasUpdate: false,
          reason: 'first_run'
        }
      }

      if (currentCommit === latestCommit.sha) {
        return {
          hasUpdate: false,
          reason: 'up_to_date'
        }
      }

      // Il y a une mise à jour disponible
      const changedFiles = await this.getChangedFiles(currentCommit, latestCommit.sha)
      
      return {
        hasUpdate: true,
        currentCommit,
        latestCommit,
        changedFiles,
        updateSize: this.estimateUpdateSize(changedFiles)
      }
    } catch (error) {
      console.error('[CommitUpdate] Erreur vérification mises à jour:', error)
      throw error
    }
  }

  /**
   * Récupère la liste des fichiers modifiés entre deux commits
   */
  async getChangedFiles(fromCommit, toCommit) {
    try {
      const response = await fetch(
        `${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/compare/${fromCommit}...${toCommit}`
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const comparison = await response.json()
      
      return comparison.files.map(file => ({
        filename: file.filename,
        status: file.status, // added, modified, removed
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        downloadUrl: file.status !== 'removed' ? this.getFileDownloadUrl(file.filename, toCommit) : null
      }))
    } catch (error) {
      console.error('[CommitUpdate] Erreur récupération fichiers modifiés:', error)
      throw error
    }
  }

  /**
   * Génère l'URL de téléchargement d'un fichier à un commit spécifique
   */
  getFileDownloadUrl(filename, commitSha) {
    return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${commitSha}/${filename}`
  }

  /**
   * Estime la taille de la mise à jour
   */
  estimateUpdateSize(changedFiles) {
    // Estimation basée sur le nombre de changements
    const totalChanges = changedFiles.reduce((sum, file) => sum + (file.changes || 0), 0)
    
    // Estimation approximative : 1 changement ≈ 50 bytes
    const estimatedBytes = totalChanges * 50
    
    return {
      bytes: estimatedBytes,
      formatted: this.formatBytes(estimatedBytes),
      fileCount: changedFiles.length
    }
  }

  /**
   * Formate les bytes en format lisible
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Télécharge et applique une mise à jour
   */
  async downloadAndApplyUpdate(updateInfo) {
    try {
      console.log('[CommitUpdate] Début téléchargement mise à jour...')
      
      const { changedFiles, latestCommit } = updateInfo
      const totalFiles = changedFiles.length
      let processedFiles = 0

      // Notifier le début du téléchargement
      this.notifyProgress(0, 'Préparation de la mise à jour...')

      for (const file of changedFiles) {
        try {
          if (file.status === 'removed') {
            // Fichier supprimé - le signaler mais ne pas essayer de le télécharger
            console.log(`[CommitUpdate] Fichier supprimé: ${file.filename}`)
          } else if (file.downloadUrl) {
            // Télécharger le fichier modifié/ajouté
            await this.downloadFile(file.downloadUrl, file.filename)
            console.log(`[CommitUpdate] Fichier mis à jour: ${file.filename}`)
          }

          processedFiles++
          const progress = (processedFiles / totalFiles) * 100
          this.notifyProgress(progress, `Mise à jour: ${file.filename}`)

        } catch (fileError) {
          console.error(`[CommitUpdate] Erreur fichier ${file.filename}:`, fileError)
          // Continuer avec les autres fichiers
        }
      }

      // Sauvegarder le nouveau commit hash
      this.setCurrentCommit(latestCommit.sha)
      
      console.log('[CommitUpdate] Mise à jour terminée avec succès')
      this.notifyProgress(100, 'Mise à jour terminée - Redémarrage requis')

      return {
        success: true,
        filesUpdated: processedFiles,
        newCommit: latestCommit.sha
      }

    } catch (error) {
      console.error('[CommitUpdate] Erreur lors de la mise à jour:', error)
      throw error
    }
  }

  /**
   * Télécharge un fichier spécifique
   */
  async downloadFile(url, filename) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Erreur téléchargement ${filename}: ${response.status}`)
    }

    const content = await response.text()
    
    // Dans un vrai environnement Electron, on écrirait le fichier sur le disque
    // Ici on simule en sauvegardant dans localStorage pour la démo
    localStorage.setItem(`updated_file_${filename}`, content)
    
    return content
  }

  /**
   * Notifie le progrès de la mise à jour
   */
  notifyProgress(progress, message) {
    // Émettre un événement personnalisé pour l'UI
    window.dispatchEvent(new CustomEvent('update-progress', {
      detail: { progress, message }
    }))
  }

  /**
   * Récupère l'historique des commits récents
   */
  async getCommitHistory(limit = 10) {
    try {
      const response = await fetch(
        `${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/commits?per_page=${limit}&sha=${this.branch}`
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const commits = await response.json()
      
      return commits.map(commit => ({
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        message: commit.commit.message,
        date: commit.commit.author.date,
        author: commit.commit.author.name,
        url: commit.html_url
      }))
    } catch (error) {
      console.error('[CommitUpdate] Erreur récupération historique:', error)
      throw error
    }
  }
}

// Instance singleton
export const commitUpdateService = new CommitUpdateService()