import { useState, useEffect, useRef } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiUsers, FiPlus, FiX, FiLoader, FiCheck, FiAlertCircle, FiLink, FiTrash2, FiGrid, FiEdit2, FiDownload, FiArrowLeft, FiFilter } from 'react-icons/fi'

// Composant pour gérer les vidéos avec fallback
function VideoPlayerWithFallback({ src, gameData }) {
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
  
  // Si l'URL est webm et échoue, essayer mp4
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
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-black/40 border border-border/30 shadow-lg p-4 text-center">
        <p className="text-muted text-sm mb-2">Vidéo non disponible</p>
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
    <div className="relative w-full rounded-xl overflow-hidden bg-black/40 border border-border/30 shadow-lg">
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
  const [showAddGame, setShowAddGame] = useState(false)
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
  const [downloadUrl, setDownloadUrl] = useState('') // Peut contenir plusieurs URLs séparées par des virgules ou des retours à la ligne
  const [activeSection, setActiveSection] = useState(null) // null, 'users', 'add-game', 'games'
  const [gameFilter, setGameFilter] = useState('all') // 'all', 'with-link', 'without-link', 'not-found'
  const [searchFilter, setSearchFilter] = useState('') // Filtre de recherche par lien
  const gamesScrollRef = useRef(null) // Ref pour la zone scrollable des jeux
  const savedScrollPosition = useRef(null) // Position de scroll à restaurer

  // Charger les utilisateurs
  useEffect(() => {
    // Vérifier que les fonctions Electron sont disponibles
    console.log('AdminPanel mounted, checking Electron availability...')
    console.log('window.electron:', window.electron)
    console.log('window.electron?.github:', window.electron?.github)
    if (window.electron?.github) {
      console.log('Available github methods:', Object.keys(window.electron.github))
      console.log('deleteUser type:', typeof window.electron.github.deleteUser)
    } else {
      console.warn('window.electron.github is not available!')
    }
    
    loadUsers()
    loadGames()
  }, [])

  // Restaurer la position de scroll après le rechargement des jeux
  useEffect(() => {
    if (savedScrollPosition.current !== null && gamesScrollRef.current && !loadingGames) {
      // Utiliser requestAnimationFrame pour s'assurer que le DOM est mis à jour
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (gamesScrollRef.current) {
            gamesScrollRef.current.scrollTop = savedScrollPosition.current
            savedScrollPosition.current = null // Réinitialiser après restauration
          }
        })
      })
    }
  }, [games, loadingGames])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setUserError('')
      if (window.electron && window.electron.github && window.electron.github.getUsers) {
        const data = await window.electron.github.getUsers()
        let usersList = data.users || []
        
        // S'assurer que l'utilisateur admin a bien le statut admin
        const ADMIN_EMAIL = 'lilianlesieur82@gmail.com'
        const adminUser = usersList.find(user => user.email === ADMIN_EMAIL)
        
        console.log('Admin user found:', adminUser ? { email: adminUser.email, isAdmin: adminUser.isAdmin } : 'not found')
        
        if (adminUser) {
          // Toujours s'assurer que le statut admin est défini
          if (!adminUser.isAdmin) {
            console.log('Admin status missing, updating for:', ADMIN_EMAIL)
            try {
              if (window.electron && window.electron.github && window.electron.github.updateUser) {
                await window.electron.github.updateUser(ADMIN_EMAIL, { isAdmin: true })
                // Recharger les utilisateurs après la mise à jour
                const updatedData = await window.electron.github.getUsers()
                usersList = updatedData.users || []
                console.log('Admin status updated on GitHub')
              }
            } catch (err) {
              console.error('Error updating admin status:', err)
              // Mettre à jour localement quand même
              adminUser.isAdmin = true
            }
          } else {
            console.log('Admin status already set for:', ADMIN_EMAIL)
          }
        } else {
          console.log('Admin user not found in users list')
        }
        
        // S'assurer que le badge admin s'affiche même si la mise à jour GitHub a échoué
        usersList = usersList.map(user => {
          if (user.email === ADMIN_EMAIL && !user.isAdmin) {
            console.log('Forcing admin status locally for:', ADMIN_EMAIL)
            return { ...user, isAdmin: true }
          }
          return user
        })
        
        setUsers(usersList)
      } else {
        setUserError('Les fonctions GitHub ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error loading users:', err)
      setUserError('Erreur lors du chargement des utilisateurs: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Supprimer un utilisateur
  const handleDeleteUser = async (email) => {
    console.log('handleDeleteUser called with email:', email)
    
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${email} ?`)) {
      console.log('User cancelled deletion')
      return
    }

    try {
      setUserError('')
      setUserSuccess('')
      setLoading(true)
      
      console.log('Starting deletion process for:', email)
      console.log('window.electron:', window.electron)
      console.log('window.electron?.github:', window.electron?.github)
      console.log('window.electron?.github?.deleteUser:', window.electron?.github?.deleteUser)
      console.log('Available github methods:', window.electron?.github ? Object.keys(window.electron.github) : 'N/A')
      
      if (!window.electron) {
        console.error('window.electron is not available')
        throw new Error('Electron n\'est pas disponible')
      }
      
      if (!window.electron.github) {
        console.error('window.electron.github is not available')
        throw new Error('Les fonctions GitHub ne sont pas disponibles')
      }
      
      if (typeof window.electron.github.deleteUser !== 'function') {
        console.error('deleteUser is not a function. Available methods:', Object.keys(window.electron.github))
        throw new Error('La fonction deleteUser n\'est pas disponible. Veuillez redémarrer l\'application Electron.')
      }
      
      console.log('Calling deleteUser...')
      const result = await window.electron.github.deleteUser(email)
      console.log('Delete result:', result)
      
      if (result === true || result === undefined) {
        console.log('Deletion successful, reloading users...')
        setUserSuccess('Utilisateur supprimé avec succès !')
        // Recharger la liste des utilisateurs
        await loadUsers()
        // Effacer le message de succès après 3 secondes
        setTimeout(() => {
          setUserSuccess('')
        }, 3000)
      } else {
        throw new Error('La suppression a échoué')
      }
    } catch (err) {
      console.error('Error deleting user:', err)
      setUserError(err.message || 'Erreur lors de la suppression de l\'utilisateur')
    } finally {
      setLoading(false)
    }
  }

  // Extraire l'ID Steam depuis l'URL
  const extractSteamId = (url) => {
    const match = url.match(/store\.steampowered\.com\/app\/(\d+)/)
    return match ? match[1] : null
  }

  // Récupérer les données Steam
  const fetchSteamData = async (steamId) => {
    try {
      setLoadingGame(true)
      setError('')
      
      if (window.electron && window.electron.steam && window.electron.steam.getGameData) {
        const data = await window.electron.steam.getGameData(steamId)
        setGameData(data)
      } else {
        throw new Error('Les fonctions Steam ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error fetching Steam data:', err)
      setError(err.message || 'Erreur lors de la récupération des données Steam')
      setGameData(null)
    } finally {
      setLoadingGame(false)
    }
  }

  // Ajouter le jeu
  const handleAddGame = async () => {
    try {
      setError('')
      setSuccess('')
      
      if (!gameData) {
        setError('Veuillez d\'abord récupérer les données du jeu')
        return
      }

      // Log pour debug
      console.log('[AdminPanel] handleAddGame - gameData:', gameData)
      console.log('[AdminPanel] handleAddGame - has pc_requirements:', !!gameData.pc_requirements)
      console.log('[AdminPanel] handleAddGame - pc_requirements keys:', gameData.pc_requirements ? Object.keys(gameData.pc_requirements) : null)
      if (gameData.pc_requirements) {
        console.log('[AdminPanel] handleAddGame - pc_requirements structure:', JSON.stringify(gameData.pc_requirements, null, 2))
      }

      if (window.electron && window.electron.games && window.electron.games.addGame) {
        const result = await window.electron.games.addGame(gameData)
        if (result && result.updated) {
          setSuccess('Jeu mis à jour avec succès !')
        } else {
          setSuccess('Jeu ajouté avec succès !')
        }
        setSteamUrl('')
        setGameData(null)
        setShowAddGame(false)
        // Effacer le message de succès après 3 secondes
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

  // Gérer le changement d'URL
  const handleUrlChange = (url) => {
    setSteamUrl(url)
    setGameData(null)
    setError('')
    setSuccess('')
  }

  // Récupérer les données depuis l'URL
  const handleFetchData = () => {
    const steamId = extractSteamId(steamUrl)
    if (!steamId) {
      setError('URL Steam invalide. Format attendu: https://store.steampowered.com/app/XXXXX')
      return
    }
    fetchSteamData(steamId)
  }

  // Charger les jeux
  const loadGames = async () => {
    try {
      setLoadingGames(true)
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const data = await window.electron.games.getGames()
        setGames(data.games || [])
      }
    } catch (err) {
      console.error('Error loading games:', err)
    } finally {
      setLoadingGames(false)
    }
  }

  // Supprimer un jeu
  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce jeu ?')) {
      return
    }
    try {
      // Sauvegarder la position de scroll avant la suppression
      if (gamesScrollRef.current) {
        savedScrollPosition.current = gamesScrollRef.current.scrollTop
      }
      
      if (window.electron && window.electron.games && window.electron.games.deleteGame) {
        await window.electron.games.deleteGame(gameId)
        setSuccess('Jeu supprimé avec succès !')
        await loadGames()
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      setError('Erreur lors de la suppression du jeu: ' + err.message)
      savedScrollPosition.current = null // Annuler la restauration en cas d'erreur
    }
  }

  // Mettre à jour le lien de téléchargement (peut contenir plusieurs URLs)
  const handleUpdateDownloadUrl = async (gameId, url) => {
    try {
      // Sauvegarder la position de scroll avant la mise à jour
      if (gamesScrollRef.current) {
        savedScrollPosition.current = gamesScrollRef.current.scrollTop
      }
      
      // Nettoyer l'URL : supprimer les espaces et séparer par virgules ou retours à la ligne
      const cleanedUrl = url.trim()
      
      if (window.electron && window.electron.games && window.electron.games.updateGame) {
        // Retirer la catégorie "Pas trouvé" si un lien de téléchargement est ajouté
        await window.electron.games.updateGame(gameId, { 
          downloadUrl: cleanedUrl,
          category: null // Retirer la catégorie "Pas trouvé" quand un lien est ajouté
        })
        const urlCount = cleanedUrl.split(/[,\n]/).filter(u => u.trim()).length
        setSuccess(urlCount > 1 ? `${urlCount} liens de téléchargement mis à jour !` : 'Lien de téléchargement mis à jour !')
        await loadGames()
        setEditingGame(null)
        setDownloadUrl('')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour: ' + err.message)
      savedScrollPosition.current = null // Annuler la restauration en cas d'erreur
    }
  }

  // Marquer un jeu comme "Pas trouvé"
  const handleMarkAsNotFound = async (gameId) => {
    try {
      console.log('[AdminPanel] handleMarkAsNotFound called for gameId:', gameId)
      
      // Sauvegarder la position de scroll avant la mise à jour
      if (gamesScrollRef.current) {
        savedScrollPosition.current = gamesScrollRef.current.scrollTop
      }
      
      if (window.electron && window.electron.games && window.electron.games.updateGame) {
        console.log('[AdminPanel] Calling updateGame with category:', 'Pas trouvé')
        const result = await window.electron.games.updateGame(gameId, { category: 'Pas trouvé' })
        console.log('[AdminPanel] Update result:', result)
        setSuccess('Jeu marqué comme "Pas trouvé" !')
        await loadGames()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        console.error('[AdminPanel] window.electron.games.updateGame not available')
        setError('Fonction de mise à jour non disponible')
      }
    } catch (err) {
      console.error('[AdminPanel] Error in handleMarkAsNotFound:', err)
      setError('Erreur lors de la mise à jour: ' + err.message)
      savedScrollPosition.current = null
    }
  }

  // Si une section est active, afficher uniquement cette section en plein écran
  if (activeSection) {
    return (
      <div className="h-full flex flex-col">
        {/* Bouton retour */}
        <Motion.button
          onClick={() => setActiveSection(null)}
          whileHover={{ scale: 1.05, x: -4 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 text-muted hover:text-white transition-colors mb-6"
        >
          <FiArrowLeft className="text-lg" />
          <span>Retour</span>
        </Motion.button>

        {/* Section active en plein écran */}
        {activeSection === 'users' && (
          <Motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="surface-card rounded-2xl border border-border/50 p-6 flex-1 flex flex-col min-h-0"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Utilisateurs</h2>
              <button 
                onClick={loadUsers} 
                className="btn btn-secondary flex items-center gap-2"
              >
                <FiLoader className={loading ? 'animate-spin' : ''} />
                Rafraîchir
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <FiLoader className="animate-spin text-primary text-2xl" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted">Aucun utilisateur trouvé</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map((user, index) => (
                    <Motion.div
                      key={user.id || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-gradient-to-r from-surface-muted/60 to-surface-muted/40 hover:border-primary/30 hover:from-surface-muted/80 hover:to-surface-muted/60 transition-all duration-300 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.username} className="h-full w-full rounded-lg object-cover" />
                          ) : (
                            <span className="text-lg font-bold text-primary">
                              {user.username?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.username || 'Sans nom'}</p>
                          <p className="text-xs text-muted">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.isAdmin ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2.5 py-0.5 text-xs font-semibold text-zinc-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-300"></span>
                            Admin
                          </span>
                        ) : user.isVip ? (
                          <span className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-xs font-semibold text-zinc-900">
                            VIP
                          </span>
                        ) : user.isBoost ? (
                          <span className="rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-2 py-0.5 text-xs font-semibold text-white">
                            BOOST
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface-muted border border-border/50 px-2 py-0.5 text-xs font-medium text-muted">
                            Gratuit
                          </span>
                        )}
                        <Motion.button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteUser(user.email)
                          }}
                          disabled={loading}
                          whileHover={{ scale: loading ? 1 : 1.05 }}
                          whileTap={{ scale: loading ? 1 : 0.95 }}
                          className={`ml-2 p-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors ${
                            loading ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title="Supprimer l'utilisateur"
                        >
                          {loading ? (
                            <FiLoader className="text-sm animate-spin" />
                          ) : (
                            <FiTrash2 className="text-sm" />
                          )}
                        </Motion.button>
                      </div>
                    </Motion.div>
                  ))}
                </div>
              )}
            </div>
          </Motion.section>
        )}

        {activeSection === 'add-game' && (
          <Motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="surface-card rounded-2xl border border-border/50 p-6 flex-1 flex flex-col min-h-0"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Ajouter un jeu</h2>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted">
                    URL Steam
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FiLink className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none z-10" />
                      <input
                        type="text"
                        value={steamUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        onPaste={(e) => {
                          e.preventDefault()
                          const pastedText = e.clipboardData.getData('text')
                          handleUrlChange(pastedText)
                        }}
                        placeholder="https://store.steampowered.com/app/XXXXX"
                        className="w-full rounded-xl border border-border/50 bg-surface-muted px-4 py-2.5 pl-10 text-sm text-white transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 relative z-0"
                        autoComplete="off"
                      />
                    </div>
                    <Motion.button
                      onClick={handleFetchData}
                      disabled={loadingGame || !steamUrl}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn btn-primary"
                    >
                      {loadingGame ? (
                        <FiLoader className="animate-spin" />
                      ) : (
                        'Récupérer'
                      )}
                    </Motion.button>
                  </div>
                </div>

                {(error || success) && (
                  <Motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 ${
                      error
                        ? 'bg-red-500/10 border border-red-500/20'
                        : 'bg-emerald-500/10 border border-emerald-500/20'
                    }`}
                  >
                    {error ? (
                      <>
                        <FiAlertCircle className="text-red-400" />
                        <p className="text-sm text-red-400">{error}</p>
                      </>
                    ) : (
                      <>
                        <FiCheck className="text-emerald-400" />
                        <p className="text-sm text-emerald-400">{success}</p>
                      </>
                    )}
                  </Motion.div>
                )}

                {gameData && (
                  <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-border/50 bg-surface-muted/30 p-6 space-y-6"
                  >
                    {/* Vidéo et Image */}
                    <div className="space-y-4">
                      {(gameData.movies || gameData.video) && (
                        <VideoPlayerWithFallback 
                          src={gameData.movies || gameData.video}
                          gameData={gameData}
                        />
                      )}
                      {gameData.header_image && !(gameData.movies || gameData.video) && (
                        <div className="relative w-full rounded-xl overflow-hidden bg-black/20 border border-border/30 shadow-lg">
                          <img
                            src={gameData.header_image}
                            alt={gameData.name}
                            className="w-full h-auto max-h-80 object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Nom et Description */}
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold text-white">{gameData.name}</h3>
                      {gameData.short_description && (
                        <p className="text-sm text-muted leading-relaxed">
                          {gameData.short_description.length > 200
                            ? gameData.short_description.substring(0, 200) + '...'
                            : gameData.short_description}
                        </p>
                      )}
                    </div>

                    {/* Configurations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {gameData.pc_requirements?.minimum && (
                        <div className="space-y-3 rounded-xl border border-border/40 bg-surface/60 p-4 backdrop-blur-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                            Configuration minimale
                          </h4>
                          <div 
                            className="text-xs text-muted leading-relaxed space-y-1.5 prose prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: gameData.pc_requirements.minimum }} 
                          />
                        </div>
                      )}
                      {gameData.pc_requirements?.recommended && (
                        <div className="space-y-3 rounded-xl border border-border/40 bg-surface/60 p-4 backdrop-blur-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                            Configuration recommandée
                          </h4>
                          <div 
                            className="text-xs text-muted leading-relaxed space-y-1.5 prose prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: gameData.pc_requirements.recommended }} 
                          />
                        </div>
                      )}
                    </div>

                    <Motion.button
                      onClick={handleAddGame}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn btn-primary w-full py-3 text-base font-semibold"
                    >
                      <FiCheck className="mr-2" />
                      Ajouter le jeu
                    </Motion.button>
                  </Motion.div>
                )}
              </div>
            </div>
          </Motion.section>
        )}

        {activeSection === 'games' && (
          <Motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="surface-card rounded-2xl border border-border/50 p-6 flex-1 flex flex-col min-h-0"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Jeux</h2>
              <div className="flex items-center gap-2">
                <input 
                  value={searchFilter} 
                  onChange={(e) => setSearchFilter(e.target.value)} 
                  placeholder="Filtrer lien..." 
                  className="input bg-surface-muted/50 border-border/50 focus:border-primary/50" 
                />
                <button 
                  onClick={loadGames} 
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <FiLoader className={loadingGames ? 'animate-spin' : ''} />
                  Rafraîchir
                </button>
              </div>
            </div>

            {/* Filtres par catégorie */}
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border/30">
              <FiFilter className="text-muted text-sm" />
              <span className="text-sm text-muted mr-2">Catégories:</span>
              <div className="flex items-center gap-2">
                <Motion.button
                  onClick={() => setGameFilter('all')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    gameFilter === 'all'
                      ? 'bg-primary text-white shadow-lg'
                      : 'bg-surface-muted/50 text-muted hover:bg-surface-muted/70'
                  }`}
                >
                  Tous ({games.length})
                </Motion.button>
                <Motion.button
                  onClick={() => setGameFilter('with-link')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    gameFilter === 'with-link'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg'
                      : 'bg-surface-muted/50 text-muted hover:bg-surface-muted/70'
                  }`}
                >
                  Avec lien ({games.filter(g => g.downloadUrl && g.downloadUrl.trim() !== '').length})
                </Motion.button>
                <Motion.button
                  onClick={() => setGameFilter('without-link')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    gameFilter === 'without-link'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg'
                      : 'bg-surface-muted/50 text-muted hover:bg-surface-muted/70'
                  }`}
                >
                  Sans lien ({games.filter(g => {
                    const hasNoLink = !g.downloadUrl || g.downloadUrl.trim() === ''
                    return hasNoLink && g.category !== 'Pas trouvé'
                  }).length})
                </Motion.button>
                {games.some(g => g.category === 'Pas trouvé') && (
                  <Motion.button
                    onClick={() => setGameFilter('not-found')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      gameFilter === 'not-found'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-lg'
                        : 'bg-surface-muted/50 text-muted hover:bg-surface-muted/70'
                    }`}
                  >
                    Pas trouvé ({games.filter(g => g.category === 'Pas trouvé').length})
                  </Motion.button>
                )}
              </div>
            </div>
            <div 
              ref={gamesScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
            >
              {loadingGames ? (
                <div className="flex items-center justify-center py-12">
                  <FiLoader className="animate-spin text-primary text-2xl" />
                </div>
              ) : games.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted">Aucun jeu</p>
                </div>
              ) : (() => {
                // Filtrer les jeux selon la catégorie et la recherche
                let filteredGames = games
                
                // Filtre par catégorie
                if (gameFilter === 'with-link') {
                  // Afficher uniquement les jeux avec un lien de téléchargement valide (non vide)
                  filteredGames = filteredGames.filter(g => g.downloadUrl && g.downloadUrl.trim() !== '')
                } else if (gameFilter === 'without-link') {
                  // Exclure les jeux marqués comme "Pas trouvé" du filtre "Sans lien"
                  // Un jeu est "sans lien" s'il n'a pas de downloadUrl ou si c'est une chaîne vide
                  filteredGames = filteredGames.filter(g => {
                    const hasNoLink = !g.downloadUrl || g.downloadUrl.trim() === ''
                    return hasNoLink && g.category !== 'Pas trouvé'
                  })
                } else if (gameFilter === 'not-found') {
                  filteredGames = filteredGames.filter(g => g.category === 'Pas trouvé')
                }
                
                // Filtre par recherche de lien
                if (searchFilter) {
                  const searchLower = searchFilter.toLowerCase()
                  filteredGames = filteredGames.filter(g => 
                    (g.downloadUrl && g.downloadUrl.toLowerCase().includes(searchLower)) ||
                    (g.name && g.name.toLowerCase().includes(searchLower))
                  )
                }
                
                if (filteredGames.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <p className="text-muted">
                        {gameFilter === 'with-link' 
                          ? 'Aucun jeu avec lien de téléchargement'
                          : gameFilter === 'without-link'
                          ? 'Aucun jeu sans lien de téléchargement'
                          : gameFilter === 'not-found'
                          ? 'Aucun jeu marqué comme "Pas trouvé"'
                          : 'Aucun jeu trouvé'}
                      </p>
                    </div>
                  )
                }
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGames.map((game, index) => (
                    <Motion.div
                      key={game.id || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-surface-muted/60 to-surface-muted/40 p-4 space-y-3 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                    >
                      {/* Image et Informations en ligne */}
                      <div className="flex items-start gap-4">
                        {/* Image du jeu */}
                        {game.header_image && (
                          <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden rounded-lg bg-black/20 border border-border/30">
                            <img
                              src={game.header_image}
                              alt={game.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        
                        {/* Informations */}
                        <div className="flex-1 space-y-2 min-w-0">
                          <h3 className="font-bold text-white text-base line-clamp-2">{game.name || 'Sans titre'}</h3>
                        
                          {/* Lien de téléchargement */}
                          {editingGame === game.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={downloadUrl}
                                onChange={(e) => setDownloadUrl(e.target.value)}
                                placeholder="URL de téléchargement (une par ligne ou séparées par des virgules pour plusieurs parties)"
                                rows={3}
                                className="w-full rounded-lg border border-border/50 bg-surface-muted px-3 py-2 text-xs text-white focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none"
                              />
                              {downloadUrl && (
                                <p className="text-xs text-muted">
                                  {downloadUrl.split(/[,\n]/).filter(u => u.trim()).length} partie(s) détectée(s)
                                </p>
                              )}
                              <div className="flex gap-2">
                                <Motion.button
                                  onClick={() => handleUpdateDownloadUrl(game.id, downloadUrl)}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="btn btn-primary flex-1 text-xs py-1.5"
                                >
                                  <FiCheck className="mr-1" />
                                  Valider
                                </Motion.button>
                                <Motion.button
                                  onClick={() => {
                                    setEditingGame(null)
                                    setDownloadUrl('')
                                  }}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="btn btn-secondary flex-1 text-xs py-1.5"
                                >
                                  <FiX className="mr-1" />
                                  Annuler
                                </Motion.button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {game.downloadUrl ? (
                                <div className="space-y-1">
                                  {(() => {
                                    const urls = game.downloadUrl.split(/[,\n]/).filter(u => u.trim())
                                    const urlCount = urls.length
                                    return (
                                      <>
                                        {urlCount > 1 ? (
                                          <div className="flex items-center gap-1.5 text-xs text-primary">
                                            <FiDownload className="text-sm" />
                                            <span>{urlCount} parties PixelDrain</span>
                                          </div>
                                        ) : (
                                          <a
                                            href={urls[0]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                                          >
                                            <FiDownload className="text-sm" />
                                            <span className="truncate max-w-[200px]">{urls[0]}</span>
                                          </a>
                                        )}
                                      </>
                                    )
                                  })()}
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs text-muted">Aucun lien de téléchargement</p>
                                  {game.category !== 'Pas trouvé' && (
                                    <Motion.button
                                      onClick={() => handleMarkAsNotFound(game.id)}
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      className="btn btn-secondary text-xs py-1 px-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border-orange-500/20"
                                      title="Marquer comme 'Pas trouvé'"
                                    >
                                      <FiFilter className="text-xs" />
                                    </Motion.button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t border-border/30">
                        <Motion.button
                          onClick={() => {
                            setEditingGame(game.id)
                            setDownloadUrl(game.downloadUrl || '')
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 btn btn-secondary text-xs py-2.5 font-medium"
                        >
                          <FiEdit2 className="mr-1.5" />
                          {game.downloadUrl ? 'Modifier lien' : 'Ajouter lien'}
                        </Motion.button>
                        <Motion.button
                          onClick={() => handleDeleteGame(game.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="btn btn-secondary text-xs py-2.5 px-4 text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 font-medium"
                        >
                          <FiTrash2 className="mr-1.5" />
                          Supprimer
                        </Motion.button>
                      </div>
                    </Motion.div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </Motion.section>
        )}
      </div>
    )
  }

  // Vue d'ensemble avec les cartes cliquables
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
       {/* Carte Utilisateurs */}
       <Motion.section
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.4 }}
         onClick={() => setActiveSection('users')}
         className="surface-card rounded-2xl border border-border/50 p-8 h-full flex flex-col min-h-[300px] cursor-pointer hover:border-primary/50 hover:shadow-xl transition-all duration-300 group"
       >
         <div className="flex items-center justify-center mb-6">
           <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
             <FiUsers className="text-4xl text-primary" />
           </div>
         </div>
         <h3 className="text-2xl font-bold text-white text-center mb-2">Utilisateurs</h3>
         <p className="text-muted text-center mb-6">Gérer les utilisateurs et leurs permissions</p>
         <div className="mt-auto pt-4 border-t border-border/30">
           <div className="flex items-center justify-between text-sm">
             <span className="text-muted">Total:</span>
             <span className="text-white font-semibold">{users.length} utilisateur{users.length > 1 ? 's' : ''}</span>
           </div>
         </div>
         <div className="mt-4 pt-4 border-t border-border/30">
           <button 
             onClick={(e) => {
               e.stopPropagation()
               loadUsers()
             }}
             className="w-full btn btn-sm btn-secondary"
           >
             <FiLoader className={loading ? 'animate-spin mr-2' : 'mr-2'} />
             Rafraîchir
           </button>
         </div>
       </Motion.section>
 
       {/* Carte Ajouter jeu */}
      <Motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        onClick={() => setActiveSection('add-game')}
        className="surface-card rounded-2xl border border-border/50 p-8 h-full flex flex-col min-h-[300px] cursor-pointer hover:border-primary/50 hover:shadow-xl transition-all duration-300 group"
      >
         <div className="flex items-center justify-center mb-6">
           <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
             <FiPlus className="text-4xl text-emerald-400" />
           </div>
         </div>
         <h3 className="text-2xl font-bold text-white text-center mb-2">Ajouter un jeu</h3>
         <p className="text-muted text-center mb-6">Ajouter un nouveau jeu depuis Steam</p>
         <div className="mt-auto pt-4 border-t border-border/30">
           <div className="flex items-center justify-center">
             <span className="text-sm text-muted">Cliquez pour commencer</span>
           </div>
         </div>
      </Motion.section>
 
       {/* Carte Jeux */}
      <Motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        onClick={() => setActiveSection('games')}
        className="surface-card rounded-2xl border border-border/50 p-8 h-full flex flex-col min-h-[300px] cursor-pointer hover:border-primary/50 hover:shadow-xl transition-all duration-300 group"
      >
         <div className="flex items-center justify-center mb-6">
           <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
             <FiGrid className="text-4xl text-blue-400" />
           </div>
         </div>
         <h3 className="text-2xl font-bold text-white text-center mb-2">Jeux</h3>
         <p className="text-muted text-center mb-6">Gérer votre bibliothèque de jeux</p>
         <div className="mt-auto pt-4 border-t border-border/30">
           <div className="flex items-center justify-between text-sm">
             <span className="text-muted">Total:</span>
             <span className="text-white font-semibold">{games.length} jeu{games.length > 1 ? 'x' : ''}</span>
           </div>
         </div>
      </Motion.section>
     </div>
   )
 }

