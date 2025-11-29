import { useState, useEffect } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiDownload, FiCheckCircle, FiXCircle, FiClock, FiHardDrive, FiZap } from 'react-icons/fi'
import { downloadManager } from '../services/downloadManager'

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

export function DownloadsPage() {
  const [downloads, setDownloads] = useState([])
  const [forceUpdate, setForceUpdate] = useState(0) // Force le re-render

  useEffect(() => {
    // Charger les téléchargements initiaux
    setDownloads(downloadManager.getAllDownloads())
    
    // S'abonner aux mises à jour du downloadManager
    const unsubscribe = downloadManager.subscribe((updatedDownloads) => {
      setDownloads([...updatedDownloads]) // Créer un nouveau tableau pour forcer le re-render
      setForceUpdate(prev => prev + 1) // Force le re-render
    })
    
    // Écouter les événements IPC pour les mises à jour en temps réel
    if (window.electron && window.electron.ipcRenderer) {
      const handleProgress = (event, data) => {
        // Mettre à jour le downloadManager qui notifiera les subscribers
        downloadManager.handleDownloadProgress(data)
        // Forcer un re-render immédiat
        setForceUpdate(prev => prev + 1)
      }
      
      const handleComplete = (event, data) => {
        downloadManager.handleDownloadComplete(data)
        setForceUpdate(prev => prev + 1)
      }
      
      const handleError = (event, data) => {
        downloadManager.handleDownloadError(data)
        setForceUpdate(prev => prev + 1)
      }
      
      const handleExtractionStarted = (event, data) => {
        downloadManager.handleExtractionStarted(data)
        setForceUpdate(prev => prev + 1)
      }
      
      const handleExtractionComplete = (event, data) => {
        downloadManager.handleExtractionComplete(data)
        setForceUpdate(prev => prev + 1)
      }
      
      window.electron.ipcRenderer.on('download:progress', handleProgress)
      window.electron.ipcRenderer.on('download:complete', handleComplete)
      window.electron.ipcRenderer.on('download:error', handleError)
      window.electron.ipcRenderer.on('extraction-started', handleExtractionStarted)
      window.electron.ipcRenderer.on('download:extracted', handleExtractionComplete)
      
      return () => {
        unsubscribe()
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.removeListener('download:progress', handleProgress)
          window.electron.ipcRenderer.removeListener('download:complete', handleComplete)
          window.electron.ipcRenderer.removeListener('download:error', handleError)
          window.electron.ipcRenderer.removeListener('extraction-started', handleExtractionStarted)
          window.electron.ipcRenderer.removeListener('download:extracted', handleExtractionComplete)
        }
      }
    }
    
    return unsubscribe
  }, [])

  if (downloads.length === 0) {
    return (
      <div className="empty-page">
        <Motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="empty-icon-wrapper"
        >
          <FiDownload className="empty-icon" />
        </Motion.div>
        <Motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          Pas de téléchargement en cours
        </Motion.h2>
        <Motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="empty-description"
        >
          Lancez un téléchargement depuis le catalogue ou importez un jeu pour suivre sa progression ici.
        </Motion.p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* En-tête */}
      <Motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FiDownload className="text-primary" />
            Téléchargements
          </h1>
          <p className="text-gray-400 mt-1">
            {downloads.length} téléchargement{downloads.length > 1 ? 's' : ''}
          </p>
        </div>
      </Motion.div>

      {/* Liste des téléchargements */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {downloads.map((download, index) => (
          <Motion.div
            key={download.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl transition-all duration-500 hover:border-white/10 hover:bg-white/8 hover:shadow-2xl hover:shadow-primary/20"
            style={{
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            }}
          >
            <div className="p-6 space-y-4">
              {/* En-tête du téléchargement */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {download.gameName}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                    {download.status === 'downloading' && (
                      <>
                        <span className="flex items-center gap-1">
                          <FiZap className="w-4 h-4" />
                          {formatSpeed(download.speed || 0)}
                        </span>
                        {download.total > 0 && (
                          <span className="flex items-center gap-1">
                            <FiHardDrive className="w-4 h-4" />
                            {formatBytes(download.total - (download.downloaded || 0))} restant
                          </span>
                        )}
                        {download.estimatedTime > 0 && (
                          <span className="flex items-center gap-1">
                            <FiClock className="w-4 h-4" />
                            {formatTime(download.estimatedTime)} restant
                          </span>
                        )}
                      </>
                    )}
                    {download.status === 'extracting' && (
                      <span className="flex items-center gap-1 text-yellow-500">
                        <FiClock className="w-4 h-4" />
                        Extraction en cours...
                      </span>
                    )}
                    {(download.status === 'completed' || download.status === 'extracted') && (
                      <span className="flex items-center gap-1 text-green-500">
                        <FiCheckCircle className="w-4 h-4" />
                        Terminé
                      </span>
                    )}
                    {download.status === 'failed' && (
                      <span className="flex items-center gap-1 text-red-500">
                        <FiXCircle className="w-4 h-4" />
                        Échec
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(download.progress)}%
                  </div>
                </div>
              </div>

              {/* Barre de progression */}
              {(download.status === 'downloading' || download.status === 'extracting') && (
                <div className="space-y-2">
                  <div className="w-full bg-background rounded-full h-3 overflow-hidden">
                    <Motion.div
                      className={`h-full rounded-full ${
                        download.status === 'extracting' 
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' 
                          : 'bg-gradient-to-r from-primary to-primary/70'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, download.progress || 0))}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>
                      {formatBytes(download.downloaded || 0)} / {formatBytes(download.total || 0)}
                    </span>
                    <span>
                      {download.total > 0 && download.status === 'downloading'
                        ? `${Math.round(((download.total - download.downloaded) / download.total) * 100)}% restant`
                        : download.status === 'extracting' 
                        ? 'Extraction en cours...'
                        : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Message d'erreur */}
              {download.status === 'failed' && download.error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {download.error}
                </div>
              )}

              {/* Informations de complétion */}
              {download.status === 'completed' && download.folder && (
                <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  Installé dans: {download.folder}
                </div>
              )}
            </div>
            
            {/* Border glow effect */}
            <div className="absolute inset-0 rounded-3xl border border-primary/0 group-hover:border-primary/20 transition-all duration-500 pointer-events-none" />
          </Motion.div>
        ))}
      </div>
    </div>
  )
}
