import { useState, useEffect } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiHeart, FiGrid, FiLoader } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'

export function FavoritesPage({ onNavigate, activePage }) {
  const [favoriteGames, setFavoriteGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [favoriteIds, setFavoriteIds] = useState([])
  const [isBoostMode, setIsBoostMode] = useState(true) // Par défaut sur FAVORIS
  
  useEffect(() => {
    // Synchroniser le toggle avec la page active
    setIsBoostMode(activePage === 'favorites')
  }, [activePage])
  
  const handleToggle = (e) => {
    setIsBoostMode(e.target.checked)
    if (!e.target.checked) {
      onNavigate?.('library')
    } else {
      onNavigate?.('favorites')
    }
  }

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    try {
      setLoading(true)
      const ids = favoritesService.getFavorites()
      setFavoriteIds(ids)

      if (ids.length === 0) {
        setFavoriteGames([])
        setLoading(false)
        return
      }

      // Charger les jeux depuis Electron
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const data = await window.electron.games.getGames()
        const allGames = data.games || []
        // Filtrer pour ne garder que les favoris
        const favorites = allGames.filter(game => ids.includes(game.id))
        setFavoriteGames(favorites)
      } else {
        setFavoriteGames([])
      }
    } catch (err) {
      console.error('Error loading favorites:', err)
      setFavoriteGames([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFavorite = (gameId) => {
    favoritesService.removeFavorite(gameId)
    setFavoriteGames(favoriteGames.filter(game => game.id !== gameId))
    setFavoriteIds(favoriteIds.filter(id => id !== gameId))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* VIP/Boost Switch */}
        <div className="flex justify-center">
          <div className={`vip-boost-switch ${isBoostMode ? 'boost-active' : ''}`}>
            <input
              type="checkbox"
              id="favorites-mode-loading"
              checked={isBoostMode}
              onChange={handleToggle}
              className="hidden"
            />
            <label htmlFor="favorites-mode-loading" className="switch cursor-pointer">
              <span className="option vip">BIBLIOTHÈQUE</span>
              <span className="option boost">FAVORIS</span>
              <span className="slider" />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <FiLoader className="text-primary text-3xl animate-spin" />
            <p className="text-muted">Chargement des favoris...</p>
          </Motion.div>
        </div>
      </div>
    )
  }

  if (favoriteGames.length === 0) {
    return (
      <div className="space-y-6">
        {/* VIP/Boost Switch */}
        <div className="flex justify-center">
          <div className={`vip-boost-switch ${isBoostMode ? 'boost-active' : ''}`}>
            <input
              type="checkbox"
              id="favorites-mode-empty"
              checked={isBoostMode}
              onChange={handleToggle}
              className="hidden"
            />
            <label htmlFor="favorites-mode-empty" className="switch cursor-pointer">
              <span className="option vip">BIBLIOTHÈQUE</span>
              <span className="option boost">FAVORIS</span>
              <span className="slider" />
            </label>
          </div>
        </div>
        <div className="empty-page">
        <Motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="empty-icon-wrapper"
        >
          <FiHeart className="empty-icon" />
        </Motion.div>
        <Motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          Vos favoris vous attendent
        </Motion.h2>
        <Motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="empty-description"
        >
          Quand vous tombez sur un jeu qui vous plaît, ajoutez-le à vos favoris en cliquant sur le cœur. Vous pourrez le retrouver facilement ici.
        </Motion.p>
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Motion.button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'catalog' }))}
            className="btn btn-primary mt-6"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            Ouvrir le catalogue
          </Motion.button>
        </Motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* VIP/Boost Switch */}
      <div className="flex justify-center">
        <div className={`vip-boost-switch ${isBoostMode ? 'boost-active' : ''}`}>
          <input
            type="checkbox"
            id="favorites-mode"
            checked={isBoostMode}
            onChange={handleToggle}
            className="hidden"
          />
          <label htmlFor="favorites-mode" className="switch cursor-pointer">
            <span className="option vip">BIBLIOTHÈQUE</span>
            <span className="option boost">FAVORIS</span>
            <span className="slider" />
          </label>
        </div>
      </div>

      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="surface-card rounded-2xl border border-border/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiHeart className="text-primary" />
              Mes favoris ({favoriteGames.length})
            </h2>
            <p className="text-sm text-muted mt-1">
              Vos jeux favoris
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {favoriteGames.map((game, index) => (
              <Motion.div
                key={game.id}
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
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFavorite(game.id)
                    }}
                    className="absolute top-3 right-3 p-2.5 rounded-xl bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FiHeart className="text-sm fill-current" />
                  </Motion.button>
                </div>

                {/* Informations du jeu */}
                <div className="p-6 space-y-3 relative z-10 bg-gradient-to-b from-transparent to-black/20">
                  <h3 className="font-semibold text-lg text-white line-clamp-1 transition-colors duration-300 group-hover:text-[#a78bfa]">
                    {game.name || 'Sans titre'}
                  </h3>
                  {game.short_description && (
                    <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: 'rgba(203, 213, 225, 0.7)' }}>
                      {game.short_description.length > 100
                        ? game.short_description.substring(0, 100) + '...'
                        : game.short_description}
                    </p>
                  )}
                </div>
              </Motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Motion.div>
    </div>
  )
}

