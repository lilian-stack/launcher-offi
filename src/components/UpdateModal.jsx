import { useEffect, useState } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiX, FiDownload, FiRefreshCw } from 'react-icons/fi'
import { patchNotesService } from '../services/patchNotesService'

const normalizeVersion = (version = '') => version.toString().trim().replace(/^v/i, '') || '0.0.0'
const compareVersions = (a, b) => {
  const pa = normalizeVersion(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = normalizeVersion(b).split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? normalizeVersion(__APP_VERSION__) : '0.0.0'

export function UpdateModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [release, setRelease] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadMsg, setDownloadMsg] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    
    // Écouter les événements de progression du téléchargement
    const progressHandler = (event, data) => {
      if (data && data.progress !== undefined) {
        setDownloadProgress(data.progress)
        const receivedMB = (data.received / 1024 / 1024).toFixed(1)
        const totalMB = (data.total / 1024 / 1024).toFixed(1)
        setDownloadMsg(`Téléchargement: ${data.progress}% (${receivedMB} MB / ${totalMB} MB)`)
      }
    }
    
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('update:download-progress', progressHandler)
    }
    
    const fetchLatest = async () => {
      setLoading(true)
      setError('')
      setRelease(null)
      setDownloadProgress(0)
      try {
        // GitHub API - latest release (returns 404 if none)
        const res = await fetch('https://api.github.com/repos/lilian-stack/launcher-offi/releases/latest', {
          headers: {
            Accept: 'application/vnd.github+json',
          },
        })
        if (res.status === 404) {
          setRelease(null)
        } else if (!res.ok) {
          throw new Error('Erreur lors de la recherche de mise à jour')
        } else {
          const data = await res.json()
          const remoteVersion = normalizeVersion(data.tag_name || data.name || '')
          if (compareVersions(remoteVersion, CURRENT_VERSION) > 0) {
            setRelease(data)
          } else {
            setRelease(null)
          }
        }
      } catch (e) {
        setError(e.message || 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchLatest()
    
    return () => {
      // Nettoyer les listeners
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('update:download-progress')
      }
      setDownloadProgress(0)
      setDownloadMsg('')
    }
  }, [isOpen])

  const handleDownload = async () => {
    if (!release) return
    const asset = Array.isArray(release.assets) && release.assets.find(a => a.name.endsWith('.exe')) || release.assets[0]
    if (!asset) {
      setError("Aucun fichier à télécharger dans la dernière release")
      return
    }
    try {
      setDownloading(true)
      setError('')
      setDownloadMsg('Téléchargement en cours...')
      if (window.electron?.updates?.downloadAsset) {
        const result = await window.electron.updates.downloadAsset(asset.browser_download_url, asset.name)
        if (result?.success) {
          setDownloadMsg(`Téléchargé: ${result.filePath}`)
          // Ouvrir l'écran de Patch Notes en plein écran avec vos notes custom
          const version = release.tag_name || 'v1.0.1'
          // Récupérer les notes depuis le service ou utiliser le body de la release
          let notes = []
          try {
            // Vérifier que patchNotesService et getNotes existent
            if (patchNotesService && typeof patchNotesService.getNotes === 'function') {
              notes = await patchNotesService.getNotes(version)
            } else {
              console.warn('[UpdateModal] patchNotesService.getNotes n\'est pas disponible')
            }
            // Si pas de notes dans le service, utiliser le body de la release
            if (!notes || notes.length === 0) {
              if (release.body) {
                notes = release.body.split('\n').filter(line => line.trim())
              } else {
                notes = []
              }
            }
          } catch (err) {
            console.warn('[UpdateModal] Erreur lors de la récupération des patch notes:', err)
            // Fallback: utiliser le body de la release
            if (release.body) {
              notes = release.body.split('\n').filter(line => line.trim())
            } else {
              notes = []
            }
          }
          window.dispatchEvent(new CustomEvent('show-patch-notes', { detail: { version, notes, installerPath: result.filePath } }))
        } else {
          const errorMsg = result?.error || 'Échec du téléchargement'
          // Ne pas afficher "HTTP 302" car c'est normal (redirection)
          if (!errorMsg.includes('HTTP 302')) {
            setError(errorMsg)
          } else {
            setError('Erreur lors du téléchargement. Veuillez réessayer.')
          }
        }
      } else {
        // Fallback: ouvrir dans le navigateur
        window.open(asset.browser_download_url, '_blank')
        setDownloadMsg('Téléchargement démarré dans le navigateur')
      }
    } catch (e) {
      const errorMsg = e.message || 'Erreur de téléchargement'
      // Ne pas afficher "HTTP 302" car c'est normal (redirection)
      if (!errorMsg.includes('HTTP 302')) {
        setError(errorMsg)
      } else {
        setError('Erreur lors du téléchargement. Veuillez réessayer.')
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15151c] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FiRefreshCw className="text-indigo-400" />
                <h3 className="text-white font-semibold">Vérifier les mises à jour</h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5">
                <FiX />
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-slate-300">Recherche en cours...</p>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : release ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm text-white font-medium">
                    Nouvelle version disponible:{' '}
                    <span className="text-indigo-300">{release.tag_name || release.name}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Version actuelle installée : <span className="font-semibold text-white">{CURRENT_VERSION}</span>
                  </p>
                  {release.body && (
                    <p className="mt-1 text-xs text-slate-300 line-clamp-4 whitespace-pre-wrap">{release.body}</p>
                  )}
                </div>
                <Motion.button
                  disabled={downloading}
                  onClick={handleDownload}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="button-primary w-full justify-center flex items-center gap-2"
                >
                  <FiDownload />
                  {downloading ? 'Téléchargement...' : 'Télécharger'}
                </Motion.button>
                {downloading && downloadProgress > 0 && (
                  <div className="w-full bg-white/5 rounded-lg overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-2 transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                )}
                {downloadMsg && <p className="text-xs text-slate-300">{downloadMsg}</p>}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm text-slate-300">Aucune mise à jour n’est disponible pour le moment.</p>
              </div>
            )}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  )
}


