import { useState, useEffect } from 'react'
import { Motion, AnimatePresence } from './Motion'
import { FiDownload, FiHardDrive, FiFolder, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi'
import { buzzFileSizeService } from '../services/buzzFileSizeService'

export function GameDownloadPopup({ 
  isOpen, 
  onClose, 
  onConfirm, 
  game, 
  downloading = false, 
  progress = 0, 
  downloadComplete = false,
  onProgress = null,
  onComplete = null,
  onError = null
}) {
  const [selectedPath, setSelectedPath] = useState('') // Commencer avec un chemin vide
  const [diskSpace, setDiskSpace] = useState({ free: 0, total: 0, used: 0 })
  const [availableDrives, setAvailableDrives] = useState([])
  const [selectedDrive, setSelectedDrive] = useState(null)
  const [loadingDiskSpace, setLoadingDiskSpace] = useState(false)
  const [fileSize, setFileSize] = useState({ size: 0, sizeText: 'Récupération...' })
  const [loadingSize, setLoadingSize] = useState(false)
  const [handlersAvailable, setHandlersAvailable] = useState(false)
  
  // Charger les disques disponibles au démarrage
  useEffect(() => {
    if (isOpen && !downloadComplete) {
      // Réinitialiser les états au démarrage
      setSelectedPath('')
      setSelectedDrive(null)
      setLoadingDiskSpace(false)
      
      // Vérifier si les handlers sont disponibles
      const hasHandlers = !!(window.electron?.utils?.getAvailableDrives && window.electron?.utils?.getDiskSpace)
      setHandlersAvailable(hasHandlers)
      
      if (hasHandlers) {
        setDiskSpace({ free: 0, total: 0, used: 0 })
        loadAvailableDrives()
      } else {
        // Fallback avec des valeurs réalistes pour éviter l'erreur "espace insuffisant"
        console.warn('[GameDownloadPopup] Handlers IPC non disponibles - utilisation de valeurs par défaut')
        setDiskSpace({ 
          free: 500 * 1024 * 1024 * 1024, // 500 GB par défaut
          total: 1000 * 1024 * 1024 * 1024, // 1 TB par défaut
          used: 500 * 1024 * 1024 * 1024 
        })
      }
    }
  }, [isOpen, downloadComplete])
  
  // Charger les disques disponibles
  const loadAvailableDrives = async () => {
    try {
      if (window.electron?.utils?.getAvailableDrives) {
        const result = await window.electron.utils.getAvailableDrives()
        if (result.success && result.drives) {
          setAvailableDrives(result.drives)
          // Sélectionner automatiquement le disque avec le plus d'espace libre
          const bestDrive = result.drives.reduce((best, current) => 
            current.free > best.free ? current : best
          )
          setSelectedDrive(bestDrive)
          setDiskSpace({
            free: bestDrive.free,
            total: bestDrive.total,
            used: bestDrive.used
          })
        }
      } else {
        console.warn('[GameDownloadPopup] Fonctions utils non disponibles - redémarrez l\'application')
      }
    } catch (error) {
      console.error('[GameDownloadPopup] Erreur lors du chargement des disques:', error)
    }
  }
  
  // Mettre à jour l'espace disque quand le chemin change
  useEffect(() => {
    if (selectedPath && window.electron?.utils?.getDiskSpace) {
      updateDiskSpace(selectedPath)
    }
  }, [selectedPath])
  
  // Mettre à jour l'espace disque
  const updateDiskSpace = async (path) => {
    try {
      setLoadingDiskSpace(true)
      if (window.electron?.utils?.getDiskSpace) {
        const result = await window.electron.utils.getDiskSpace(path)
        if (result.success) {
          setDiskSpace({
            free: result.free,
            total: result.total,
            used: result.used
          })
          
          // Mettre à jour le disque sélectionné si possible
          const driveLetter = path.split(':')[0] + ':'
          const matchingDrive = availableDrives.find(drive => drive.drive === driveLetter)
          if (matchingDrive) {
            setSelectedDrive(matchingDrive)
          }
        }
      } else {
        console.warn('[GameDownloadPopup] Fonction getDiskSpace non disponible - redémarrez l\'application')
      }
    } catch (error) {
      console.error('[GameDownloadPopup] Erreur lors de la récupération de l\'espace disque:', error)
    } finally {
      setLoadingDiskSpace(false)
    }
  }
  
  // Changer de disque
  const handleDriveChange = (drive) => {
    setSelectedDrive(drive)
    setDiskSpace({
      free: drive.free,
      total: drive.total,
      used: drive.used
    })
    // Réinitialiser le chemin pour forcer une nouvelle sélection
    setSelectedPath('')
  }
  
  // Récupérer la taille du fichier depuis Buzz
  useEffect(() => {
    if (isOpen && game && !downloadComplete) {
      console.log('[GameDownloadPopup] Démarrage de la récupération pour:', game.name || game.title)
      console.log('[GameDownloadPopup] URLs du jeu:', {
        downloadUrl: game.downloadUrl,
        lockrUrl: game.lockrUrl,
        buzzUrl: game.buzzUrl,
        koysoUrl: game.koysoUrl
      })
      
      setLoadingSize(true)
      setFileSize({ size: 0, sizeText: 'Récupération...' })
      
      // Essayer de récupérer la taille depuis Buzz seulement
      const tryGetFileSize = async () => {
        try {
          // Essayer Buzz seulement (système simplifié)
          let result = await buzzFileSizeService.getFileSize(game.downloadUrl || game.buzzUrl)
          
          if (!result) {
            console.log('[GameDownloadPopup] ⚠️ Impossible de récupérer la taille du fichier')
            result = 0
          }
          
          const formattedSize = buzzFileSizeService.formatFileSize(result)
          console.log('[GameDownloadPopup] Taille récupérée:', formattedSize)
          setFileSize({ size: result, sizeText: formattedSize })
          setLoadingSize(false)
          
        } catch (error) {
          console.error('[GameDownloadPopup] Erreur lors de la récupération de la taille:', error)
          setFileSize({ size: 0, sizeText: 'Taille inconnue' })
          setLoadingSize(false)
        }
      }
      
      tryGetFileSize()
    } else if (!isOpen) {
      // Réinitialiser quand le popup se ferme
      setFileSize({ size: 0, sizeText: 'Récupération...' })
      setLoadingSize(false)
      setSelectedPath('') // Réinitialiser le chemin aussi
    }
  }, [isOpen, game, downloadComplete])

  // Écouter les événements de téléchargement
  useEffect(() => {
    if (!isOpen || !window.electron?.ipcRenderer) return

    const handleDownloadStarted = (event, data) => {
      console.log('[GameDownloadPopup] 🚀 Téléchargement démarré:', data)
      // Le téléchargement a démarré, mais on garde le popup ouvert pour montrer la progression
    }

    const handleDownloadProgress = (event, data) => {
      console.log('[GameDownloadPopup] 📈 Progression téléchargement:', data)
      
      // Mettre à jour la progression si c'est pour ce jeu
      if (data.gameName === game?.name || data.gameName === game?.title || data.gameId === game?.id) {
        // Calculer le pourcentage
        const progressPercent = data.progress || 0
        
        // Mettre à jour les états de progression
        if (onProgress && typeof onProgress === 'function') {
          onProgress(progressPercent)
        }
        
        // Mettre à jour la taille si on l'a reçue
        if (data.totalBytes > 0) {
          const sizeInGB = data.totalBytes / (1024 * 1024 * 1024)
          const sizeInMB = data.totalBytes / (1024 * 1024)
          
          let displayText
          if (sizeInGB >= 1) {
            displayText = `${sizeInGB.toFixed(1)} GB`
          } else {
            displayText = `${sizeInMB.toFixed(1)} MB`
          }
          
          setFileSize({
            size: sizeInGB,
            sizeText: displayText,
            exact: true
          })
        }
      }
    }

    const handleDownloadComplete = (event, data) => {
      console.log('[GameDownloadPopup] ✅ Téléchargement terminé:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameName === game?.name || data.gameName === game?.title || data.gameId === game?.id) {
        // Marquer comme terminé
        if (onComplete && typeof onComplete === 'function') {
          onComplete(data)
        }
      }
    }

    const handleDownloadError = (event, data) => {
      console.error('[GameDownloadPopup] ❌ Erreur téléchargement:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameName === game?.name || data.gameName === game?.title || data.gameId === game?.id) {
        // Gérer l'erreur
        if (onError && typeof onError === 'function') {
          onError(data.error || 'Erreur de téléchargement')
        }
      }
    }

    // Ajouter les listeners
    window.electron.ipcRenderer.on('download:started', handleDownloadStarted)
    window.electron.ipcRenderer.on('download:progress', handleDownloadProgress)
    window.electron.ipcRenderer.on('download:complete', handleDownloadComplete)
    window.electron.ipcRenderer.on('download:error', handleDownloadError)

    // Nettoyer les listeners
    return () => {
      window.electron.ipcRenderer.removeListener('download:started', handleDownloadStarted)
      window.electron.ipcRenderer.removeListener('download:progress', handleDownloadProgress)
      window.electron.ipcRenderer.removeListener('download:complete', handleDownloadComplete)
      window.electron.ipcRenderer.removeListener('download:error', handleDownloadError)
    }
  }, [isOpen, game, onProgress, onComplete, onError])
  
  // Utiliser la taille récupérée ou une valeur par défaut
  // IMPORTANT: Convertir toutes les tailles en GB pour la cohérence
  const gameSizeInBytes = fileSize.size > 0 ? fileSize.size : ((game?.size || 45.8) * 1024 * 1024 * 1024)
  const gameSizeInGB = gameSizeInBytes / (1024 * 1024 * 1024)
  const gameSizeText = loadingSize ? 'Récupération...' : (fileSize.size > 0 ? fileSize.sizeText : `${game?.size || 45.8} GB`)
  const remainingSpace = (diskSpace.free / (1024 * 1024 * 1024)) - gameSizeInGB // Tout en GB
  
  // IMPORTANT: Forcer l'utilisation de la taille récupérée si disponible
  const displaySize = gameSizeInGB
  const displaySizeText = gameSizeText
  
  // Formatage des tailles en GB
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 GB'
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }
  
  // Vérifier si il y a assez d'espace
  const hasEnoughSpace = remainingSpace >= 0
  
  // Log pour débogage
  useEffect(() => {
    if (isOpen) {
      console.log('[GameDownloadPopup] État actuel:', {
        loadingSize,
        fileSize,
        gameSizeInGB: gameSizeInGB.toFixed(2),
        gameSizeText,
        remainingSpace: remainingSpace.toFixed(1),
        diskSpaceFreeGB: (diskSpace.free / (1024 * 1024 * 1024)).toFixed(1)
      })
    }
  }, [isOpen, loadingSize, fileSize, gameSizeInGB, gameSizeText, remainingSpace])

  // Demander le dossier de destination via Electron
  const handleChangePath = async () => {
    try {
      if (window.electron?.download?.selectFolder) {
        console.log('[GameDownloadPopup] Ouverture du sélecteur de dossier...')
        const result = await window.electron.download.selectFolder()
        console.log('[GameDownloadPopup] Résultat sélection:', result)
        
        if (result.success && result.folderPath) {
          setSelectedPath(result.folderPath)
          console.log('[GameDownloadPopup] Nouveau chemin sélectionné:', result.folderPath)
        } else {
          console.log('[GameDownloadPopup] Sélection annulée ou échouée')
        }
      } else {
        // Fallback pour le développement
        const newPath = prompt('Entrez le chemin de destination:', selectedPath || 'C:\\Program Files\\Games')
        if (newPath) {
          setSelectedPath(newPath)
          console.log('[GameDownloadPopup] Chemin saisi manuellement:', newPath)
        }
      }
    } catch (error) {
      console.error('[GameDownloadPopup] Erreur lors de la sélection du dossier:', error)
    }
  }

  const handleConfirm = () => {
    console.log('🔍 DEBUG POPUP: handleConfirm appelé')
    console.log('🔍 DEBUG POPUP: selectedPath =', selectedPath)
    console.log('🔍 DEBUG POPUP: onConfirm =', typeof onConfirm, onConfirm)
    console.log('🔍 DEBUG POPUP: downloading =', downloading)
    console.log('🔍 DEBUG POPUP: hasEnoughSpace =', hasEnoughSpace)
    console.log('🔍 DEBUG POPUP: game =', game)
    
    if (!selectedPath) {
      console.warn('❌ POPUP: Aucun chemin sélectionné')
      return
    }
    
    if (!onConfirm) {
      console.error('❌ POPUP: onConfirm est null/undefined')
      return
    }
    
    console.log('✅ POPUP: Appel de onConfirm...')
    
    try {
      // Vérifier si c'est un lien Gofile pour utiliser le téléchargement Python
      const isGofileDownload = game?.gofileUrl || game?.downloadUrl?.includes('gofile.io')
      
      if (isGofileDownload) {
        console.log('🐍 POPUP: Téléchargement Gofile détecté - utilisation du script Python')
        onConfirm(selectedPath, { useGofilePython: true })
      } else {
        console.log('📦 POPUP: Téléchargement standard')
        onConfirm(selectedPath)
      }
      
      console.log('✅ POPUP: onConfirm appelé avec succès')
    } catch (error) {
      console.error('❌ POPUP: Erreur lors de l\'appel de onConfirm:', error)
    }
  }

  const handleClose = () => {
    // Réinitialiser les états
    setSelectedPath('')
    setDiskSpace({ free: 0, total: 0, used: 0 })
    setSelectedDrive(null)
    setLoadingDiskSpace(false)
    
    if (onClose) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <Motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-gradient-to-br from-[#1a1a20] to-[#0f0f14] rounded-2xl max-w-lg w-full border border-white/10 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {game?.title || game?.name || 'Jeu'}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {game?.category || 'Téléchargement'}
              </p>
            </div>
            <Motion.button
              onClick={handleClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
            >
              <FiX className="w-5 h-5" />
            </Motion.button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {!downloadComplete ? (
              <>
                {/* Destination Path */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-300">
                    Emplacement d'installation
                  </label>
                  <div className="flex gap-2">
                    <div className={`flex-1 border rounded-lg px-4 py-2.5 text-sm font-mono truncate transition-colors ${
                      selectedPath 
                        ? 'bg-[#0f0f14] border-white/10 text-white' 
                        : 'bg-[#0f0f14]/50 border-red-500/50 text-gray-500'
                    }`}>
                      {selectedPath || 'Aucun dossier sélectionné - Cliquez sur "Choisir"'}
                    </div>
                    <Motion.button
                      onClick={handleChangePath}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2.5 bg-[#0f0f14] hover:bg-[#1a1a20] border border-white/10 rounded-lg transition-colors duration-200 flex items-center gap-2 text-white text-sm font-medium"
                    >
                      <FiFolder className="w-4 h-4" />
                      Choisir
                    </Motion.button>
                  </div>
                  {!selectedPath && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <span>⚠️</span>
                      Vous devez sélectionner un dossier d'installation
                    </p>
                  )}
                </div>

                {/* Disk Space Info */}
                <div className="bg-[#0f0f14]/50 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FiHardDrive className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-300">Espace disque</span>
                      {!handlersAvailable && (
                        <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                          Redémarrez pour la détection automatique
                        </span>
                      )}
                    </div>
                    {loadingDiskSpace && (
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  
                  {/* Sélection de disque */}
                  {handlersAvailable && availableDrives.length > 1 && (
                    <div className="mb-4">
                      <div className="text-xs text-gray-400 mb-2">Disques disponibles :</div>
                      <div className="flex flex-wrap gap-2">
                        {availableDrives.map((drive) => (
                          <Motion.button
                            key={drive.drive}
                            onClick={() => handleDriveChange(drive)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              selectedDrive?.drive === drive.drive
                                ? 'bg-[#3b82f6] text-white border border-[#3b82f6]'
                                : 'bg-[#1a1a1f] text-gray-300 border border-white/10 hover:border-white/20'
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-center gap-2">
                              <FiHardDrive className="w-3 h-3" />
                              <span>{drive.drive}</span>
                            </div>
                            <div className="text-xs opacity-75 mt-1">
                              {formatBytes(drive.free)} libre
                            </div>
                          </Motion.button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <Motion.div 
                      className="flex justify-between text-sm"
                      key={`size-${loadingSize}-${displaySizeText}`}
                      initial={{ opacity: 0.7 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className="text-gray-400">Taille requise</span>
                      <span className="text-white font-medium">
                        {loadingSize ? (
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                            Récupération...
                          </span>
                        ) : (
                          <Motion.span
                            key={displaySizeText}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4 }}
                          >
                            {displaySizeText}
                          </Motion.span>
                        )}
                      </span>
                    </Motion.div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Disponible</span>
                      <span className={`font-medium ${hasEnoughSpace ? 'text-white' : 'text-red-400'}`}>
                        {formatBytes(diskSpace.free)}
                      </span>
                    </div>
                    <Motion.div 
                      className="flex justify-between text-sm"
                      key={`remaining-${displaySize}`}
                      initial={{ opacity: 0.7 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <span className="text-gray-400">Après installation</span>
                      <span className={`font-medium ${hasEnoughSpace ? 'text-white' : 'text-red-400'}`}>
                        <Motion.span
                          key={`${remainingSpace.toFixed(1)}`}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4 }}
                        >
                          {remainingSpace.toFixed(1)} GB
                        </Motion.span>
                      </span>
                    </Motion.div>
                    
                    {/* Avertissement si pas assez d'espace */}
                    {handlersAvailable && !hasEnoughSpace && (
                      <Motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg"
                      >
                        <span className="text-red-400 text-xs">⚠️</span>
                        <span className="text-red-400 text-xs">Espace insuffisant sur ce disque</span>
                      </Motion.div>
                    )}
                  </div>
                </div>

                {/* Download Progress */}
                {downloading && (
                  <Motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Téléchargement en cours</span>
                      <span className="text-white font-medium">{progress}%</span>
                    </div>
                    <div className="h-2 bg-[#0f0f14] rounded-full overflow-hidden border border-white/10">
                      <Motion.div
                        className="h-full bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {((displaySize * progress) / 100).toFixed(1)} GB / {displaySizeText}
                    </p>
                  </Motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Motion.button
                    onClick={handleClose}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-[#0f0f14] hover:bg-[#1a1a20] border border-white/10 text-white rounded-lg transition-colors duration-200 font-medium text-sm"
                  >
                    Annuler
                  </Motion.button>
                  <Motion.button
                    onClick={handleConfirm}
                    disabled={downloading || !selectedPath || (handlersAvailable && !hasEnoughSpace)} // Bloquer seulement si handlers disponibles ET pas assez d'espace
                    whileHover={downloading || !selectedPath || (handlersAvailable && !hasEnoughSpace) ? {} : { scale: 1.02 }}
                    whileTap={downloading || !selectedPath || (handlersAvailable && !hasEnoughSpace) ? {} : { scale: 0.98 }}
                    className={`flex-1 px-4 py-2.5 rounded-lg transition-colors duration-200 font-medium text-sm flex items-center justify-center gap-2 ${
                      !selectedPath 
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed border border-gray-600' 
                        : (handlersAvailable && !hasEnoughSpace)
                          ? 'bg-red-600 text-red-200 cursor-not-allowed border border-red-600'
                        : downloading 
                          ? 'bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white opacity-50 cursor-not-allowed'
                          : 'bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] hover:from-[#0891b2] hover:to-[#2563eb] text-white'
                    }`}
                  >
                    <FiDownload className="w-4 h-4" />
                    {!selectedPath 
                      ? 'Choisir un dossier' 
                      : (handlersAvailable && !hasEnoughSpace)
                        ? 'Espace insuffisant'
                        : downloading 
                          ? 'Téléchargement...' 
                          : 'Confirmer'
                    }
                  </Motion.button>
                </div>
              </>
            ) : (
              <Motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4 py-6"
              >
                <Motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-12 h-12 bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] rounded-full flex items-center justify-center mx-auto"
                >
                  <FiCheck className="w-6 h-6 text-white" />
                </Motion.div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Installation terminée</h3>
                  <p className="text-sm text-gray-400 mt-1">Le jeu est prêt à être lancé</p>
                </div>
                <div className="bg-[#0f0f14]/50 rounded-lg p-4 border border-white/10 text-left">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Espace utilisé</span>
                      <span className="text-white font-medium">{displaySizeText}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Espace restant</span>
                      <span className="text-white font-medium">{(diskSpace - displaySize).toFixed(1)} GB</span>
                    </div>
                  </div>
                </div>
                <Motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] hover:from-[#0891b2] hover:to-[#2563eb] text-white rounded-lg transition-colors duration-200 font-medium text-sm"
                >
                  Terminer
                </Motion.button>
              </Motion.div>
            )}
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>
  )
}