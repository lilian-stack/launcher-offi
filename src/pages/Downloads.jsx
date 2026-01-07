import { useState, useEffect } from 'react'
import { Motion } from '../components/Motion'
import { FiDownload, FiCheckCircle, FiXCircle, FiTrash2 } from 'react-icons/fi'
import { downloadManager } from '../services/downloadManager'
import { ProgressBar } from '../components/ProgressBar'

function formatBytes(bytes) {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function formatTime(seconds) {
  if (!seconds || seconds === Infinity || isNaN(seconds)) return '--'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}min`
}

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s'
  return formatBytes(bytesPerSecond) + '/s'
}

export function DownloadsPage({ installedGames = [] }) {
  const [downloads, setDownloads] = useState([])

  useEffect(() => {
    console.log('[Downloads] 🔄 Initialisation de la page Downloads')
    
    // Charger les téléchargements existants
    const initialDownloads = downloadManager.getAllDownloads()
    console.log('[Downloads] 📊 Téléchargements initiaux:', initialDownloads.length)
    setDownloads(initialDownloads)

    // S'abonner aux mises à jour du downloadManager
    const unsubscribe = downloadManager.subscribe((updatedDownloads) => {
      console.log('[Downloads] 📨 Mise à jour reçue:', updatedDownloads.length, 'téléchargements')
      setDownloads([...updatedDownloads]) // Créer un nouveau tableau pour forcer le re-render
    })

    // Écouter les événements de désinstallation
    const handleGameUninstalled = (event) => {
      const gameName = event.detail?.gameName
      if (gameName) {
        console.log('[Downloads] 🗑️ Jeu désinstallé:', gameName)
        const allDownloads = downloadManager.getAllDownloads()
        allDownloads.forEach(download => {
          const downloadName = (download.gameName || '').toLowerCase().trim()
          const uninstalledName = gameName.toLowerCase().trim()
          if (downloadName === uninstalledName || downloadName.includes(uninstalledName) || uninstalledName.includes(downloadName)) {
            downloadManager.removeDownload(download.id)
          }
        })
        setDownloads([...downloadManager.getAllDownloads()])
      }
    }

    window.addEventListener('game-uninstalled', handleGameUninstalled)

    // Écouter directement les événements IPC pour s'assurer qu'on reçoit les mises à jour
    if (window.electron?.ipcRenderer) {
      const handleProgress = (event, data) => {
        console.log('[Downloads] 📈 Événement download:progress reçu:', data)
        setDownloads([...downloadManager.getAllDownloads()])
      }
      
      const handleComplete = (event, data) => {
        console.log('[Downloads] ✅ Événement download:complete reçu:', data)
        setDownloads([...downloadManager.getAllDownloads()])
      }
      
      const handleError = (event, data) => {
        console.log('[Downloads] ❌ Événement download:error reçu:', data)
        setDownloads([...downloadManager.getAllDownloads()])
      }
      
      const handleStarted = (event, data) => {
        console.log('[Downloads] 🚀 Événement download:started reçu:', data)
        setDownloads([...downloadManager.getAllDownloads()])
      }
      
      const handleExtractionStarted = (event, data) => {
        console.log('[Downloads] 📦 Événement extraction-started reçu:', data)
        setDownloads([...downloadManager.getAllDownloads()])
      }
      
      const handleExtractionProgress = (event, data) => {
        console.log('[Downloads] 📦 Événement extraction:progress reçu:', data)
        setDownloads([...downloadManager.getAllDownloads()])
      }
      
      const handleExtractionComplete = (event, data) => {
        console.log('[Downloads] 📦 Événement download:extracted reçu:', data)
        setDownloads([...downloadManager.getAllDownloads()])
      }

      // Ajouter les listeners IPC
      window.electron.ipcRenderer.on('download:started', handleStarted)
      window.electron.ipcRenderer.on('download:progress', handleProgress)
      window.electron.ipcRenderer.on('download:complete', handleComplete)
      window.electron.ipcRenderer.on('download:error', handleError)
      window.electron.ipcRenderer.on('extraction-started', handleExtractionStarted)
      window.electron.ipcRenderer.on('extraction:progress', handleExtractionProgress)
      window.electron.ipcRenderer.on('download:extracted', handleExtractionComplete)

      return () => {
        console.log('[Downloads] 🧹 Nettoyage des listeners')
        unsubscribe()
        window.removeEventListener('game-uninstalled', handleGameUninstalled)
        
        // Nettoyer les listeners IPC
        window.electron.ipcRenderer.removeListener('download:started', handleStarted)
        window.electron.ipcRenderer.removeListener('download:progress', handleProgress)
        window.electron.ipcRenderer.removeListener('download:complete', handleComplete)
        window.electron.ipcRenderer.removeListener('download:error', handleError)
        window.electron.ipcRenderer.removeListener('extraction-started', handleExtractionStarted)
        window.electron.ipcRenderer.removeListener('extraction:progress', handleExtractionProgress)
        window.electron.ipcRenderer.removeListener('download:extracted', handleExtractionComplete)
      }
    }

    return () => {
      console.log('[Downloads] 🧹 Nettoyage des listeners (fallback)')
      unsubscribe()
      window.removeEventListener('game-uninstalled', handleGameUninstalled)
    }
  }, [])

  const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'extracting' || d.status === 'paused')
  const completedDownloads = downloads.filter(d => d.status === 'completed')
  const failedDownloads = downloads.filter(d => d.status === 'error')

  const handlePause = (downloadId) => {
    if (window.electron?.download?.pauseDownload) {
      window.electron.download.pauseDownload(downloadId)
    }
  }

  const handleResume = (downloadId) => {
    if (window.electron?.download?.resumeDownload) {
      window.electron.download.resumeDownload(downloadId)
    }
  }

  const handleCancel = (downloadId) => {
    if (window.electron?.download?.cancelDownload) {
      window.electron.download.cancelDownload(downloadId)
    }
    downloadManager.removeDownload(downloadId)
    setDownloads([...downloadManager.getAllDownloads()])
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-simple">
      <div className="container-simple">
        {/* Header moderne */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#3b82f6]/10 to-[#06b6d4]/10 rounded-2xl blur-2xl -z-10" />
          <div className="relative flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-[#3b82f6]/20 to-[#06b6d4]/20 rounded-xl border border-[#3b82f6]/30">
              <FiDownload className="text-2xl text-[#3b82f6]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Téléchargements</h1>
              <p className="text-gray-400 text-sm mt-1">
                {activeDownloads.length} {activeDownloads.length === 1 ? 'téléchargement actif' : 'téléchargements actifs'}
              </p>
            </div>
          </div>
        </Motion.div>

        {/* Téléchargements actifs */}
        {activeDownloads.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">En cours</h2>
            <div className="space-y-4">
              {activeDownloads.map((download) => (
                <ProgressBar
                  key={download.id}
                  title={download.gameName || 'Téléchargement'}
                  progress={download.progress || 0}
                  downloaded={download.downloaded || 0}
                  total={download.total || 0}
                  speed={download.speed || 0}
                  eta={download.estimatedTime || download.eta || 0}
                  status={download.status || 'downloading'}
                  extractedBytes={download.extractedBytes || 0}
                  extractionTotal={download.extractionTotal || download.total || 0}
                  extractionSpeed={download.extractionSpeed || 0}
                  extractionEta={download.extractionEta || 0}
                  installPath={download.installPath || download.destinationPath || null}
                  imageUrl={download.gameImage || download.coverImage || null}
                  onPause={() => handlePause(download.id)}
                  onResume={() => handleResume(download.id)}
                  onCancel={() => handleCancel(download.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Terminés */}
        {completedDownloads.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Terminés</h2>
            <div className="space-y-2">
              {completedDownloads.map((download) => (
                <div key={download.id} className="card-simple flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiCheckCircle className="text-[#10b981] text-xl" />
                    <div>
                      <h3 className="text-white font-medium">{download.gameName || 'Téléchargement'}</h3>
                      <p className="text-sm text-gray-400">Terminé</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(download.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Échoués */}
        {failedDownloads.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Échoués</h2>
            <div className="space-y-2">
              {failedDownloads.map((download) => (
                <div key={download.id} className="card-simple flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiXCircle className="text-red-500 text-xl" />
                    <div>
                      <h3 className="text-white font-medium">{download.gameName || 'Téléchargement'}</h3>
                      <p className="text-sm text-red-400">{download.error || 'Erreur'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(download.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* État vide */}
        {downloads.length === 0 && (
          <div className="text-center py-20">
            <FiDownload className="text-5xl text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Aucun téléchargement</p>
          </div>
        )}
      </div>
    </div>
  )
}