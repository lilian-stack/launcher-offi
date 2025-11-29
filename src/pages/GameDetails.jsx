import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiArrowLeft, FiDownload, FiStar, FiHeart, FiGrid, FiLoader, FiAlertCircle, FiPlay, FiTrash2, FiFolder, FiImage, FiPause, FiX, FiCheckCircle } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'
import { ShortcutModal } from '../components/ShortcutModal'
import { UninstallModal } from '../components/UninstallModal'
import { ImageModal } from '../components/ImageModal'
import { DownloadInfoModal } from '../components/DownloadInfoModal'
import { downloadManager } from '../services/downloadManager'

// Composant pour gérer les vidéos avec fallback (essaye mp4 si webm échoue)
function VideoPlayerWithFallback({ src, autoPlay, loop, muted, playsInline, className, game }) {
  const [videoError, setVideoError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const [hasTriedAlternative, setHasTriedAlternative] = useState(false)
  const videoRef = useRef(null)
  const errorCountRef = useRef(0)
  
  // Réinitialiser quand src change
  useEffect(() => {
    setCurrentSrc(src)
    setVideoError(false)
    setHasTriedAlternative(false)
    errorCountRef.current = 0
  }, [src])
  
  // Si l'URL est webm et échoue, essayer mp4 (ou vice versa)
  const getAlternativeUrl = (url) => {
    if (!url) return null
    // Remplacer webm par mp4
    if (url.includes('.webm')) {
      return url.replace('.webm', '.mp4').replace('movie_max.webm', 'movie_max.mp4').replace('movie480.webm', 'movie480.mp4')
    }
    // Remplacer mp4 par webm
    if (url.includes('.mp4')) {
      return url.replace('.mp4', '.webm').replace('movie_max.mp4', 'movie_max.webm').replace('movie480.mp4', 'movie480.webm')
    }
    return null
  }
  
  const handleError = (e) => {
    // Limiter les tentatives pour éviter le spam
    errorCountRef.current += 1
    
    // Si on a déjà essayé l'alternative ou trop d'erreurs, arrêter
    if (hasTriedAlternative || errorCountRef.current > 2) {
      setVideoError(true)
      if (e.target) {
        e.target.style.display = 'none'
      }
      return
    }
    
    // Essayer le format alternatif une seule fois
    const altUrl = getAlternativeUrl(currentSrc)
    if (altUrl && !hasTriedAlternative) {
      setHasTriedAlternative(true)
      setCurrentSrc(altUrl)
      // Utiliser setTimeout pour éviter les appels multiples
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.src = altUrl
          videoRef.current.load()
        }
      }, 100)
    } else {
      // Pas d'alternative ou déjà essayé, masquer la vidéo
      setVideoError(true)
      if (e.target) {
        e.target.style.display = 'none'
      }
    }
  }
  
  if (videoError || !currentSrc) {
    return null // Laisser l'image de fond s'afficher
  }
  
  return (
    <video
      ref={videoRef}
      src={currentSrc}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      className={className}
      onError={handleError}
      preload="metadata"
    />
  )
}

export function GameDetails({ gameId, installedGames = [], toast, currentUser = null }) {
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [downloading, setDownloading] = useState(false)
  
  // Mettre à jour la ref quand downloading change
  useEffect(() => {
    downloadingRef.current = downloading
  }, [downloading])
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [installedGame, setInstalledGame] = useState(null) // { name, folder, exePath }
  const [isCheckingInstalled, setIsCheckingInstalled] = useState(false) // Flag pour éviter les appels multiples
  const uninstalledRef = useRef(false) // Flag pour savoir si le jeu vient d'être désinstallé
  const checkTimerRef = useRef(null) // Timer pour éviter les appels répétés à checkInstalledGame
  const lastCheckTimeRef = useRef(0) // Dernier temps de vérification pour éviter les appels trop fréquents
  const downloadingRef = useRef(false) // Ref pour accéder à la valeur actuelle de downloading sans déclencher de re-render
  const downloadStartedRef = useRef(0) // Timestamp du dernier démarrage de téléchargement
  const [isUninstalling, setIsUninstalling] = useState(false) // Flag pour la désinstallation en cours
  const [showShortcutModal, setShowShortcutModal] = useState(false)
  const [completedGameData, setCompletedGameData] = useState(null) // { gameName, exePath }
  const [showUninstallModal, setShowUninstallModal] = useState(false)
  const [showUninstallSuccess, setShowUninstallSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [mediaReady, setMediaReady] = useState(false)
  const mediaSectionRef = useRef(null)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [showDownloadInfoModal, setShowDownloadInfoModal] = useState(false)

  const sectionConfig = [
    { id: 'overview', label: 'Aperçu', icon: FiGrid },
    { id: 'requirements', label: 'Configurations', icon: FiStar },
    { id: 'media', label: 'Médias', icon: FiImage }
  ]

  useEffect(() => {
    if (mediaReady) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setMediaReady(true)
      }
    }, { threshold: 0.2 })

    const node = mediaSectionRef.current
    if (node) observer.observe(node)
    return () => observer.disconnect()
  }, [mediaReady, activeTab])


  // ✅ Vérifier directement si le jeu est dans installedGames
  const isGameActuallyInstalled = useMemo(() => {
    if (!game || !installedGames || installedGames.length === 0) return false
    
    const gameName = game.name || game.title
    if (!gameName) return false
    
    const normalizeName = (name) => {
      if (!name) return ''
      return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
    }
    
    const normalizedGameName = normalizeName(gameName)
    return installedGames.some(g => {
      if (!g.name) return false
      const normalizedInstalledName = normalizeName(g.name)
      const gameWords = normalizedGameName.split(' ').filter(w => w.length > 2)
      const installedWords = normalizedInstalledName.split(' ').filter(w => w.length > 2)
      const matchingWords = gameWords.filter(w => installedWords.includes(w))
      const matchRatio = gameWords.length > 0 ? matchingWords.length / gameWords.length : 0
      const exactMatch = normalizedInstalledName === normalizedGameName
      const containsMatch = normalizedInstalledName.includes(normalizedGameName) || normalizedGameName.includes(normalizedInstalledName)
      const wordMatch = matchRatio >= 0.5
      return exactMatch || containsMatch || wordMatch
    })
  }, [game, installedGames])
  
  // ✅ FORCER downloading à false si le jeu n'est pas installé ET qu'aucun téléchargement n'est en cours
  // Ne pas réinitialiser si un téléchargement vient d'être lancé (dans les 2 secondes)
  useEffect(() => {
    // Ne réinitialiser que si le jeu n'est pas installé ET qu'il n'y a pas de téléchargement actif
    // Un téléchargement actif est indiqué par downloadProgress > 0 ou un téléchargement récemment lancé
    const timeSinceDownloadStart = Date.now() - downloadStartedRef.current
    const isRecentDownload = timeSinceDownloadStart < 2000 // 2 secondes
    
    if (!isGameActuallyInstalled && downloading && downloadProgress === 0 && !isRecentDownload) {
      // Si après 2 secondes il n'y a toujours pas de progression, c'est probablement un état bloqué
      setDownloading(false)
      setDownloadProgress(0)
      setIsPaused(false)
      setError('')
    }
  }, [isGameActuallyInstalled, downloading, downloadProgress])

  const progressValue = downloading && isGameActuallyInstalled
    ? Math.min(100, Math.max(0, downloadProgress))
    : installedGame
      ? 100
      : 0

  const progressLabel = downloading && isGameActuallyInstalled
    ? `Téléchargement • ${Math.round(downloadProgress)}%`
    : installedGame
      ? 'Installé'
      : 'Prêt à télécharger'

  const progressSubtitle = downloading
    ? 'Interruption automatique en cas d\'erreur ou d\'antivirus'
    : installedGame
      ? installedGame.folder || 'Dossier local synchronisé'
      : (game?.downloadUrl ? 'Le jeu sera téléchargé dans votre dossier choisi' : 'URL de téléchargement manquante')

  // Mettre à jour installedGame quand installedGames change
  useEffect(() => {
    if (!game) return
    
    // Si pas de jeux installés, mettre à jour l'état IMMÉDIATEMENT (même si uninstalledRef est actif)
    if (!installedGames || installedGames.length === 0) {
      downloadStartedRef.current = 0 // Réinitialiser le timestamp du téléchargement
      setInstalledGame(null)
      setDownloading(false)
      setDownloadProgress(0)
      setIsPaused(false)
      setError('')
      return
    }
    
    // Si le jeu vient d'être désinstallé, vérifier quand même si installedGames a changé
    // pour mettre à jour l'état si nécessaire
    if (uninstalledRef.current) {
      console.log('[GameDetails] 🔍 Flag uninstalledRef actif, vérification du statut...')
      // Vérifier si le jeu est toujours dans installedGames
      const gameName = game.name || game.title
      if (gameName) {
        const normalizeName = (name) => {
          if (!name) return ''
          return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
        }
        const normalizedGameName = normalizeName(gameName)
        const found = installedGames.find(g => {
          if (!g.name) return false
          const normalizedInstalledName = normalizeName(g.name)
          const gameWords = normalizedGameName.split(' ').filter(w => w.length > 2)
          const installedWords = normalizedInstalledName.split(' ').filter(w => w.length > 2)
          const matchingWords = gameWords.filter(w => installedWords.includes(w))
          const matchRatio = gameWords.length > 0 ? matchingWords.length / gameWords.length : 0
          const exactMatch = normalizedInstalledName === normalizedGameName
          const containsMatch = normalizedInstalledName.includes(normalizedGameName) || normalizedGameName.includes(normalizedInstalledName)
          const wordMatch = matchRatio >= 0.5
          return exactMatch || containsMatch || wordMatch
        })
        
        // Si le jeu n'est pas trouvé, mettre à jour l'état même si uninstalledRef est actif
        if (!found) {
          console.log('[GameDetails] ✅ Jeu non trouvé dans installedGames, confirmation de non-installation')
          downloadStartedRef.current = 0 // Réinitialiser le timestamp du téléchargement
          setInstalledGame(null)
          setDownloading(false)
          setDownloadProgress(0)
          setIsPaused(false)
          setError('')
          // Réinitialiser le flag immédiatement puisque le jeu n'est plus installé
          uninstalledRef.current = false
        }
      }
      return
    }

    const gameName = game.name || game.title
    if (!gameName) return

    // Comparaison flexible des noms
    const normalizeName = (name) => {
      if (!name) return ''
      return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
    }
    const normalizedGameName = normalizeName(gameName)

    const found = installedGames.find(g => {
      if (!g.name) return false
      const normalizedInstalledName = normalizeName(g.name)
      const gameWords = normalizedGameName.split(' ').filter(w => w.length > 2)
      const installedWords = normalizedInstalledName.split(' ').filter(w => w.length > 2)
      const matchingWords = gameWords.filter(w => installedWords.includes(w))
      const matchRatio = gameWords.length > 0 ? matchingWords.length / gameWords.length : 0
      
      const exactMatch = normalizedInstalledName === normalizedGameName
      const containsMatch = normalizedInstalledName.includes(normalizedGameName) || normalizedGameName.includes(normalizedInstalledName)
      const wordMatch = matchRatio >= 0.5
      
      return exactMatch || containsMatch || wordMatch
    })

    if (found) {
      // Si l'exécutable est déjà disponible, l'utiliser directement
      if (found.executable) {
        const installedGameData = {
          name: found.name,
          folder: found.folder,
          exePath: found.executable
        }
        setInstalledGame(installedGameData)
        // Réinitialiser l'état de téléchargement si le jeu est installé
        setDownloading(false)
        setDownloadProgress(0)
        setIsPaused(false)
        setError('')
      } else if (found.executableName) {
        // Si on a le nom de l'exécutable mais pas le chemin complet, essayer de le construire
        const exePath = `${found.folder.replace(/\\/g, '/')}/${found.executableName}`.replace(/\/+/g, '/')
        const installedGameData = {
          name: found.name,
          folder: found.folder,
          exePath: exePath
        }
        setInstalledGame(installedGameData)
        // Réinitialiser l'état de téléchargement
        setDownloading(false)
        setDownloadProgress(0)
        setIsPaused(false)
        setError('')
      } else {
        // Même sans exécutable détecté, on peut marquer le jeu comme installé
        // et essayer de trouver l'exécutable plus tard
        // Essayer de trouver l'exécutable de manière asynchrone
        if (window.electron && window.electron.games && window.electron.games.findGameExe) {
          window.electron.games.findGameExe(found.folder, gameName).then(exeResult => {
            if (exeResult.success && exeResult.exePath) {
              const installedGameData = {
                name: found.name,
                folder: found.folder,
                exePath: exeResult.exePath
              }
              setInstalledGame(installedGameData)
              // Réinitialiser l'état de téléchargement
              setDownloading(false)
              setDownloadProgress(0)
              setIsPaused(false)
              setError('')
            } else {
              // Même sans exécutable, on peut marquer comme installé
              const installedGameData = {
                name: found.name,
                folder: found.folder,
                exePath: null
              }
              setInstalledGame(installedGameData)
              // Réinitialiser l'état de téléchargement
              setDownloading(false)
              setDownloadProgress(0)
              setIsPaused(false)
              setError('')
            }
          }).catch(err => {
            console.error('[GameDetails] Erreur lors de la recherche de l\'exécutable:', err)
            // Même en cas d'erreur, on marque comme installé
            const installedGameData = {
              name: found.name,
              folder: found.folder,
              exePath: null
            }
            setInstalledGame(installedGameData)
            // Réinitialiser l'état de téléchargement
            setDownloading(false)
            setDownloadProgress(0)
            setIsPaused(false)
            setError('')
          })
        } else {
          // Même sans API, on marque comme installé
          const installedGameData = {
            name: found.name,
            folder: found.folder,
            exePath: null
          }
          setInstalledGame(installedGameData)
          // Réinitialiser l'état de téléchargement
          setDownloading(false)
          setDownloadProgress(0)
          setIsPaused(false)
          setError('')
        }
      }
    } else {
      // Si le jeu n'est pas trouvé dans installedGames, réinitialiser complètement l'état IMMÉDIATEMENT
      // Réinitialiser downloading AVANT installedGame pour éviter que le useEffect de détection de blocage ne se déclenche
      downloadStartedRef.current = 0 // Réinitialiser le timestamp du téléchargement
      setDownloading(false)
      setDownloadProgress(0)
      setIsPaused(false)
      setError('')
      setInstalledGame(null)
    }
  }, [installedGames, game]) // Retirer downloading et downloadProgress des dépendances pour éviter les boucles

  useEffect(() => {
    loadGame()
    setIsFavorite(favoritesService.isFavorite(gameId))
    
    // ✅ Synchroniser l'état de téléchargement depuis downloadManager quand on arrive sur la page
    if (gameId && downloadManager) {
      const download = downloadManager.getDownload(gameId)
      if (download) {
        // Si un téléchargement est en cours, synchroniser l'état
        if (download.status === 'downloading' || download.status === 'extracting') {
          setDownloading(true)
          setDownloadProgress(download.progress || 0)
          downloadStartedRef.current = download.startTime || Date.now()
        } else if (download.status === 'completed' || download.status === 'extracted') {
          // Téléchargement terminé, réinitialiser
          setDownloading(false)
          setDownloadProgress(0)
          downloadStartedRef.current = 0
        } else if (download.status === 'failed') {
          // Téléchargement échoué
          setDownloading(false)
          setDownloadProgress(0)
          setError(download.error || 'Erreur de téléchargement')
          downloadStartedRef.current = 0
        }
      } else {
        // Pas de téléchargement actif, réinitialiser
        downloadStartedRef.current = 0
        setDownloading(false)
        setDownloadProgress(0)
        setIsPaused(false)
        setError('')
      }
    } else {
      // Réinitialiser IMMÉDIATEMENT l'état de téléchargement quand on change de jeu
      downloadStartedRef.current = 0 // Réinitialiser le timestamp du téléchargement
      setDownloading(false)
      setDownloadProgress(0)
      setIsPaused(false)
      setError('')
    }
    // Réinitialiser le flag de désinstallation
    uninstalledRef.current = false
    
    // Vérifier IMMÉDIATEMENT si le jeu est installé (sans délai)
    // Utiliser installedGames directement si disponible
    if (installedGames && installedGames.length > 0) {
      // Vérifier immédiatement dans la liste des jeux installés
      const checkImmediately = () => {
        if (game) {
          const gameName = game.name || game.title
          if (gameName) {
            const normalizeName = (name) => {
              if (!name) return ''
              return name
                .toLowerCase()
                .trim()
                .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // Supprimer les symboles spéciaux
                .replace(/[^\x20-\x7E]/g, '') // Supprimer tous les caractères non-ASCII
                .replace(/\s+/g, ' ') // Collapser les espaces multiples
                .replace(/[^a-z0-9\s]/g, '') // Supprimer tous les caractères non alphanumériques
                .trim()
            }
            const normalizedGameName = normalizeName(gameName)
            const found = installedGames.find(g => {
              if (!g.name) return false
              const normalizedInstalledName = normalizeName(g.name)
              const gameWords = normalizedGameName.split(' ').filter(w => w.length > 2)
              const installedWords = normalizedInstalledName.split(' ').filter(w => w.length > 2)
              const matchingWords = gameWords.filter(w => installedWords.includes(w))
              const matchRatio = gameWords.length > 0 ? matchingWords.length / gameWords.length : 0
              const exactMatch = normalizedInstalledName === normalizedGameName
              const containsMatch = normalizedInstalledName.includes(normalizedGameName) || normalizedGameName.includes(normalizedInstalledName)
              const wordMatch = matchRatio >= 0.5
              return exactMatch || containsMatch || wordMatch
            })
            
            if (!found) {
              // Jeu non installé, s'assurer que downloading est false
              setDownloading(false)
              setDownloadProgress(0)
              setIsPaused(false)
              setInstalledGame(null)
            }
          }
        }
      }
      
      // Vérifier immédiatement
      checkImmediately()
      
      // Vérifier avec le cache (pas de scan forcé pour éviter le spam)
      // Utiliser un ref pour éviter les appels répétés
      if (!downloading && !checkTimerRef.current) {
        checkTimerRef.current = setTimeout(() => {
          checkInstalledGame(false) // Utilise le cache
          checkTimerRef.current = null
        }, 100)
      }
      
      return () => {
        if (checkTimerRef.current) {
          clearTimeout(checkTimerRef.current)
          checkTimerRef.current = null
        }
      }
    } else {
      // Si installedGames n'est pas encore disponible, vérifier avec le cache
      // Utiliser un ref pour éviter les appels répétés
      if (!downloading && !checkTimerRef.current) {
        checkTimerRef.current = setTimeout(() => {
          checkInstalledGame(false) // Utilise le cache
          checkTimerRef.current = null
        }, 100)
      }
      return () => {
        if (checkTimerRef.current) {
          clearTimeout(checkTimerRef.current)
          checkTimerRef.current = null
        }
      }
    }
  }, [gameId, installedGames]) // Retirer downloading des dépendances pour éviter les boucles

  // Écouter l'événement game-uninstalled pour réinitialiser immédiatement l'état
  useEffect(() => {
    const handleGameUninstalled = (event) => {
      const uninstalledGameName = event.detail?.gameName
      const currentGameName = game?.name || game?.title
      
      // Normaliser les noms pour la comparaison
      const normalizeName = (name) => {
        if (!name) return ''
        return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[®©™]/g, '')
      }
      
      // Si c'est le jeu actuellement affiché qui a été désinstallé, réinitialiser immédiatement
      if (uninstalledGameName && currentGameName) {
        const normalizedUninstalled = normalizeName(uninstalledGameName)
        const normalizedCurrent = normalizeName(currentGameName)
        
        if (normalizedUninstalled === normalizedCurrent || 
            normalizedCurrent.includes(normalizedUninstalled) ||
            normalizedUninstalled.includes(normalizedCurrent)) {
          console.log('[GameDetails] 🗑️ Événement désinstallation reçu - forçage états')
          
          // ✅ Ne plus activer uninstalledRef ici
          // ✅ Juste forcer la réinitialisation des états visuels
          downloadStartedRef.current = 0 // Réinitialiser le timestamp du téléchargement
          setInstalledGame(null)
          setDownloading(false)
          setDownloadProgress(0)
          setIsPaused(false)
          setError('')
          setIsCheckingInstalled(false)
          
          // ✅ NOUVEAU : Forcer un re-render avec un délai minimal pour être absolument sûr
          setTimeout(() => {
            downloadStartedRef.current = 0
            setDownloading(false)
            setDownloadProgress(0)
            setInstalledGame(null)
          }, 10)
        }
      }
    }
    
    window.addEventListener('game-uninstalled', handleGameUninstalled)
    return () => {
      window.removeEventListener('game-uninstalled', handleGameUninstalled)
    }
  }, [game])

  // Détecter et corriger les téléchargements bloqués (0% depuis plus de 5 secondes)
  // ⚠️ Ne pas déclencher si le jeu vient d'être désinstallé ou si installedGame est null
  useEffect(() => {
    // Ne pas vérifier si le jeu vient d'être désinstallé ou si le jeu n'est pas installé
    if (uninstalledRef.current || !installedGame) {
      return
    }
    
    if (downloading && downloadProgress === 0) {
      const timeout = setTimeout(() => {
        // Vérifier à nouveau les conditions avant d'afficher l'erreur
        if (downloading && downloadProgress === 0 && !uninstalledRef.current && installedGame) {
          console.warn('[GameDetails] Téléchargement bloqué détecté, réinitialisation...')
          setDownloading(false)
          setDownloadProgress(0)
          setIsPaused(false)
          setError('Le téléchargement semble bloqué. Veuillez réessayer.')
          // Vérifier à nouveau si le jeu est installé avec un scan forcé
          checkInstalledGame()
        }
      }, 5000)
      
      return () => clearTimeout(timeout)
    }
  }, [downloading, downloadProgress, installedGame])


  // Écouter les mises à jour du DownloadManager pour ce jeu
  useEffect(() => {
    if (!game || !gameId) return

    const updateDownloadStatus = () => {
      const download = downloadManager.getDownload(gameId)
      if (download) {
        setDownloading(download.status === 'downloading' || download.status === 'extracting')
        setDownloadProgress(download.progress || 0)
      } else {
        // Vérifier si un téléchargement existe avec le nom du jeu
        const allDownloads = downloadManager.getAllDownloads()
        const gameName = game.name || game.title
        const matchingDownload = allDownloads.find(d => {
          const normalizeName = (name) => name?.toLowerCase().trim().replace(/\s+/g, ' ') || ''
          return normalizeName(d.gameName) === normalizeName(gameName)
        })
        if (matchingDownload) {
          setDownloading(matchingDownload.status === 'downloading' || matchingDownload.status === 'extracting')
          setDownloadProgress(matchingDownload.progress || 0)
        } else {
          setDownloading(false)
          setDownloadProgress(0)
        }
      }
    }

    // Mise à jour initiale
    updateDownloadStatus()

    // S'abonner aux mises à jour
    const unsubscribe = downloadManager.subscribe(updateDownloadStatus)

    return unsubscribe
  }, [game, gameId])

  // Écouter les événements de téléchargement (séparé pour éviter les re-créations)
  useEffect(() => {
    // Écouter les événements de téléchargement
    if (!window.electron || !window.electron.ipcRenderer) return
    
    // Listener global de debug pour tous les événements download
    const debugDownloadListener = (event, data) => {
      }
    window.electron.ipcRenderer.on('download:part-completed', debugDownloadListener)
    window.electron.ipcRenderer.on('download:complete', debugDownloadListener)
    window.electron.ipcRenderer.on('download:error', debugDownloadListener)
    
    const handleDownloadProgress = (event, data) => {
      // Vérifier que c'est bien pour le jeu actuel
      const currentGameName = game?.name || game?.title
      const downloadGameName = data?.gameName
      
      if (currentGameName && downloadGameName) {
        // Normaliser les noms pour la comparaison
        const normalizeName = (name) => name.toLowerCase().trim().replace(/\s+/g, ' ')
        const normalizedCurrent = normalizeName(currentGameName)
        const normalizedDownload = normalizeName(downloadGameName)
        
        // Vérifier si les noms correspondent
        const matches = normalizedCurrent === normalizedDownload || 
                       normalizedCurrent.includes(normalizedDownload) ||
                       normalizedDownload.includes(normalizedCurrent)
        
        if (!matches) {
          return // Ignorer les événements pour d'autres jeux
        }
      }
      
      // data.progress est déjà un pourcentage (0-100), pas besoin de multiplier
      const progress = data.progress || 0
      
      // Mettre à jour la progression
      setDownloadProgress(progress)
      
      // S'assurer que downloading est à true si on reçoit des événements de progression
      setDownloading(prev => {
        if (progress > 0 && !prev) {
          return true
        }
        return prev
      })
    }

    const handleDownloadCompleted = (event, data) => {
        setDownloading(false)
        setDownloadProgress(0)
        }

      const handleDownloadFailed = (event, data) => {
        setDownloading(false)
        setDownloadProgress(0)
        setError('Erreur lors du téléchargement: ' + (data.state || 'Erreur inconnue'))
        console.error('[GameDetails] Téléchargement échoué:', data)
      }

      const handleDownloadRequiresInteraction = (event, data) => {
        console.warn('[GameDetails] Téléchargement nécessite une interaction visible:', data)
        setDownloading(false)
        setDownloadProgress(0)
        const openInBrowser = window.confirm(
          'Le téléchargement automatique n\'a pas pu détecter le lien.\n\n' +
          'Voulez-vous ouvrir le lien dans votre navigateur pour télécharger manuellement ?'
        )
        if (openInBrowser && window.electron && window.electron.shell && window.electron.shell.openExternal) {
          window.electron.shell.openExternal(data.url)
        }
      }

      const handleDownloadExtracted = (event, data) => {
        setDownloading(false)
        setDownloadProgress(0)
        alert(`${data.gameName} a été installé avec succès dans:\n${data.gameFolder}`)
      }

      const handleDownloadExtractionFailed = (event, data) => {
        console.error('[GameDetails] Erreur lors de l\'extraction:', data)
        setDownloading(false)
        setDownloadProgress(0)
        setError('Erreur lors de l\'extraction: ' + (data.error || 'Erreur inconnue'))
      }

      const handleDownloadComplete = (event, data) => {
        setDownloading(false)
        setDownloadProgress(0)
        setError('')
        
        // Utiliser directement l'exePath de l'événement s'il est disponible
        const installedGameName = data.gameName || game?.name || game?.title
        const exePathFromEvent = data.exePath || null
        
        if (installedGameName) {
          // Si on a l'exePath directement depuis l'événement, l'utiliser
          if (exePathFromEvent) {
            const installedGameData = {
              name: installedGameName,
              folder: data.folder || null,
              exePath: exePathFromEvent
            }
            setInstalledGame(installedGameData)
            setDownloading(false)
            setDownloadProgress(0)
            setIsPaused(false)
            setError('')
            setCompletedGameData({
              gameName: installedGameName,
              exePath: exePathFromEvent
            })
            setShowShortcutModal(true)
            // ✅ Mise à jour immédiate après installation
            console.log('[GameDetails] 📦 Installation complète, vérification immédiate du statut...')
            checkInstalledGame(true)
          } else {
            // Sinon, chercher dans le scan (fallback)
            setTimeout(async () => {
              try {
                if (window.electron && window.electron.download && window.electron.download.scanInstalledGames) {
                  const result = await window.electron.download.scanInstalledGames(null, true) // Force le scan
                  if (result.success && result.games) {
                    // Comparaison flexible des noms
                    const normalizeName = (name) => name.toLowerCase().trim().replace(/\s+/g, ' ')
                    const normalizedGameName = normalizeName(installedGameName)
                    
                    const found = result.games.find(g => {
                      const normalizedInstalledName = normalizeName(g.name)
                      return normalizedInstalledName === normalizedGameName || 
                             normalizedInstalledName.includes(normalizedGameName) ||
                             normalizedGameName.includes(normalizedInstalledName)
                    })
                    
                    if (found) {
                      // Utiliser l'exécutable stocké dans le marqueur si disponible
                      let exePath = null
                      if (found.executable && found.hasExecutable) {
                        exePath = found.executable
                      } else if (window.electron && window.electron.games && window.electron.games.findGameExe) {
                        const exeResult = await window.electron.games.findGameExe(found.folder, installedGameName)
                        if (exeResult.success && exeResult.exePath) {
                          exePath = exeResult.exePath
                        }
                      }
                      
                      if (exePath) {
                        const installedGameData = {
                          name: found.name,
                          folder: found.folder,
                          exePath: exePath
                        }
                        setInstalledGame(installedGameData)
                        setDownloading(false)
                        setDownloadProgress(0)
                        setIsPaused(false)
                        setError('')
                        setCompletedGameData({
                          gameName: found.name,
                          exePath: exePath
                        })
                        setShowShortcutModal(true)
                        // ✅ Mise à jour immédiate après installation
                        console.log('[GameDetails] 📦 Installation complète (via scan), vérification immédiate...')
                        checkInstalledGame(true)
                      } else {
                        // Même sans exePath, on peut proposer le raccourci plus tard
                        setInstalledGame({
                          name: found.name,
                          folder: found.folder,
                          exePath: null
                        })
                        setDownloading(false)
                        setDownloadProgress(0)
                        setIsPaused(false)
                        setError('')
                        setCompletedGameData({
                          gameName: found.name,
                          exePath: null
                        })
                        setShowShortcutModal(true)
                        checkInstalledGame(true)
                      }
                    } else {
                      // Afficher quand même le modal avec les données disponibles
                      setDownloading(false)
                      setDownloadProgress(0)
                      setIsPaused(false)
                      setError('')
                      setCompletedGameData({
                        gameName: installedGameName,
                        exePath: null
                      })
                      setShowShortcutModal(true)
                      checkInstalledGame(true)
                    }
                  }
                }
              } catch (err) {
                console.error('[GameDetails] Erreur lors de la vérification:', err)
              }
            }, 1000) // Délai réduit pour laisser le temps au marqueur d'être créé
          }
        }
      }

      const handleDownloadError = (event, data) => {
        console.error('[GameDetails] ❌ Erreur de téléchargement:', data)
        setDownloading(false)
        setDownloadProgress(0)
        const errorMessage = data.error || 'Erreur inconnue'
        setError(`Erreur: ${errorMessage}`)
        // Afficher aussi une alerte pour les erreurs importantes
        if (errorMessage.includes('vide') || errorMessage.includes('incomplet') || errorMessage.includes('corrompue')) {
          alert(`Erreur: ${errorMessage}`)
        }
      }

      const handleExtractionStarted = (event, data) => {
        // Ne pas mettre setDownloading(false) car on est toujours en cours
        // L'extraction fait partie du processus de téléchargement
        // Mettre à jour le message pour indiquer l'extraction
        setDownloadProgress(100) // Le téléchargement est à 100%, on passe à l'extraction
      }

      const handleExtractionProgress = (event, data) => {
        }

    const handleDownloadCancelled = (event, data) => {
      const currentGameName = game?.name || game?.title
      const cancelledGameName = data?.gameName
      
      if (currentGameName && cancelledGameName) {
        const normalizeName = (name) => name.toLowerCase().trim().replace(/\s+/g, ' ')
        const normalizedCurrent = normalizeName(currentGameName)
        const normalizedCancelled = normalizeName(cancelledGameName)
        
        const matches = normalizedCurrent === normalizedCancelled || 
                       normalizedCurrent.includes(normalizedCancelled) ||
                       normalizedCancelled.includes(normalizedCurrent)
        
        if (matches) {
          setDownloading(false)
          setDownloadProgress(0)
          setIsPaused(false)
        }
      }
    }

    window.electron.ipcRenderer.on('download:progress', handleDownloadProgress)
    window.electron.ipcRenderer.on('download:completed', handleDownloadCompleted)
    window.electron.ipcRenderer.on('download:failed', handleDownloadFailed)
    window.electron.ipcRenderer.on('download:requires-visible-interaction', handleDownloadRequiresInteraction)
    window.electron.ipcRenderer.on('extraction-started', handleExtractionStarted)
    window.electron.ipcRenderer.on('extraction-progress', handleExtractionProgress)
    window.electron.ipcRenderer.on('download:extracted', handleDownloadExtracted)
    window.electron.ipcRenderer.on('download:extraction-failed', handleDownloadExtractionFailed)
    window.electron.ipcRenderer.on('download:complete', handleDownloadComplete)
    window.electron.ipcRenderer.on('download:error', handleDownloadError)
    window.electron.ipcRenderer.on('download:cancelled', handleDownloadCancelled)

    return () => {
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('download:progress')
        window.electron.ipcRenderer.removeAllListeners('download:completed')
        window.electron.ipcRenderer.removeAllListeners('download:failed')
        window.electron.ipcRenderer.removeAllListeners('download:requires-visible-interaction')
        window.electron.ipcRenderer.removeAllListeners('extraction-started')
        window.electron.ipcRenderer.removeAllListeners('extraction-progress')
        window.electron.ipcRenderer.removeAllListeners('download:extracted')
        window.electron.ipcRenderer.removeAllListeners('download:extraction-failed')
        window.electron.ipcRenderer.removeAllListeners('download:complete')
        window.electron.ipcRenderer.removeAllListeners('download:error')
        window.electron.ipcRenderer.removeAllListeners('download:cancelled')
      }
    }
  }, [game]) // Ne dépendre que de game pour éviter les re-configurations inutiles des listeners

  const checkInstalledGame = async (forceRefresh = false) => {
    // Protection contre les appels multiples
    if (isCheckingInstalled && !forceRefresh) {
      return
    }
    
    // ✅ Désactiver le scan pendant un téléchargement actif
    if (downloading && !forceRefresh) {
      return
    }
    
    // Protection supplémentaire : éviter les appels trop fréquents (minimum 2 secondes entre les appels)
    const now = Date.now()
    if (!forceRefresh && (now - lastCheckTimeRef.current) < 2000) {
      return
    }
    lastCheckTimeRef.current = now
    
    try {
      setIsCheckingInstalled(true)
      
      if (!game) {
        setIsCheckingInstalled(false)
        return // Attendre que le jeu soit chargé
      }
      
      const gameName = game.name || game.title
      if (!gameName) {
        setIsCheckingInstalled(false)
        return
      }

      // ✅ VÉRIFICATION DIRECTE : Si on a déjà un installedGame avec un exePath, vérifier qu'il existe toujours
      if (installedGame && installedGame.exePath) {
        try {
          // Vérifier directement si le fichier exe existe
          if (window.electron?.games?.checkFileExists) {
            const checkResult = await window.electron.games.checkFileExists(installedGame.exePath)
            if (checkResult && !checkResult.exists) {
              // Le fichier n'existe plus, réinitialiser l'état
              console.log('[GameDetails] ⚠️ Fichier exe introuvable, réinitialisation de l\'état')
              setInstalledGame(null)
              setDownloading(false)
              setDownloadProgress(0)
              setIsPaused(false)
              setError('')
              setIsCheckingInstalled(false)
              return
            }
          }
        } catch (checkErr) {
          console.warn('[GameDetails] Erreur lors de la vérification directe:', checkErr)
        }
      }

      // Scanner les jeux installés dans le dossier de téléchargement par défaut
      // Utiliser le cache par défaut, forcer seulement si demandé explicitement
      if (window.electron && window.electron.download && window.electron.download.scanInstalledGames) {
        // Utiliser le cache sauf si forceRefresh est explicitement true
        const result = await window.electron.download.scanInstalledGames(null, forceRefresh) // Utilise le cache par défaut
        
        if (result.success && result.games) {
          // Comparaison flexible des noms (insensible à la casse, ignore les espaces et caractères spéciaux)
          const normalizeName = (name) => {
            if (!name) return ''
            return name
              .toLowerCase()
              .trim()
              .replace(/[®©™°²³¹½¼¾⅓⅔⅛⅜⅝⅞]/g, '') // Supprimer les symboles spéciaux
              .replace(/[^\x20-\x7E]/g, '') // Supprimer tous les caractères non-ASCII
              .replace(/\s+/g, ' ') // Collapser les espaces multiples
              .replace(/[^a-z0-9\s]/g, '') // Supprimer tous les caractères non alphanumériques
              .trim()
          }
          const normalizedGameName = normalizeName(gameName)
          // Logs réduits pour éviter le spam (seulement en mode debug)
          // console.log('[GameDetails] 🔍 Recherche du jeu:', gameName, '-> normalisé:', normalizedGameName)
          // console.log('[GameDetails] 📋 Jeux installés trouvés:', result.games.length)
          
          const found = result.games.find(g => {
            if (!g.name) return false
            const normalizedInstalledName = normalizeName(g.name)
            // console.log('[GameDetails]   - Comparaison:', g.name, '-> normalisé:', normalizedInstalledName)
            
            // Correspondance exacte
            if (normalizedInstalledName === normalizedGameName) {
              // console.log('[GameDetails] ✅ Correspondance exacte trouvée:', g.name)
              return true
            }
            
            // Correspondance partielle (l'un contient l'autre)
            if (normalizedInstalledName.includes(normalizedGameName) || normalizedGameName.includes(normalizedInstalledName)) {
              // console.log('[GameDetails] ✅ Correspondance partielle trouvée:', g.name)
              return true
            }
            
            // Comparaison plus flexible : vérifier si les mots-clés correspondent
            const gameWords = normalizedGameName.split(' ').filter(w => w.length > 2)
            const installedWords = normalizedInstalledName.split(' ').filter(w => w.length > 2)
            
            // Si au moins 50% des mots correspondent, c'est probablement le même jeu
            if (gameWords.length > 0 && installedWords.length > 0) {
              const matchingWords = gameWords.filter(w => installedWords.includes(w))
              const matchRatio = matchingWords.length / Math.max(gameWords.length, installedWords.length)
              
              if (matchRatio >= 0.5) {
                // console.log('[GameDetails] ✅ Correspondance par mots-clés trouvée:', g.name, `(ratio: ${matchRatio.toFixed(2)})`)
                return true
              }
            }
            
            return false
          })
          
          if (found) {
            // Utiliser l'exécutable stocké dans le marqueur si disponible
            let exePath = null
            if (found.executable && found.hasExecutable) {
              exePath = found.executable
            } else {
              // Sinon, chercher manuellement
              if (window.electron && window.electron.games && window.electron.games.findGameExe) {
                const exeResult = await window.electron.games.findGameExe(found.folder, gameName)
                if (exeResult.success && exeResult.exePath) {
                  exePath = exeResult.exePath
                }
              }
            }
            
            if (exePath) {
              const installedGameData = {
                name: found.name,
                folder: found.folder,
                exePath: exePath
              }
              setInstalledGame(installedGameData)
              // Réinitialiser l'état de téléchargement si le jeu est installé
              setDownloading(false)
              setDownloadProgress(0)
              setIsPaused(false)
              setError('')
              // Forcer un re-render en mettant à jour l'état
            } else {
              setInstalledGame(null)
              // Réinitialiser aussi si pas d'exe trouvé mais jeu installé
              setDownloading(false)
              setDownloadProgress(0)
            }
          } else {
            setInstalledGame(null)
            // Si le jeu n'est pas trouvé, réinitialiser complètement l'état de téléchargement
            setDownloading(false)
            setDownloadProgress(0)
            setIsPaused(false)
            setError('')
          }
        } else {
          setInstalledGame(null)
          // Réinitialiser complètement si pas de résultat
          setDownloading(false)
          setDownloadProgress(0)
          setIsPaused(false)
          setError('')
        }
      } else {
        setInstalledGame(null)
        // Réinitialiser complètement si pas de service
        setDownloading(false)
        setDownloadProgress(0)
        setIsPaused(false)
        setError('')
      }
    } catch (err) {
      console.error('[GameDetails] Erreur lors de la vérification des jeux installés:', err)
      setInstalledGame(null)
      // Réinitialiser complètement en cas d'erreur
      setDownloading(false)
      setDownloadProgress(0)
      setIsPaused(false)
      setError('')
    } finally {
      setIsCheckingInstalled(false)
    }
  }

  const loadGame = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const data = await window.electron.games.getGames()
        const foundGame = data.games?.find(g => g.id === gameId)
        if (foundGame) {
          setGame(foundGame)
          // Vérifier si le jeu est installé après le chargement (une seule fois, avec cache)
          setTimeout(() => {
            if (!isCheckingInstalled) {
              checkInstalledGame(false) // Utilise le cache
            }
          }, 500)
        } else {
          setError('Jeu non trouvé')
        }
      }
    } catch (err) {
      console.error('Error loading game:', err)
      setError('Erreur lors du chargement du jeu')
    } finally {
      setLoading(false)
    }
  }, [gameId, isCheckingInstalled])

  // ✅ Si le jeu n'est pas chargé mais qu'on vient de désinstaller, recharger le jeu
  // (le jeu existe toujours dans le catalogue, juste pas installé)
  // IMPORTANT: Ce hook doit être AVANT tous les return conditionnels
  useEffect(() => {
    if (!game && gameId && (showUninstallSuccess || uninstalledRef.current)) {
      loadGame()
    }
  }, [gameId, game, showUninstallSuccess, loadGame])
  
  // Écouter l'événement pour démarrer le téléchargement depuis le protocole
  useEffect(() => {
    const handleProtocolStartDownload = async (event) => {
      const data = event.detail
      if (!data) return
      
      console.log('[GameDetails] 📥 Événement protocole reçu:', data)
      
      // Vérifier que c'est bien pour ce jeu (par gameId ou gameName)
      const matchesById = data.gameId && gameId && data.gameId === gameId
      const matchesByName = data.gameName && game && (
        (game.name || game.title || '').toLowerCase().trim() === (data.gameName || '').toLowerCase().trim()
      )
      
      if (!matchesById && !matchesByName) {
        console.log('[GameDetails] ⚠️ Événement protocole ignoré - jeu différent:', data.gameId || data.gameName, 'vs', gameId || game?.name)
        return
      }
      
      console.log('[GameDetails] ✅ Démarrage du téléchargement depuis le protocole pour:', game?.name || data.gameName, 'gameId:', gameId || data.gameId)
      
      // Attendre que le jeu soit chargé si nécessaire
      if (!game) {
        console.log('[GameDetails] ⏳ Jeu non chargé, attente...')
        // Attendre un peu et réessayer (jusqu'à 5 secondes)
        let retries = 0
        const maxRetries = 10
        const checkInterval = setInterval(() => {
          retries++
          if (game || retries >= maxRetries) {
            clearInterval(checkInterval)
            if (game) {
              handleProtocolStartDownload(event)
            } else {
              console.error('[GameDetails] ❌ Jeu non chargé après', maxRetries * 500, 'ms')
            }
          }
        }, 500)
        return () => clearInterval(checkInterval)
      }
      
      // Simuler un clic sur le bouton de téléchargement
      // On va déclencher le téléchargement avec sélection du dossier AUTOMATIQUEMENT
      try {
        setError('')
        
        // Utiliser le gameId du protocole si disponible, sinon celui du composant
        const finalGameId = data.gameId || gameId
        const finalGameName = game.name || game.title || data.gameName || 'Game'
        
        console.log('[GameDetails] 🚀 Téléchargement via protocole - gameId:', finalGameId, 'gameName:', finalGameName)
        
        // 🎯 OUVRIR AUTOMATIQUEMENT LE DIALOGUE DE SÉLECTION DE DOSSIER
        let destinationPath = null
        if (window.electron && window.electron.download && window.electron.download.selectFolder) {
          console.log('[GameDetails] 📁 Ouverture automatique du dialogue de sélection de dossier...')
          const folderResult = await window.electron.download.selectFolder()
          if (folderResult.canceled) {
            console.log('[GameDetails] ❌ Sélection de dossier annulée par l\'utilisateur')
            return
          }
          if (folderResult.success && folderResult.folderPath) {
            destinationPath = folderResult.folderPath
            console.log('[GameDetails] ✅ Dossier sélectionné:', destinationPath)
          }
        }
        
        downloadStartedRef.current = Date.now()
        setDownloading(true)
        setDownloadProgress(0)
        setIsPaused(false)
        
        if (window.electron && window.electron.download && window.electron.download.downloadGame) {
          if (downloadManager) {
            downloadManager.startDownload(finalGameId, finalGameName, { total: 0 })
          }
          
          const urls = game.downloadUrl.split(/[,\n]/).filter(u => u.trim())
          
          console.log('[GameDetails] 📥 Démarrage du téléchargement vers:', destinationPath)
          await window.electron.download.downloadGame(
            urls[0],
            destinationPath,
            {
              gameId: finalGameId,
              gameName: finalGameName,
              userStatus: {
                isVip: currentUser?.isVip || false,
                isBoost: currentUser?.isBoost || false
              }
            }
          )
        }
      } catch (err) {
        console.error('[GameDetails] ❌ Erreur lors du téléchargement depuis le protocole:', err)
        setError('Erreur: ' + err.message)
        setDownloading(false)
        setDownloadProgress(0)
      }
    }
    
    window.addEventListener('protocol:start-download', handleProtocolStartDownload)
    
    return () => {
      window.removeEventListener('protocol:start-download', handleProtocolStartDownload)
    }
  }, [game, gameId, currentUser])

  const handleLaunchGame = async () => {
    if (!installedGame || !installedGame.exePath) {
      alert('Impossible de trouver le fichier exécutable du jeu.')
      return
    }

    try {
      if (window.electron && window.electron.games && window.electron.games.launchGame) {
        await window.electron.games.launchGame(installedGame.exePath)
        } else {
        // Fallback: ouvrir avec shell
        if (window.electron && window.electron.shell && window.electron.shell.openPath) {
          await window.electron.shell.openPath(installedGame.exePath)
        }
      }
    } catch (err) {
      console.error('[GameDetails] Erreur lors du lancement du jeu:', err)
      alert('Erreur lors du lancement du jeu: ' + err.message)
    }
  }

  const renderSystemRequirements = () => {
    if (!game) return null
    const requirements = game.pc_requirements || game.systemRequirements || game.system_requirements

    const getRequirementText = (req) => {
      if (!req) return null
      if (typeof req === 'string') return req
      if (typeof req === 'object') {
        if (typeof req.os === 'string' && req.os.trim()) return req.os
        const parts = []
        if (req.os) parts.push(`OS: ${req.os}`)
        if (req.processor) parts.push(`Processeur: ${req.processor}`)
        if (req.memory) parts.push(`Mémoire: ${req.memory}`)
        if (req.graphics) parts.push(`Graphiques: ${req.graphics}`)
        if (req.storage) parts.push(`Espace disque: ${req.storage}`)
        if (parts.length) return parts.join('\n')
      }
      return null
    }

    const formatRequirementText = (text) => {
      if (!text) return ''
      let clean = text.replace(/<[^>]*>/g, ' ')
      clean = clean.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      return clean
        .replace(/Processeur\s*:/gi, '\nProcesseur:')
        .replace(/Mémoire\s*:/gi, '\nMémoire:')
        .replace(/Graphiques\s*:/gi, '\nGraphiques:')
        .replace(/Stockage\s*:/gi, '\nStockage:')
        .replace(/DirectX\s*:/gi, '\nDirectX:')
        .trim()
    }

    if (!requirements) {
      return (
        <Motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 mt-8"
        >
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30">
                <FiStar className="text-primary text-sm" />
              </div>
              Configurations système
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-xl">
            <p className="text-white/70 text-center">Aucune configuration système disponible pour ce jeu.</p>
          </div>
        </Motion.section>
      )
    }

    const minimum = requirements.minimum || requirements.min
    const recommended = requirements.recommended || requirements.rec
    const minText = formatRequirementText(getRequirementText(minimum))
    const recText = formatRequirementText(getRequirementText(recommended))

    if (!minText && !recText) {
      return (
        <Motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 mt-8"
        >
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30">
                <FiStar className="text-primary text-sm" />
              </div>
              Configurations système
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-xl">
            <p className="text-white/70 text-center">Les configurations système ne sont pas disponibles dans un format lisible.</p>
          </div>
        </Motion.section>
      )
    }

    return (
      <Motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 mt-8"
      >
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30">
              <FiStar className="text-primary text-xl" />
            </div>
            <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Configurations système
            </span>
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {minText && (
            <Motion.div
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              className="group relative rounded-3xl border border-primary/20 bg-gradient-to-br from-surface-muted/90 via-surface-muted/60 to-surface-muted/40 backdrop-blur-xl p-8 space-y-6 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -z-10 opacity-60" />
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/30 to-purple-500/20 border border-primary/40 shadow-lg">
                  <FiStar className="text-primary text-2xl drop-shadow-lg" />
                </div>
                <h3 className="text-2xl font-bold text-white">Configuration minimale</h3>
              </div>
              <div className="relative text-sm text-white/95 leading-relaxed whitespace-pre-line font-medium space-y-2">
                {minText.split('\n').map((line, idx) => (
                  <div key={idx} className={line.trim() ? 'pl-4 border-l-2 border-primary/30' : ''}>
                    {line.trim() || '\u00A0'}
                  </div>
                ))}
              </div>
            </Motion.div>
          )}

          {recText && (
            <Motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              className="group relative rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-surface-muted/90 via-surface-muted/60 to-surface-muted/40 backdrop-blur-xl p-8 space-y-6 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/20 rounded-full blur-3xl -z-10 opacity-60" />
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400/0 via-yellow-400/10 to-yellow-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-400/30 to-amber-500/20 border border-yellow-400/40 shadow-lg">
                  <FiStar className="text-yellow-400 text-2xl drop-shadow-lg" />
                </div>
                <h3 className="text-2xl font-bold text-white">Configuration recommandée</h3>
              </div>
              <div className="relative text-sm text-white/95 leading-relaxed whitespace-pre-line font-medium space-y-2">
                {recText.split('\n').map((line, idx) => (
                  <div key={idx} className={line.trim() ? 'pl-4 border-l-2 border-yellow-400/30' : ''}>
                    {line.trim() || '\u00A0'}
                  </div>
                ))}
              </div>
            </Motion.div>
          )}
        </div>
      </Motion.section>
    )
  }

  const renderOverviewSection = () => {
    if (!game) return null
    const genres = Array.isArray(game.genres) ? game.genres.map((g) => g.description || g).join(', ') : game.genres
    const tags = Array.isArray(game.tags) ? game.tags : (game.categories || []).map((c) => c.description || c)
    const releaseDate = game.release_date?.date || game.releaseDate || 'Non communiqué'
    return (
      <Motion.section
        key="overview"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8 grid gap-8 lg:grid-cols-[2fr,1fr]"
      >
        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          <h3 className="text-2xl font-semibold text-white mb-4">Synopsis</h3>
          <p className="text-white/80 leading-relaxed">
            {game.short_description || game.description || 'Aucune description détaillée fournie.'}
          </p>
        </div>
        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          <h3 className="text-2xl font-semibold text-white">Infos clés</h3>
          <div className="space-y-3 text-sm text-white/80">
            <div className="flex justify-between border-b border-white/5 pb-3">
              <span className="text-white/60">Genre</span>
              <span className="text-right">{genres || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-3">
              <span className="text-white/60">Date de sortie</span>
              <span className="text-right">{releaseDate}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-white/60">Tags</span>
              <div className="flex flex-wrap gap-2">
                {(tags || []).slice(0, 6).map((tag, idx) => (
                  <span
                    key={`${tag}-${idx}`}
                    className="px-3 py-1 rounded-full text-xs bg-white/10 border border-white/10 text-white/80"
                  >
                    {typeof tag === 'string' ? tag : tag?.description || 'Tag'}
                  </span>
                ))}
                {(!tags || tags.length === 0) && (
                  <span className="text-white/50 text-xs">Aucun tag renseigné</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Motion.section>
    )
  }

  const renderMediaSection = () => {
    const mediaItems = []
    if (Array.isArray(game?.screenshots)) {
      game.screenshots.forEach((s) => {
        if (s?.path_full) mediaItems.push(s.path_full)
        else if (typeof s === 'string') mediaItems.push(s)
      })
    }
    if (game?.backgroundImage) mediaItems.push(game.backgroundImage)
    if (game?.header_image) mediaItems.push(game.header_image)

    return (
      <Motion.section
        key="media"
        ref={mediaSectionRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <FiImage className="text-primary text-2xl" />
          <h3 className="text-2xl font-semibold text-white">Galerie</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mediaReady ? (
            mediaItems.length > 0 ? (
              mediaItems.map((src, idx) => (
                <Motion.div
                  key={`${src}-${idx}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 group cursor-pointer"
                  onClick={() => {
                    setSelectedImageIndex(idx)
                    setImageModalOpen(true)
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <img
                    src={src}
                    alt={`Capture ${idx + 1}`}
                    className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <FiImage className="text-white text-2xl" />
                  </div>
                </Motion.div>
              ))
            ) : (
              <p className="text-white/60 col-span-full text-center">Aucun média disponible.</p>
            )
          ) : (
            Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="h-48 rounded-2xl bg-white/5 border border-white/10 animate-pulse"
              />
            ))
          )}
        </div>
        
        {/* Modal d'images */}
        <ImageModal
          isOpen={imageModalOpen}
          images={mediaItems}
          initialIndex={selectedImageIndex}
          onClose={() => setImageModalOpen(false)}
        />
      </Motion.section>
    )
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <FiLoader className="text-primary text-3xl animate-spin" />
          <p className="text-muted">Chargement du jeu...</p>
        </Motion.div>
      </div>
    )
  }

  // ✅ Ne pas afficher l'écran d'erreur si on vient de désinstaller (garder la page GameDetails visible)
  // Le jeu existe toujours dans le catalogue, juste pas installé
  if ((error || !game) && !showUninstallSuccess && !uninstalledRef.current) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <FiAlertCircle className="text-red-400 text-3xl" />
          <p className="text-red-400">{error || 'Jeu non trouvé'}</p>
          <Motion.button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'catalog' }))}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-secondary mt-4"
          >
            <FiArrowLeft className="mr-2" />
            Retour au catalogue
          </Motion.button>
        </Motion.div>
      </div>
    )
  }

  const videoSrc = game.movies || game.video

  return (
    <div className="space-y-6">
      {/* Bouton retour */}
      <Motion.button
        onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'catalog' }))}
        whileHover={{ scale: 1.02, x: -4 }}
        whileTap={{ scale: 0.98 }}
        className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm text-muted hover:text-white hover:border-white/20 hover:bg-white/10 transition-all duration-300"
      >
        <FiArrowLeft className="text-lg transition-transform duration-300 group-hover:-translate-x-1" />
        <span className="font-medium">Retour</span>
      </Motion.button>

      {/* Section Hero avec vidéo/image */}
      <Motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl group shadow-2xl"
        style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        }}
      >
        {/* Vidéo/Image */}
        <div className="relative w-full h-[600px] overflow-hidden bg-gradient-to-br from-black/80 to-black/60 rounded-t-3xl">
          {/* Image en arrière-plan (toujours visible) */}
          {game.header_image && (
            <img
              src={game.header_image}
              alt={game.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          )}
          {/* Vidéo par-dessus l'image (si disponible) */}
          {videoSrc && (
            <VideoPlayerWithFallback
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          )}
          <div className="hidden absolute inset-0 flex items-center justify-center bg-black/60">
            <FiGrid className="text-muted text-6xl" />
          </div>
          
          {/* Overlay gradient avec effet de brillance */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1500 ease-in-out" />
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/15 group-hover:via-primary/8 group-hover:to-primary/0 transition-all duration-700 pointer-events-none blur-xl" />
        </div>

        {/* Overlay hover avec informations mises en avant */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/98 via-black/90 to-black/75 rounded-3xl p-8 md:p-12 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20 overflow-y-auto backdrop-blur-sm">
          <div className="space-y-6 relative z-10">
            <Motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileHover={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-2xl bg-gradient-to-r from-white via-white/95 to-white/80 bg-clip-text text-transparent"
            >
              {game.name || 'Sans titre'}
            </Motion.h2>
            
            {game.short_description && (
              <Motion.p 
                initial={{ opacity: 0, y: 10 }}
                whileHover={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg md:text-xl text-white/95 max-w-3xl leading-relaxed drop-shadow-lg"
              >
                {game.short_description}
              </Motion.p>
            )}

            <div className="flex items-center gap-3 flex-wrap pt-2">
              {installedGame ? (
                installedGame.exePath ? (
                <div className="flex gap-3 flex-wrap">
                  {/* Bouton Lancer - Premium */}
                  <Motion.button
                    onClick={handleLaunchGame}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-2xl transition-all duration-300"
                    style={{
                      boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
                    }}
                  >
                    {/* Effet de brillance */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/0 group-hover:from-white/10 group-hover:via-white/5 group-hover:to-white/0 transition-all duration-500 blur-sm" />
                    <div className="relative flex items-center gap-2">
                      <FiPlay className="text-lg" />
                      <span>Lancer</span>
                    </div>
                  </Motion.button>

                  {/* Bouton Dossier - Élégant */}
                  <Motion.button
                    onClick={async () => {
                      if (window.electron && window.electron.games && window.electron.games.openGameFolder) {
                        const result = await window.electron.games.openGameFolder(installedGame.name)
                        if (!result.success) {
                          alert('Erreur: ' + result.error)
                        }
                      }
                    }}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    className="group relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-4 text-base font-medium text-white/90 shadow-xl transition-all duration-300 hover:border-white/20 hover:bg-black/60"
                    style={{
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                    <div className="relative flex items-center gap-2">
                      <FiFolder className="text-lg" />
                      <span>Dossier</span>
                    </div>
                  </Motion.button>

                  {/* Bouton Désinstaller - Destructif mais élégant */}
                  <Motion.button
                    onClick={() => {
                      setShowUninstallModal(true)
                    }}
                    disabled={isUninstalling}
                    whileHover={!isUninstalling ? { scale: 1.03, y: -3 } : {}}
                    whileTap={!isUninstalling ? { scale: 0.97 } : {}}
                    className={`group relative overflow-hidden rounded-2xl bg-red-500/10 backdrop-blur-xl border border-red-500/30 px-6 py-4 text-base font-medium text-red-400 shadow-xl transition-all duration-300 hover:border-red-500/50 hover:bg-red-500/20 ${isUninstalling ? 'opacity-75 cursor-wait' : ''}`}
                    style={{
                      boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2), 0 0 0 1px rgba(239, 68, 68, 0.1) inset'
                    }}
                    title="Désinstaller le jeu"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                    <div className="relative flex items-center gap-2">
                      {isUninstalling ? (
                        <>
                          <FiLoader className="text-lg animate-spin" />
                          <span>Désinstallation...</span>
                        </>
                      ) : (
                        <>
                          <FiTrash2 className="text-lg" />
                          <span>Désinstaller</span>
                        </>
                      )}
                    </div>
                  </Motion.button>
                </div>
                ) : (
                  // Jeu installé mais exécutable non trouvé
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/30">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-base font-semibold text-emerald-400">Installé</span>
                    </div>
                    <Motion.button
                      onClick={async () => {
                        if (window.electron && window.electron.games && window.electron.games.openGameFolder) {
                          const result = await window.electron.games.openGameFolder(installedGame.name)
                          if (!result.success) {
                            alert('Erreur: ' + result.error)
                          }
                        }
                      }}
                      whileHover={{ scale: 1.03, y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      className="group relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-4 text-base font-medium text-white/90 shadow-xl transition-all duration-300 hover:border-white/20 hover:bg-black/60"
                    >
                      <div className="relative flex items-center gap-2">
                        <FiFolder className="text-lg" />
                        <span>Ouvrir le dossier</span>
                      </div>
                    </Motion.button>
                  </div>
                )
              ) : game.downloadUrl ? (
                <div className="flex items-center gap-3">
                  <Motion.button
                    onClick={async () => {
                      if (isPaused) {
                        // Reprendre le téléchargement
                        setIsPaused(false)
                        if (window.electron && window.electron.download && window.electron.download.resumeDownload) {
                          await window.electron.download.resumeDownload(gameId)
                        }
                        return
                      }
                      
                      try {
                        setError('')
                        
                        // 🎯 VÉRIFIER SI L'UTILISATEUR EST GRATUIT
                        const isFreeUser = !currentUser?.isVip && !currentUser?.isBoost
                        
                        if (isFreeUser) {
                          // Utilisateur gratuit : ouvrir le lien Lockr dans le navigateur
                          // Construire l'URL de redirection avec le gameId pour identifier correctement le jeu
                          const gameName = game.name || game.title || 'Game'
                          const redirectUrl = `https://actoris-qneqonl9k-boyka47348-glitchs-projects.vercel.app/?game=${encodeURIComponent(gameName)}&gameId=${encodeURIComponent(gameId)}`
                          
                          // Ouvrir d'abord Lockr, puis rediriger vers notre site après validation
                          const LOCKR_PUB_URL = 'https://lockr.net/W78Ec3TTz'
                          console.log('[GameDetails] 🔒 Utilisateur gratuit, ouverture du lien Lockr:', LOCKR_PUB_URL)
                          console.log('[GameDetails] 📋 URL de redirection préparée:', redirectUrl)
                          
                          if (window.electron && window.electron.shell && window.electron.shell.openExternal) {
                            await window.electron.shell.openExternal(LOCKR_PUB_URL)
                          } else {
                            window.open(LOCKR_PUB_URL, '_blank', 'noopener,noreferrer')
                          }
                          
                          // Afficher le modal informatif moderne
                          setShowDownloadInfoModal(true)
                          return
                        }
                        
                        // Utilisateur VIP/Boost : continuer avec le téléchargement normal
                        let destinationPath = null
                        if (window.electron && window.electron.download && window.electron.download.selectFolder) {
                          const folderResult = await window.electron.download.selectFolder()
                          if (folderResult.canceled) {
                            return
                          }
                          if (folderResult.success && folderResult.folderPath) {
                            destinationPath = folderResult.folderPath
                            }
                        }
                        
                        downloadStartedRef.current = Date.now() // Enregistrer le moment du démarrage
                        setDownloading(true)
                        setDownloadProgress(0)
                        setIsPaused(false)
                      
                      if (window.electron && window.electron.download && window.electron.download.downloadGame) {
                        try {
                          const gameName = game.name || game.title || 'Game'
                          
                          // Notifier le downloadManager du démarrage du téléchargement
                          if (downloadManager) {
                            downloadManager.startDownload(gameId, gameName, { total: 0 })
                          }
                          
                          // Détecter plusieurs URLs (séparées par des virgules ou des retours à la ligne)
                          const urls = game.downloadUrl.split(/[,\n]/).filter(u => u.trim())
                          
                          if (urls.length > 1) {
                            // TÉLÉCHARGEMENT MULTI-PARTIES SÉQUENTIEL
                            for (let i = 0; i < urls.length; i++) {
                              const url = urls[i].trim()
                              const partNumber = i + 1
                              const isLastPart = partNumber === urls.length
                              
                              // Créer une promesse qui attend la completion de cette partie
                              const partPromise = new Promise((resolvePart, rejectPart) => {
                                let partResolved = false
                                
                                // Fallback: vérifier périodiquement si le fichier existe
                                const checkFileInterval = setInterval(async () => {
                                  if (partResolved) {
                                    clearInterval(checkFileInterval)
                                    return
                                  }
                                  
                                  // Essayer de détecter le fichier téléchargé en vérifiant le dossier
                                  try {
                                    if (window.electron && window.electron.download && window.electron.download.scanInstalledGames) {
                                      // On ne peut pas vérifier directement les fichiers, mais on peut attendre l'événement
                                      // Le fallback sera géré par le timeout principal
                                    }
                                  } catch (e) {
                                    // Ignorer les erreurs de vérification
                                  }
                                }, 2000) // Vérifier toutes les 2 secondes
                                
                                const timeout = setTimeout(() => {
                                  if (!partResolved) {
                                    partResolved = true
                                    clearInterval(checkFileInterval)
                                    console.error(`[GameDetails] ⏱️ Timeout partie ${partNumber}/${urls.length} (5 minutes)`)
                                    rejectPart(new Error(`Timeout: partie ${partNumber} n'a pas été téléchargée dans les temps`))
                                  }
                                }, 5 * 60 * 1000) // 5 minutes max par partie (réduit de 30 minutes)
                                
                                // Normaliser le nom pour la comparaison
                                const normalizeName = (name) => name ? name.toLowerCase().trim().replace(/\s+/g, ' ') : ''
                                const normalizedGameName = normalizeName(gameName)
                                
                                // Écouter l'événement de completion de partie
                                const onPartCompleted = (event, data) => {
                                  if (!data || !data.gameName) {
                                    return
                                  }
                                  
                                  const normalizedDataName = normalizeName(data.gameName)
                                  const nameMatches = normalizedDataName === normalizedGameName || 
                                                     normalizedDataName.includes(normalizedGameName) ||
                                                     normalizedGameName.includes(normalizedDataName)
                                  
                                  if (!partResolved && nameMatches && data.currentPart === partNumber) {
                                    partResolved = true
                                    clearTimeout(timeout)
                                    clearInterval(checkFileInterval)
                                    window.electron.ipcRenderer.removeListener('download:part-completed', onPartCompleted)
                                    window.electron.ipcRenderer.removeListener('download:error', onError)
                                    window.electron.ipcRenderer.removeListener('download:complete', onComplete)
                                    resolvePart(data)
                                  }
                                }
                                
                                // Écouter l'événement de completion complète (dernière partie)
                                const onComplete = (event, data) => {
                                  const normalizedDataName = normalizeName(data.gameName)
                                  const nameMatches = normalizedDataName === normalizedGameName || 
                                                     normalizedDataName.includes(normalizedGameName) ||
                                                     normalizedGameName.includes(normalizedDataName)
                                  
                                  if (!partResolved && isLastPart && nameMatches) {
                                    partResolved = true
                                    clearTimeout(timeout)
                                    clearInterval(checkFileInterval)
                                    window.electron.ipcRenderer.removeListener('download:part-completed', onPartCompleted)
                                    window.electron.ipcRenderer.removeListener('download:error', onError)
                                    window.electron.ipcRenderer.removeListener('download:complete', onComplete)
                                    resolvePart(data)
                                  }
                                }
                                
                                // Écouter les erreurs
                                const onError = (event, data) => {
                                  const normalizedDataName = normalizeName(data.gameName)
                                  const nameMatches = normalizedDataName === normalizedGameName || 
                                                     normalizedDataName.includes(normalizedGameName) ||
                                                     normalizedGameName.includes(normalizedDataName)
                                  
                                  if (!partResolved && nameMatches) {
                                    console.error(`[GameDetails] ❌ Erreur partie ${partNumber}:`, data.error)
                                    partResolved = true
                                    clearTimeout(timeout)
                                    clearInterval(checkFileInterval)
                                    window.electron.ipcRenderer.removeListener('download:part-completed', onPartCompleted)
                                    window.electron.ipcRenderer.removeListener('download:error', onError)
                                    window.electron.ipcRenderer.removeListener('download:complete', onComplete)
                                    rejectPart(new Error(data.error || 'Erreur inconnue'))
                                  }
                                }
                                
                                // Enregistrer les listeners
                                window.electron.ipcRenderer.on('download:part-completed', onPartCompleted)
                                window.electron.ipcRenderer.on('download:complete', onComplete)
                                window.electron.ipcRenderer.on('download:error', onError)
                                
                                })
                              
                              // Lancer le téléchargement de cette partie
                              try {
                                // IMPORTANT: Attendre un peu pour s'assurer que les listeners sont bien enregistrés
                                await new Promise(resolve => setTimeout(resolve, 100))
                                
                                // Lancer le téléchargement (ne pas attendre, il retourne immédiatement)
                                const downloadPromise = window.electron.download.downloadGame(
                                  url,
                                  destinationPath,
                                  {
                                    gameId: gameId,
                                    gameName: gameName,
                                    isMultiPart: true,
                                    currentPart: partNumber,
                                    totalParts: urls.length,
                                    userStatus: {
                                      isVip: currentUser?.isVip || false,
                                      isBoost: currentUser?.isBoost || false
                                    }
                                  }
                                ).catch(err => {
                                  console.error(`[GameDetails] ❌ Erreur lors du lancement partie ${partNumber}:`, err)
                                  throw err
                                })
                                
                                // Attendre que cette partie soit complètement téléchargée
                                // Attendre soit l'événement, soit une erreur de lancement
                                await Promise.race([
                                  partPromise,
                                  downloadPromise.then(() => {
                                    // Si le téléchargement se lance sans erreur, on attend l'événement
                                    return partPromise
                                  })
                                ])
                                
                              } catch (partError) {
                                console.error(`[GameDetails] ❌ Erreur partie ${partNumber}:`, partError)
                                setError(`Erreur partie ${partNumber}: ${partError.message}`)
                                setDownloading(false)
                                setDownloadProgress(0)
                                return
                              }
                            }
                          } else {
                            // TÉLÉCHARGEMENT SIMPLE (une seule URL)
                            const result = await window.electron.download.downloadGame(
                              urls[0],
                              destinationPath,
                              {
                                gameId: gameId,
                                gameName: gameName,
                                userStatus: {
                                  isVip: currentUser?.isVip || false,
                                  isBoost: currentUser?.isBoost || false
                                }
                              }
                            )
                          }
                        } catch (downloadError) {
                          console.error('[GameDetails] Erreur lors du téléchargement:', downloadError)
                          setError('Erreur: ' + (downloadError.message || 'Impossible de démarrer le téléchargement'))
                          setDownloading(false)
                          setDownloadProgress(0)
                          
                          const urls = game.downloadUrl.split(/[,\n]/).filter(u => u.trim())
                          const urlCount = urls.length
                          const message = urlCount > 1 
                            ? `Le téléchargement automatique a échoué.\n\nVoulez-vous ouvrir les ${urlCount} liens dans votre navigateur pour télécharger manuellement ?`
                            : 'Le téléchargement automatique a échoué.\n\nVoulez-vous ouvrir le lien dans votre navigateur pour télécharger manuellement ?'
                          
                          const openInBrowser = window.confirm(message)
                          if (openInBrowser) {
                            for (const url of urls) {
                              if (window.electron && window.electron.shell && window.electron.shell.openExternal) {
                                await window.electron.shell.openExternal(url.trim())
                              } else {
                                window.open(url.trim(), '_blank', 'noopener,noreferrer')
                              }
                              // Petit délai entre chaque ouverture
                              if (urls.indexOf(url) < urls.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 500))
                              }
                            }
                          }
                        }
                      } else {
                        // Ouvrir toutes les URLs si plusieurs parties
                        const urls = game.downloadUrl.split(/[,\n]/).filter(u => u.trim())
                        for (const url of urls) {
                          window.open(url.trim(), '_blank', 'noopener,noreferrer')
                          if (urls.indexOf(url) < urls.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500))
                          }
                        }
                        setDownloading(false)
                      }
                    } catch (err) {
                      setError('Erreur: ' + err.message)
                      setDownloading(false)
                      setDownloadProgress(0)
                    }
                  }}
                  disabled={false}
                  whileHover={{ scale: 1.03, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-2xl transition-all duration-300 cursor-pointer"
                  style={{
                    boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
                  }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                    {/* Barre de progression intégrée dans le bouton */}
                    {downloading && !installedGame && downloadProgress > 0 && downloadStartedRef.current > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div
                          className="h-full bg-white/60 transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    )}
                    <div className="relative flex items-center gap-2">
                      {/* Afficher le pourcentage uniquement si un téléchargement est réellement en cours */}
                      {downloading && !installedGame && downloadStartedRef.current > 0 && (downloadProgress > 0 || isPaused) ? (
                        <>
                          {isPaused ? (
                            <>
                              <FiPause className="text-lg" />
                              <span>En pause {Math.round(downloadProgress)}%</span>
                            </>
                          ) : (
                            <>
                              <FiLoader className="text-lg animate-spin" />
                              <span>Téléchargement... {Math.round(downloadProgress)}%</span>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <FiDownload className="text-lg" />
                          <span>
                            {(() => {
                              const urls = game.downloadUrl?.split(/[,\n]/).filter(u => u.trim()) || []
                              const urlCount = urls.length
                              return urlCount > 1 ? `Télécharger (${urlCount} parties)` : 'Télécharger'
                            })()}
                          </span>
                        </>
                      )}
                    </div>
                  </Motion.button>
                  
                  {/* Boutons Pauser/Annuler */}
                  {downloading && isGameActuallyInstalled && (
                    <>
                      <Motion.button
                        onClick={async () => {
                          if (isPaused) {
                            // Reprendre
                            setIsPaused(false)
                            if (window.electron && window.electron.download && window.electron.download.resumeDownload) {
                              await window.electron.download.resumeDownload(gameId)
                            }
                          } else {
                            // Pauser
                            setIsPaused(true)
                            if (window.electron && window.electron.download && window.electron.download.pauseDownload) {
                              await window.electron.download.pauseDownload(gameId)
                            }
                          }
                        }}
                        whileHover={{ scale: 1.03, y: -3 }}
                        whileTap={{ scale: 0.97 }}
                        className="group relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 px-5 py-4 text-base font-medium text-white/90 shadow-xl transition-all duration-300 hover:border-white/20 hover:bg-black/60"
                      >
                        <div className="relative flex items-center gap-2">
                          {isPaused ? (
                            <>
                              <FiPlay className="text-lg" />
                              <span>Reprendre</span>
                            </>
                          ) : (
                            <>
                              <FiPause className="text-lg" />
                              <span>Pauser</span>
                            </>
                          )}
                        </div>
                      </Motion.button>
                      
                      <Motion.button
                        onClick={async () => {
                          if (window.confirm('Voulez-vous vraiment annuler le téléchargement ?')) {
                            if (window.electron && window.electron.download && window.electron.download.cancelDownload) {
                              const result = await window.electron.download.cancelDownload(gameId)
                              if (result && result.success) {
                                setDownloading(false)
                                setDownloadProgress(0)
                                setIsPaused(false)
                              }
                            } else {
                              setDownloading(false)
                              setDownloadProgress(0)
                              setIsPaused(false)
                            }
                          }
                        }}
                        whileHover={{ scale: 1.03, y: -3 }}
                        whileTap={{ scale: 0.97 }}
                        className="group relative overflow-hidden rounded-2xl bg-red-500/10 backdrop-blur-xl border border-red-500/30 px-5 py-4 text-base font-medium text-red-400 shadow-xl transition-all duration-300 hover:border-red-500/50 hover:bg-red-500/20"
                      >
                        <div className="relative flex items-center gap-2">
                          <FiX className="text-lg" />
                          <span>Annuler</span>
                        </div>
                      </Motion.button>
                    </>
                  )}
                </div>
              ) : (
                <Motion.button
                  disabled
                  className="rounded-2xl bg-black/20 backdrop-blur-xl border border-white/5 px-8 py-4 text-base font-medium text-white/40 cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <FiDownload className="text-lg" />
                    <span>Téléchargement non disponible</span>
                  </div>
                </Motion.button>
              )}
              
              {/* Bouton Favoris - Élégant */}
              <Motion.button
                onClick={() => {
                  favoritesService.toggleFavorite(gameId)
                  setIsFavorite(!isFavorite)
                }}
                whileHover={{ scale: 1.03, y: -3 }}
                whileTap={{ scale: 0.97 }}
                className={`group relative overflow-hidden rounded-2xl backdrop-blur-xl border px-6 py-4 text-base font-medium shadow-xl transition-all duration-300 ${
                  isFavorite 
                    ? 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-500/30 text-red-400 hover:border-red-500/50 hover:bg-red-500/30' 
                    : 'bg-black/40 border-white/10 text-white/90 hover:border-white/20 hover:bg-black/60'
                }`}
                style={{
                  boxShadow: isFavorite 
                    ? '0 4px 20px rgba(239, 68, 68, 0.2), 0 0 0 1px rgba(239, 68, 68, 0.1) inset'
                    : '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                <div className="relative flex items-center gap-2">
                  <FiHeart className={`text-lg ${isFavorite ? 'fill-current' : ''}`} />
                  <span>{isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                </div>
              </Motion.button>
            </div>
          </div>
        </div>
      </Motion.section>


      {/* Système d'onglets pour les sections */}
      {game && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {sectionConfig.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              return (
                <Motion.button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border transition-all duration-300 ${
                    active 
                      ? 'border-primary/50 bg-primary/10 text-white shadow-lg shadow-primary/20' 
                      : 'border-white/5 bg-white/5 text-white/70 hover:text-white hover:border-white/10 hover:bg-white/8'
                  }`}
                >
                  <Icon className="text-sm" />
                  <span className="text-sm font-medium">{label}</span>
                </Motion.button>
              )
            })}
          </div>

          <div className="mt-6">
            {activeTab === 'overview' && renderOverviewSection()}
            {activeTab === 'requirements' && renderSystemRequirements()}
            {activeTab === 'media' && renderMediaSection()}
          </div>
        </div>
      )}
      
      {/* Modal de raccourci après téléchargement */}
      <ShortcutModal
        isOpen={showShortcutModal}
        onClose={() => {
          setShowShortcutModal(false)
          setCompletedGameData(null)
        }}
        gameName={completedGameData?.gameName || game?.name || game?.title || ''}
        exePath={completedGameData?.exePath || null}
        onConfirm={() => {
          setShowShortcutModal(false)
          setCompletedGameData(null)
        }}
      />
      
      {/* Modal de désinstallation */}
      <UninstallModal
        isOpen={showUninstallModal}
        onClose={() => {
          setShowUninstallModal(false)
        }}
        gameName={installedGame?.name || game?.name || game?.title || ''}
        onConfirm={async () => {
          const gameName = installedGame?.name || game?.name || game?.title
          if (!gameName) return
          
          setIsUninstalling(true)
          setShowUninstallModal(false)
          
          try {
            if (window.electron && window.electron.games && window.electron.games.uninstallGame) {
              const result = await window.electron.games.uninstallGame(gameName)
              if (result.success) {
                console.log('[GameDetails] ✅ Désinstallation réussie - réinitialisation forcée')
                
                // ✅ NOUVEAU : Forcer uninstalledRef à false AVANT de réinitialiser
                uninstalledRef.current = false
                
                // 1. Réinitialiser IMMÉDIATEMENT tous les états (dans le bon ordre)
                // D'abord réinitialiser downloading pour éviter que le useEffect de détection de blocage ne se déclenche
                downloadStartedRef.current = 0 // Réinitialiser le timestamp du téléchargement
                setDownloading(false)
                setDownloadProgress(0)
                setIsPaused(false)
                setError('')
                setIsCheckingInstalled(false)
                setInstalledGame(null)
                
                // Afficher le popup de confirmation
                setShowUninstallSuccess(true)
                
                // 2. Déclencher l'événement IMMÉDIATEMENT pour mettre à jour la liste des jeux installés dans App.jsx
                // Cela va déclencher un scan qui mettra à jour installedGames, ce qui va mettre à jour la page
                window.dispatchEvent(new CustomEvent('game-uninstalled', { detail: { gameName } }))
                
                // ✅ Attendre un peu pour que le scan se fasse, puis vérifier
                await new Promise(resolve => setTimeout(resolve, 200))
                await checkInstalledGame(true)
                
                // Fermer le popup après 3 secondes
                setTimeout(() => {
                  setShowUninstallSuccess(false)
                }, 3000)
              } else {
                alert(`Erreur lors de la désinstallation :\n\n${result.error}\n\n` +
                      `Si le dossier est verrouillé, fermez l'Explorateur Windows et tous les programmes qui utilisent ce dossier, puis réessayez.`)
              }
            }
          } catch (err) {
            console.error('[GameDetails] Erreur lors de la désinstallation:', err)
            alert(`Erreur: ${err.message}`)
          } finally {
            setIsUninstalling(false)
          }
        }}
      />
      
      {/* Popup de confirmation de désinstallation réussie */}
      <AnimatePresence>
        {showUninstallSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <Motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 backdrop-blur-xl p-6 shadow-2xl pointer-events-auto"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 border border-green-500/30">
                  <FiCheckCircle className="text-3xl text-green-400" />
                </div>
                
                <h2 className="mb-2 text-2xl font-bold text-white">
                  Désinstallation réussie
                </h2>
                
                <p className="text-muted">
                  {installedGame?.name || game?.name || game?.title || 'Le jeu'} a été désinstallé avec succès.
                </p>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Modal d'information pour le téléchargement */}
      <DownloadInfoModal
        isOpen={showDownloadInfoModal}
        onClose={() => setShowDownloadInfoModal(false)}
      />
    </div>
  )
}

