import { Motion } from './Motion'
import { FiPause, FiPlay, FiX, FiDownload, FiPackage, FiFolder } from 'react-icons/fi'

function formatBytes(bytes) {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function formatTime(seconds) {
  if (!seconds || seconds === Infinity || isNaN(seconds) || seconds < 0) return '--'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.round(seconds % 60)
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond === 0 || isNaN(bytesPerSecond)) return '0 B/s'
  return formatBytes(bytesPerSecond) + '/s'
}

export function ProgressBar({ 
  title, 
  progress = 0, 
  downloaded = 0, 
  total = 0, 
  speed = 0, 
  eta = 0,
  status = 'downloading',
  onPause,
  onResume,
  onCancel,
  className = '',
  extractedBytes = 0,
  extractionTotal = 0,
  extractionSpeed = 0,
  extractionEta = 0,
  imageUrl = null,
  installPath = null
}) {
  const isPaused = status === 'paused'
  const isExtracting = status === 'extracting'
  const isCompleted = status === 'completed' || status === 'extracted'

  // Calculer le pourcentage de progression
  let progressPercent = 0
  if (isExtracting && extractionTotal > 0) {
    progressPercent = (extractedBytes / extractionTotal) * 100
  } else if (total > 0) {
    progressPercent = (downloaded / total) * 100
  } else {
    progressPercent = progress
  }

  // S'assurer que le pourcentage est valide
  progressPercent = Math.max(0, Math.min(100, progressPercent || 0))

  // Déterminer les valeurs à afficher
  const displayDownloaded = isExtracting ? extractedBytes : downloaded
  const displayTotal = isExtracting ? extractionTotal : total
  const displaySpeed = isExtracting ? extractionSpeed : speed
  const displayEta = isExtracting ? extractionEta : eta

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl ${className}`}
    >
      {/* Header avec image et titre */}
      <div className="flex items-start gap-4 mb-6">
        {/* Thumbnail du jeu */}
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
          ) : null}
          <div className="w-full h-full flex items-center justify-center text-gray-400" style={{ display: imageUrl ? 'none' : 'flex' }}>
            <FiPackage className="text-2xl" />
          </div>
          
          {/* Badge de statut */}
          <div className="absolute top-2 right-2">
            {isCompleted ? (
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <FiDownload className="text-white text-xs" />
              </div>
            ) : isPaused ? (
              <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                <FiPause className="text-white text-xs" />
              </div>
            ) : (
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                <FiDownload className="text-white text-xs" />
              </div>
            )}
          </div>
        </div>

        {/* Informations du téléchargement */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white mb-1 truncate">{title}</h3>
          
          {/* Statut */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isCompleted ? 'bg-green-500/20 text-green-400' :
              isPaused ? 'bg-yellow-500/20 text-yellow-400' :
              isExtracting ? 'bg-purple-500/20 text-purple-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {isCompleted ? 'Terminé' :
               isPaused ? 'En pause' :
               isExtracting ? 'Extraction...' :
               'Téléchargement...'}
            </span>
            
            {installPath && (
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <FiFolder className="text-xs" />
                <span className="truncate max-w-48">{installPath}</span>
              </div>
            )}
          </div>

          {/* Barre de progression principale */}
          <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden mb-3">
            <Motion.div
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted ? 'bg-gradient-to-r from-green-500 to-green-400' :
                isPaused ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                isExtracting ? 'bg-gradient-to-r from-purple-500 to-purple-400' :
                'bg-gradient-to-r from-blue-500 to-cyan-400'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
            
            {/* Animation de progression */}
            {!isPaused && !isCompleted && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            )}
          </div>
        </div>

        {/* Contrôles */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isCompleted && (
            <>
              {isPaused ? (
                <button
                  onClick={onResume}
                  className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  title="Reprendre"
                >
                  <FiPlay className="text-sm" />
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="p-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                  title="Pause"
                >
                  <FiPause className="text-sm" />
                </button>
              )}
            </>
          )}
          
          <button
            onClick={onCancel}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            title="Annuler"
          >
            <FiX className="text-sm" />
          </button>
        </div>
      </div>

      {/* Statistiques détaillées */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Progression */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Progression</p>
          <p className="text-sm font-semibold text-white">
            {formatBytes(displayDownloaded)} / {formatBytes(displayTotal)}
          </p>
        </div>

        {/* Vitesse */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Vitesse</p>
          <p className="text-sm font-semibold text-white">
            {formatSpeed(displaySpeed)}
          </p>
        </div>

        {/* Temps restant */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Temps restant</p>
          <p className="text-sm font-semibold text-white">
            {formatTime(displayEta)}
          </p>
        </div>

        {/* Pourcentage */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Pourcentage</p>
          <p className="text-sm font-semibold text-white">
            {Math.round(progressPercent)}%
          </p>
        </div>
      </div>
    </Motion.div>
  )
}