import { useState, useEffect, useMemo, useCallback, useRef, Suspense, useTransition } from 'react'
import { Motion, AnimatePresence } from '../components/Motion'
import { FiSearch, FiChevronLeft, FiChevronRight, FiFilter, FiWifi, FiWifiOff } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'
import { GameCard } from '../components/GameCard'
import { gamesCacheService } from '../services/gamesCache'
import { useSearch } from '../contexts/SearchContext'
import { GameCardSkeleton } from '../components/SkeletonLoader'
import { mergeInstalledGamesIntoCatalog } from '../services/gamesInstalledMerger'

export function CatalogPage({ installedGames = [], currentUser = null, onNavigate }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [favoriteIds, setFavoriteIds] = useState([])
  const { searchQuery } = useSearch()
  const [isPending, startTransition] = useTransition()
  const [localInstalledGames, setLocalInstalledGames] = useState(installedGames)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [onlineFilter, setOnlineFilter] = useState('all') // 'all', 'online', 'offline'
  const [currentPage, setCurrentPage] = useState(1)
  const gamesPerPage = 52
  const catalogRef = useRef(null)
  
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
        console.error('[Catalog] Erreur scan:', error)
      }
    }
    scanInstalledGames()
  }, [])
  
  const gamesToUse = localInstalledGames.length > 0 ? localInstalledGames : installedGames

  const loadFavorites = useCallback(() => {
    const ids = favoritesService.getFavorites()
    setFavoriteIds(ids)
  }, [])

  const handleToggleFavorite = useCallback((gameId) => {
    console.log('[Catalog] 🔄 Toggle favori pour:', gameId)
    const success = favoritesService.toggleFavorite(gameId)
    if (success) {
      // Recharger les favoris depuis le service
      const updatedFavorites = favoritesService.getFavorites()
      setFavoriteIds(updatedFavorites)
      console.log('[Catalog] ✅ Favoris mis à jour:', updatedFavorites.length)
    }
  }, [])

  const loadGames = useCallback(async () => {
    try {
      setLoading(true)
      
      const cachedGames = gamesCacheService.getCachedGames()
      if (cachedGames.length > 0) {
        const mergedGames = mergeInstalledGamesIntoCatalog(cachedGames, gamesToUse)
        setGames(mergedGames)
        setLoading(false)
      }

      // ⚡ Petit délai pour éviter d'appeler en même temps que Home
      setTimeout(() => {
        startTransition(async () => {
          try {
            const allGames = await gamesCacheService.getGames()
            const mergedGames = mergeInstalledGamesIntoCatalog(allGames, gamesToUse)
            setGames(mergedGames)
          } catch (err) {
            console.error('Erreur:', err)
          }
        })
      }, 50)
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

  useEffect(() => {
    if (games.length > 0) {
      const mergedGames = mergeInstalledGamesIntoCatalog(games, gamesToUse)
      setGames(mergedGames)
    }
  }, [gamesToUse])

  const categories = useMemo(() => {
    const cats = new Set()
    games.forEach(game => {
      if (game.category) cats.add(game.category)
      else if (game.genre && Array.isArray(game.genre)) {
        game.genre.forEach(g => cats.add(g))
      }
    })
    return Array.from(cats).sort()
  }, [games])

  const filteredGames = useMemo(() => {
    let filtered = [...games]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(game => {
        const name = (game.name || game.title || '').toLowerCase()
        const desc = (game.description || game.desc || '').toLowerCase()
        return name.includes(query) || desc.includes(query)
      })
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(game => {
        if (game.category === selectedCategory) return true
        if (game.genre && Array.isArray(game.genre) && game.genre.includes(selectedCategory)) return true
        return false
      })
    }

    // Filtre par statut en ligne
    if (onlineFilter === 'online') {
      filtered = filtered.filter(game => game.isOnline === true)
    } else if (onlineFilter === 'offline') {
      filtered = filtered.filter(game => game.isOnline !== true)
    }

    return filtered
  }, [games, searchQuery, selectedCategory, onlineFilter])

  const totalPages = Math.ceil(filteredGames.length / gamesPerPage)
  const paginatedGames = useMemo(() => {
    const startIndex = (currentPage - 1) * gamesPerPage
    const endIndex = startIndex + gamesPerPage
    return filteredGames.slice(startIndex, endIndex)
  }, [filteredGames, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, onlineFilter, searchQuery])

  useEffect(() => {
    if (catalogRef.current) {
      catalogRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [currentPage])

  const handleGameClick = useCallback((gameId) => {
    if (onNavigate) {
      onNavigate('game-details', gameId)
    }
  }, [onNavigate])

  return (
    <div ref={catalogRef} className="h-full overflow-y-auto scrollbar-simple bg-[#0f0f14]">
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#06b6d4]/5 via-transparent to-transparent" />
      
      <div className="max-w-[1800px] mx-auto px-8 py-12">
        {/* Header simple */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white mb-2">Catalogue</h1>
              <p className="text-gray-400">{filteredGames.length} jeux disponibles</p>
            </div>
          </div>

          {/* Filtres toujours visibles */}
          {categories.length > 0 && (
            <div className="mt-6 space-y-4">
              {/* Filtre en ligne/hors ligne */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Statut en ligne</h3>
                <div className="flex gap-2 flex-wrap">
                  <Motion.button
                    onClick={() => setOnlineFilter('all')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      onlineFilter === 'all'
                        ? 'bg-[#06b6d4] text-white'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    Tous
                  </Motion.button>
                  <Motion.button
                    onClick={() => setOnlineFilter('online')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      onlineFilter === 'online'
                        ? 'bg-green-500 text-white'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <FiWifi className="text-sm" />
                    En ligne
                  </Motion.button>
                  <Motion.button
                    onClick={() => setOnlineFilter('offline')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      onlineFilter === 'offline'
                        ? 'bg-gray-600 text-white'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <FiWifiOff className="text-sm" />
                    Hors ligne
                  </Motion.button>
                </div>
              </div>

              {/* Filtre par catégorie */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Catégorie</h3>
                <div className="flex gap-2 flex-wrap">
                  <Motion.button
                    onClick={() => setSelectedCategory('all')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-[#06b6d4] text-white'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    Tous
                  </Motion.button>
                  {categories.map(category => (
                    <Motion.button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        selectedCategory === category
                          ? 'bg-[#06b6d4] text-white'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {category}
                    </Motion.button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Motion.div>

        {/* Grille */}
        <Suspense fallback={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(16)].map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        }>
          <AnimatePresence mode="wait">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[...Array(16)].map((_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredGames.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                  {paginatedGames.map((game, index) => {
                    const isFavorite = favoriteIds.includes(String(game.id))
                    const isInstalled = game.isInstalled === true

                    return (
                      <Motion.div
                        key={game.id || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.3 }}
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

                {/* Pagination simple */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <Motion.button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
                      className={`p-2 rounded-lg ${
                        currentPage === 1
                          ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <FiChevronLeft />
                    </Motion.button>

                    <span className="text-gray-400 font-medium">
                      {currentPage} / {totalPages}
                    </span>

                    <Motion.button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
                      className={`p-2 rounded-lg ${
                        currentPage === totalPages
                          ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <FiChevronRight />
                    </Motion.button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-gray-400">
                {searchQuery 
                  ? `Aucun résultat pour "${searchQuery}"`
                  : 'Aucun jeu disponible'}
              </div>
            )}
          </AnimatePresence>
        </Suspense>
      </div>
    </div>
  )
}

export default CatalogPage
