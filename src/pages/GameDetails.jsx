import { useState, useEffect } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiArrowLeft, FiDownload, FiStar, FiHeart, FiGrid, FiLoader, FiAlertCircle, FiPlay, FiTrash2, FiFolder } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'

export function GameDetails({ gameId, installedGames = [] }) {
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [installedGame, setInstalledGame] = useState(null) // { name, folder, exePath }
  const [isCheckingInstalled, setIsCheckingInstalled] = useState(false) // Flag pour éviter les appels multiples
  const [isUninstalling, setIsUninstalling] = useState(false) // Flag pour la désinstallation en cours

  // Mettre à jour installedGame quand installedGames change
  useEffect(() => {
    if (!game || !installedGames || installedGames.length === 0) {
      setInstalledGame(null)
      return
    }

    const gameName = game.name || game.title
    if (!gameName) return

    console.log('[GameDetails] 🔍 Mise à jour depuis installedGames prop:', installedGames.length, 'jeux')

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

    if (found && found.hasExecutable && found.executable) {
      const installedGameData = {
        name: found.name,
        folder: found.folder,
        exePath: found.executable
      }
      console.log('[GameDetails] ✅ Jeu installé trouvé depuis props:', installedGameData)
      setInstalledGame(installedGameData)
    } else {
      console.log('[GameDetails] ⚠️ Jeu non trouvé dans installedGames ou pas d\'exécutable')
      setInstalledGame(null)
    }
  }, [installedGames, game])

  useEffect(() => {
    loadGame()
    setIsFavorite(favoritesService.isFavorite(gameId))
    
    // Vérifier si le jeu est installé après le chargement
    // Attendre que le jeu soit chargé avant de vérifier
    const timer = setTimeout(() => {
      if (game) {
        checkInstalledGame()
      } else {
        // Si le jeu n'est pas encore chargé, attendre un peu plus
        const retryTimer = setTimeout(() => {
          checkInstalledGame()
        }, 1000)
        return () => clearTimeout(retryTimer)
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [gameId])

  // Écouter les événements de téléchargement (séparé pour éviter les re-créations)
  useEffect(() => {
    // Écouter les événements de téléchargement
    if (!window.electron || !window.electron.ipcRenderer) return
    
    const handleDownloadProgress = (event, data) => {
      console.log('[GameDetails] 📥 Événement download:progress reçu:', data)
      
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
          console.log('[GameDetails] ⚠️ Événement ignoré - nom de jeu différent:', {
            current: normalizedCurrent,
            download: normalizedDownload
          })
          return // Ignorer les événements pour d'autres jeux
        }
      }
      
      // data.progress est déjà un pourcentage (0-100), pas besoin de multiplier
      const progress = data.progress || 0
      console.log('[GameDetails] 📊 Progression mise à jour:', progress + '%', `(${data.received || 0} / ${data.total || 0} bytes)`)
      
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
        console.log('[GameDetails] Téléchargement terminé:', data.filePath)
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
        console.log('[GameDetails] Jeu extrait avec succès:', data)
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
        console.log('[GameDetails] ✅ Jeu installé avec succès:', data)
        setDownloading(false)
        setDownloadProgress(0)
        setError('')
        
        // Re-vérifier si le jeu est installé après l'installation
        // Utiliser directement le nom du jeu depuis l'événement
        const installedGameName = data.gameName || game?.name || game?.title
        if (installedGameName) {
          console.log('[GameDetails] 🔄 Re-vérification du jeu installé:', installedGameName)
          // Augmenter le délai pour laisser le temps au marqueur d'être créé et écrit
          setTimeout(async () => {
            console.log('[GameDetails] 🔄 Scan des jeux installés...')
            try {
              if (window.electron && window.electron.download && window.electron.download.scanInstalledGames) {
                const result = await window.electron.download.scanInstalledGames()
                console.log('[GameDetails] Résultat du scan après installation:', result)
                
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
                    console.log('[GameDetails] ✅ Jeu trouvé après installation:', found)
                    
                    // Utiliser l'exécutable stocké dans le marqueur si disponible
                    let exePath = null
                    if (found.executable && found.hasExecutable) {
                      exePath = found.executable
                      console.log('[GameDetails] Exécutable trouvé dans le marqueur:', exePath)
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
                      console.log('[GameDetails] 🎯 Mise à jour de installedGame:', installedGameData)
                      setInstalledGame(installedGameData)
                      console.log('[GameDetails] ✅ État mis à jour, le bouton devrait changer !')
                    }
                  } else {
                    console.log('[GameDetails] ⚠️ Jeu non trouvé dans le scan')
                  }
                }
              }
            } catch (err) {
              console.error('[GameDetails] Erreur lors de la vérification:', err)
            }
          }, 1500) // Délai de 1.5 secondes pour être sûr
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
        console.log('[GameDetails] 🔄 Extraction de', data.gameName, 'en cours...')
        // Ne pas mettre setDownloading(false) car on est toujours en cours
        // L'extraction fait partie du processus de téléchargement
        // Mettre à jour le message pour indiquer l'extraction
        setDownloadProgress(100) // Le téléchargement est à 100%, on passe à l'extraction
      }

      const handleExtractionProgress = (event, data) => {
        console.log('[GameDetails] 📦', data.fileCount, 'fichiers extraits pour', data.gameName)
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
      }
    }
  }, [game, downloading]) // Dépendre de game et downloading pour avoir accès aux valeurs à jour

  const checkInstalledGame = async () => {
    // Protection contre les appels multiples
    if (isCheckingInstalled) {
      console.log('[GameDetails] ⚠️ Vérification déjà en cours, ignoré')
      return
    }
    
    try {
      setIsCheckingInstalled(true)
      
      if (!game) {
        console.log('[GameDetails] checkInstalledGame: jeu non chargé')
        setIsCheckingInstalled(false)
        return // Attendre que le jeu soit chargé
      }
      
      const gameName = game.name || game.title
      if (!gameName) {
        console.log('[GameDetails] checkInstalledGame: pas de nom de jeu')
        setIsCheckingInstalled(false)
        return
      }

      console.log('[GameDetails] 🔍 Vérification si le jeu est installé:', gameName)

      // Scanner les jeux installés dans le dossier de téléchargement par défaut
      // Forcer un nouveau scan (invalider le cache) pour être sûr d'avoir les dernières données
      if (window.electron && window.electron.download && window.electron.download.scanInstalledGames) {
        // Invalider le cache côté main en passant un paramètre ou en forçant un nouveau scan
        console.log('[GameDetails] 🔍 Lancement du scan des jeux installés...')
        const result = await window.electron.download.scanInstalledGames()
        console.log('[GameDetails] Résultat du scan:', result)
        console.log('[GameDetails] Nombre de jeux trouvés:', result.games?.length || 0)
        
        if (result.games && result.games.length > 0) {
          console.log('[GameDetails] 📋 Liste complète des jeux installés:')
          result.games.forEach((g, i) => {
            console.log(`  ${i + 1}. "${g.name}" (dossier: ${g.folder}, exe: ${g.executableName || 'N/A'})`)
          })
        }
        
        if (result.success && result.games) {
          console.log('[GameDetails] Jeux installés trouvés:', result.games.map(g => ({ name: g.name, folder: g.folder, hasExe: g.hasExecutable })))
          
          // Comparaison flexible des noms (insensible à la casse, ignore les espaces)
          const normalizeName = (name) => {
            if (!name) return ''
            return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
          }
          const normalizedGameName = normalizeName(gameName)
          console.log('[GameDetails] Nom du jeu normalisé:', normalizedGameName)
          
          const found = result.games.find(g => {
            if (!g.name) return false
            const normalizedInstalledName = normalizeName(g.name)
            // Comparaison plus flexible : vérifier si les mots-clés correspondent
            const gameWords = normalizedGameName.split(' ').filter(w => w.length > 2)
            const installedWords = normalizedInstalledName.split(' ').filter(w => w.length > 2)
            
            // Si au moins 50% des mots correspondent, c'est probablement le même jeu
            const matchingWords = gameWords.filter(w => installedWords.includes(w))
            const matchRatio = gameWords.length > 0 ? matchingWords.length / gameWords.length : 0
            
            const exactMatch = normalizedInstalledName === normalizedGameName
            const containsMatch = normalizedInstalledName.includes(normalizedGameName) || normalizedGameName.includes(normalizedInstalledName)
            const wordMatch = matchRatio >= 0.5
            
            const match = exactMatch || containsMatch || wordMatch
            
            console.log('[GameDetails] Comparaison:', {
              installed: normalizedInstalledName,
              game: normalizedGameName,
              exactMatch,
              containsMatch,
              wordMatch,
              matchRatio: matchRatio.toFixed(2),
              finalMatch: match
            })
            return match
          })
          
          if (found) {
            console.log('[GameDetails] Jeu installé trouvé:', found)
            
            // Utiliser l'exécutable stocké dans le marqueur si disponible
            let exePath = null
            if (found.executable && found.hasExecutable) {
              exePath = found.executable
              console.log('[GameDetails] Exécutable trouvé dans le marqueur:', exePath)
            } else {
              // Sinon, chercher manuellement
              if (window.electron && window.electron.games && window.electron.games.findGameExe) {
                const exeResult = await window.electron.games.findGameExe(found.folder, gameName)
                console.log('[GameDetails] Résultat findGameExe:', exeResult)
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
              console.log('[GameDetails] ✅ Jeu installé configuré:', installedGameData)
              setInstalledGame(installedGameData)
              // Forcer un re-render en mettant à jour l'état
              console.log('[GameDetails] 🎯 État installedGame mis à jour, bouton devrait changer')
            } else {
              console.log('[GameDetails] ⚠️ Jeu trouvé mais pas de .exe')
              setInstalledGame(null)
            }
          } else {
            console.log('[GameDetails] ❌ Jeu non trouvé dans les jeux installés')
            setInstalledGame(null)
          }
        } else {
          console.log('[GameDetails] ⚠️ Scan échoué ou aucun jeu trouvé')
          setInstalledGame(null)
        }
      } else {
        console.log('[GameDetails] ⚠️ API scanInstalledGames non disponible')
        setInstalledGame(null)
      }
    } catch (err) {
      console.error('[GameDetails] Erreur lors de la vérification des jeux installés:', err)
      setInstalledGame(null)
    } finally {
      setIsCheckingInstalled(false)
    }
  }

  const handleLaunchGame = async () => {
    if (!installedGame || !installedGame.exePath) {
      alert('Impossible de trouver le fichier exécutable du jeu.')
      return
    }

    try {
      if (window.electron && window.electron.games && window.electron.games.launchGame) {
        await window.electron.games.launchGame(installedGame.exePath)
        console.log('[GameDetails] Jeu lancé:', installedGame.exePath)
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

  const loadGame = async () => {
    try {
      setLoading(true)
      setError('')
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const data = await window.electron.games.getGames()
        const foundGame = data.games?.find(g => g.id === gameId)
        if (foundGame) {
          console.log('[GameDetails] Game loaded:', foundGame)
          console.log('[GameDetails] systemRequirements:', foundGame.systemRequirements)
          console.log('[GameDetails] pc_requirements:', foundGame.pc_requirements)
          if (foundGame.pc_requirements) {
            console.log('[GameDetails] pc_requirements type:', typeof foundGame.pc_requirements)
            console.log('[GameDetails] pc_requirements keys:', Object.keys(foundGame.pc_requirements))
            console.log('[GameDetails] pc_requirements.minimum type:', typeof foundGame.pc_requirements.minimum)
            console.log('[GameDetails] pc_requirements.recommended type:', typeof foundGame.pc_requirements.recommended)
            console.log('[GameDetails] pc_requirements.minimum (first 100 chars):', 
              typeof foundGame.pc_requirements.minimum === 'string' 
                ? foundGame.pc_requirements.minimum.substring(0, 100) 
                : foundGame.pc_requirements.minimum)
            console.log('[GameDetails] pc_requirements.recommended (first 100 chars):', 
              typeof foundGame.pc_requirements.recommended === 'string' 
                ? foundGame.pc_requirements.recommended.substring(0, 100) 
                : foundGame.pc_requirements.recommended)
          } else {
            console.log('[GameDetails] NO pc_requirements found in game object!')
            console.log('[GameDetails] Available keys:', Object.keys(foundGame))
          }
          setGame(foundGame)
          // Vérifier si le jeu est installé après le chargement (une seule fois)
          setTimeout(() => {
            if (!isCheckingInstalled) {
              checkInstalledGame()
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

  if (error || !game) {
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
        className="flex items-center gap-2 text-muted hover:text-white transition-colors"
      >
        <FiArrowLeft className="text-lg" />
        <span>Retour</span>
      </Motion.button>

      {/* Section Hero avec vidéo/image */}
      <Motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/40 group"
      >
        {/* Vidéo/Image */}
        <div className="relative w-full h-[600px] overflow-hidden bg-gradient-to-br from-black/60 to-black/40">
          {/* Image en arrière-plan (toujours visible) */}
          {game.header_image && (
            <img
              src={game.header_image}
              alt={game.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          )}
          {/* Vidéo par-dessus l'image (si disponible) */}
          {videoSrc && (
            <video
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          )}
          <div className="hidden absolute inset-0 flex items-center justify-center bg-black/60">
            <FiGrid className="text-muted text-6xl" />
          </div>
          
          {/* Overlay gradient (seulement visible au hover) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Overlay hover avec informations mises en avant */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/85 to-black/70 rounded-2xl p-8 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 overflow-y-auto">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl">
              {game.name || 'Sans titre'}
            </h2>
            
            {game.short_description && (
              <p className="text-lg text-white/95 max-w-3xl leading-relaxed drop-shadow-lg">
                {game.short_description}
              </p>
            )}


            <div className="flex items-center gap-3 flex-wrap pt-2">
              {installedGame && installedGame.exePath ? (
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
                    onClick={async () => {
                      const gameName = installedGame.name
                      const confirm = window.confirm(
                        `Voulez-vous vraiment désinstaller ${gameName} ?\n\n` +
                        `Cette action est irréversible et supprimera tous les fichiers du jeu.\n\n` +
                        `Assurez-vous que le jeu n'est pas en cours d'exécution.`
                      )
                      if (!confirm) {
                        return
                      }
                      
                      setIsUninstalling(true)
                      
                      try {
                        if (window.electron && window.electron.games && window.electron.games.uninstallGame) {
                          const result = await window.electron.games.uninstallGame(gameName)
                          if (result.success) {
                            setInstalledGame(null)
                            setTimeout(() => {
                              checkInstalledGame()
                            }, 500)
                            alert(`${gameName} a été désinstallé avec succès.`)
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
              ) : game.downloadUrl ? (
                <Motion.button
                  onClick={async () => {
                    try {
                      setError('')
                      
                      let destinationPath = null
                      if (window.electron && window.electron.download && window.electron.download.selectFolder) {
                        const folderResult = await window.electron.download.selectFolder()
                        if (folderResult.canceled) {
                          console.log('[GameDetails] Sélection de dossier annulée')
                          return
                        }
                        if (folderResult.success && folderResult.folderPath) {
                          destinationPath = folderResult.folderPath
                          console.log('[GameDetails] Dossier sélectionné:', destinationPath)
                        }
                      }
                      
                      setDownloading(true)
                      setDownloadProgress(0)
                      
                      if (window.electron && window.electron.download && window.electron.download.downloadGame) {
                        try {
                          console.log('[GameDetails] Lancement du téléchargement avec destination:', destinationPath)
                          const gameName = game.name || game.title || 'Game'
                          const result = await window.electron.download.downloadGame(
                            game.downloadUrl, 
                            destinationPath,
                            { gameName: gameName }
                          )
                          console.log('[GameDetails] Téléchargement lancé:', result)
                        } catch (downloadError) {
                          console.error('[GameDetails] Erreur lors du téléchargement:', downloadError)
                          setError('Erreur: ' + (downloadError.message || 'Impossible de démarrer le téléchargement'))
                          setDownloading(false)
                          setDownloadProgress(0)
                          
                          const openInBrowser = window.confirm(
                            'Le téléchargement automatique a échoué.\n\n' +
                            'Voulez-vous ouvrir le lien dans votre navigateur pour télécharger manuellement ?'
                          )
                          if (openInBrowser) {
                            if (window.electron && window.electron.shell && window.electron.shell.openExternal) {
                              await window.electron.shell.openExternal(game.downloadUrl)
                            } else {
                              window.open(game.downloadUrl, '_blank', 'noopener,noreferrer')
                            }
                          }
                        }
                      } else {
                        window.open(game.downloadUrl, '_blank', 'noopener,noreferrer')
                        setDownloading(false)
                      }
                    } catch (err) {
                      setError('Erreur: ' + err.message)
                      setDownloading(false)
                      setDownloadProgress(0)
                    }
                  }}
                  disabled={downloading}
                  whileHover={!downloading ? { scale: 1.03, y: -3 } : {}}
                  whileTap={!downloading ? { scale: 0.97 } : {}}
                  className={`group relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-2xl transition-all duration-300 ${downloading ? 'opacity-75 cursor-wait' : ''}`}
                  style={{
                    boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                  <div className="relative flex items-center gap-2">
                    {downloading ? (
                      <>
                        <FiLoader className="text-lg animate-spin" />
                        <span>Téléchargement... {Math.round(downloadProgress)}%</span>
                      </>
                    ) : (
                      <>
                        <FiDownload className="text-lg" />
                        <span>Télécharger</span>
                      </>
                    )}
                  </div>
                </Motion.button>
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

      {/* Configurations système (section permanente) */}
      {game && (() => {
        // Debug: afficher toutes les clés du jeu
        console.log('[GameDetails] All game keys:', Object.keys(game))
        console.log('[GameDetails] Full game object:', JSON.stringify(game, null, 2))
        
        const requirements = game.pc_requirements || game.systemRequirements || game.system_requirements
        console.log('[GameDetails] Requirements found:', requirements)
        console.log('[GameDetails] Requirements type:', typeof requirements)
        console.log('[GameDetails] Requirements keys:', requirements ? Object.keys(requirements) : 'null')
        
        if (!requirements) {
          console.log('[GameDetails] No requirements found, showing placeholder')
          // Afficher un placeholder pour tester le rendu
          return (
            <Motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="space-y-6 mt-6"
            >
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <FiStar className="text-primary" />
                Configurations système
              </h2>
              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-surface-muted/80 to-surface-muted/40 backdrop-blur-sm p-6">
                <p className="text-white/60">Aucune configuration système disponible pour ce jeu.</p>
              </div>
            </Motion.section>
          )
        }
        
        const minimum = requirements.minimum || requirements.min
        const recommended = requirements.recommended || requirements.rec
        
        console.log('[GameDetails] Minimum:', minimum)
        console.log('[GameDetails] Recommended:', recommended)
        console.log('[GameDetails] Minimum type:', typeof minimum)
        console.log('[GameDetails] Recommended type:', typeof recommended)
        
        // Extraire le texte des requirements
        const getRequirementText = (req) => {
          if (!req) {
            console.log('[GameDetails] getRequirementText: req is null/undefined')
            return null
          }
          if (typeof req === 'string') {
            console.log('[GameDetails] getRequirementText: req is string, length:', req.length)
            return req
          }
          if (typeof req === 'object') {
            console.log('[GameDetails] getRequirementText: req is object, keys:', Object.keys(req))
            console.log('[GameDetails] getRequirementText: req object:', JSON.stringify(req, null, 2))
            
            // Essayer d'abord la propriété os qui contient souvent tout le texte
            if (req.os && typeof req.os === 'string' && req.os.trim().length > 0) {
              console.log('[GameDetails] getRequirementText: using req.os')
              return req.os
            }
            
            // Sinon, essayer les autres propriétés
            const text = req.processor || req.memory || req.graphics || req.storage || null
            if (text && typeof text === 'string' && text.trim().length > 0) {
              console.log('[GameDetails] getRequirementText: using other property')
              return text
            }
            
            // Si aucune propriété string n'existe, formater l'objet
            const parts = []
            if (req.os) parts.push(`OS: ${req.os}`)
            if (req.processor) parts.push(`Processeur: ${req.processor}`)
            if (req.memory) parts.push(`Mémoire: ${req.memory}`)
            if (req.graphics) parts.push(`Graphiques: ${req.graphics}`)
            if (req.storage) parts.push(`Espace disque: ${req.storage}`)
            
            if (parts.length > 0) {
              console.log('[GameDetails] getRequirementText: formatted from parts')
              return parts.join('\n')
            }
            
            console.log('[GameDetails] getRequirementText: no valid text found')
            return null
          }
          console.log('[GameDetails] getRequirementText: req type not handled:', typeof req)
          return null
        }
        
        // Formater le texte pour améliorer la lisibilité
        const formatRequirementText = (text) => {
          if (!text) return ''
          
          // Nettoyer le HTML si c'est une chaîne HTML
          let cleanText = text
          if (typeof text === 'string') {
            // Supprimer les balises HTML
            cleanText = cleanText.replace(/<[^>]*>/g, '')
            // Remplacer les entités HTML courantes
            cleanText = cleanText.replace(/&nbsp;/g, ' ')
            cleanText = cleanText.replace(/&amp;/g, '&')
            cleanText = cleanText.replace(/&lt;/g, '<')
            cleanText = cleanText.replace(/&gt;/g, '>')
            cleanText = cleanText.replace(/&quot;/g, '"')
            cleanText = cleanText.replace(/&#39;/g, "'")
            // Nettoyer les espaces multiples
            cleanText = cleanText.replace(/\s+/g, ' ')
          }
          
          // Remplacer les labels pour améliorer la lisibilité
          return cleanText
            .replace(/\*:/g, 'OS:')
            .replace(/Processeur\s*:/g, '\n\nProcesseur:')
            .replace(/Mémoire\s*vive\s*:/g, '\nMémoire:')
            .replace(/Graphiques\s*:/g, '\nGraphiques:')
            .replace(/DirectX\s*:/g, '\nDirectX:')
            .replace(/Espace\s*disque\s*:/g, '\nEspace disque:')
            .replace(/Notes\s*supplémentaires\s*:/g, '\n\nNotes supplémentaires:')
            .replace(/Système d'exploitation\s*:/g, '\nSystème d\'exploitation:')
            .replace(/Système d'exploitation et processeur\s*:/g, 'Système d\'exploitation et processeur:')
            .trim()
        }
        
        const minText = getRequirementText(minimum)
        const recText = getRequirementText(recommended)
        
        console.log('[GameDetails] MinText result:', minText ? minText.substring(0, 50) + '...' : 'null')
        console.log('[GameDetails] RecText result:', recText ? recText.substring(0, 50) + '...' : 'null')
        
        if (!minText && !recText) {
          console.log('[GameDetails] No text extracted, showing placeholder')
          return (
            <Motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="space-y-6 mt-6"
            >
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <FiStar className="text-primary" />
                Configurations système
              </h2>
              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-surface-muted/80 to-surface-muted/40 backdrop-blur-sm p-6">
                <p className="text-white/60">Les configurations système ne sont pas disponibles dans un format lisible.</p>
              </div>
            </Motion.section>
          )
        }
        
        console.log('[GameDetails] Rendering requirements section')
        
        return (
          <Motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
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
                  transition={{ delay: 0.5, duration: 0.5 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="group relative rounded-3xl border border-primary/20 bg-gradient-to-br from-surface-muted/90 via-surface-muted/60 to-surface-muted/40 backdrop-blur-xl p-8 space-y-6 shadow-2xl hover:shadow-primary/20 transition-all duration-500 overflow-hidden"
                  style={{
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.1) inset',
                  }}
                >
                  {/* Glow effects */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -z-10 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl -z-10" />
                  
                  {/* Border glow */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                  
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary/30 to-purple-500/20 border border-primary/40 shadow-lg">
                      <FiStar className="text-primary text-2xl drop-shadow-lg" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      <span className="bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent">
                        Configuration minimale
                      </span>
                    </h3>
                  </div>
                  
                  {/* Content */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent rounded-xl -m-2" />
                    <div className="relative text-sm text-white/95 leading-relaxed whitespace-pre-line font-medium space-y-2">
                      {formatRequirementText(minText).split('\n').map((line, idx) => (
                        <div key={idx} className={line.trim() ? 'pl-4 border-l-2 border-primary/30 hover:border-primary/60 transition-colors' : ''}>
                          {line.trim() || '\u00A0'}
                        </div>
                      ))}
                    </div>
                  </div>
                </Motion.div>
              )}
              
              {recText && (
                <Motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="group relative rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-surface-muted/90 via-surface-muted/60 to-surface-muted/40 backdrop-blur-xl p-8 space-y-6 shadow-2xl hover:shadow-yellow-400/20 transition-all duration-500 overflow-hidden"
                  style={{
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(234, 179, 8, 0.1) inset',
                  }}
                >
                  {/* Glow effects */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/20 rounded-full blur-3xl -z-10 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl -z-10" />
                  
                  {/* Border glow */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400/0 via-yellow-400/10 to-yellow-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                  
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-400/30 to-amber-500/20 border border-yellow-400/40 shadow-lg">
                      <FiStar className="text-yellow-400 text-2xl fill-current drop-shadow-lg" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      <span className="bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent">
                        Configuration recommandée
                      </span>
                    </h3>
                  </div>
                  
                  {/* Content */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-yellow-400/5 to-transparent rounded-xl -m-2" />
                    <div className="relative text-sm text-white/95 leading-relaxed whitespace-pre-line font-medium space-y-2">
                      {formatRequirementText(recText).split('\n').map((line, idx) => (
                        <div key={idx} className={line.trim() ? 'pl-4 border-l-2 border-yellow-400/30 hover:border-yellow-400/60 transition-colors' : ''}>
                          {line.trim() || '\u00A0'}
                        </div>
                      ))}
                    </div>
                  </div>
                </Motion.div>
              )}
            </div>
          </Motion.section>
        )
      })()}
    </div>
  )
}

