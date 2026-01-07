import { useState, useEffect, useRef } from 'react'
import { Motion } from '../components/Motion'
import { GamesPagination } from '../components/GamesPagination'
import { FiUsers, FiPlus, FiX, FiLoader, FiCheck, FiAlertCircle, FiLink, FiTrash2, FiGrid, FiEdit2, FiDownload, FiArrowLeft, FiFilter, FiRefreshCw, FiPackage, FiWifi, FiWifiOff, FiBell, FiBellOff } from 'react-icons/fi'

// Composant pour gérer les vidéos avec fallback
function VideoPlayerWithFallback({ src, gameData }) {
  const [videoError, setVideoError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const [hasTriedAlternative, setHasTriedAlternative] = useState(false)
  const videoRef = useRef(null)
  const errorCountRef = useRef(0)
  
  useEffect(() => {
    setCurrentSrc(src)
    setVideoError(false)
    setHasTriedAlternative(false)
    errorCountRef.current = 0
  }, [src])
  
  const getAlternativeUrl = (url) => {
    if (!url) return null
    if (url.includes('.webm')) {
      return url.replace('.webm', '.mp4').replace('movie_max.webm', 'movie_max.mp4').replace('movie480.webm', 'movie480.mp4')
    }
    if (url.includes('.mp4')) {
      return url.replace('.mp4', '.webm').replace('movie_max.mp4', 'movie_max.webm').replace('movie480.mp4', 'movie480.webm')
    }
    return null
  }
  
  const handleError = (e) => {
    errorCountRef.current += 1
    if (hasTriedAlternative || errorCountRef.current > 2) {
      setVideoError(true)
      if (e.target) {
        e.target.style.display = 'none'
      }
      return
    }
    
    const altUrl = getAlternativeUrl(currentSrc)
    if (altUrl && !hasTriedAlternative) {
      setHasTriedAlternative(true)
      setCurrentSrc(altUrl)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.src = altUrl
          videoRef.current.load()
        }
      }, 100)
    } else {
      setVideoError(true)
      if (e.target) {
        e.target.style.display = 'none'
      }
    }
  }
  
  if (videoError || !currentSrc) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-black/40 border border-gray-700 shadow-lg p-4 text-center">
        <p className="text-gray-400 text-sm mb-2">Vidéo non disponible</p>
        {gameData?.header_image && (
          <img
            src={gameData.header_image}
            alt={gameData.name}
            className="w-full h-auto max-h-80 object-cover rounded-lg"
          />
        )}
      </div>
    )
  }
  
  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black/40 border border-gray-700 shadow-lg">
      <video
        ref={videoRef}
        src={currentSrc}
        controls
        className="w-full h-auto max-h-80 object-contain"
        onError={handleError}
        preload="metadata"
      />
    </div>
  )
}

export function AdminPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [steamUrl, setSteamUrl] = useState('')
  const [gameData, setGameData] = useState(null)
  const [loadingGame, setLoadingGame] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [games, setGames] = useState([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [editingLockrUrl, setEditingLockrUrl] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [lockrUrl, setLockrUrl] = useState('')
  const [activePage, setActivePage] = useState('overview')
  const [gameFilter, setGameFilter] = useState('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [itemsPerPage, setItemsPerPage] = useState(24)
  const [webhookDisabled, setWebhookDisabled] = useState(true) // État du webhook
  const gamesScrollRef = useRef(null)
  const savedScrollPosition = useRef(null)
  const [generatingLockers, setGeneratingLockers] = useState(false)
  const [lockerGenerationResult, setLockerGenerationResult] = useState(null)
  const [onlineStatus, setOnlineStatus] = useState({})

  useEffect(() => {
    if (window.electron?.github) {
    } else {
      console.warn('window.electron.github is not available!')
    }
    
    loadUsers()
    loadGames()
  }, [])

  useEffect(() => {
    if (savedScrollPosition.current !== null && gamesScrollRef.current && !loadingGames) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (gamesScrollRef.current) {
            gamesScrollRef.current.scrollTop = savedScrollPosition.current
            savedScrollPosition.current = null
          }
        })
      })
    }
  }, [games, loadingGames])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setUserError('')
      
      let usersList = []
      
      if (window.electron && window.electron.sqliteLibrary) {
        try {
          // Initialiser la base de données si nécessaire
          if (window.electron.sqliteLibrary.init) {
            await window.electron.sqliteLibrary.init()
          }
          
          if (window.electron.sqliteLibrary.getAllUsers) {
            const result = await window.electron.sqliteLibrary.getAllUsers()
            if (result.success && result.users) {
              usersList = result.users.map(user => ({
                id: user.id,
                username: user.username,
                avatar: user.avatarUrl || user.avatar,
                avatarUrl: user.avatarUrl,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt,
                isAdmin: user.isAdmin || false,
                isVip: user.isVip || false,
                isBoost: user.isBoost || false
              }))
            }
          } else {
            setUserError('La fonction getAllUsers n\'est pas disponible')
          }
        } catch (sqliteError) {
          console.error('[AdminPanel] Erreur SQLite:', sqliteError)
          setUserError('Erreur lors du chargement depuis SQLite: ' + sqliteError.message)
        }
      } else {
        setUserError('Les fonctions SQLite ne sont pas disponibles. Veuillez redémarrer l\'application.')
      }
      
      if (usersList.length > 0) {
        setUsers(usersList)
      }
    } catch (err) {
      console.error('Error loading users:', err)
      setUserError('Erreur lors du chargement des utilisateurs: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (discordId) => {
    const user = users.find(u => u.id === discordId)
    const username = user?.username || discordId
    
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${username} ?`)) {
      return
    }

    try {
      setLoading(true)
      if (window.electron && window.electron.sqliteLibrary && window.electron.sqliteLibrary.deleteUser) {
        const result = await window.electron.sqliteLibrary.deleteUser(discordId)
        if (result.success) {
          await loadUsers()
          setUserSuccess(`Utilisateur ${username} supprimé avec succès`)
          setTimeout(() => setUserSuccess(''), 3000)
        } else {
          throw new Error(result.error || 'Erreur lors de la suppression')
        }
      } else {
        throw new Error('Les fonctions SQLite ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error deleting user:', err)
      setUserError('Erreur lors de la suppression: ' + err.message)
      setTimeout(() => setUserError(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleUrlChange = (url) => {
    setSteamUrl(url)
    setError('')
    setSuccess('')
  }

  const handleFetchData = async () => {
    try {
      setLoadingGame(true)
      setError('')
      setSuccess('')
      setGameData(null)

      if (!steamUrl || !steamUrl.includes('steampowered.com')) {
        setError('Veuillez entrer une URL Steam valide')
        return
      }

      const appIdMatch = steamUrl.match(/app\/(\d+)/)
      if (!appIdMatch) {
        setError('Impossible d\'extraire l\'ID de l\'application depuis l\'URL')
        return
      }

      const appId = appIdMatch[1]

      if (window.electron && window.electron.steam && window.electron.steam.getGameData) {
        const data = await window.electron.steam.getGameData(appId)
        if (data && data.success) {
          setGameData(data.gameData)
          setSuccess('Données récupérées avec succès !')
        } else {
          // Afficher un message d'erreur plus détaillé
          const errorMessage = data?.error || data?.message || 'Erreur lors de la récupération des données'
          console.error('[AdminPanel] Erreur Steam:', data)
          setError(errorMessage)
        }
      } else {
        throw new Error('Les fonctions Steam ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error fetching game data:', err)
      setError(err.message || 'Erreur lors de la récupération des données')
    } finally {
      setLoadingGame(false)
    }
  }

  const handleAddGame = async () => {
    try {
      setError('')
      setSuccess('')
      
      if (!gameData) {
        setError('Veuillez d\'abord récupérer les données du jeu')
        return
      }

      if (window.electron && window.electron.games && window.electron.games.addGame) {
        const gameDataWithLockr = {
          ...gameData,
          lockrUrl: 'https://lockr.net/7dhjn5m8',
          lockr_url: 'https://lockr.net/7dhjn5m8',
          LockrUrl: 'https://lockr.net/7dhjn5m8'
        }
        const result = await window.electron.games.addGame(gameDataWithLockr)
        if (result && result.updated) {
          setSuccess('Jeu mis à jour avec succès !')
        } else {
          setSuccess('Jeu ajouté avec succès !')
        }
        setSteamUrl('')
        setGameData(null)
        setTimeout(() => {
          setSuccess('')
        }, 3000)
      } else {
        throw new Error('Les fonctions de gestion des jeux ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error adding game:', err)
      setError(err.message || 'Erreur lors de l\'ajout du jeu')
    }
  }

  const loadGames = async () => {
    try {
      setLoadingGames(true)
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const result = await window.electron.games.getGames(true)
        if (result && result.games) {
          setGames(result.games)
          // Initialiser le statut en ligne depuis les données existantes
          const statusMap = {}
          result.games.forEach(game => {
            statusMap[game.id] = game.isOnline !== false // Par défaut en ligne
          })
          setOnlineStatus(statusMap)
        }
      }
    } catch (err) {
      console.error('Error loading games:', err)
    } finally {
      setLoadingGames(false)
    }
  }

  const handleUpdateGameLink = async (gameId) => {
    try {
      if (!downloadUrl.trim()) {
        setError('Veuillez entrer un lien de téléchargement')
        return
      }

      if (window.electron && window.electron.games && window.electron.games.updateGame) {
        await window.electron.games.updateGame(gameId, { downloadUrl: downloadUrl.trim() })
        setEditingGame(null)
        setDownloadUrl('')
        await loadGames()
        setSuccess('Lien mis à jour avec succès !')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        throw new Error('Les fonctions de gestion des jeux ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error updating game link:', err)
      setError(err.message || 'Erreur lors de la mise à jour du lien')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleToggleOnlineStatus = async (gameId) => {
    try {
      const currentStatus = onlineStatus[gameId] || false
      const newStatus = !currentStatus
      
      if (window.electron && window.electron.games && window.electron.games.updateGame) {
        await window.electron.games.updateGame(gameId, { isOnline: newStatus })
        setOnlineStatus(prev => ({ ...prev, [gameId]: newStatus }))
        setSuccess(`Jeu ${newStatus ? 'mis en ligne' : 'mis hors ligne'} avec succès !`)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        throw new Error('Les fonctions de gestion des jeux ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error toggling online status:', err)
      setError(err.message || 'Erreur lors du changement de statut')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleUpdateLockrUrl = async (gameId) => {
    try {
      if (!lockrUrl.trim()) {
        setError('Veuillez entrer un lien Lockr')
        return
      }

      if (window.electron && window.electron.games && window.electron.games.updateGame) {
        await window.electron.games.updateGame(gameId, { 
          lockrUrl: lockrUrl.trim(),
          lockr_url: lockrUrl.trim(),
          LockrUrl: lockrUrl.trim()
        })
        setEditingLockrUrl(null)
        setLockrUrl('')
        await loadGames()
        setSuccess('Lien Lockr mis à jour avec succès !')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        throw new Error('Les fonctions de gestion des jeux ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error updating Lockr URL:', err)
      setError(err.message || 'Erreur lors de la mise à jour du lien Lockr')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleReupload = async (gameId, gameName, downloadUrl) => {
    try {
      if (!downloadUrl || downloadUrl.trim() === '') {
        setError('Ce jeu n\'a pas de lien de téléchargement')
        return
      }

      if (window.electron && window.electron.games && window.electron.games.updateGame) {
        await window.electron.games.updateGame(gameId, { downloadUrl: downloadUrl.trim() })
        setSuccess(`Reupload effectué pour ${gameName} !`)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        throw new Error('Les fonctions de gestion des jeux ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error reuploading game:', err)
      setError(err.message || 'Erreur lors du reupload')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce jeu ?')) {
      return
    }

    try {
      if (window.electron && window.electron.games && window.electron.games.deleteGame) {
        await window.electron.games.deleteGame(gameId)
        await loadGames()
        setSuccess('Jeu supprimé avec succès !')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        throw new Error('Les fonctions de gestion des jeux ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error deleting game:', err)
      setError(err.message || 'Erreur lors de la suppression')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleGenerateLockers = async () => {
    try {
      setGeneratingLockers(true)
      setLockerGenerationResult(null)
      setError('')

      const gamesWithoutLockr = games.filter(game => {
        const hasLockr = game.lockrUrl || game.lockr_url || game.LockrUrl
        return !hasLockr || (hasLockr && (!hasLockr.trim() || hasLockr.trim() === ''))
      })

      if (gamesWithoutLockr.length === 0) {
        setSuccess('Tous les jeux ont déjà un lien Lockr !')
        setTimeout(() => setSuccess(''), 3000)
        return
      }

      const results = []
      let successCount = 0
      let failCount = 0
      let skippedCount = 0

      for (const game of gamesWithoutLockr) {
        try {
          const defaultLockrUrl = 'https://lockr.net/7dhjn5m8'
          
          if (window.electron && window.electron.games && window.electron.games.updateGame) {
            await window.electron.games.updateGame(game.id, {
              lockrUrl: defaultLockrUrl,
              lockr_url: defaultLockrUrl,
              LockrUrl: defaultLockrUrl
            })
            results.push({
              gameId: game.id,
              gameName: game.name,
              success: true,
              skipped: false,
              lockerUrl: defaultLockrUrl
            })
            successCount++
          }
        } catch (err) {
          results.push({
            gameId: game.id,
            gameName: game.name,
            success: false,
            skipped: false,
            error: err.message
          })
          failCount++
        }
      }

      const allGames = games.map(game => {
        const result = results.find(r => r.gameId === game.id)
        if (result && result.success) {
          return {
            ...game,
            lockrUrl: result.lockerUrl,
            lockr_url: result.lockerUrl,
            LockrUrl: result.lockerUrl
          }
        }
        return game
      })

      setGames(allGames)
      setLockerGenerationResult({
        total: gamesWithoutLockr.length,
        successCount,
        failCount,
        skippedCount,
        results
      })

      setSuccess(`Génération terminée : ${successCount} succès, ${failCount} échecs`)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      console.error('[AdminPanel] Error generating lockers:', err)
      setError('Erreur lors de la génération : ' + err.message)
    } finally {
      setGeneratingLockers(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: FiGrid },
    { id: 'users', label: 'Utilisateurs', icon: FiUsers },
    { id: 'add-game', label: 'Ajouter un jeu', icon: FiPlus },
    { id: 'games', label: 'Jeux', icon: FiPackage },
  ]

  return (
    <div className="h-full overflow-y-auto scrollbar-simple bg-[#0f0f14]">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="max-w-[1800px] mx-auto px-8 py-8 relative z-10">
        {/* Header */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Panel Admin</h1>
          <p className="text-gray-400">Gérez les utilisateurs et les jeux de votre launcher</p>
        </Motion.div>

        {/* Tab Navigation - Sticky */}
        <div className="sticky top-0 z-30 bg-[#0f0f14]/80 backdrop-blur-xl border-b border-white/10 mb-8 -mx-8 px-8 pb-4">
          <div className="flex items-center gap-3">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activePage === tab.id
              return (
                <Motion.button
                  key={tab.id}
                  onClick={() => setActivePage(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="text-lg" />
                  <span>{tab.label}</span>
                </Motion.button>
              )
            })}
          </div>
        </div>

        {/* Messages globaux */}
        {(error || success || userError || userSuccess) && (
          <Motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 flex items-center gap-3 rounded-xl px-4 py-3 ${
              error || userError
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-emerald-500/10 border border-emerald-500/20'
            }`}
          >
            {error || userError ? (
              <>
                <FiAlertCircle className="text-red-400" />
                <p className="text-sm text-red-400">{error || userError}</p>
              </>
            ) : (
              <>
                <FiCheck className="text-emerald-400" />
                <p className="text-sm text-emerald-400">{success || userSuccess}</p>
              </>
            )}
          </Motion.div>
        )}

        {/* Page Content */}
        <div className="space-y-6">
          {activePage === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setActivePage('users')}
                className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-8 cursor-pointer hover:border-cyan-400/50 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-300 group"
              >
                <div className="flex items-center justify-center mb-6">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/30 group-hover:scale-110 transition-transform duration-300">
                    <FiUsers className="text-5xl text-cyan-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white text-center mb-2">Utilisateurs</h3>
                <p className="text-gray-400 text-center mb-6">Gérer les utilisateurs et leurs permissions</p>
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Total:</span>
                    <span className="text-white font-bold text-xl">{users.length}</span>
                  </div>
                </div>
              </Motion.div>

              <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setActivePage('add-game')}
                className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-8 cursor-pointer hover:border-emerald-400/50 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 group"
              >
                <div className="flex items-center justify-center mb-6">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-green-500/20 border border-emerald-400/30 group-hover:scale-110 transition-transform duration-300">
                    <FiPlus className="text-5xl text-emerald-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white text-center mb-2">Ajouter un jeu</h3>
                <p className="text-gray-400 text-center mb-6">Ajouter un nouveau jeu depuis Steam</p>
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-center">
                    <span className="text-sm text-gray-400">Cliquez pour commencer</span>
                  </div>
                </div>
              </Motion.div>

              <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setActivePage('games')}
                className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-8 cursor-pointer hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 group"
              >
                <div className="flex items-center justify-center mb-6">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 border border-blue-400/30 group-hover:scale-110 transition-transform duration-300">
                    <FiPackage className="text-5xl text-blue-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white text-center mb-2">Jeux</h3>
                <p className="text-gray-400 text-center mb-6">Gérer votre bibliothèque de jeux</p>
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Total:</span>
                    <span className="text-white font-bold text-xl">{games.length}</span>
                  </div>
                </div>
              </Motion.div>
            </div>
          )}

          {activePage === 'users' && (
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Utilisateurs</h2>
                <Motion.button
                  onClick={loadUsers}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 rounded-xl transition-colors flex items-center gap-2"
                >
                  <FiLoader className={loading ? 'animate-spin' : ''} />
                  Rafraîchir
                </Motion.button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <FiLoader className="animate-spin text-cyan-400 text-3xl" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">Aucun utilisateur trouvé</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map((user, index) => (
                    <Motion.div
                      key={user.id || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/60 to-gray-900/40 hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {user.avatarUrl || user.avatar ? (
                            <img src={user.avatarUrl || user.avatar} alt={user.username} className="h-full w-full rounded-xl object-cover" />
                          ) : (
                            <span className="text-xl font-bold text-cyan-400">
                              {user.username?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{user.username || 'Sans nom'}</p>
                          {user.lastLogin && (
                            <p className="text-xs text-gray-400 truncate">
                              Dernière connexion: {new Date(user.lastLogin).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        {user.isAdmin ? (
                          <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-400/20 to-yellow-500/20 border border-amber-400/30 text-amber-400 text-xs font-semibold">
                            Admin
                          </span>
                        ) : user.isVip ? (
                          <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border border-yellow-400/30 text-yellow-400 text-xs font-semibold">
                            VIP
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 text-xs font-medium">
                            Gratuit
                          </span>
                        )}
                        <Motion.button
                          onClick={() => handleDeleteUser(user.id)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Supprimer"
                        >
                          <FiTrash2 className="text-sm" />
                        </Motion.button>
                      </div>
                    </Motion.div>
                  ))}
                </div>
              )}
            </Motion.div>
          )}

          {activePage === 'add-game' && (
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Ajouter un jeu</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">URL Steam</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <FiLink className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={steamUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://store.steampowered.com/app/XXXXX"
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/10 bg-gray-900/50 text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all"
                      />
                    </div>
                    <Motion.button
                      onClick={handleFetchData}
                      disabled={loadingGame || !steamUrl}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingGame ? (
                        <FiLoader className="animate-spin" />
                      ) : (
                        'Récupérer'
                      )}
                    </Motion.button>
                  </div>
                </div>

                {gameData && (
                  <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/10 bg-gray-900/30 p-6 space-y-6"
                  >
                    {(gameData.movies || gameData.video) && (
                      <VideoPlayerWithFallback 
                        src={gameData.movies || gameData.video}
                        gameData={gameData}
                      />
                    )}
                    {gameData.header_image && !(gameData.movies || gameData.video) && (
                      <img
                        src={gameData.header_image}
                        alt={gameData.name}
                        className="w-full h-auto max-h-80 object-cover rounded-xl"
                      />
                    )}

                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">{gameData.name}</h3>
                      {gameData.short_description && (
                        <p className="text-gray-400">{gameData.short_description.substring(0, 200)}...</p>
                      )}
                    </div>

                    <Motion.button
                      onClick={handleAddGame}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <FiCheck />
                      Ajouter le jeu
                    </Motion.button>
                  </Motion.div>
                )}
              </div>
            </Motion.div>
          )}

          {activePage === 'games' && (
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Jeux</h2>
                <div className="flex items-center gap-3">
                  <input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Rechercher..."
                    className="px-4 py-2 rounded-xl border border-white/10 bg-gray-900/50 text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all"
                  />
                  <select
                    value={gameFilter}
                    onChange={(e) => setGameFilter(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-white/10 bg-gray-900/50 text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all"
                  >
                    <option value="all">Tous les jeux</option>
                    <option value="with-link">Avec lien</option>
                    <option value="without-link">Sans lien</option>
                    <option value="not-found">Non trouvés</option>
                    <option value="other-links">Liens non Buzz/Gofile</option>
                  </select>
                  <Motion.button
                    onClick={handleGenerateLockers}
                    disabled={generatingLockers}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <FiLoader className={generatingLockers ? 'animate-spin' : ''} />
                    Générer Lockr
                  </Motion.button>
                  <Motion.button
                    onClick={loadGames}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <FiLoader className={loadingGames ? 'animate-spin' : ''} />
                    Actualiser
                  </Motion.button>
                </div>
              </div>

              {lockerGenerationResult && (
                <Motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Résultat de la génération</h3>
                    <button
                      onClick={() => setLockerGenerationResult(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <FiX />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Total:</span>
                      <span className="ml-2 text-white font-medium">{lockerGenerationResult.total}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Succès:</span>
                      <span className="ml-2 text-emerald-400 font-medium">{lockerGenerationResult.successCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Échecs:</span>
                      <span className="ml-2 text-red-400 font-medium">{lockerGenerationResult.failCount}</span>
                    </div>
                  </div>
                </Motion.div>
              )}

              {loadingGames ? (
                <div className="flex items-center justify-center py-12">
                  <FiLoader className="animate-spin text-cyan-400 text-3xl" />
                </div>
              ) : games.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">Aucun jeu</p>
                </div>
              ) : (
                <GamesPagination
                  games={games}
                  searchFilter={searchFilter}
                  gameFilter={gameFilter}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  renderGame={(game, index) => (
                    <Motion.div
                      key={game.id || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (index % itemsPerPage) * 0.03 }}
                      className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/60 to-gray-900/40 hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 overflow-hidden"
                    >
                      {game.header_image && (
                        <img
                          src={game.header_image}
                          alt={game.name}
                          className="w-full h-40 object-cover"
                        />
                      )}
                      <div className="p-4">
                        <h3 className="text-lg font-bold text-white mb-2 truncate">{game.name}</h3>
                        
                        {editingGame === game.id ? (
                          <div className="space-y-3 mb-3">
                            <input
                              value={downloadUrl}
                              onChange={(e) => setDownloadUrl(e.target.value)}
                              placeholder="Lien de téléchargement"
                              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-gray-900/50 text-white text-sm focus:border-cyan-400/50 focus:outline-none"
                              onKeyPress={(e) => e.key === 'Enter' && handleUpdateGameLink(game.id)}
                            />
                            <div className="flex gap-2">
                              <Motion.button
                                onClick={() => handleUpdateGameLink(game.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium"
                              >
                                Enregistrer
                              </Motion.button>
                              <Motion.button
                                onClick={() => {
                                  setEditingGame(null)
                                  setDownloadUrl('')
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                              >
                                Annuler
                              </Motion.button>
                            </div>
                          </div>
                        ) : editingLockrUrl === game.id ? (
                          <div className="space-y-3 mb-3">
                            <input
                              value={lockrUrl}
                              onChange={(e) => setLockrUrl(e.target.value)}
                              placeholder="Lien Lockr"
                              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-gray-900/50 text-white text-sm focus:border-cyan-400/50 focus:outline-none"
                              onKeyPress={(e) => e.key === 'Enter' && handleUpdateLockrUrl(game.id)}
                            />
                            <div className="flex gap-2">
                              <Motion.button
                                onClick={() => handleUpdateLockrUrl(game.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium"
                              >
                                Enregistrer
                              </Motion.button>
                              <Motion.button
                                onClick={() => {
                                  setEditingLockrUrl(null)
                                  setLockrUrl('')
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                              >
                                Annuler
                              </Motion.button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 mb-3">
                            {game.downloadUrl && (
                              <div className="text-xs text-cyan-400 truncate flex items-center gap-1">
                                <FiDownload className="flex-shrink-0" />
                                <span className="truncate">{game.downloadUrl}</span>
                              </div>
                            )}
                            {(game.lockrUrl || game.lockr_url || game.LockrUrl) && (
                              <div className="text-xs text-purple-400 truncate flex items-center gap-1">
                                <FiLink className="flex-shrink-0" />
                                <span className="truncate">{game.lockrUrl || game.lockr_url || game.LockrUrl}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {editingGame !== game.id && editingLockrUrl !== game.id && (
                            <>
                              <Motion.button
                                onClick={() => {
                                  setEditingGame(game.id)
                                  setDownloadUrl(game.downloadUrl || '')
                                  setEditingLockrUrl(null)
                                  setLockrUrl('')
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="flex-1 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                              >
                                <FiEdit2 />
                                {game.downloadUrl ? 'Modifier' : 'Ajouter'}
                              </Motion.button>
                              <Motion.button
                                onClick={() => handleToggleOnlineStatus(game.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                                  onlineStatus[game.id] !== false
                                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border border-gray-500/30'
                                }`}
                              >
                                {onlineStatus[game.id] !== false ? <FiWifi /> : <FiWifiOff />}
                                {onlineStatus[game.id] !== false ? 'En ligne' : 'Hors ligne'}
                              </Motion.button>
                              {game.downloadUrl && (
                                <Motion.button
                                  onClick={() => handleReupload(game.id, game.name, game.downloadUrl)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                                >
                                  <FiRefreshCw />
                                  Reupload
                                </Motion.button>
                              )}
                              <Motion.button
                                onClick={() => handleDeleteGame(game.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                              >
                                <FiTrash2 />
                                Supprimer
                              </Motion.button>
                            </>
                          )}
                        </div>
                      </div>
                    </Motion.div>
                  )}
                />
              )}
            </Motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
