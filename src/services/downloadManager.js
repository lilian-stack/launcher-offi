// Gestionnaire global des téléchargements
class DownloadManager {
  constructor() {
    this.downloads = new Map() // Map<gameId, downloadInfo>
    this.listeners = new Set()
    this.toastCallback = null
    this.navigateCallback = null
    this.initialized = false
  }

  // Initialiser le DownloadManager avec les callbacks
  init(toastCallback, navigateCallback) {
    this.toastCallback = toastCallback
    this.navigateCallback = navigateCallback
    this.initialized = true

    // Écouter les événements IPC depuis Electron
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('download:started', (event, data) => {
        this.handleDownloadStarted(data)
      })

      window.electron.ipcRenderer.on('download:progress', (event, data) => {
        this.handleDownloadProgress(data)
      })

      window.electron.ipcRenderer.on('download:complete', (event, data) => {
        this.handleDownloadComplete(data)
      })

      window.electron.ipcRenderer.on('download:error', (event, data) => {
        this.handleDownloadError(data)
      })

      window.electron.ipcRenderer.on('extraction-started', (event, data) => {
        this.handleExtractionStarted(data)
      })

      window.electron.ipcRenderer.on('download:extracted', (event, data) => {
        this.handleExtractionComplete(data)
      })

      window.electron.ipcRenderer.on('download:extraction-failed', (event, data) => {
        this.handleExtractionFailed(data)
      })
    }
  }

  // Nettoyer les listeners
  cleanup() {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.removeAllListeners('download:started')
      window.electron.ipcRenderer.removeAllListeners('download:progress')
      window.electron.ipcRenderer.removeAllListeners('download:complete')
      window.electron.ipcRenderer.removeAllListeners('download:error')
      window.electron.ipcRenderer.removeAllListeners('extraction-started')
      window.electron.ipcRenderer.removeAllListeners('download:extracted')
      window.electron.ipcRenderer.removeAllListeners('download:extraction-failed')
    }
    this.toastCallback = null
    this.navigateCallback = null
    this.initialized = false
  }

  // Gérer le démarrage d'un téléchargement
  handleDownloadStarted(data) {
    const { gameId, gameName, totalBytes } = data
    this.startDownload(gameId, gameName, { total: totalBytes || 0 })
    
    if (this.toastCallback) {
      // Créer l'action comme un objet avec les propriétés nécessaires
      // Le composant Toast créera le bouton à partir de ces propriétés
      const action = this.navigateCallback ? {
        label: 'Voir dans les téléchargements',
        onClick: () => this.navigateCallback('downloads')
      } : null
      this.toastCallback(`Téléchargement de ${gameName} lancé !`, 'download', 10000, action)
    }
  }

  // Gérer la progression d'un téléchargement
  handleDownloadProgress(data) {
    const {
      gameId,
      gameName,
      progress,
      receivedBytes,
      totalBytes,
      bytesPerSecond,
      eta,
      received,
      total,
      downloaded,
      speed
    } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      this.updateProgress(id, {
        progress: progress ?? 0,
        downloaded: receivedBytes ?? received ?? downloaded ?? 0,
        total: totalBytes ?? total ?? 0,
        speed: bytesPerSecond ?? speed ?? 0,
        estimatedTime: eta ?? 0
      })
    }
  }

  // Gérer la fin d'un téléchargement
  handleDownloadComplete(data) {
    const { gameId, gameName } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      this.completeDownload(id)
      if (this.toastCallback) {
        this.toastCallback(`${gameName} téléchargé avec succès !`, 'success', 5000)
      }
    }
  }

  // Gérer une erreur de téléchargement
  handleDownloadError(data) {
    const { gameId, gameName, error } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      this.failDownload(id, error)
      if (this.toastCallback) {
        this.toastCallback(`Échec du téléchargement de ${gameName}: ${error}`, 'error', 10000)
      }
    }
  }

  // Gérer le début de l'extraction
  handleExtractionStarted(data) {
    const { gameId, gameName } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      const download = this.downloads.get(id)
      if (download) {
        download.status = 'extracting'
        this.notify()
      }
      if (this.toastCallback) {
        this.toastCallback(`Extraction de ${gameName} en cours...`, 'info', 5000)
      }
    }
  }

  // Gérer la fin de l'extraction
  handleExtractionComplete(data) {
    const { gameId, gameName } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      const download = this.downloads.get(id)
      if (download) {
        download.status = 'extracted'
        download.progress = 100
        this.notify()
      }
      if (this.toastCallback) {
        this.toastCallback(`${gameName} installé avec succès !`, 'success', 5000)
      }
    }
  }

  // Gérer l'échec de l'extraction
  handleExtractionFailed(data) {
    const { gameId, gameName, error } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      this.failDownload(id, error)
      if (this.toastCallback) {
        this.toastCallback(`Échec de l'extraction de ${gameName}: ${error}`, 'error', 10000)
      }
    }
  }

  // Trouver un téléchargement par nom de jeu
  findDownloadByGameName(gameName) {
    for (const [id, download] of this.downloads.entries()) {
      if (download.gameName === gameName) {
        return id
      }
    }
    return null
  }

  // Ajouter un listener pour les mises à jour
  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  // Alias pour compatibilité
  subscribe(callback) {
    return this.addListener(callback)
  }

  // Notifier tous les listeners
  notify() {
    this.listeners.forEach(callback => {
      try {
        callback(Array.from(this.downloads.values()))
      } catch (error) {
        console.error('[DownloadManager] Erreur dans un listener:', error)
      }
    })
  }

  // Démarrer un téléchargement
  startDownload(gameId, gameName, downloadInfo = {}) {
    const download = {
      id: gameId,
      gameId,
      gameName,
      status: 'downloading',
      progress: 0,
      speed: 0, // bytes/s
      downloaded: 0, // bytes
      total: 0, // bytes
      estimatedTime: 0, // secondes
      startTime: Date.now(),
      ...downloadInfo
    }

    this.downloads.set(gameId, download)
    this.notify()
    return download
  }

  // Mettre à jour la progression d'un téléchargement
  updateProgress(gameId, progressData) {
    const download = this.downloads.get(gameId)
    if (!download) return

    const now = Date.now()
    const elapsed = (now - download.startTime) / 1000 // secondes
    const downloaded = progressData.downloaded !== undefined ? progressData.downloaded : download.downloaded
    const total = progressData.total !== undefined ? progressData.total : download.total
    const progress = progressData.progress !== undefined ? progressData.progress : (total > 0 ? (downloaded / total) * 100 : 0)

    // Utiliser la vitesse fournie, sinon la calculer
    if (progressData.speed !== undefined && progressData.speed > 0) {
      download.speed = progressData.speed
    } else if (elapsed > 0 && downloaded > download.downloaded) {
      const bytesDiff = downloaded - download.downloaded
      const timeDiff = (now - (download.lastUpdate || download.startTime)) / 1000
      download.speed = timeDiff > 0 ? bytesDiff / timeDiff : 0
    }

    // Utiliser le temps estimé fourni, sinon le calculer
    if (progressData.estimatedTime !== undefined && progressData.estimatedTime > 0) {
      download.estimatedTime = progressData.estimatedTime
    } else if (download.speed > 0 && total > downloaded) {
      const remaining = total - downloaded
      download.estimatedTime = remaining / download.speed
    } else {
      download.estimatedTime = 0
    }

    download.progress = Math.min(100, Math.max(0, progress))
    download.downloaded = downloaded
    download.total = total
    download.lastUpdate = now

    this.downloads.set(gameId, download)
    this.notify()
  }

  // Marquer un téléchargement comme terminé
  completeDownload(gameId, result = {}) {
    const download = this.downloads.get(gameId)
    if (!download) return

    download.status = 'completed'
    download.progress = 100
    download.completedAt = Date.now()
    Object.assign(download, result)

    this.downloads.set(gameId, download)
    this.notify()

    // Supprimer après 5 secondes
    setTimeout(() => {
      this.removeDownload(gameId)
    }, 5000)
  }

  // Marquer un téléchargement comme échoué
  failDownload(gameId, error = {}) {
    const download = this.downloads.get(gameId)
    if (!download) return

    download.status = 'failed'
    download.error = error.message || error || 'Erreur inconnue'
    download.failedAt = Date.now()

    this.downloads.set(gameId, download)
    this.notify()
  }

  // Supprimer un téléchargement
  removeDownload(gameId) {
    this.downloads.delete(gameId)
    this.notify()
  }

  // Obtenir un téléchargement
  getDownload(gameId) {
    return this.downloads.get(gameId)
  }

  // Obtenir tous les téléchargements
  getAllDownloads() {
    return Array.from(this.downloads.values())
  }

  // Obtenir les téléchargements actifs
  getActiveDownloads() {
    return Array.from(this.downloads.values()).filter(d => d.status === 'downloading')
  }
}

// Instance singleton
export const downloadManager = new DownloadManager()

