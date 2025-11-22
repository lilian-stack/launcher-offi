import { useState, useEffect } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FaGamepad } from 'react-icons/fa'
import { FiStar, FiHeart, FiGrid } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'

export function HomePage({ installedGames = [] }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
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
    favoritesService.toggleFavorite(gameId)
    loadFavorites()
  }

  const loadGames = async () => {
    try {
      setLoading(true)
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const data = await window.electron.games.getGames()
        // Trier par date d'ajout (les plus récents en premier) et prendre les 3 premiers
        const sortedGames = (data.games || [])
          .sort((a, b) => {
            const dateA = new Date(a.addedAt || 0)
            const dateB = new Date(b.addedAt || 0)
            return dateB - dateA
          })
          .slice(0, 3)
        setGames(sortedGames)
      }
    } catch (err) {
      console.error('Error loading games:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* Section de bienvenue */}
      <section className="home-hero flex-shrink-0">
        <Motion.div
          className="hero-logo"
          initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ 
            duration: 0.7,
            type: "spring",
            stiffness: 150,
            damping: 12
          }}
          whileHover={{ 
            scale: 1.08,
            rotate: 8,
            transition: { duration: 0.3, type: "spring", stiffness: 300 }
          }}
        >
          <FaGamepad />
        </Motion.div>
        <Motion.h1
          className="hero-heading"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          Bienvenue sur ACTORIS
        </Motion.h1>
      </section>

      {/* Section Derniers ajouts */}
      {!loading && games.length > 0 && (
        <Motion.section
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-4 flex-1 flex flex-col min-h-0"
        >
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <FiStar className="text-xl text-yellow-400" />
              <h2 className="text-xl font-bold text-white">Derniers ajouts</h2>
            </div>
          </div>
          <p className="text-xs text-muted flex-shrink-0">Les titres les plus récents</p>
          
          <div className="grid grid-cols-4 gap-2.5 flex-1 min-h-0">
            <AnimatePresence mode="popLayout">
              {games.map((game, index) => (
                <Motion.div
                  key={game.id || index}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ delay: index * 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl transition-all duration-500 cursor-pointer hover:border-white/10 hover:bg-white/8 hover:shadow-xl hover:shadow-primary/15 hover:-translate-y-1"
                  style={{
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
                  }}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'game-details', gameId: game.id } }))
                  }}
                >
                  {/* Image du jeu */}
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-black/60 to-black/80 rounded-t-2xl">
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
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:via-primary/5 group-hover:to-primary/0 transition-all duration-500 pointer-events-none" />
                    {/* Bouton favori moderne */}
                    <Motion.button
                      onClick={(e) => handleToggleFavorite(e, game.id)}
                      className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md border transition-all ${
                        favoriteIds.includes(game.id) 
                          ? 'opacity-100 bg-red-500/20 border-red-500/30 text-red-400' 
                          : 'opacity-0 group-hover:opacity-100 bg-black/40 border-white/10 text-white hover:bg-red-500/20 hover:border-red-500/30'
                      }`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <FiHeart className={`text-xs ${favoriteIds.includes(game.id) ? 'fill-current' : ''}`} />
                    </Motion.button>
                  </div>

                  {/* Informations du jeu */}
                  <div className="p-3 relative z-10 bg-gradient-to-b from-transparent to-black/20">
                    <h3 className="font-semibold text-xs text-white line-clamp-1 transition-colors duration-300 group-hover:text-[#a78bfa]">
                      {game.name || 'Sans titre'}
                    </h3>
                  </div>
                  
                  {/* Border glow effect moderne */}
                  <div className="absolute inset-0 rounded-2xl border border-primary/0 group-hover:border-primary/20 transition-all duration-500 pointer-events-none" />
                </Motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Motion.section>
      )}
    </div>
  )
}



