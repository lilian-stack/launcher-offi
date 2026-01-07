import { useState, useEffect, useMemo, useCallback, Suspense, useTransition } from 'react'
import { Motion, AnimatePresence } from '../components/Motion'
import { FiArrowRight } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'
import { gamesCacheService } from '../services/gamesCache'
import { GameCard } from '../components/GameCard'
import { GameCardSkeleton } from '../components/SkeletonLoader'
import { mergeInstalledGamesIntoCatalog } from '../services/gamesInstalledMerger'

export function HomePage({ installedGames = [], onNavigate }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [favoriteIds, setFavoriteIds] = useState([])
  const [isPending, startTransition] = useTransition()
  const [localInstalledGames, setLocalInstalledGames] = useState(installedGames)
  
  // 🔍 SCAN AUTOMATIQUE des jeux installés
  useEffect(() => {
    const scanInstalledGames = async () => {
      try {
        if (window.electron?.games?.scanInstalledGames) {
          const result = await window.electron.games.scanInstalledGames(null, true)
          if (result && result.success) {
            setLocalInstalledGames(result.games || [])
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('installed-games-updated', {
                detail: { games: result.games || [] }
              }))
            }
          }
        }
      } catch (error) {
        console.error('[Home] Erreur lors du scan:', error)
      }
    }
    scanInstalledGames()
  }, [])
  
  const gamesToUse = localInstalledGames.length > 0 ? localInstalledGames : installedGames

  const loadFavorites = useCallback(async () => {
    try {
      const favorites = await favoritesService.getFavorites()
      const ids = favorites.map(fav => fav.id)
      setFavoriteIds(ids)
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error)
      setFavoriteIds([])
    }
  }, [])

  const handleToggleFavorite = useCallback(async (gameId) => {
    try {
      const game = games.find(g => g.id === gameId)
      if (game) {
        await favoritesService.toggleFavorite(game)
        const favorites = await favoritesService.getFavorites()
        const ids = favorites.map(fav => fav.id)
        setFavoriteIds(ids)
      }
    } catch (error) {
      console.error('Erreur lors de la gestion des favoris:', error)
    }
  }, [games])

  const loadGames = useCallback(async () => {
    try {
      setLoading(true)
      
      const cachedGames = gamesCacheService.getCachedGames()
      if (cachedGames.length > 0) {
        const mergedGames = mergeInstalledGamesIntoCatalog(cachedGames, gamesToUse)
        const sortedGames = mergedGames
          .sort((a, b) => {
            const dateA = new Date(a.addedAt || a.added_at || 0)
            const dateB = new Date(b.addedAt || b.added_at || 0)
            return dateB - dateA
          })
          .slice(0, 4)
        setGames(sortedGames)
        setLoading(false)
      }

      startTransition(async () => {
        try {
          const allGames = await gamesCacheService.getGames()
          const mergedGames = mergeInstalledGamesIntoCatalog(allGames, gamesToUse)
          const sortedGames = mergedGames
            .sort((a, b) => {
              const dateA = new Date(a.addedAt || a.added_at || 0)
              const dateB = new Date(b.addedAt || b.added_at || 0)
              return dateB - dateA
            })
            .slice(0, 4)
          setGames(sortedGames)
        } catch (err) {
          console.error('Erreur chargement:', err)
        }
      })
    } catch (err) {
      console.error('Erreur:', err)
      setGames([])
    } finally {
      setLoading(false)
    }
  }, [gamesToUse])

  useEffect(() => {
    loadGames()
    loadFavorites()
  }, [loadGames, loadFavorites])

  const handleGameClick = useCallback((gameId) => {
    if (onNavigate) {
      onNavigate('game-details', gameId)
    }
  }, [onNavigate])

  return (
    <div className="h-full overflow-y-auto scrollbar-simple bg-[#0f0f14]">
      {/* Fond dégradé subtil */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#06b6d4]/5 via-transparent to-transparent" />
      
      <div className="max-w-[1800px] mx-auto px-8 py-12">
        {/* Hero minimaliste */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h1 className="text-7xl font-bold mb-4 bg-gradient-to-r from-white via-[#06b6d4] to-white bg-clip-text text-transparent">
                Bienvenue
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Découvrez et jouez aux meilleurs jeux
          </p>
        </Motion.div>

        {/* Section jeux avec header simple */}
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Nouveautés</h2>
              <Motion.button
                onClick={() => onNavigate?.('catalog')}
              whileHover={{ x: 4 }}
              className="flex items-center gap-2 text-[#06b6d4] hover:text-white transition-colors group"
              >
              <span className="font-medium">Voir tout</span>
              <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Motion.button>
          </div>

          <Suspense fallback={
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          }>
            <AnimatePresence mode="wait">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <GameCardSkeleton key={i} />
                  ))}
                </div>
              ) : games.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {games.map((game, index) => {
                    const isInstalled = game.isInstalled === true
                    const isFavorite = favoriteIds.includes(game.id)

                    return (
                      <Motion.div
                        key={game.id || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.4 }}
                      >
                            <GameCard
                          game={game}
                          index={index}
                          isFavorite={isFavorite}
                          installedGame={isInstalled ? {
                            path: game.installFolder,
                            gamePath: game.installFolder,
                            exePath: game.executable,
                            name: game.name || game.title,
                            installDate: game.installDate,
                            version: game.installedVersion,
                            launcherId: game.launcherId
                          } : null}
                          onToggleFavorite={handleToggleFavorite}
                          onClick={handleGameClick}
                        />
                      </Motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-400">
                  Aucun jeu disponible
                  </div>
              )}
            </AnimatePresence>
          </Suspense>
        </Motion.div>
      </div>
    </div>
  )
}

export default HomePage
