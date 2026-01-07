import { useState, useEffect } from 'react'
import { Motion } from './Motion'
import { FiBarChart2, FiClock, FiHardDrive, FiTrendingUp, FiGrid, FiZap } from 'react-icons/fi'

export function GamingStatistics({ currentUser }) {
  const [stats, setStats] = useState(null)
  const [mostPlayed, setMostPlayed] = useState([])
  const [recentlyPlayed, setRecentlyPlayed] = useState([])
  const [installedGames, setInstalledGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!currentUser || (!currentUser.isVip && !currentUser.isAdmin)) {
      setLoading(false)
      return
    }

    loadStatistics()
    
    // Écouter l'événement de désinstallation pour rafraîchir les stats
    const handleGameUninstalled = () => {
      console.log('[GamingStatistics] Jeu désinstallé, rechargement des stats...')
      loadStatistics()
    }
    
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('game-uninstalled', handleGameUninstalled)
    }
    
    // Cleanup
    return () => {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeListener('game-uninstalled', handleGameUninstalled)
      }
    }
  }, [currentUser])

  // Enrichir les jeux avec les données du catalogue (images, etc.)
  const enrichGamesWithCatalogData = async (games) => {
    if (!window.electron?.games?.getGames) return games
    
    try {
      const catalogData = await window.electron.games.getGames(false)
      const catalog = catalogData?.games || []
      
      return games.map(game => {
        console.log('[GamingStatistics] 🔍 Recherche pour:', game.name, 'game_id:', game.game_id, 'launcher_id:', game.launcher_id)
        
        // Chercher le jeu dans le catalogue par game_id, launcher_id ou steamId
        let catalogGame = catalog.find(
          g => {
            const match = g.id === game.game_id || 
                         g.id === game.launcher_id || 
                         g.steamId === game.game_id || 
                         g.gameId === game.game_id ||
                         String(g.steamId) === String(game.game_id)
            
            if (match) {
              console.log('[GamingStatistics] ✅ Match trouvé par ID:', g.name, 'steamId:', g.steamId)
            }
            return match
          }
        )
        
        // Si pas trouvé par ID, NE PAS chercher par nom pour éviter les faux positifs
        // Les images ne s'afficheront que pour les jeux présents dans le catalogue avec le bon ID
        
        if (catalogGame) {
          const imageUrl = catalogGame.image || catalogGame.headerImage
          console.log('[GamingStatistics] ✅ Jeu trouvé dans catalogue:', game.name, '→', catalogGame.name, 'image:', imageUrl)
          
          // Ne pas enrichir si pas d'image disponible
          if (!imageUrl) {
            console.warn('[GamingStatistics] ⚠️ Pas d\'image pour:', catalogGame.name)
            return game
          }
          
          return {
            ...game,
            image: imageUrl,
            coverImage: catalogGame.coverImage,
            description: catalogGame.description
          }
        }
        
        console.warn('[GamingStatistics] ❌ Jeu non trouvé dans le catalogue:', game.name, 'game_id:', game.game_id, 'launcher_id:', game.launcher_id)
        return game
      })
    } catch (error) {
      console.warn('[GamingStatistics] Erreur lors de l\'enrichissement:', error)
      return games
    }
  }

  const loadStatistics = async () => {
    try {
      setLoading(true)
      setError(null)

      // Initialiser SQLite si nécessaire (optionnel)
      if (window.electron?.sqliteLibrary?.init) {
        try {
          await window.electron.sqliteLibrary.init()
        } catch (sqliteError) {
          // SQLite non disponible, continuer sans (utilisera SimpleStore)
          console.warn('[GamingStatistics] SQLite non disponible, utilisation de SimpleStore:', sqliteError.message)
        }
      }

      // Définir l'utilisateur actuel dans SQLite
      if (window.electron?.sqliteLibrary?.setUser && currentUser?.id) {
        await window.electron.sqliteLibrary.setUser(currentUser.id, {
          username: currentUser.username,
          discriminator: currentUser.discriminator,
          avatar: currentUser.avatar,
          isAdmin: currentUser.isAdmin,
          isVip: currentUser.isVip,
          isBoost: currentUser.isBoost
        })
      }

      // Récupérer les statistiques
      if (window.electron?.sqliteLibrary?.getStats) {
        console.log('[GamingStatistics] Récupération des stats pour userId:', currentUser?.id)
        const statsResult = await window.electron.sqliteLibrary.getStats(currentUser?.id)
        console.log('[GamingStatistics] Résultat stats:', statsResult)
        if (statsResult?.success) {
          console.log('[GamingStatistics] Stats reçues:', statsResult.stats)
          setStats(statsResult.stats)
        } else {
          console.warn('[GamingStatistics] Aucune stats reçue ou échec')
        }
      }

      // Récupérer la liste des jeux installés avec leurs images
      if (window.electron?.sqliteLibrary?.getGames) {
        const gamesResult = await window.electron.sqliteLibrary.getGames(currentUser?.id)
        if (gamesResult?.success) {
          // Enrichir avec les métadonnées du catalogue (images, etc.)
          const gamesWithImages = await enrichGamesWithCatalogData(gamesResult.games || [])
          setInstalledGames(gamesWithImages)
        }
      }

      // Récupérer les jeux les plus joués
      if (window.electron?.sqliteLibrary?.getMostPlayed) {
        const mostPlayedResult = await window.electron.sqliteLibrary.getMostPlayed(5, currentUser?.id)
        if (mostPlayedResult?.success) {
          const enriched = await enrichGamesWithCatalogData(mostPlayedResult.games || [])
          setMostPlayed(enriched)
        }
      }

      // Récupérer les jeux récemment joués
      if (window.electron?.sqliteLibrary?.getRecentlyPlayed) {
        const recentResult = await window.electron.sqliteLibrary.getRecentlyPlayed(5, currentUser?.id)
        if (recentResult?.success) {
          const enriched = await enrichGamesWithCatalogData(recentResult.games || [])
          setRecentlyPlayed(enriched)
        }
      }

    } catch (err) {
      console.error('[GamingStatistics] Erreur:', err)
      setError('Impossible de charger les statistiques')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatMinutes = (minutes) => {
    if (!minutes || minutes === 0) return '0h'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
    }
    return `${mins}m`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Jamais'
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (minutes < 60) return `Il y a ${minutes}m`
    if (hours < 24) return `Il y a ${hours}h`
    if (days < 7) return `Il y a ${days}j`
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // Ne pas afficher si pas VIP/Admin
  if (!currentUser || (!currentUser.isVip && !currentUser.isAdmin)) {
    return null
  }

  if (loading) {
    return (
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1a1a20]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <FiBarChart2 className="text-xl text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Statistiques de Jeu</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </Motion.div>
    )
  }

  if (error) {
    return (
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1a1a20]/80 backdrop-blur-xl border border-red-500/30 rounded-xl p-6"
      >
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadStatistics}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </Motion.div>
    )
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1a1a20]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
          <FiBarChart2 className="text-xl text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">Statistiques de Jeu</h2>
          <p className="text-sm text-gray-400 mt-1">
            {currentUser.isAdmin ? '👑 Accès Administrateur' : '⭐ Accès VIP'}
          </p>
        </div>
      </div>

      {/* Statistiques principales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <FiGrid className="text-2xl text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Jeux installés</p>
                <p className="text-2xl font-bold text-white">{stats.totalGames || 0}</p>
              </div>
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <FiHardDrive className="text-2xl text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Espace utilisé</p>
                <p className="text-2xl font-bold text-white">{formatBytes(stats.totalSize || 0)}</p>
              </div>
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <FiClock className="text-2xl text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Temps de jeu</p>
                <p className="text-2xl font-bold text-white">{formatMinutes(stats.totalPlayTime || 0)}</p>
              </div>
            </div>
          </Motion.div>
        </div>
      )}

      {/* Jeux les plus joués */}
      {mostPlayed.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FiTrendingUp className="text-lg text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Jeux les plus joués</h3>
          </div>
          <div className="space-y-2">
            {mostPlayed.map((game, index) => (
              <Motion.div
                key={game.id || game.game_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {game.image ? (
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-white/20">
                      <img 
                        src={game.image} 
                        alt={game.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null
                          e.target.parentElement.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center border border-amber-500/30"><span class="text-amber-400 font-bold text-sm">#${index + 1}</span></div>`
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-lg flex items-center justify-center border border-amber-500/30">
                    <span className="text-amber-400 font-bold text-sm">#{index + 1}</span>
                  </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{game.name}</p>
                    <p className="text-xs text-gray-400">{formatMinutes(game.play_time)} jouées</p>
                  </div>
                </div>
                {game.last_played && (
                  <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {formatDate(game.last_played)}
                  </p>
                )}
              </Motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Jeux récemment joués */}
      {recentlyPlayed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FiZap className="text-lg text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Récemment joués</h3>
          </div>
          <div className="space-y-2">
            {recentlyPlayed.map((game, index) => (
              <Motion.div
                key={game.id || game.game_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {game.image ? (
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-white/20">
                      <img 
                        src={game.image} 
                        alt={game.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null
                          e.target.parentElement.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30"><svg class="text-cyan-400 text-sm w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg></div>'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30">
                    <FiGrid className="text-cyan-400 text-sm" />
                  </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{game.name}</p>
                    {game.play_time > 0 && (
                      <p className="text-xs text-gray-400">{formatMinutes(game.play_time)} jouées</p>
                    )}
                  </div>
                </div>
                {game.last_played && (
                  <p className="text-xs text-cyan-400 flex-shrink-0 ml-2">
                    {formatDate(game.last_played)}
                  </p>
                )}
              </Motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Message si aucune donnée */}
      {stats && stats.totalGames === 0 && mostPlayed.length === 0 && recentlyPlayed.length === 0 && (
        <div className="text-center py-8">
          <FiGrid className="text-4xl text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">Aucune statistique disponible</p>
          <p className="text-sm text-gray-500">Lancez vos jeux pour voir vos statistiques ici</p>
        </div>
      )}
    </Motion.div>
  )
}

