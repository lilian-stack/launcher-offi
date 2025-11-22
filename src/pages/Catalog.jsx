import { useState, useEffect } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiGrid, FiSearch, FiLoader, FiAlertCircle, FiHeart, FiDownload } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'

export function CatalogPage({ installedGames = [] }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [favoriteIds, setFavoriteIds] = useState([])
  
  // Marquer les jeux comme installés
  const getGameInstallStatus = (gameName) => {
    if (!installedGames || installedGames.length === 0) return null
    const normalizeName = (name) => name.toLowerCase().trim().replace(/\s+/g, ' ')
    const normalizedGameName = normalizeName(gameName)
    return installedGames.find(g => {
      const normalizedInstalledName = normalizeName(g.name)
      return normalizedInstalledName === normalizedGameName || 
             normalizedInstalledName.includes(normalizedGameName) ||
             normalizedGameName.includes(normalizedInstalledName)
    })
  }

  // Charger les jeux
  useEffect(() => {
    loadGames()
    loadFavorites()
  }, [])

  const loadFavorites = () => {
    const ids = favoritesService.getFavorites()
    setFavoriteIds(ids)
  }

  const handleToggleFavorite = (e, gameId) => {
    e.stopPropagation()
    const wasAdded = favoritesService.toggleFavorite(gameId)
    loadFavorites()
  }

  const loadGames = async () => {
    try {
      setLoading(true)
      setError('')
      
      console.log('Catalog: Loading games...')
      console.log('Catalog: window.electron:', window.electron)
      console.log('Catalog: window.electron?.games:', window.electron?.games)
      console.log('Catalog: window.electron?.games?.getGames:', window.electron?.games?.getGames)
      
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        console.log('Catalog: Calling getGames...')
        const data = await window.electron.games.getGames()
        console.log('Catalog: Games data received:', data)
        console.log('Catalog: Number of games:', data?.games?.length || 0)
        setGames(data.games || [])
      } else {
        console.error('Catalog: Electron games functions not available')
        setError('Les fonctions de gestion des jeux ne sont pas disponibles')
      }
    } catch (err) {
      console.error('Error loading games:', err)
      setError(`Erreur lors du chargement des jeux: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les jeux selon la recherche
  const filteredGames = games.filter(game => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      game.name?.toLowerCase().includes(query) ||
      game.short_description?.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <FiLoader className="text-primary text-3xl animate-spin" />
          <p className="text-muted">Chargement des jeux...</p>
        </Motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <FiAlertCircle className="text-red-400 text-3xl" />
          <p className="text-red-400">{error}</p>
          <Motion.button
            onClick={loadGames}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-secondary mt-4"
          >
            Réessayer
          </Motion.button>
        </Motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Barre de recherche */}
      <Motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-lg" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un jeu..."
          className="w-full rounded-xl border border-border/50 bg-surface-muted px-4 py-3 pl-12 text-sm text-white transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
      </Motion.div>

      {/* Liste des jeux */}
      {filteredGames.length === 0 ? (
        <div className="empty-page">
          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="empty-icon-wrapper"
          >
            <FiGrid className="empty-icon" />
          </Motion.div>
          <Motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            {searchQuery ? 'Aucun jeu trouvé' : 'Aucun jeu disponible'}
          </Motion.h2>
          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="empty-description"
          >
            {searchQuery
              ? 'Essayez avec d\'autres mots-clés.'
              : 'Le catalogue sera bientôt disponible. Revenez plus tard pour découvrir nos jeux.'}
          </Motion.p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {filteredGames.length} {filteredGames.length === 1 ? 'jeu' : 'jeux'}
              {searchQuery && ` pour "${searchQuery}"`}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredGames.map((game, index) => (
                <Motion.div
                  key={game.id || index}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ delay: index * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'game-details', gameId: game.id } }))
                  }}
                  className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl transition-all duration-500 cursor-pointer hover:border-white/10 hover:bg-white/8 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2"
                  style={{
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
                  }}
                >
                  {/* Badge "Télécharger" élégant et discret */}
                  <div className="absolute top-4 left-4 z-20">
                    <Motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 + 0.2, type: "spring", stiffness: 200 }}
                      className="relative group/badge"
                    >
                      {/* Badge avec effet de brillance */}
                      <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                        {/* Effet de brillance animé */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/badge:translate-x-full transition-transform duration-1000 ease-in-out" />
                        
                        {/* Contenu du badge */}
                        <div className="relative flex items-center gap-1.5">
                          <div className="p-1 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30">
                            <FiDownload className="text-xs text-purple-300" />
                          </div>
                          <span className="text-xs font-medium text-white/90 tracking-wide">Télécharger</span>
                        </div>
                        
                        {/* Glow effect au hover */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/0 via-purple-500/0 to-purple-500/0 group-hover/badge:from-purple-500/20 group-hover/badge:via-purple-500/10 group-hover/badge:to-purple-500/0 transition-all duration-500 pointer-events-none blur-sm" />
                      </div>
                    </Motion.div>
                  </div>

                  {/* Image du jeu */}
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-black/60 to-black/80 rounded-t-3xl">
                    {game.header_image ? (
                      <>
                        <img
                          src={game.header_image}
                          alt={game.name || 'Jeu'}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                        <div className="hidden absolute inset-0 flex items-center justify-center bg-black/30">
                          <FiGrid className="text-muted text-4xl" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-muted/40 to-surface-muted/20">
                        <FiGrid className="text-muted text-5xl opacity-50" />
                      </div>
                    )}
                    {/* Overlay gradient moderne */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    {/* Shine effect moderne */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:via-primary/5 group-hover:to-primary/0 transition-all duration-500 pointer-events-none" />
                    {/* Bouton favori moderne */}
                    <Motion.button
                      onClick={(e) => handleToggleFavorite(e, game.id)}
                      className={`absolute top-3 right-3 p-2.5 rounded-xl backdrop-blur-md border transition-all ${
                        favoriteIds.includes(game.id) 
                          ? 'opacity-100 bg-red-500/20 border-red-500/30 text-red-400' 
                          : 'opacity-0 group-hover:opacity-100 bg-black/40 border-white/10 text-white hover:bg-red-500/20 hover:border-red-500/30'
                      }`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <FiHeart className={`text-sm ${favoriteIds.includes(game.id) ? 'fill-current' : ''}`} />
                    </Motion.button>
                  </div>

                  {/* Nom du jeu (visible seulement au hover) */}
                  <div className="absolute inset-0 flex flex-col justify-end p-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-3xl -m-6" />
                      <h3 className="relative font-semibold text-lg text-white drop-shadow-lg">
                        {game.name || 'Sans titre'}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Border glow effect moderne */}
                  <div className="absolute inset-0 rounded-3xl border border-primary/0 group-hover:border-primary/20 transition-all duration-500 pointer-events-none" />
                </Motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}
