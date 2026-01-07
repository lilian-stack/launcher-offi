import { useState, useEffect } from 'react'
import { Motion } from './Motion'
import { FiDownload, FiGitCommit, FiUser, FiCalendar, FiX, FiRefreshCw, FiCheck } from 'react-icons/fi'
import { commitUpdateService } from '../services/commitUpdateService'

export function CommitUpdateModal({ isOpen, onClose }) {
  const [updateStatus, setUpdateStatus] = useState('idle') // idle, checking, available, downloading, ready, error
  const [updateInfo, setUpdateInfo] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadMessage, setDownloadMessage] = useState('')
  const [error, setError] = useState(null)
  const [commitHistory, setCommitHistory] = useState([])

  useEffect(() => {
    if (isOpen) {
      checkForUpdates()
      loadCommitHistory()
    }
  }, [isOpen])

  useEffect(() => {
    const handleUpdateProgress = (event) => {
      const { progress, message } = event.detail
      setDownloadProgress(progress)
      setDownloadMessage(message)
    }

    window.addEventListener('update-progress', handleUpdateProgress)
    return () => window.removeEventListener('update-progress', handleUpdateProgress)
  }, [])

  const checkForUpdates = async () => {
    try {
      setUpdateStatus('checking')
      setError(null)
      
      const result = await commitUpdateService.checkForUpdates()
      
      if (result.hasUpdate) {
        setUpdateInfo(result)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('upToDate')
      }
    } catch (err) {
      setError(err.message)
      setUpdateStatus('error')
    }
  }

  const loadCommitHistory = async () => {
    try {
      const history = await commitUpdateService.getCommitHistory(5)
      setCommitHistory(history)
    } catch (err) {
      console.error('Erreur chargement historique:', err)
    }
  }

  const downloadUpdate = async () => {
    try {
      setUpdateStatus('downloading')
      setDownloadProgress(0)
      
      await commitUpdateService.downloadAndApplyUpdate(updateInfo)
      
      setUpdateStatus('ready')
    } catch (err) {
      setError(err.message)
      setUpdateStatus('error')
    }
  }

  const restartApp = () => {
    if (window.electron?.app?.restart) {
      window.electron.app.restart()
    } else {
      window.location.reload()
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FiGitCommit className="text-blue-400 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Mises à jour</h2>
              <p className="text-gray-400 text-sm">Système basé sur les commits GitHub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <FiX className="text-gray-400" />
          </button>
        </div>

        {/* Status Section */}
        <div className="mb-6">
          {updateStatus === 'checking' && (
            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <FiRefreshCw className="text-blue-400 animate-spin" />
              <div>
                <p className="text-white font-medium">Vérification des mises à jour...</p>
                <p className="text-gray-400 text-sm">Comparaison avec le dernier commit</p>
              </div>
            </div>
          )}

          {updateStatus === 'upToDate' && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <FiCheck className="text-green-400" />
              <div>
                <p className="text-white font-medium">Application à jour</p>
                <p className="text-gray-400 text-sm">Vous utilisez la dernière version</p>
              </div>
            </div>
          )}

          {updateStatus === 'available' && updateInfo && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <FiDownload className="text-orange-400" />
                <div className="flex-1">
                  <p className="text-white font-medium">Mise à jour disponible</p>
                  <p className="text-gray-400 text-sm">
                    {updateInfo.updateSize.fileCount} fichier{updateInfo.updateSize.fileCount > 1 ? 's' : ''} modifié{updateInfo.updateSize.fileCount > 1 ? 's' : ''} • {updateInfo.updateSize.formatted}
                  </p>
                </div>
                <button
                  onClick={downloadUpdate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Télécharger
                </button>
              </div>

              {/* Commit Info */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiGitCommit className="text-gray-400" />
                  <span className="text-gray-400 text-sm">Dernier commit</span>
                </div>
                <p className="text-white font-medium mb-1">{updateInfo.latestCommit.message}</p>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <FiUser className="text-xs" />
                    {updateInfo.latestCommit.author}
                  </div>
                  <div className="flex items-center gap-1">
                    <FiCalendar className="text-xs" />
                    {formatDate(updateInfo.latestCommit.date)}
                  </div>
                  <code className="bg-gray-700 px-2 py-1 rounded text-xs">
                    {updateInfo.latestCommit.sha.substring(0, 7)}
                  </code>
                </div>
              </div>

              {/* Changed Files */}
              {updateInfo.changedFiles.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Fichiers modifiés</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {updateInfo.changedFiles.slice(0, 10).map((file, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full ${
                          file.status === 'added' ? 'bg-green-400' :
                          file.status === 'modified' ? 'bg-yellow-400' :
                          'bg-red-400'
                        }`} />
                        <code className="text-gray-300">{file.filename}</code>
                        <span className="text-gray-500 text-xs">
                          {file.status === 'added' ? 'ajouté' :
                           file.status === 'modified' ? 'modifié' :
                           'supprimé'}
                        </span>
                      </div>
                    ))}
                    {updateInfo.changedFiles.length > 10 && (
                      <p className="text-gray-400 text-xs">
                        ... et {updateInfo.changedFiles.length - 10} autre{updateInfo.changedFiles.length - 10 > 1 ? 's' : ''} fichier{updateInfo.changedFiles.length - 10 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {updateStatus === 'downloading' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <FiDownload className="text-blue-400" />
                <div className="flex-1">
                  <p className="text-white font-medium">Téléchargement en cours...</p>
                  <p className="text-gray-400 text-sm">{downloadMessage}</p>
                </div>
                <span className="text-blue-400 font-medium">{Math.round(downloadProgress)}%</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {updateStatus === 'ready' && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <FiCheck className="text-green-400" />
              <div className="flex-1">
                <p className="text-white font-medium">Mise à jour installée</p>
                <p className="text-gray-400 text-sm">Redémarrez l'application pour appliquer les changements</p>
              </div>
              <button
                onClick={restartApp}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Redémarrer
              </button>
            </div>
          )}

          {updateStatus === 'error' && error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <FiX className="text-red-400" />
              <div className="flex-1">
                <p className="text-white font-medium">Erreur</p>
                <p className="text-gray-400 text-sm">{error}</p>
              </div>
              <button
                onClick={checkForUpdates}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Réessayer
              </button>
            </div>
          )}
        </div>

        {/* Commit History */}
        {commitHistory.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-3">Commits récents</h3>
            <div className="space-y-2">
              {commitHistory.map((commit, index) => (
                <div key={commit.sha} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                  <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{commit.message}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span>{commit.author}</span>
                      <span>{formatDate(commit.date)}</span>
                      <code className="bg-gray-700 px-1 rounded">{commit.shortSha}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={checkForUpdates}
            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <FiRefreshCw className={updateStatus === 'checking' ? 'animate-spin' : ''} />
            Vérifier
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </Motion.div>
    </Motion.div>
  )
}