import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Motion, AnimatePresence } from '../components/Motion'
import { 
  FiArrowLeft, FiDownload, FiPlay, FiHeart, FiWifi, FiWifiOff, 
  FiFolder, FiTrash2, FiX, FiVolume2, FiVolumeX, FiExternalLink, FiCheck, FiLink2, FiPackage
} from 'react-icons/fi'
import { useCachedImage } from '../hooks/useCachedImage'
import { isGameOnline } from '../services/onlineFixStatus'
import { favoritesService } from '../services/favorites'
import { gamesCacheService } from '../services/gamesCache'
import { downloadManager } from '../services/downloadManager'
import { mergeInstalledGamesIntoCatalog } from '../services/gamesInstalledMerger'
import { UninstallModal } from '../components/UninstallModal'
import { ShortcutModal } from '../components/ShortcutModal'
import { GuestWarningModal } from '../components/GuestWarningModal'
import { DeadLinkRewardModal } from '../components/DeadLinkRewardModal'
import { GameDownloadPopup } from '../components/GameDownloadPopup'
import { BACKEND_URL } from '../utils/backend'
import { gamesMetadataService } from '../services/gamesMetadata.js'

export function GameDetailsPage({ gameId, onNavigate, currentUser, installedGames = [] }) {
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [installedGame, setInstalledGame] = useState(null)
  const [isOnline, setIsOnline] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState(0)
  const [downloadEta, setDownloadEta] = useState(0)
  const [downloadedBytes, setDownloadedBytes] = useState(0)
  const [totalBytes, setTotalBytes] = useState(0)
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [showUninstallModal, setShowUninstallModal] = useState(false)
  const [uninstallProgress, setUninstallProgress] = useState(0)
  const [uninstallStep, setUninstallStep] = useState('')
  const [uninstallError, setUninstallError] = useState(null)
  const [showShortcutModal, setShowShortcutModal] = useState(false)
  const [showGuestWarning, setShowGuestWarning] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // 'download' ou 'launch'
  const [videoMuted, setVideoMuted] = useState(true)
  const [showVideo, setShowVideo] = useState(true)
  const videoRef = useRef(null)
  const [localInstalledGames, setLocalInstalledGames] = useState(installedGames)
  const [currentDownload, setCurrentDownload] = useState(null)
  const [showDeadLinkRewardModal, setShowDeadLinkRewardModal] = useState(false)
  const [showDownloadPopup, setShowDownloadPopup] = useState(false)
  const [deadLinkRewardGameName, setDeadLinkRewardGameName] = useState('')
  const [deadLinkRewardGameId, setDeadLinkRewardGameId] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)

  // Fonction pour vérifier l'état d'installation du jeu (optimisée, sans scan complet)
  const checkInstalledStatus = useCallback(async () => {
    if (!game) return
    
    try {
      // Utiliser isGameInstalled au lieu de scanner tous les jeux
      if (window.electron?.games?.isGameInstalled) {
        const gameIdToCheck = game.id || game.gameId
        if (gameIdToCheck) {
          const installCheck = await window.electron.games.isGameInstalled(gameIdToCheck)
          
          if (installCheck && installCheck.installed) {
            setIsInstalled(true)
            if (installCheck.gameData) {
              setInstalledGame({
                path: installCheck.gameData.path || installCheck.gameData.gamePath,
                gamePath: installCheck.gameData.path || installCheck.gameData.gamePath,
                folder: installCheck.gameData.path || installCheck.gameData.gamePath,
                exePath: installCheck.gameData.exePath,
                name: installCheck.gameData.gameName || installCheck.gameData.name || game.name || game.title,
                installDate: installCheck.gameData.installDate,
                version: installCheck.gameData.installedVersion,
                launcherId: installCheck.gameData.launcherId
              })
            }
          } else {
            setIsInstalled(false)
            setInstalledGame(null)
          }
          return
        }
      }
      
      // Fallback: Scanner seulement si isGameInstalled n'est pas disponible
      if (window.electron?.games?.scanInstalledGames) {
        const result = await window.electron.games.scanInstalledGames(null, false) // Ne pas forcer
        if (result && result.success) {
          const scannedGames = result.games || []
          setLocalInstalledGames(scannedGames)
          
          // Vérifier si le jeu actuel est installé
          const gameName = game.name || game.title || ''
          const normalizedGameName = gameName.toLowerCase().trim()
          
          const foundInstalled = scannedGames.find(installed => {
            const installedName = (installed.name || '').toLowerCase().trim()
            return installedName === normalizedGameName || 
                   installedName.includes(normalizedGameName) || 
                   normalizedGameName.includes(installedName)
          })
          
          if (foundInstalled) {
            setIsInstalled(true)
            setInstalledGame({
              path: foundInstalled.path || foundInstalled.gamePath,
              gamePath: foundInstalled.path || foundInstalled.gamePath,
              folder: foundInstalled.path || foundInstalled.gamePath,
              exePath: foundInstalled.exePath,
              name: foundInstalled.name,
              installDate: foundInstalled.installDate,
              version: foundInstalled.version,
              launcherId: foundInstalled.launcherId
            })
          } else {
            setIsInstalled(false)
            setInstalledGame(null)
          }
          
          // Notifier le parent
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('installed-games-updated', {
              detail: { games: scannedGames }
            }))
          }
        }
      }
    } catch (error) {
      console.error('[GameDetails] Erreur lors de la vérification de l\'installation:', error)
    }
  }, [game])

  // handleDownload doit être défini avant d'être utilisé dans les useEffect
  const handleDownload = useCallback(async () => {
    console.log('🔍 DEBUG: handleDownload appelé', { game: game?.name, downloading, currentDownload })
    
    if (!game || downloading || currentDownload) {
      console.log('🔍 DEBUG: handleDownload bloqué', { 
        hasGame: !!game, 
        downloading, 
        currentDownload: !!currentDownload 
      })
      return
    }

    // Vérifier si l'utilisateur est un invité
    if (currentUser?.isGuest) {
      console.log('🔍 DEBUG: Utilisateur invité détecté, affichage warning')
      setPendingAction('download')
      setShowGuestWarning(true)
      return
    }

    // Ouvrir le popup de téléchargement
    console.log('🔍 DEBUG: Ouverture du popup de téléchargement')
    setShowDownloadPopup(true)
  }, [game, downloading, currentUser, currentDownload])

  // Fonction pour confirmer le téléchargement depuis le popup
  const handleConfirmDownload = useCallback(async (selectedPath, options = {}) => {
    console.log('🔍 DEBUG: handleConfirmDownload appelé', { 
      selectedPath, 
      game: game?.name, 
      downloading, 
      currentDownload: !!currentDownload,
      options
    })
    
    if (!game || downloading || currentDownload) {
      console.log('🔍 DEBUG: handleConfirmDownload bloqué', { 
        hasGame: !!game, 
        downloading, 
        currentDownload: !!currentDownload 
      })
      return
    }

    // Fermer le popup immédiatement
    setShowDownloadPopup(false)

    // Déterminer l'URL à utiliser selon le statut utilisateur
    const userStatus = currentUser || { isAdmin: false, isVip: false, isBoost: false }
    const isGratuit = !userStatus.isAdmin && !userStatus.isVip && !userStatus.isBoost
    
    console.log('🔍 DEBUG: Statut utilisateur', { userStatus, isGratuit })
    
    // Vérifier si l'utilisateur a réclamé une clé gratuite (permet un téléchargement sans pub)
    let hasFreeKeyClaimed = false
    try {
      const freeKeyData = localStorage.getItem('freeKeyClaimed')
      if (freeKeyData) {
        const parsed = JSON.parse(freeKeyData)
        if (parsed.claimed === true) {
          hasFreeKeyClaimed = true
        }
      }
    } catch (error) {
      console.error('[GameDetails] Erreur lors de la vérification de la clé gratuite:', error)
    }
    
    // Pour les utilisateurs gratuits, utiliser le système à un seul lien Lockr
    // SAUF s'ils ont réclamé une clé gratuite (alors téléchargement direct sans pub)
    if (isGratuit && !hasFreeKeyClaimed) {
      const gameId = game.id || game.gameId
      const gameName = game.title || game.name || 'Jeu inconnu'
      
      if (!gameId || !gameName) {
        console.error('[GameDetails] ❌ Informations du jeu manquantes (gameId ou gameName)')
        alert(`Impossible de lancer le jeu: informations manquantes.`)
        return
      }
      
      // Ouvrir Lockr directement - le dossier sera demandé APRÈS les quêtes
      try {
        if (window.electron?.lockr?.launchGameWithUniqueLink) {
          const result = await window.electron.lockr.launchGameWithUniqueLink(gameId, gameName)
          
          if (result.success) {
            console.log('[GameDetails] ✅ Lockr ouvert avec succès')
          } else {
            console.error('[GameDetails] ❌ Erreur lors de l\'ouverture de Lockr:', result.error)
            alert(`Erreur lors de l'ouverture de Lockr: ${result.error || 'Erreur inconnue'}`)
          }
        } else {
          console.error('[GameDetails] ❌ Fonction launchGameWithUniqueLink non disponible')
          alert('Fonction de lancement Lockr non disponible. Veuillez redémarrer le launcher.')
        }
      } catch (error) {
        console.error('[GameDetails] ❌ Erreur lors de l\'ouverture de Lockr:', error)
        alert(`Erreur: ${error.message || 'Impossible d\'ouvrir Lockr'}`)
      }
      return
    }

    // Pour les VIP/Admin/Boost ou utilisateurs avec clé gratuite, procéder au téléchargement direct
    try {
      console.log('🔍 DEBUG: Démarrage téléchargement VIP/Admin/Boost ou clé gratuite')
      setDownloading(true)

      // Déterminer l'URL de téléchargement
      let downloadUrl = null
      
      // Si c'est un téléchargement Gofile (détecté par les options ou l'URL)
      if (options.useGofilePython || game.gofileUrl || game?.downloadUrl?.includes('gofile.io')) {
        downloadUrl = game.gofileUrl || game.downloadUrl
        console.log('🐍 DEBUG: Téléchargement Gofile détecté:', downloadUrl)
        
        // Utiliser le handler IPC Gofile
        if (window.electron?.download?.gofile) {
          const result = await window.electron.download.gofile({
            url: downloadUrl,
            installPath: selectedPath,
            gameName: game.title || game.name || 'Jeu inconnu',
            password: null
          })
          
          console.log('🔍 DEBUG: Résultat téléchargement Gofile:', result)
          
          if (result && result.success) {
            console.log('✅ DEBUG: Téléchargement Gofile démarré avec succès')
          } else {
            console.error('❌ DEBUG: Téléchargement Gofile échoué:', result?.error)
            setDownloading(false)
            alert(`Erreur téléchargement Gofile: ${result?.error || 'Erreur inconnue'}`)
          }
        } else {
          console.error('[GameDetails] ❌ Handler Gofile non disponible')
          setDownloading(false)
          alert('Handler de téléchargement Gofile non disponible')
        }
      } else {
        // Téléchargement standard (Buzz, PixelDrain, etc.)
        downloadUrl = game.downloadUrl || game.download_url || game.lockrUrl || game.lockr_url
        console.log('📦 DEBUG: Téléchargement standard:', downloadUrl)
        
        if (!downloadUrl) {
          console.error('[GameDetails] ❌ Aucune URL de téléchargement disponible')
          alert('URL de téléchargement non disponible')
          setDownloading(false)
          return
        }

        const gameName = game.title || game.name || 'Jeu inconnu'
        
        // Si l'utilisateur a réclamé une clé gratuite, marquer lockrCompleted comme true
        const lockrCompleted = hasFreeKeyClaimed ? true : false
        
        console.log('🔍 DEBUG: Appel window.electron.download.downloadGame')
        
        // Utiliser le handler de téléchargement standard
        if (window.electron?.download?.downloadGame) {
          const result = await window.electron.download.downloadGame(
            downloadUrl,
            selectedPath,
            {
              gameName: gameName,
              gameId: game.id || game.gameId,
              userStatus: userStatus,
              lockrCompleted: lockrCompleted
            }
          )
          
          console.log('🔍 DEBUG: Résultat de downloadGame', result)
          
          // Si le téléchargement démarre avec succès et qu'une clé a été utilisée, la supprimer
          if (result && result.success && hasFreeKeyClaimed) {
            localStorage.removeItem('freeKeyClaimed')
            console.log('[GameDetails] 🎁 Clé gratuite utilisée, suppression de localStorage')
          }
          
          if (result && result.success) {
            console.log('✅ DEBUG: Téléchargement standard démarré avec succès')
          } else {
            console.error('❌ DEBUG: Téléchargement standard échoué:', result)
            setDownloading(false)
            alert(`Erreur téléchargement: ${result?.error || 'Erreur inconnue'}`)
          }
        } else {
          console.error('[GameDetails] ❌ Handler downloadGame non disponible')
          setDownloading(false)
          alert('Handler de téléchargement non disponible')
        }
      }
      
    } catch (error) {
      console.error('[GameDetails] ❌ Erreur lors du téléchargement:', error)
      const errorMessage = error?.message || 'Erreur inconnue lors du téléchargement'
      alert(`Erreur lors du téléchargement: ${errorMessage}`)
      setDownloading(false)
    }
  }, [game, downloading, currentUser, currentDownload])

  // 🔍 Charger les jeux installés depuis le cache (sans forcer un scan complet)
  useEffect(() => {
    const loadInstalledGames = async () => {
      try {
        if (window.electron?.games?.scanInstalledGames) {
          // Utiliser le cache, ne pas forcer un scan complet
          const result = await window.electron.games.scanInstalledGames(null, false)
          if (result && result.success) {
            setLocalInstalledGames(result.games || [])
          }
        }
      } catch (error) {
        console.error('[GameDetails] Erreur lors du chargement des jeux installés:', error)
      }
    }
    
    // Charger une seule fois au montage
    loadInstalledGames()
  }, []) // Une seule fois, pas de dépendance sur gameId

  // Écouter les événements de téléchargement pour ce jeu spécifique
  useEffect(() => {
    if (!window.electron?.ipcRenderer || !game) return

    const gameIdToMatch = game.id || game.gameId
    const gameNameToMatch = game.name || game.title

    const handleDownloadStarted = (event, data) => {
      console.log('[GameDetails] 🚀 Téléchargement démarré:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameId === gameIdToMatch || data.gameName === gameNameToMatch) {
        setDownloading(true)
        setDownloadProgress(0)
        setDownloadSpeed(0)
        setDownloadEta(0)
        setDownloadedBytes(0)
        setTotalBytes(data.totalBytes || 0)
      }
    }

    const handleDownloadProgress = (event, data) => {
      console.log('[GameDetails] 📈 Progression téléchargement:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameId === gameIdToMatch || data.gameName === gameNameToMatch) {
        setDownloadProgress(data.progress || 0)
        setDownloadSpeed(data.speed || 0)
        setDownloadEta(data.eta || 0)
        setDownloadedBytes(data.downloadedBytes || 0)
        setTotalBytes(data.totalBytes || 0)
      }
    }

    const handleDownloadComplete = (event, data) => {
      console.log('[GameDetails] ✅ Téléchargement terminé:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameId === gameIdToMatch || data.gameName === gameNameToMatch) {
        setDownloading(false)
        setDownloadProgress(100)
        
        // Rafraîchir le statut d'installation après un délai
        setTimeout(() => {
          checkInstalledStatus()
        }, 2000)
      }
    }

    const handleDownloadError = (event, data) => {
      console.error('[GameDetails] ❌ Erreur téléchargement:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameId === gameIdToMatch || data.gameName === gameNameToMatch) {
        setDownloading(false)
        setDownloadProgress(0)
        alert(`Erreur de téléchargement: ${data.error || 'Erreur inconnue'}`)
      }
    }

    const handleExtractionStarted = (event, data) => {
      console.log('[GameDetails] 📦 Extraction démarrée:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameId === gameIdToMatch || data.gameName === gameNameToMatch) {
        setDownloading(true) // Garder l'état downloading pendant l'extraction
        setDownloadProgress(100) // Le téléchargement est terminé
      }
    }

    const handleExtractionComplete = (event, data) => {
      console.log('[GameDetails] 📦 Extraction terminée:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameId === gameIdToMatch || data.gameName === gameNameToMatch) {
        setDownloading(false)
        setDownloadProgress(100)
        
        // Rafraîchir le statut d'installation après un délai
        setTimeout(() => {
          checkInstalledStatus()
        }, 3000) // Attendre 3 secondes pour que la détection automatique se fasse
      }
    }

    const handleGameInstalled = (event, data) => {
      console.log('[GameDetails] 🎮 Jeu installé automatiquement:', data)
      
      // Vérifier si c'est pour ce jeu
      if (data.gameId === gameIdToMatch || data.gameName === gameNameToMatch) {
        // Mettre à jour immédiatement l'état d'installation
        setIsInstalled(true)
        setInstalledGame({
          path: data.installPath,
          gamePath: data.installPath,
          folder: data.installPath,
          exePath: data.exePath,
          name: data.gameName,
          installDate: new Date().toISOString(),
          version: '1.0',
          launcherId: 'gofile-download'
        })
      }
    }

    // Ajouter les listeners
    window.electron.ipcRenderer.on('download:started', handleDownloadStarted)
    window.electron.ipcRenderer.on('download:progress', handleDownloadProgress)
    window.electron.ipcRenderer.on('download:complete', handleDownloadComplete)
    window.electron.ipcRenderer.on('download:error', handleDownloadError)
    window.electron.ipcRenderer.on('extraction-started', handleExtractionStarted)
    window.electron.ipcRenderer.on('download:extracted', handleExtractionComplete)
    window.electron.ipcRenderer.on('game-installed', handleGameInstalled)

    // Nettoyer les listeners
    return () => {
      window.electron.ipcRenderer.removeListener('download:started', handleDownloadStarted)
      window.electron.ipcRenderer.removeListener('download:progress', handleDownloadProgress)
      window.electron.ipcRenderer.removeListener('download:complete', handleDownloadComplete)
      window.electron.ipcRenderer.removeListener('download:error', handleDownloadError)
      window.electron.ipcRenderer.removeListener('extraction-started', handleExtractionStarted)
      window.electron.ipcRenderer.removeListener('download:extracted', handleExtractionComplete)
      window.electron.ipcRenderer.removeListener('game-installed', handleGameInstalled)
    }
  }, [game, checkInstalledStatus])

  // 🔊 Écouter les événements de progression de désinstallation
  useEffect(() => {
    if (!window.electron?.games?.onUninstallProgress) return

    const handleProgress = (data) => {
      if (data.progress !== undefined) {
        setUninstallProgress(data.progress)
      }
      if (data.step) {
        setUninstallStep(data.step)
      }
    }

    window.electron.games.onUninstallProgress(handleProgress)

    return () => {
      if (window.electron?.games?.removeUninstallProgressListener) {
        window.electron.games.removeUninstallProgressListener()
      }
    }
  }, [])

  // 🔊 Écouter l'événement 'game-uninstalled' du backend pour mettre à jour la page
  useEffect(() => {
    if (!window.electron?.ipcRenderer) return

    const handleGameUninstalled = (event, data) => {
      const uninstalledGameName = data?.gameName || ''
      const currentGameName = game?.name || game?.title || ''
      
      // Si c'est le jeu actuel qui a été désinstallé, mettre à jour l'état
      if (uninstalledGameName && currentGameName && 
          uninstalledGameName.toLowerCase() === currentGameName.toLowerCase()) {
        
        // ✅ Mise à jour IMMÉDIATE de l'état local
        setIsInstalled(false)
        setInstalledGame(null)
        setLocalInstalledGames([])
        
        // ✅ Vérifier via le store de persistance pour confirmer
        if (window.electron?.games?.isGameInstalled) {
          const gameIdToCheck = game?.id || game?.gameId
          if (gameIdToCheck) {
            window.electron.games.isGameInstalled(gameIdToCheck).then(installCheck => {
              if (installCheck && !installCheck.installed) {
                setIsInstalled(false)
                setInstalledGame(null)
              }
            }).catch(err => {
              console.error('[GameDetails] Erreur lors de la vérification:', err)
            })
          }
        }
        
        // Mettre à jour l'état local sans re-scanner (le scan sera fait par le parent si nécessaire)
        // Juste vérifier ce jeu spécifique
        if (window.electron?.games?.isGameInstalled) {
          const gameIdToCheck = game?.id || game?.gameId
          if (gameIdToCheck) {
            window.electron.games.isGameInstalled(gameIdToCheck).then(installCheck => {
              if (installCheck && installCheck.installed) {
                setIsInstalled(true)
                if (installCheck.gameData) {
                  setInstalledGame({
                    path: installCheck.gameData.path || installCheck.gameData.gamePath,
                    gamePath: installCheck.gameData.path || installCheck.gameData.gamePath,
                    folder: installCheck.gameData.path || installCheck.gameData.gamePath,
                    exePath: installCheck.gameData.exePath,
                    name: installCheck.gameData.gameName || installCheck.gameData.name || game?.name || game?.title,
                    installDate: installCheck.gameData.installDate,
                    version: installCheck.gameData.installedVersion,
                    launcherId: installCheck.gameData.launcherId
                  })
                }
              } else {
                setIsInstalled(false)
                setInstalledGame(null)
            }
          }).catch(err => {
              console.error('[GameDetails] Erreur lors de la vérification après événement:', err)
          })
          }
        }
      }
    }

    window.electron.ipcRenderer.on('game-uninstalled', handleGameUninstalled)

    return () => {
      window.electron.ipcRenderer.removeListener('game-uninstalled', handleGameUninstalled)
    }
  }, [game])

  // Utiliser les jeux locaux si disponibles, sinon les jeux passés en props
  const gamesToUse = localInstalledGames.length > 0 ? localInstalledGames : installedGames

  useEffect(() => {
    const loadGame = async () => {
      if (!gameId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Réinitialiser les états vidéo pour le nouveau jeu
        // (Plus besoin de réinitialiser les états Steam)
        
        // 🔍 VÉRIFICATION IMMÉDIATE DE L'INSTALLATION AVANT TOUT (PRIORITAIRE)
        let isGameInstalled = false
        let installedGameData = null
        
        if (window.electron?.games?.isGameInstalled) {
          try {
            // Essayer plusieurs variantes d'ID
            const gameIdsToTry = [
              gameId, // L'ID passé en paramètre
              String(gameId).toLowerCase(), // Version lowercase
              String(gameId).toLowerCase().replace(/\s+/g, '-'), // Version slug
            ]
            
            
            for (const gameIdToCheck of gameIdsToTry) {
              try {
                const installCheck = await window.electron.games.isGameInstalled(gameIdToCheck)
                
                if (installCheck && installCheck.installed) {
                  isGameInstalled = true
                  installedGameData = installCheck.gameData
                  break // Arrêter dès qu'on trouve
                }
              } catch (checkError) {
                console.warn('[GameDetails] ⚠️ Erreur lors de la vérification pour', gameIdToCheck, ':', checkError)
              }
            }
            
            if (!isGameInstalled) {
            }
          } catch (checkError) {
            console.error('[GameDetails] ❌ Erreur lors de la vérification du store:', checkError)
          }
        }
        
        // Utiliser les jeux déjà scannés, pas besoin de re-scanner à chaque fois
        let scannedInstalledGames = gamesToUse
        
        // Utiliser le cache (les colonnes optionnelles sont maintenant toujours récupérées)
        const allGames = await gamesCacheService.getGames()
        
        // Fusionner les jeux installés dans le catalogue avec les jeux scannés
        const mergedGames = mergeInstalledGamesIntoCatalog(allGames, scannedInstalledGames)
        const foundGame = mergedGames.find(g => g.id === gameId || g.gameId === gameId)
        
        if (foundGame) {
          setGame(foundGame)
          
          // Si on n'a pas trouvé via le store, réessayer avec l'ID du jeu trouvé
          if (!isGameInstalled && window.electron?.games?.isGameInstalled) {
            try {
              const gameIdToCheck = foundGame.id || foundGame.gameId
              if (gameIdToCheck && gameIdToCheck !== gameId) {
                const installCheck = await window.electron.games.isGameInstalled(gameIdToCheck)
                
                if (installCheck && installCheck.installed) {
                  isGameInstalled = true
                  installedGameData = installCheck.gameData
                }
              }
            } catch (checkError) {
              console.error('[GameDetails] Erreur lors de la vérification du store avec ID catalogue:', checkError)
            }
          }
          
          // Utiliser les données fusionnées si pas trouvé dans le store
          if (!isGameInstalled) {
            isGameInstalled = foundGame.isInstalled === true && 
                                  (foundGame.hasCrkFile === true || Boolean(foundGame.launcherId)) &&
                                  Boolean(foundGame.installFolder)
          }
          
          // 🔍 VÉRIFICATION SUPPLÉMENTAIRE : Si la fusion n'a pas détecté l'installation, vérifier directement dans le scan
          if (!isGameInstalled && scannedInstalledGames.length > 0) {
            const gameName = foundGame.name || foundGame.title || ''
            const normalizedGameName = gameName.toLowerCase().trim()
            
            const foundInstalled = scannedInstalledGames.find(installed => {
              const installedName = (installed.name || installed.gameName || '').toLowerCase().trim()
              const installedId = installed.gameId || installed.id
              const catalogId = foundGame.id || foundGame.gameId
              
              // Vérifier par ID d'abord
              if (catalogId && installedId && (String(catalogId) === String(installedId))) {
                return true
              }
              
              // Vérifier par nom
              return installedName === normalizedGameName || 
                     (installedName.length > 0 && normalizedGameName.length > 0 &&
                      (installedName.includes(normalizedGameName) || normalizedGameName.includes(installedName)))
            })
            
            if (foundInstalled) {
              isGameInstalled = true
              foundGame.isInstalled = true
              foundGame.installFolder = foundInstalled.path || foundInstalled.gamePath
              foundGame.executable = foundInstalled.exePath
              foundGame.installDate = foundInstalled.installDate
              foundGame.installedVersion = foundInstalled.version
              foundGame.launcherId = foundInstalled.launcherId
            }
          }
          
          if (isGameInstalled) {
            setIsInstalled(true)
            
            // Utiliser les données du store si disponibles, sinon les données fusionnées
            if (installedGameData) {
              setInstalledGame({
                path: installedGameData.path || installedGameData.gamePath,
                gamePath: installedGameData.path || installedGameData.gamePath,
                folder: installedGameData.path || installedGameData.gamePath,
                exePath: installedGameData.exePath,
                name: installedGameData.gameName || installedGameData.name || foundGame.name || foundGame.title,
                installDate: installedGameData.installDate,
                version: installedGameData.installedVersion,
                launcherId: installedGameData.launcherId
              })
            } else {
            setInstalledGame({
              path: foundGame.installFolder,
              gamePath: foundGame.installFolder,
              folder: foundGame.installFolder,
              exePath: foundGame.executable,
              name: foundGame.name || foundGame.title,
              installDate: foundGame.installDate,
              version: foundGame.installedVersion,
              launcherId: foundGame.launcherId
            })
            }
          } else {
            setIsInstalled(false)
            setInstalledGame(null)
          }
          
          if (foundGame.isOnline !== undefined) {
            setIsOnline(foundGame.isOnline)
          } else {
            const onlineStatus = await isGameOnline(foundGame.id || foundGame.gameId)
            setIsOnline(onlineStatus)
          }

          setIsFavorite(favoritesService.isFavorite(foundGame.id || foundGame.gameId))
        } else {
          // Si le jeu n'est pas dans le catalogue mais qu'on a détecté une installation
          if (isGameInstalled && installedGameData) {
            // Créer un objet jeu minimal avec les données d'installation
            const minimalGame = {
              id: gameId,
              gameId: gameId,
              name: installedGameData.gameName || installedGameData.name || 'Jeu installé',
              title: installedGameData.gameName || installedGameData.name || 'Jeu installé',
              isInstalled: true,
              installFolder: installedGameData.path || installedGameData.gamePath,
              executable: installedGameData.exePath,
              installDate: installedGameData.installDate,
              installedVersion: installedGameData.installedVersion,
              launcherId: installedGameData.launcherId
            }
            setGame(minimalGame)
            setIsInstalled(true)
            setInstalledGame({
              path: installedGameData.path || installedGameData.gamePath,
              gamePath: installedGameData.path || installedGameData.gamePath,
              folder: installedGameData.path || installedGameData.gamePath,
              exePath: installedGameData.exePath,
              name: installedGameData.gameName || installedGameData.name,
              installDate: installedGameData.installDate,
              version: installedGameData.installedVersion,
              launcherId: installedGameData.launcherId
            })
          } else {
            console.warn('[GameDetails] ⚠️ Jeu non trouvé dans le catalogue et non installé:', gameId)
            setLoading(false)
            return
          }
        }
      } catch (error) {
        console.error('[GameDetails] Error loading game', error)
      } finally {
        setLoading(false)
      }
    }

    loadGame()
  }, [gameId]) // Retirer gamesToUse des dépendances pour éviter les re-scans

  // 🔍 Vérifier l'installation au chargement et quand la page reçoit le focus (optimisé)
  useEffect(() => {
    if (!game || !gameId) return

    const checkInstallation = async () => {
      if (window.electron?.games?.isGameInstalled) {
        try {
          const gameIdToCheck = game.id || game.gameId || gameId
          const installCheck = await window.electron.games.isGameInstalled(gameIdToCheck)
          
          if (installCheck && installCheck.installed) {
            setIsInstalled(true)
            if (installCheck.gameData) {
              setInstalledGame({
                path: installCheck.gameData.path || installCheck.gameData.gamePath,
                gamePath: installCheck.gameData.path || installCheck.gameData.gamePath,
                folder: installCheck.gameData.path || installCheck.gameData.gamePath,
                exePath: installCheck.gameData.exePath,
                name: installCheck.gameData.gameName || installCheck.gameData.name || game.name || game.title,
                installDate: installCheck.gameData.installDate,
                version: installCheck.gameData.installedVersion,
                launcherId: installCheck.gameData.launcherId
              })
            }
          } else {
            // ✅ IMPORTANT: Si le jeu n'est plus installé, mettre à jour l'état
            setIsInstalled(false)
            setInstalledGame(null)
          }
        } catch (checkError) {
          console.error('[GameDetails] Erreur lors de la vérification:', checkError)
        }
      }
    }

    // Vérifier immédiatement
    checkInstallation()

    // Vérifier aussi quand la fenêtre reçoit le focus (avec debounce)
    let focusTimeout = null
    const handleFocus = () => {
      if (focusTimeout) clearTimeout(focusTimeout)
      focusTimeout = setTimeout(() => {
        checkInstallation()
      }, 500) // Attendre 500ms avant de vérifier
    }

    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      if (focusTimeout) clearTimeout(focusTimeout)
    }
  }, [game, gameId]) // Retirer isInstalled des dépendances pour éviter les boucles

  // Écouter l'événement trigger-download pour déclencher le téléchargement automatiquement
  useEffect(() => {
    let lastTriggeredGameId = null
    let lastTriggerTime = 0
    
    const handleTriggerDownload = async (event) => {
      const { gameId: triggerGameId, gameName: triggerGameName } = event.detail || {}
      const currentGameId = game?.id || game?.gameId
      const currentGameName = game?.name || game?.title || ''
      
      // Vérifier que c'est bien le jeu actuel
      if (triggerGameId && currentGameId && triggerGameId.toString() === currentGameId.toString()) {
        // Éviter les déclenchements multiples pour le même jeu dans un court délai
        const now = Date.now()
        if (lastTriggeredGameId === triggerGameId && (now - lastTriggerTime) < 2000) {
          return
        }
        
        lastTriggeredGameId = triggerGameId
        lastTriggerTime = now
        
        
        // Pour les utilisateurs gratuits, protocol:start-download signifie qu'on vient de la redirection Netlify
        // Il faut déclencher le dialogue de sélection de dossier directement
        const userStatus = currentUser || { isAdmin: false, isVip: false, isBoost: false }
        const isGratuit = !userStatus.isAdmin && !userStatus.isVip && !userStatus.isBoost
        
        if (isGratuit && game) {
          // Pour les utilisateurs gratuits, protocol:start-download signifie qu'on vient de redirect.html
          // (après les quêtes Lockr). On doit maintenant utiliser le lien direct VIP (violet) du panel admin
          
          // Récupérer le lien direct VIP (violet) depuis le panel admin
          // Le lien violet dans le panel admin est dans downloadUrl, pas dans lockrUrl
          const directVipUrl = game.downloadUrl || game.download_url
          
          if (!directVipUrl) {
            console.error('[GameDetails] ❌ Aucun lien direct VIP trouvé pour le jeu')
            alert('Aucun lien de téléchargement disponible pour ce jeu')
            setDownloading(false)
            return
          }
          
          
          // Demander le dossier et télécharger directement avec le lien VIP
          setTimeout(async () => {
            try {
              setDownloading(true)
              const folderResult = await window.electron.download.selectFolder()
              
              if (!folderResult.success || !folderResult.folderPath) {
                console.log('[GameDetails] ❌ Sélection de dossier annulée ou échouée')
                setDownloading(false)
                return
              }


              // Télécharger directement avec le lien VIP (violet)
              const gameName = game.title || game.name || 'Jeu inconnu'
              const result = await window.electron.download.downloadGame(
                directVipUrl, // Utiliser le lien direct VIP (violet) du panel admin
                folderResult.folderPath,
                {
                  gameName: gameName,
                  gameId: game.id || game.gameId,
                  userStatus: userStatus,
                  lockrCompleted: true // Indiquer que les quêtes sont complétées
                }
              )
              
              if (result && result.success) {
              } else {
                console.warn('[GameDetails] ⚠️ Résultat inattendu:', result)
                setDownloading(false)
              }
            } catch (error) {
              console.error('[GameDetails] ❌ Erreur lors du téléchargement:', error)
              alert(`Erreur: ${error.message || 'Impossible de télécharger le jeu'}`)
              setDownloading(false)
            }
          }, 500)
          return
        } else {
          // Pour les VIP/Admin/Boost, utiliser handleDownload normal
          setTimeout(() => {
            handleDownload()
          }, 300)
        }
      }
    }

    window.addEventListener('trigger-download', handleTriggerDownload)
    
    return () => {
      window.removeEventListener('trigger-download', handleTriggerDownload)
    }
  }, [game, handleDownload, handleConfirmDownload, currentUser, downloading, setDownloading])

  // Écouter les événements de récompense pour liens morts après publicités
  useEffect(() => {
    const handleDeadLinkReward = (event) => {
      console.log('[GameDetails] 🎁 Événement dead-link-reward reçu:', event.detail)
      const { gameId, gameName } = event.detail || {}
      
      const currentGameId = game?.id || game?.gameId
      const currentGameName = game?.name || game?.title || ''
      
      const gameIdMatch = gameId && currentGameId && String(gameId) === String(currentGameId)
      const gameNameMatch = gameName && currentGameName && 
        gameName.toLowerCase().trim() === currentGameName.toLowerCase().trim()
      
      if (gameIdMatch || gameNameMatch || (!gameId && !currentGameId && gameNameMatch)) {
        const finalGameName = gameName || currentGameName || 'Jeu inconnu'
        const finalGameId = gameId || currentGameId || null
        
        setDeadLinkRewardGameName(finalGameName)
        setDeadLinkRewardGameId(finalGameId)
        setShowDeadLinkRewardModal(true)
      }
    }

    window.addEventListener('dead-link-reward', handleDeadLinkReward)
    
    return () => {
      window.removeEventListener('dead-link-reward', handleDeadLinkReward)
    }
  }, [game])

  // Écouter les téléchargements pour ce jeu
  useEffect(() => {
    if (!game) return

    const gameId = game.id || game.gameId
    const gameName = game.name || game.title || ''
    
    console.log('[GameDetails] 🔍 Configuration de l\'écoute des téléchargements pour:', { gameId, gameName })
    
    const checkDownload = () => {
      const downloads = downloadManager.getAllDownloads()
      console.log('[GameDetails] 📊 Vérification des téléchargements:', downloads.length, 'total')
      
      const download = downloads.find(d => {
        const matchById = d.gameId === gameId
        const matchByName = d.gameName && gameName && d.gameName.toLowerCase() === gameName.toLowerCase()
        console.log('[GameDetails] 🔍 Comparaison téléchargement:', {
          downloadId: d.gameId,
          downloadName: d.gameName,
          targetId: gameId,
          targetName: gameName,
          matchById,
          matchByName
        })
        return matchById || matchByName
      })
      
      console.log('[GameDetails] 🎯 Téléchargement trouvé:', download ? {
        id: download.id,
        gameName: download.gameName,
        status: download.status,
        progress: download.progress
      } : 'Aucun')
      
      // Créer un nouvel objet pour forcer React à détecter le changement
      if (download) {
        setCurrentDownload({
          ...download,
          // Ajouter un timestamp pour forcer la mise à jour même si les valeurs sont identiques
          _updateTime: Date.now()
        })
        console.log('[GameDetails] ✅ currentDownload mis à jour')
      } else {
        setCurrentDownload(null)
        console.log('[GameDetails] ❌ currentDownload réinitialisé')
      }
      
      // Mettre à jour l'état downloading en fonction du statut du téléchargement
      if (download) {
        if (download.status === 'downloading' || download.status === 'extracting' || download.status === 'paused') {
          console.log('[GameDetails] 🔄 Téléchargement actif détecté, downloading = true')
          setDownloading(true)
        } else if (download.status === 'completed' || download.status === 'extracted' || download.status === 'error' || download.status === 'failed') {
          console.log('[GameDetails] ✅ Téléchargement terminé/échoué, downloading = false')
          setDownloading(false)
          // Si le téléchargement est terminé, vérifier si le jeu est installé
          if (download.status === 'extracted' || download.status === 'completed') {
            // Attendre un peu pour laisser le temps à l'installation de se terminer
            setTimeout(() => {
              console.log('[GameDetails] 🔍 Vérification de l\'installation après téléchargement')
              checkInstalledStatus()
            }, 2000)
          }
        }
      } else {
        console.log('[GameDetails] ❌ Aucun téléchargement, downloading = false')
        setDownloading(false)
      }
    }

    checkDownload()
    
    const unsubscribe = downloadManager.subscribe((downloads) => {
      console.log('[GameDetails] 📨 Mise à jour reçue du downloadManager:', downloads.length, 'téléchargements')
      checkDownload()
    })

    if (window.electron?.ipcRenderer) {
      const handleProgress = (event, data) => {
        console.log('[GameDetails] 📈 Événement download:progress reçu:', data)
        checkDownload()
      }
      const handleComplete = (event, data) => {
        console.log('[GameDetails] ✅ Événement download:complete reçu:', data)
        checkDownload()
        // Attendre un peu avant de réinitialiser downloading pour laisser le temps à l'extraction de démarrer
        setTimeout(() => {
          const downloads = downloadManager.getAllDownloads()
          const download = downloads.find(d => 
            d.gameId === gameId || 
            (d.gameName && gameName && d.gameName.toLowerCase() === gameName.toLowerCase())
          )
          if (!download || (download.status !== 'extracting' && download.status !== 'downloading')) {
            setDownloading(false)
            setCurrentDownload(null)
            // Vérifier si le jeu est installé après la fin du téléchargement
            if (download && (download.status === 'extracted' || download.status === 'completed')) {
              checkInstalledStatus()
            }
          }
        }, 1000)
      }
      const handleError = (event, data) => {
        console.log('[GameDetails] ❌ Événement download:error reçu:', data)
        checkDownload()
        setDownloading(false)
        setCurrentDownload(null)
      }
      const handleStarted = (event, data) => {
        console.log('[GameDetails] 🚀 Événement download:started reçu:', data)
        checkDownload()
      }
      const handleExtraction = (event, data) => {
        console.log('[GameDetails] 📦 Événement extraction reçu:', data)
        checkDownload()
      }
      const handleExtractionProgress = (event, data) => {
        console.log('[GameDetails] 📦 Événement extraction:progress reçu:', data)
        checkDownload()
      }

      window.electron.ipcRenderer.on('download:started', handleStarted)
      window.electron.ipcRenderer.on('download:progress', handleProgress)
      window.electron.ipcRenderer.on('download:complete', handleComplete)
      window.electron.ipcRenderer.on('download:error', handleError)
      window.electron.ipcRenderer.on('extraction-started', handleExtraction)
      window.electron.ipcRenderer.on('extraction:progress', handleExtractionProgress)
      window.electron.ipcRenderer.on('download:extracted', (event, data) => {
        console.log('[GameDetails] 📦 Événement download:extracted reçu:', data)
        checkDownload()
        // Réinitialiser downloading après l'extraction
        setTimeout(() => {
          setDownloading(false)
          setCurrentDownload(null)
          // Vérifier si le jeu est maintenant installé
          checkInstalledStatus()
        }, 2000) // Augmenter le délai pour laisser le temps à l'installation
      })
      
      // Écouter l'événement de jeu installé pour mettre à jour l'état
      const handleGameInstalled = (event, data) => {
        console.log('[GameDetails] 🎮 Événement games:installed-updated reçu:', data)
        checkInstalledStatus()
        setDownloading(false)
        setCurrentDownload(null)
      }
      
      window.electron.ipcRenderer.on('games:installed-updated', handleGameInstalled)

      return () => {
        console.log('[GameDetails] 🧹 Nettoyage des listeners de téléchargement')
        unsubscribe()
        window.electron.ipcRenderer.removeListener('download:started', handleStarted)
        window.electron.ipcRenderer.removeListener('download:progress', handleProgress)
        window.electron.ipcRenderer.removeListener('download:complete', handleComplete)
        window.electron.ipcRenderer.removeListener('download:error', handleError)
        window.electron.ipcRenderer.removeListener('extraction-started', handleExtraction)
        window.electron.ipcRenderer.removeListener('extraction:progress', handleExtractionProgress)
        window.electron.ipcRenderer.removeListener('download:extracted', handleExtraction)
        window.electron.ipcRenderer.removeListener('games:installed-updated', handleGameInstalled)
      }
    }

    return () => {
      console.log('[GameDetails] 🧹 Nettoyage des listeners (fallback)')
      unsubscribe()
    }
  }, [game, checkInstalledStatus])

  const coverUrl = useMemo(() => (
    game?.coverImage ||
    game?.cover_image ||
    game?.header_image ||
    game?.headerImage ||
    game?.image
  ), [game])

  const videoUrl = useMemo(() => {
    if (!game) return null
    
    // 🎬 PRIORITÉ 1: Métadonnées Supabase (nos vidéos scrapées)
    const gameMetadata = gamesMetadataService.getGameMetadata(game.id || game.gameId)
    if (gameMetadata && gameMetadata.video && gameMetadata.video.url) {
      console.log('[GameDetails] 🎬 Vidéo trouvée dans les métadonnées Supabase:', gameMetadata.video.url)
      return gameMetadata.video.url
    }
    
    // Priorité 2: Champ video direct (string)
    if (game.video && typeof game.video === 'string') return game.video
    
    // Priorité 3: Champ trailer
    if (game.trailer && typeof game.trailer === 'string') return game.trailer
    
    // Priorité 3: Champ trailer_url
    if (game.trailer_url && typeof game.trailer_url === 'string') return game.trailer_url
    
    // Priorité 4: Champ movies (objet avec mp4/webm)
    if (game.movies) {
      // Si c'est un string, l'utiliser directement
      if (typeof game.movies === 'string') return game.movies
      
      // Si c'est un objet, chercher mp4.max, mp4.480, webm.max, webm.480
      if (game.movies.mp4?.max) return game.movies.mp4.max
      if (game.movies.mp4?.['480']) return game.movies.mp4['480']
      if (game.movies.webm?.max) return game.movies.webm.max
      if (game.movies.webm?.['480']) return game.movies.webm['480']
      
      // Si movies est un tableau, prendre le premier élément
      if (Array.isArray(game.movies) && game.movies.length > 0) {
        const firstMovie = game.movies[0]
        if (typeof firstMovie === 'string') return firstMovie
        if (firstMovie.mp4?.max) return firstMovie.mp4.max
        if (firstMovie.mp4?.['480']) return firstMovie.mp4['480']
        if (firstMovie.webm?.max) return firstMovie.webm.max
        if (firstMovie.webm?.['480']) return firstMovie.webm['480']
      }
    }
    
    return null
  }, [game])

  // ❌ Vidéos Steam désactivées (problèmes CORS + HLS incompatibles avec Electron)
  // Les vidéos Steam utilisent le format HLS qui nécessite hls.js et crée des blobs
  // qui sont bloqués par le Content Security Policy

  // Utiliser les vidéos Steam ou Supabase (par ordre de priorité)
  const finalVideoUrl = videoUrl
  const hasVideo = finalVideoUrl

  const cachedCover = useCachedImage(coverUrl)
  const title = game?.name || game?.title || 'Jeu inconnu'
  
  // Nettoyer la description HTML et limiter à 200 caractères
  const description = useMemo(() => {
    const rawDescription = game?.description || game?.desc || game?.shortDescription || 'Aucune description disponible.'
    
    // Supprimer toutes les balises HTML
    const textOnly = rawDescription.replace(/<[^>]*>/g, '')
    
    // Remplacer les entités HTML courantes
    const decoded = textOnly
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
    
    // Nettoyer les espaces multiples
    const cleaned = decoded.replace(/\s+/g, ' ').trim()
    
    // Limiter à 200 caractères
    if (cleaned.length > 200) {
      return cleaned.substring(0, 200) + '...'
    }
    
    return cleaned
  }, [game?.description, game?.desc, game?.shortDescription])
  
  // Précharger l'image LCP pour améliorer les performances (9,130 ms économisés)
  useEffect(() => {
    if (cachedCover) {
      // Le composant est déjà monté sur game-details, pas besoin de vérifier activePage
      const img = new Image()
      img.src = cachedCover
    }
  }, [cachedCover])

  const handleToggleFavorite = useCallback(() => {
    if (game) {
      favoritesService.toggleFavorite(game.id || game.gameId)
      setIsFavorite(prev => !prev)
    }
  }, [game])

  // Ouvrir le modal de désinstallation
  const handleUninstallClick = useCallback(() => {
    if (!installedGame) {
      alert('Aucun jeu installé trouvé')
      return
    }
    setShowUninstallModal(true)
    setUninstallError(null)
    setUninstallProgress(0)
    setUninstallStep('')
  }, [installedGame])

  // Confirmer la désinstallation depuis le modal
  const handleUninstall = useCallback(async () => {
    
    if (!installedGame) {
      console.error('[GameDetails] ❌ ERREUR: Aucun jeu installé à désinstaller')
      setUninstallError('Aucun jeu installé trouvé')
      return
    }

    if (!window.electron?.games?.uninstallGame) {
      console.error('[GameDetails] ❌ ERREUR: Fonction uninstallGame non disponible')
      setUninstallError('Fonction de désinstallation non disponible')
      return
    }


    // ✅ Marquer la désinstallation comme en cours AVANT de commencer
    setIsUninstalling(true)
    setUninstallProgress(0)
    setUninstallStep('Initialisation...')

    // ⭐ IMPORTANT : Attendre 300ms pour que l'animation démarre et soit visible
    await new Promise(resolve => setTimeout(resolve, 300))

    try {
      // Utiliser le chemin du dossier si disponible, sinon chercher par nom
      const gameFolderPath = installedGame.path || installedGame.gamePath || installedGame.folder || null
      

      const startTime = Date.now()
      const result = await window.electron.games.uninstallGame(title, gameFolderPath)
      const duration = Date.now() - startTime
      

      if (result && result.success) {
        // La progression devrait déjà être à 100% via les événements IPC
        // Mais on s'assure qu'elle est bien à 100%
        setUninstallProgress(100)
        setUninstallStep('Finalisation...')
        
        
        // Attendre un peu pour voir la progression à 100%
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // ✅ Mise à jour IMMÉDIATE de l'état local (PRIORITAIRE)
        setIsInstalled(false)
        setInstalledGame(null)
        setLocalInstalledGames([]) // Réinitialiser la liste locale
        
        // Attendre un peu pour montrer le message de succès avant de fermer
        // Ne pas réinitialiser isUninstalling immédiatement, laisser la modale afficher le succès
        // Fermer le modal après 2 secondes pour laisser voir le message de succès
        setTimeout(() => {
          setIsUninstalling(false)
          // Fermer la modale après avoir montré le message de succès
          setTimeout(() => {
            setShowUninstallModal(false)
            setUninstallProgress(0)
            setUninstallStep('')
          }, 1500) // Réduire à 1.5s pour éviter le flash de l'état initial
        }, 800) // Attendre 800ms après le 100% avant de changer isUninstalling
        
        // ✅ Vérifier via le store de persistance pour confirmer
        if (window.electron?.games?.isGameInstalled) {
          const gameIdToCheck = game?.id || game?.gameId
          if (gameIdToCheck) {
            try {
              const installCheck = await window.electron.games.isGameInstalled(gameIdToCheck)
              if (installCheck && !installCheck.installed) {
              }
            } catch (checkError) {
              console.error('[GameDetails] Erreur lors de la vérification du store:', checkError)
            }
          }
        }

        // Vérifier uniquement ce jeu spécifique, pas besoin de scanner tous les jeux
        if (window.electron?.games?.isGameInstalled) {
          const gameIdToCheck = game?.id || game?.gameId
          if (gameIdToCheck) {
            // Vérifier après un court délai pour laisser le temps au store de se mettre à jour
            setTimeout(async () => {
              try {
                const finalCheck = await window.electron.games.isGameInstalled(gameIdToCheck)
                if (finalCheck && !finalCheck.installed) {
                  setIsInstalled(false)
                  setInstalledGame(null)
                }
              } catch (checkError) {
                console.error('[GameDetails] Erreur lors de la vérification finale:', checkError)
              }
            }, 500)
          }
        }
        
        
        // ✅ Vérification finale pour s'assurer que l'état est bien mis à jour
        // Attendre un peu pour laisser le temps au store de se mettre à jour
        setTimeout(async () => {
          if (window.electron?.games?.isGameInstalled) {
            const gameIdToCheck = game?.id || game?.gameId
            if (gameIdToCheck) {
              try {
                const finalCheck = await window.electron.games.isGameInstalled(gameIdToCheck)
                if (finalCheck && !finalCheck.installed) {
                  // S'assurer que l'état est bien à jour
                  setIsInstalled(false)
                  setInstalledGame(null)
                }
              } catch (finalCheckError) {
                console.error('[GameDetails] Erreur lors de la vérification finale:', finalCheckError)
              }
            }
          }
        }, 500)
        
      } else {
        const errorMsg = result?.error || result?.message || 'Erreur inconnue'
        console.error('[GameDetails] ❌ ÉCHEC DE LA DÉSINSTALLATION:')
        console.error('  - error:', errorMsg)
        console.error('  - result complet:', result)
        setUninstallError(errorMsg)
        setIsUninstalling(false)
      }
    } catch (error) {
      console.error('[GameDetails] ❌ EXCEPTION LORS DE LA DÉSINSTALLATION:')
      console.error('  - error:', error)
      console.error('  - message:', error?.message)
      console.error('  - stack:', error?.stack)
      setUninstallError(error?.message || 'Erreur inconnue')
      setIsUninstalling(false)
    }
  }, [installedGame, title, onNavigate, game])

  const handleCreateShortcut = useCallback(() => {
    if (installedGame && installedGame.exePath) {
      setShowShortcutModal(true)
    }
  }, [installedGame])

  const handleLaunch = useCallback(async () => {
    if (!installedGame || !installedGame.exePath) return

    // Vérifier si l'utilisateur est un invité
    if (currentUser?.isGuest) {
      setPendingAction('launch')
      setShowGuestWarning(true)
      return
    }

    try {
      if (window.electron?.games?.launchGame) {
        // Passer launcherId (ID SQLite) et gameName pour le tracking
        const sqliteGameId = installedGame.launcherId || gameId
        await window.electron.games.launchGame(installedGame.exePath, game.name, sqliteGameId)
      } else if (window.electron?.games?.launch) {
        await window.electron.games.launch(installedGame.exePath)
      }
    } catch (error) {
      console.error('[GameDetails] Erreur lors du lancement:', error)
      alert('Erreur lors du lancement: ' + (error.message || 'Erreur inconnue'))
    }
  }, [installedGame, currentUser, game, gameId])

  const handleOpenFolder = useCallback(async () => {
    if (installedGame && (installedGame.path || installedGame.installPath)) {
      try {
        const folderPath = installedGame.path || installedGame.installPath
        if (window.electron?.shell?.openPath) {
          await window.electron.shell.openPath(folderPath)
        }
      } catch (error) {
        console.error('[GameDetails] Erreur lors de l\'ouverture du dossier:', error)
        alert('Erreur lors de l\'ouverture du dossier: ' + (error.message || 'Erreur inconnue'))
      }
    }
  }, [installedGame])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f0f14] relative overflow-hidden">
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <Motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full blur-xl opacity-30" />
            <div className="relative w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-lg">Chargement du jeu...</p>
        </Motion.div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f0f14] relative overflow-hidden">
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <Motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="text-6xl mb-4"
          >
            🎮
          </Motion.div>
          <p className="text-gray-400 text-xl">Jeu non trouvé</p>
          <Motion.button
            onClick={() => onNavigate('catalog')}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="btn-modern btn-modern-primary flex items-center gap-2 mx-auto"
          >
            <FiArrowLeft />
            Retour au catalogue
          </Motion.button>
        </Motion.div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden relative bg-[#0f0f14]">
      {/* Background effects modernes */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Image de fond */}
      {!videoUrl && cachedCover && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f14]/95 via-[#0f0f14]/80 to-[#0f0f14] z-10" />
          <img
            src={cachedCover}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
            style={{ 
              filter: 'blur(8px) brightness(0.3)',
              transform: 'scale(1.1)',
              minWidth: '100vw',
              minHeight: '100vh',
              left: '-80px', // Décaler vers la gauche pour couvrir la sidebar
              width: 'calc(100vw + 80px)' // Étendre la largeur pour couvrir la sidebar
            }}
          />
        </div>
      )}

      {/* Contenu principal */}
      <div className="relative z-10 h-full overflow-y-auto scrollbar-simple">
        {/* Header avec bouton retour */}
        <div className="sticky top-0 z-20 bg-gradient-to-b from-[#0f0f14] to-transparent pb-4 pt-6 px-6">
          <Motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('catalog')}
            className="btn-modern btn-modern-secondary flex items-center gap-2"
          >
            <FiArrowLeft />
            Retour
          </Motion.button>
        </div>

        {/* Contenu scrollable */}
        <div className="container-simple px-6 pb-12 py-6">
          <div className="max-w-7xl mx-auto">
            {/* Header du jeu simple */}
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
                  <div className="flex items-center gap-3">
                    {game.category && (
                      <span className="text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-lg">{game.category}</span>
                    )}
                    <span className={`text-sm font-medium flex items-center gap-1.5 ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
                      {isOnline ? <FiWifi className="text-sm" /> : <FiWifiOff className="text-sm" />}
                      {isOnline ? 'En ligne' : 'Hors ligne'}
                    </span>
                    {game.views && (
                      <span className="text-sm text-gray-400">👁️ {game.views} vues</span>
                    )}
                  </div>
                </div>
                <Motion.button
                  onClick={handleToggleFavorite}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={`btn-modern btn-modern-sm p-2.5 ${
                    isFavorite
                      ? 'btn-modern-danger'
                      : 'btn-modern-ghost'
                  }`}
                >
                  <FiHeart className={isFavorite ? 'fill-current' : ''} />
                </Motion.button>
              </div>
            </Motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Colonne principale - Vidéo/Image */}
              <div className="lg:col-span-2 space-y-6">
                {/* Vidéo ou Image principale */}
                {finalVideoUrl ? (
                  <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative w-full rounded-xl overflow-hidden bg-black aspect-video"
                  >
                    <video
                      ref={videoRef}
                      src={finalVideoUrl}
                      controls
                      autoPlay
                      muted={videoMuted}
                      playsInline
                      loop
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('[GameDetails] ❌ Erreur chargement vidéo:', finalVideoUrl)
                        setShowVideo(false)
                      }}
                    />
                  </Motion.div>
                ) : cachedCover ? (
                  <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative w-full rounded-xl overflow-hidden aspect-video"
                  >
                    <img
                      src={cachedCover}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  </Motion.div>
                ) : null}

                {/* Description */}
                <Motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-[#1a1a20]/60 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-3">Description</h2>
                  <p className="text-gray-300 leading-relaxed text-sm">
                    {description}
                  </p>
                </Motion.div>

                {/* Configuration système */}
                <Motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-[#1a1a20]/60 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                >
                  <h2 className="text-xl font-bold text-white mb-4">Configuration requise</h2>
                  
                  {(() => {
                    // Utiliser directement system_requirements de Supabase
                    const supabaseRequirements = game?.system_requirements || game?.pc_requirements || game?.systemRequirements
                    
                    // Afficher les requirements de Supabase s'ils existent
                    if (supabaseRequirements) {
                      // Si c'est un string, le traiter comme minimum
                      if (typeof supabaseRequirements === 'string') {
                        return (
                          <div className="grid grid-cols-1 gap-6">
                            <div>
                              <h3 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                                Configuration requise
                              </h3>
                              <div 
                                className="text-gray-300 text-sm space-y-1"
                                dangerouslySetInnerHTML={{ 
                                  __html: supabaseRequirements
                                    .replace(/<br\s*\/?>/gi, '<br/>')
                                    .replace(/\n/g, '<br/>')
                                }}
                              />
                            </div>
                          </div>
                        )
                      }
                      
                      // Si c'est un objet avec minimum/recommended
                      if (typeof supabaseRequirements === 'object' && (supabaseRequirements.minimum || supabaseRequirements.recommended)) {
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Configuration minimale */}
                            {supabaseRequirements.minimum && (
                              <div>
                                <h3 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                                  Minimale
                                </h3>
                                <div 
                                  className="text-gray-300 text-sm space-y-1"
                                  dangerouslySetInnerHTML={{ 
                                    __html: supabaseRequirements.minimum
                                      .replace(/<br\s*\/?>/gi, '<br/>')
                                      .replace(/\n/g, '<br/>')
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* Configuration recommandée */}
                            {supabaseRequirements.recommended && (
                              <div>
                                <h3 className="text-emerald-400 font-semibold mb-3 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                  Recommandée
                                </h3>
                                <div 
                                  className="text-gray-300 text-sm space-y-1"
                                  dangerouslySetInnerHTML={{ 
                                    __html: supabaseRequirements.recommended
                                      .replace(/<br\s*\/?>/gi, '<br/>')
                                      .replace(/\n/g, '<br/>')
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        )
                      }
                    }
                    
                    // Fallback: Pas de configuration disponible
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-400 text-sm">Aucune configuration système disponible</p>
                      </div>
                    )
                  })()}
                </Motion.div>

                {/* Screenshots */}
                {game?.screenshots && game.screenshots.length > 0 && (
                  <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-[#1a1a20]/60 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                  >
                    <h2 className="text-xl font-bold text-white mb-4">Captures d'écran</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {game.screenshots.slice(0, 4).map((screenshot, index) => (
                        <div
                          key={index}
                          className="relative overflow-hidden rounded-lg cursor-pointer group border-2 border-white/10 hover:border-cyan-500 transition-all"
                          onClick={() => setSelectedImage(screenshot)}
                        >
                          <img
                            src={screenshot}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                          {/* Overlay au survol */}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="text-white text-xs bg-black/50 px-2 py-1 rounded">
                              Cliquer pour agrandir
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Motion.div>
                )}
              </div>

              {/* Sidebar - Actions */}
              <div className="space-y-4">
                {/* Carte principale d'action */}
                <Motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[#1a1a20]/80 backdrop-blur-sm border border-white/10 rounded-xl p-5"
                >
                  <h3 className="text-lg font-bold text-white mb-4">Téléchargement</h3>
                  <p className="text-sm text-gray-400 mb-4">Gérer l'installation</p>
                  
                  {isInstalled && installedGame?.exePath ? (
                    <div className="space-y-2">
                      {/* Bouton Lancer - Vert comme sur l'image */}
                      <button
                        onClick={handleLaunch}
                        className="btn-modern btn-modern-success btn-modern-full flex items-center justify-center gap-2"
                      >
                        <FiPlay />
                        Lancer
                      </button>
                      <button
                        onClick={handleOpenFolder}
                        className="btn-modern btn-modern-secondary btn-modern-sm btn-modern-full flex items-center justify-center gap-2"
                      >
                        <FiFolder />
                        Ouvrir le dossier
                      </button>
                      <button
                        onClick={handleCreateShortcut}
                        className="btn-modern btn-modern-secondary btn-modern-sm btn-modern-full flex items-center justify-center gap-2"
                      >
                        <FiLink2 />
                        Créer un raccourci
                      </button>
                      <button
                        onClick={handleUninstallClick}
                        disabled={downloading || isUninstalling}
                        className="btn-modern btn-modern-danger btn-modern-sm btn-modern-full flex items-center justify-center gap-2"
                      >
                        <FiTrash2 />
                        Désinstaller
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={handleDownload}
                        disabled={downloading || (currentDownload && (currentDownload.status === 'downloading' || currentDownload.status === 'extracting'))}
                        className="btn-modern btn-modern-success btn-modern-full flex items-center justify-center gap-2"
                      >
                        <FiDownload />
                        Télécharger
                      </button>
                      
                      {/* Affichage de la progression en temps réel */}
                      {downloading && downloadProgress > 0 && (
                        <div className="space-y-2 mt-3">
                          {/* Barre de progression */}
                          <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                downloadProgress >= 100 ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-gradient-to-r from-[#06b6d4] to-[#3b82f6]'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, downloadProgress))}%` }}
                            ></div>
                          </div>
                          
                          {/* Informations de progression */}
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>
                              {downloadProgress >= 100 ? 'Extraction en cours...' : `${downloadProgress.toFixed(1)}%`}
                            </span>
                            <span>
                              {downloadProgress < 100 && downloadSpeed > 0 && (
                                <>
                                  {(downloadSpeed / (1024 * 1024)).toFixed(1)} MB/s
                                  {downloadEta > 0 && ` • ${Math.round(downloadEta / 60)}min restantes`}
                                </>
                              )}
                              {downloadProgress >= 100 && (
                                <span className="text-purple-400">Extraction...</span>
                              )}
                            </span>
                          </div>
                          
                          {/* Taille téléchargée */}
                          {totalBytes > 0 && downloadedBytes > 0 && downloadProgress < 100 && (
                            <div className="text-xs text-gray-500 text-center">
                              {(downloadedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB / {(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                            </div>
                          )}
                          
                          {/* Message d'extraction */}
                          {downloadProgress >= 100 && (
                            <div className="text-xs text-purple-400 text-center">
                              Extraction et installation automatique en cours...
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* DEBUG: Log de l'état currentDownload */}
                      {(() => {
                        console.log('[GameDetails] 🔍 État currentDownload:', {
                          currentDownload: currentDownload,
                          downloading: downloading,
                          hasCurrentDownload: !!currentDownload,
                          status: currentDownload?.status,
                          shouldShowProgress: !!(currentDownload && (currentDownload.status === 'downloading' || currentDownload.status === 'extracting' || currentDownload.status === 'paused'))
                        })
                        return null
                      })()}
                      
                      {currentDownload && currentDownload.status === 'extracting' ? (
                        <div className="space-y-3">
                          {/* Barre de progression violette pour l'extraction */}
                          <div className="w-full h-10 bg-gray-700/50 rounded-lg overflow-hidden relative">
                            <div 
                              className="absolute inset-y-0 left-0 bg-purple-500 transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, Math.round(currentDownload.progress || 0)))}%` }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="relative flex items-center gap-2 text-white font-medium z-10">
                                <Motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <FiPackage className="text-lg" />
                                </Motion.div>
                                <span className="text-sm font-semibold">Extraction {Math.round(currentDownload.progress || 0)}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Bouton Arrêter */}
                          <button
                            onClick={() => {
                              if (window.electron?.download?.cancelDownload) {
                                window.electron.download.cancelDownload(currentDownload.id)
                              }
                              downloadManager.removeDownload(currentDownload.id)
                              setCurrentDownload(null)
                              setDownloading(false)
                            }}
                            className="btn-modern btn-modern-danger btn-modern-sm btn-modern-full flex items-center justify-center gap-2"
                          >
                            <FiX className="text-sm" />
                            Arrêter
                          </button>

                          {/* Section statistiques d'extraction */}
                          <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <h4 className="text-sm font-semibold text-white">Extraction en cours</h4>
                            </div>
                            <div className="space-y-2">
                              {/* Vitesse d'extraction */}
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Vitesse d'écriture</span>
                                <span className="text-sm font-medium text-purple-400">
                                  {(() => {
                                    const speed = currentDownload.extractionSpeed || currentDownload.speed || 0
                                    if (!speed || speed === 0) return '0 B/s'
                                    const k = 1024
                                    const sizes = ['B', 'KB', 'MB', 'GB']
                                    const i = Math.floor(Math.log(speed) / Math.log(k))
                                    const formatted = Math.round((speed / Math.pow(k, i)) * 100) / 100
                                    return formatted + ' ' + sizes[i] + '/s'
                                  })()}
                                </span>
                              </div>
                              {/* Temps restant */}
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Temps restant</span>
                                <span className="text-sm font-medium text-blue-400">
                                  {(() => {
                                    const eta = currentDownload.extractionEta || currentDownload.estimatedTime || currentDownload.eta || 0
                                    if (!eta || eta === Infinity || isNaN(eta) || eta < 0) return '--'
                                    if (eta < 60) return `${Math.round(eta)}s`
                                    const hours = Math.floor(eta / 3600)
                                    const minutes = Math.floor((eta % 3600) / 60)
                                    const secs = Math.round(eta % 60)
                                    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
                                    if (minutes > 0) return `${minutes}m ${secs}s`
                                    return `${secs}s`
                                  })()}
                                </span>
                              </div>
                              {/* Progression */}
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Progression</span>
                                <span className="text-sm font-medium text-white">
                                  {(() => {
                                    const extracted = currentDownload.extractedBytes || currentDownload.downloaded || 0
                                    const total = currentDownload.extractionTotal || currentDownload.total || 0
                                    if (total === 0) return '0 B / 0 B'
                                    const extractedMB = extracted / (1024 * 1024)
                                    const totalMB = total / (1024 * 1024)
                                    if (totalMB >= 1024) {
                                      return `${(extracted / (1024 * 1024 * 1024)).toFixed(2)} GB / ${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                    }
                                    return `${extractedMB.toFixed(2)} MB / ${totalMB.toFixed(2)} MB`
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : currentDownload && (currentDownload.status === 'downloading' || currentDownload.status === 'paused') && (() => {
                        console.log('[GameDetails] 🎯 Affichage des détails de téléchargement:', {
                          currentDownload: currentDownload,
                          status: currentDownload.status,
                          progress: currentDownload.progress,
                          speed: currentDownload.speed,
                          downloaded: currentDownload.downloaded,
                          total: currentDownload.total
                        })
                        
                        const progress = currentDownload.progress || 0
                        const progressPercent = Math.min(100, Math.max(0, Math.round(progress)))
                        const speed = currentDownload.speed || 0
                        const eta = currentDownload.estimatedTime || currentDownload.eta || 0
                        const downloaded = currentDownload.downloaded || 0
                        const total = currentDownload.total || 0
                        
                        // Format vitesse
                        const formatSpeed = (bytesPerSecond) => {
                          if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s'
                          const k = 1024
                          const sizes = ['B', 'KB', 'MB', 'GB']
                          const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
                          const formatted = Math.round((bytesPerSecond / Math.pow(k, i)) * 100) / 100
                          return formatted + ' ' + sizes[i] + '/s'
                        }
                        
                        // Format temps
                        const formatTime = (seconds) => {
                          if (!seconds || seconds === Infinity || isNaN(seconds) || seconds < 0) return '--'
                          if (seconds < 60) return `${Math.round(seconds)}s`
                          const hours = Math.floor(seconds / 3600)
                          const minutes = Math.floor((seconds % 3600) / 60)
                          const secs = Math.round(seconds % 60)
                          if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
                          if (minutes > 0) return `${minutes}m ${secs}s`
                          return `${secs}s`
                        }
                        
                        // Format progression
                        const formatProgress = () => {
                          if (total === 0) return '0 B / 0 B'
                          const downloadedMB = downloaded / (1024 * 1024)
                          const totalMB = total / (1024 * 1024)
                          if (totalMB >= 1024) {
                            return `${(downloaded / (1024 * 1024 * 1024)).toFixed(2)} GB / ${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`
                          }
                          return `${downloadedMB.toFixed(2)} MB / ${totalMB.toFixed(2)} MB`
                        }
                        
                        console.log('[GameDetails] 📊 Données formatées:', {
                          progressPercent,
                          speedFormatted: formatSpeed(speed),
                          etaFormatted: formatTime(eta),
                          progressFormatted: formatProgress()
                        })
                        
                        return (
                          <div className="space-y-3">
                            {/* Barre de progression verte */}
                            <div className="w-full h-10 bg-gray-700/50 rounded-lg overflow-hidden relative">
                              <div 
                                className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              ></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="relative flex items-center gap-2 text-white font-medium z-10">
                                  <Motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  >
                                    <FiDownload className="text-lg" />
                                  </Motion.div>
                                  <span className="text-sm font-semibold">{progressPercent}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Bouton Arrêter */}
                            <button
                              onClick={() => {
                                if (window.electron?.download?.cancelDownload) {
                                  window.electron.download.cancelDownload(currentDownload.id)
                                }
                                downloadManager.removeDownload(currentDownload.id)
                                setCurrentDownload(null)
                                setDownloading(false)
                              }}
                              className="btn-modern btn-modern-danger btn-modern-sm btn-modern-full flex items-center justify-center gap-2"
                            >
                              <FiX className="text-sm" />
                              Arrêter
                            </button>

                            {/* Section statistiques détaillées */}
                            <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <h4 className="text-sm font-semibold text-white">Progression du téléchargement</h4>
                              </div>
                              <div className="space-y-2">
                                {/* Vitesse */}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-400">Vitesse</span>
                                  <span className="text-sm font-medium text-green-400">{formatSpeed(speed)}</span>
                                </div>
                                {/* Temps restant */}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-400">Temps restant</span>
                                  <span className="text-sm font-medium text-blue-400">{formatTime(eta)}</span>
                                </div>
                                {/* Progression */}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-400">Progression</span>
                                  <span className="text-sm font-medium text-white">{formatProgress()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </Motion.div>

                {/* Informations */}
                <Motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-[#1a1a20]/80 backdrop-blur-sm border border-white/10 rounded-xl p-5"
                >
                  <h3 className="text-lg font-bold text-white mb-4">Informations</h3>
                  <div className="space-y-3 text-sm">
                    {game.developer && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Développeur</span>
                        <span className="text-white font-medium text-right">{game.developer}</span>
                      </div>
                    )}
                    {game.publisher && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Éditeur</span>
                        <span className="text-white font-medium text-right">{game.publisher}</span>
                      </div>
                    )}
                    {game.releaseDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Date de sortie</span>
                        <span className="text-white font-medium text-right">{game.releaseDate}</span>
                      </div>
                    )}
                    {game.steamId && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">ID Steam</span>
                        <span className="text-white font-medium text-right">{game.steamId}</span>
                      </div>
                    )}
                    {game.isMultiplayer && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Multijoueur</span>
                        <span className="text-green-400 font-medium">Oui</span>
                      </div>
                    )}
                    {game.genre && Array.isArray(game.genre) && (
                      <div className="flex justify-between items-start">
                        <span className="text-gray-400">Catégories</span>
                        <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                          {game.genre.slice(0, 3).map((g, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white/5 text-white rounded text-xs">
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de désinstallation */}
        <UninstallModal
          isOpen={showUninstallModal}
          onClose={() => {
            // Réinitialiser tous les états lors de la fermeture
            setShowUninstallModal(false)
            setUninstallError(null)
            setIsUninstalling(false)
            // Réinitialiser progress et step APRÈS un court délai pour éviter le flash
            setTimeout(() => {
              setUninstallProgress(0)
              setUninstallStep('')
            }, 100)
          }}
          gameName={title}
          onConfirm={handleUninstall}
          isUninstalling={isUninstalling}
          progress={uninstallProgress}
          currentStep={uninstallStep}
          error={uninstallError}
        />

      {/* Modal d'avertissement pour les invités */}
      <GuestWarningModal
        isOpen={showGuestWarning}
        onClose={() => {
          setShowGuestWarning(false)
          setPendingAction(null)
        }}
        onContinue={async () => {
          if (pendingAction === 'download') {
            // Pour les invités, vérifier s'ils sont gratuits et ouvrir Lockr
            if (!game) return

            const userStatus = currentUser || { isAdmin: false, isVip: false, isBoost: false }
            const isGratuit = !userStatus.isAdmin && !userStatus.isVip && !userStatus.isBoost
            
            // Pour les utilisateurs gratuits (y compris invités), utiliser le système à un seul lien Lockr
            if (isGratuit) {
              const gameId = game.id || game.gameId
              const gameName = game.title || game.name || title
              
              if (!gameId || !gameName) {
                console.error('[GameDetails] ❌ Informations du jeu manquantes (gameId ou gameName)')
                alert(`Impossible de lancer le jeu: informations manquantes.`)
                return
              }
              
              
              // Utiliser le système à un seul lien Lockr (ouvre dans une fenêtre Electron)
              try {
                if (window.electron?.lockr?.launchGameWithUniqueLink) {
                  const result = await window.electron.lockr.launchGameWithUniqueLink(gameId, gameName)
                  
                  if (result.success) {
              } else {
                    console.error('[GameDetails] ❌ Erreur lors de l\'ouverture de Lockr:', result.error)
                    alert(`Erreur lors de l'ouverture de Lockr: ${result.error || 'Erreur inconnue'}`)
                  }
                } else {
                  console.error('[GameDetails] ❌ Fonction launchGameWithUniqueLink non disponible')
                  alert('Fonction de lancement Lockr non disponible. Veuillez redémarrer le launcher.')
                }
              } catch (error) {
                console.error('[GameDetails] ❌ Erreur lors de l\'ouverture de Lockr:', error)
                alert(`Erreur: ${error.message || 'Impossible d\'ouvrir Lockr'}`)
              }
              return
            }

            // Pour les VIP/Admin/Boost, procéder au téléchargement normal
            if (downloading || currentDownload) return

            try {
              setDownloading(true)
              const folderResult = await window.electron.download.selectFolder()
              
              if (!folderResult.success || !folderResult.folderPath) {
                console.log('[GameDetails] ❌ Sélection de dossier annulée ou échouée')
                setDownloading(false)
                return
              }


              const downloadUrl = game.downloadUrl || game.download_url || game.lockrUrl || game.lockr_url
              if (!downloadUrl) {
                console.error('[GameDetails] ❌ Aucune URL de téléchargement disponible')
                alert('URL de téléchargement non disponible')
                setDownloading(false)
                return
              }

      // Si l'utilisateur a réclamé une clé gratuite, marquer lockrCompleted comme true
      const lockrCompleted = hasFreeKeyClaimed ? true : false
      
      const result = await window.electron.download.downloadGame(
        downloadUrl,
        folderResult.folderPath,
        {
          gameName: title,
          gameId: game.id || game.gameId,
          userStatus: userStatus,
          lockrCompleted: lockrCompleted // Permet de télécharger sans pub si clé réclamée
        }
      )
      
      // Si le téléchargement démarre avec succès et qu'une clé a été utilisée, la supprimer
      if (result && result.success && hasFreeKeyClaimed) {
        localStorage.removeItem('freeKeyClaimed')
        console.log('[GameDetails] 🎁 Clé gratuite utilisée, suppression de localStorage')
      }
              
              if (result && result.success) {
              } else {
                console.warn('[GameDetails] ⚠️ Résultat inattendu:', result)
                setDownloading(false)
              }
            } catch (error) {
              console.error('[GameDetails] ❌ Erreur lors du téléchargement:', error)
              const errorMessage = error?.message || 'Erreur inconnue lors du téléchargement'
              alert(`Erreur lors du téléchargement: ${errorMessage}`)
              setDownloading(false)
            }
          } else if (pendingAction === 'launch') {
            // Exécuter le lancement directement (sans vérification invité)
            if (installedGame && installedGame.exePath) {
              try {
                if (window.electron?.games?.launchGame) {
                  // Passer launcherId (ID SQLite) et gameName pour le tracking
                  const sqliteGameId = installedGame.launcherId || gameId
                  console.log('[GameDetails] 🚀 Lancement avec tracking:', { sqliteGameId, gameName: game.name })
                  await window.electron.games.launchGame(installedGame.exePath, game.name, sqliteGameId)
                } else if (window.electron?.games?.launch) {
                  await window.electron.games.launch(installedGame.exePath)
                }
              } catch (error) {
                console.error('[GameDetails] Erreur lors du lancement:', error)
                alert('Erreur lors du lancement: ' + (error.message || 'Erreur inconnue'))
              }
            }
          }
        }}
        action={pendingAction === 'download' ? 'télécharger' : 'lancer'}
      />
        
        <ShortcutModal
          isOpen={showShortcutModal}
          onClose={() => setShowShortcutModal(false)}
          gameName={title}
          exePath={installedGame?.exePath}
          onConfirm={() => {
          }}
        />

        <DeadLinkRewardModal
          isOpen={showDeadLinkRewardModal}
          onClose={() => {
            setShowDeadLinkRewardModal(false)
            setDeadLinkRewardGameName('')
            setDeadLinkRewardGameId(null)
          }}
          gameName={deadLinkRewardGameName}
          onClaimReward={async () => {
            try {
              // Récupérer l'utilisateur actuel pour obtenir userId et username
              const userId = currentUser?.id || currentUser?.userId || null
              const username = currentUser?.username || currentUser?.name || null

              // Appeler l'API de récompense
              const response = await fetch(`${BACKEND_URL}/api/rewards/claim-free-key`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  gameId: deadLinkRewardGameId,
                  gameName: deadLinkRewardGameName,
                  userId: userId,
                  username: username
                })
              })

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                if (errorData.alreadyClaimed) {
                  // L'utilisateur a déjà réclamé une clé pour ce jeu spécifique
                  throw new Error(`Vous avez déjà réclamé une clé gratuite pour "${deadLinkRewardGameName}". Une seule clé gratuite est autorisée par jeu.`)
                }
                throw new Error(`Erreur HTTP: ${response.status}`)
              }

              const result = await response.json()
              console.log('[GameDetails] ✅ Récompense réclamée:', result)
              
              // Stocker dans localStorage qu'une clé a été réclamée pour CE JEU SPÉCIFIQUE
              // Permet de suivre quels jeux ont déjà donné une clé
              try {
                const existingData = localStorage.getItem('freeKeysClaimed')
                let claimedGames = []
                
                if (existingData) {
                  const parsed = JSON.parse(existingData)
                  claimedGames = parsed.claimedGames || []
                }
                
                // Vérifier si ce jeu n'est pas déjà dans la liste
                const gameAlreadyClaimed = claimedGames.some(game => 
                  game.gameId === deadLinkRewardGameId || 
                  game.gameId === String(deadLinkRewardGameId) ||
                  (game.gameName && deadLinkRewardGameName && 
                   game.gameName.toLowerCase() === deadLinkRewardGameName.toLowerCase())
                )
                
                if (!gameAlreadyClaimed) {
                  // Ajouter ce jeu à la liste des jeux ayant donné une clé
                  claimedGames.push({
                    gameId: deadLinkRewardGameId,
                    gameName: deadLinkRewardGameName,
                    claimedAt: new Date().toISOString(),
                    userId: userId,
                    username: username
                  })
                  
                  const rewardData = {
                    claimedGames: claimedGames,
                    lastClaimedAt: new Date().toISOString()
                  }
                  localStorage.setItem('freeKeysClaimed', JSON.stringify(rewardData))
                  console.log('[GameDetails] 💾 Clé gratuite réclamée pour ce jeu sauvegardée dans localStorage')
                } else {
                  console.log('[GameDetails] ⚠️ Ce jeu a déjà donné une clé, pas de nouvelle sauvegarde nécessaire')
                }
              } catch (error) {
                console.error('[GameDetails] ❌ Erreur lors de la sauvegarde dans localStorage:', error)
              }
              
              return result
            } catch (error) {
              console.error('[GameDetails] ❌ Erreur lors de la réclamation de la récompense:', error)
              throw error
            }
          }}
        />

        {/* Modal d'image agrandie */}
        <AnimatePresence>
          {selectedImage && (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
              onClick={() => setSelectedImage(null)}
            >
              <Motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative max-w-[90vw] max-h-[90vh] bg-[#1a1a24] rounded-xl overflow-hidden border border-white/20 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Bouton fermer */}
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                >
                  <FiX className="text-xl" />
                </button>
                
                {/* Image */}
                <img
                  src={selectedImage}
                  alt="Capture d'écran agrandie"
                  className="w-full h-full object-contain"
                  style={{ maxWidth: '90vw', maxHeight: '90vh' }}
                />
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Popup de téléchargement */}
        <GameDownloadPopup
          isOpen={showDownloadPopup}
          onClose={() => setShowDownloadPopup(false)}
          onConfirm={handleConfirmDownload}
          game={game}
          downloading={downloading}
          progress={currentDownload?.progress || 0}
          downloadComplete={false}
        />
    </div>
  )
}

