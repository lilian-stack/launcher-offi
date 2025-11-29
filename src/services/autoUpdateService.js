import { patchNotesService } from './patchNotesService'

const defaultState = {
  status: 'idle', // idle | checking | available | downloading | verifying | downloaded | upToDate | error
  progress: 0,
  currentVersion: null,
  latestVersion: null,
  releaseDate: null,
  manifest: null,
  downloadPath: null,
  error: null,
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class AutoUpdateService {
  constructor() {
    this.state = { ...defaultState }
    this.listeners = new Set()
    this.initialized = false
    this.progressUnsubscribed = false

    if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('update:download-progress', this.handleDownloadProgress)
    }
  }

  subscribe(callback) {
    this.listeners.add(callback)
    callback(this.state)
    return () => {
      this.listeners.delete(callback)
    }
  }

  setState(partial) {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((cb) => cb(this.state))
  }

  async ensureInitialized() {
    if (this.initialized) return
    const version = await window.electron?.app?.getVersion?.()
    this.setState({ currentVersion: version })
    this.initialized = true
  }

  normalizeVersion(version) {
    if (!version) return '0.0.0'
    return version.replace(/^v/i, '')
  }

  compareVersions(a, b) {
    const split = (v) => this.normalizeVersion(v).split('.').map((part) => parseInt(part, 10) || 0)
    const [a1, a2, a3] = split(a)
    const [b1, b2, b3] = split(b)
    if (a1 !== b1) return a1 - b1
    if (a2 !== b2) return a2 - b2
    return a3 - b3
  }

  isUpdateAvailable(latestVersion) {
    if (!latestVersion || !this.state.currentVersion) return false
    return this.compareVersions(latestVersion, this.state.currentVersion) > 0
  }

  async checkForUpdates(force = false) {
    await this.ensureInitialized()
    this.setState({ status: 'checking', error: null })
    try {
      const manifest = await patchNotesService.getLatest(force)
      this.setState({
        manifest,
        latestVersion: manifest?.latestVersion || null,
        releaseDate: manifest?.releaseDate || null,
      })

      if (this.isUpdateAvailable(manifest?.latestVersion)) {
        this.setState({ status: 'available' })
        this.downloadInBackground()
      } else {
        this.setState({ status: 'upToDate', progress: 100 })
      }
    } catch (error) {
      console.error('[AutoUpdateService] checkForUpdates error:', error)
      this.setState({ status: 'error', error: error.message || 'Impossible de vérifier les mises à jour' })
    }
  }

  async downloadInBackground() {
    if (this.state.status === 'downloading' || this.state.status === 'verifying') return
    const downloadInfo = this.state.manifest?.downloads?.windows
    if (!downloadInfo?.url) {
      this.setState({ status: 'error', error: 'Aucun binaire de mise à jour disponible' })
      return
    }

    this.setState({ status: 'downloading', progress: 0, downloadPath: null })

    try {
      const filename = `Actoris-Setup-${this.state.manifest?.latestVersion || 'latest'}.exe`
      const result = await window.electron?.updates?.downloadAsset(downloadInfo.url, filename)

      if (!result?.success) {
        throw new Error(result?.error || 'Téléchargement impossible')
      }

      this.setState({ status: 'verifying', downloadPath: result.filePath, progress: 100 })
      await this.verifyHash(result.filePath, downloadInfo.sha256)
      this.setState({ status: 'downloaded', downloadPath: result.filePath, error: null })
    } catch (error) {
      console.error('[AutoUpdateService] downloadInBackground error:', error)
      this.setState({ status: 'error', error: error.message || 'Erreur lors du téléchargement de la mise à jour' })
    }
  }

  handleDownloadProgress = (_event, payload) => {
    if (!payload) return
    if (this.state.status !== 'downloading') return
    this.setState({
      progress: payload.progress ?? 0,
    })
  }

  async verifyHash(filePath, expectedHash) {
    if (!expectedHash) {
      return true
    }
    const result = await window.electron?.files?.sha256?.(filePath)
    if (!result?.success) {
      throw new Error(result?.error || 'Impossible de calculer le hash')
    }
    const normalized = (result.hash || '').toLowerCase()
    if (normalized !== expectedHash.toLowerCase()) {
      throw new Error('Le fichier téléchargé est corrompu (hash invalide)')
    }
    return true
  }

  async applyUpdate() {
    if (!this.state.downloadPath) {
      throw new Error('Aucun fichier de mise à jour disponible')
    }

    try {
      if (window.electron?.shell?.openPath) {
        await window.electron.shell.openPath(this.state.downloadPath)
      }
      await delay(800)
      if (window.electron?.app?.restart) {
        await window.electron.app.restart()
      } else if (window.electron?.app?.quit) {
        await window.electron.app.quit()
      }
    } catch (error) {
      console.error('[AutoUpdateService] applyUpdate error:', error)
      throw error
    }
  }
}

export const autoUpdateService = new AutoUpdateService()

