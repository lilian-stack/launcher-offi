import { useState, useEffect } from 'react'
import { Motion } from '../components/Motion'
import { FiDownload, FiCheck, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'

export function UpdatesPage() {
  const [updateStatus, setUpdateStatus] = useState('checking') // checking, available, downloading, ready, upToDate
  const [updateInfo, setUpdateInfo] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    checkForUpdates()
  }, [])

  const checkForUpdates = async () => {
    setUpdateStatus('checking')
    
    try {
      // Simuler la vérification des mises à jour
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simuler qu'il n'y a pas de mise à jour
      setUpdateStatus('upToDate')
      setUpdateInfo({
        currentVersion: '2.0.0',
        latestVersion: '2.0.0',
        releaseNotes: 'Vous utilisez la dernière version d\'Actoris Launcher.'
      })
    } catch (error) {
      console.error('Erreur lors de la vérification des mises à jour:', error)
      setUpdateStatus('error')
    }
  }

  const startUpdate = async () => {
    setUpdateStatus('downloading')
    setDownloadProgress(0)
    
    // Simuler le téléchargement
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setDownloadProgress(i)
    }
    
    setUpdateStatus('ready')
  }

  const installUpdate = () => {
    // En production, ceci redémarrerait l'application
    console.log('Installation de la mise à jour...')
  }

  const getStatusIcon = () => {
    switch (updateStatus) {
      case 'checking':
        return <FiRefreshCw className="animate-spin" />
      case 'available':
        return <FiDownload />
      case 'downloading':
        return <FiDownload className="animate-pulse" />
      case 'ready':
        return <FiCheck />
      case 'upToDate':
        return <FiCheck />
      default:
        return <FiAlertCircle />
    }
  }

  const getStatusText = () => {
    switch (updateStatus) {
      case 'checking':
        return 'Vérification des mises à jour...'
      case 'available':
        return 'Mise à jour disponible'
      case 'downloading':
        return `Téléchargement en cours... ${downloadProgress}%`
      case 'ready':
        return 'Mise à jour prête à installer'
      case 'upToDate':
        return 'Application à jour'
      default:
        return 'Erreur lors de la vérification'
    }
  }

  const getStatusColor = () => {
    switch (updateStatus) {
      case 'checking':
        return 'text-blue-400'
      case 'available':
        return 'text-yellow-400'
      case 'downloading':
        return 'text-blue-400'
      case 'ready':
        return 'text-green-400'
      case 'upToDate':
        return 'text-green-400'
      default:
        return 'text-red-400'
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0f0f14] text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Mises à jour</h1>
          <p className="text-gray-400">Gérez les mises à jour d'Actoris Launcher</p>
        </Motion.div>

        {/* Statut actuel */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 rounded-xl p-6 mb-6 border border-gray-700/50"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-2xl ${getStatusColor()}`}>
              {getStatusIcon()}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{getStatusText()}</h2>
              {updateInfo && (
                <p className="text-gray-400">
                  Version actuelle: {updateInfo.currentVersion}
                </p>
              )}
            </div>
          </div>

          {updateStatus === 'downloading' && (
            <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
              <div 
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={checkForUpdates}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <FiRefreshCw className={updateStatus === 'checking' ? 'animate-spin' : ''} />
              Vérifier les mises à jour
            </button>

            {updateStatus === 'available' && (
              <button
                onClick={startUpdate}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all flex items-center gap-2"
              >
                <FiDownload />
                Télécharger la mise à jour
              </button>
            )}

            {updateStatus === 'ready' && (
              <button
                onClick={installUpdate}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all flex items-center gap-2"
              >
                <FiCheck />
                Installer et redémarrer
              </button>
            )}
          </div>
        </Motion.div>

        {/* Informations de mise à jour */}
        {updateInfo && (
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50"
          >
            <h3 className="text-lg font-semibold mb-4">Informations de version</h3>
            <div className="space-y-2 text-gray-300">
              <p><strong>Version actuelle:</strong> {updateInfo.currentVersion}</p>
              <p><strong>Dernière version:</strong> {updateInfo.latestVersion}</p>
              {updateInfo.releaseNotes && (
                <div>
                  <strong>Notes de version:</strong>
                  <p className="mt-2 text-gray-400">{updateInfo.releaseNotes}</p>
                </div>
              )}
            </div>
          </Motion.div>
        )}
      </div>
    </div>
  )
}