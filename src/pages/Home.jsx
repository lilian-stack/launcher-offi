import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiStar, FiHeart, FiGrid, FiFileText, FiDownload } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'
import { PatchNotes } from '../components/PatchNotes'
import { patchNotesService } from '../services/patchNotesService'

export function HomePage({ installedGames = [] }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [favoriteIds, setFavoriteIds] = useState([])
  const [showPatchNotes, setShowPatchNotes] = useState(false)
  const [patchNotesData, setPatchNotesData] = useState(null)
  const [patchNotesLoading, setPatchNotesLoading] = useState(false)
  
  // Mémoriser la fonction de normalisation
  const normalizeName = useCallback((name) => {
    if (!name) return ''
    return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
  }, [])
  
  // Mémoriser le mapping des jeux installés
  const installedGamesMap = useMemo(() => {
    if (!installedGames || installedGames.length === 0) return new Map()
    const map = new Map()
    installedGames.forEach(g => {
      if (g.name) {
        const normalized = normalizeName(g.name)
        if (normalized) map.set(normalized, g)
      }
    })
    return map
  }, [installedGames, normalizeName])
  
  // Mémoriser la fonction de vérification d'installation
  const getGameInstallStatus = useCallback((gameName) => {
    if (!gameName || installedGamesMap.size === 0) return null
    const normalizedGameName = normalizeName(gameName)
    const directMatch = installedGamesMap.get(normalizedGameName)
    if (directMatch) return directMatch
    // Recherche partielle
    for (const [key, game] of installedGamesMap.entries()) {
      if (key.includes(normalizedGameName) || normalizedGameName.includes(key)) {
        return game
      }
    }
    return null
  }, [installedGamesMap, normalizeName])

  // Mémoriser les fonctions de chargement
  const loadFavorites = useCallback(() => {
    const ids = favoritesService.getFavorites()
    setFavoriteIds(ids)
  }, [])

  const loadPatchNotes = useCallback(async () => {
    try {
      setPatchNotesLoading(true)
      const data = await patchNotesService.getLatest()
      setPatchNotesData(data)
    } catch (err) {
      console.warn('[Home] Impossible de charger les patch notes:', err)
      // Fallback sur des données par défaut si le service échoue
      setPatchNotesData({
        latestVersion: '1.0.25',
        releaseDate: new Date().toISOString(),
        highlights: [],
        notes: [
          "Interface utilisateur modernisée avec un design épuré et élégant",
          "Optimisation des performances de chargement du catalogue",
          "Amélioration de la stabilité des téléchargements",
          "Corrections de bugs mineurs et améliorations générales"
        ],
        downloads: {},
        history: []
      })
    } finally {
      setPatchNotesLoading(false)
    }
  }, [])

  const handleToggleFavorite = useCallback((e, gameId) => {
    e.stopPropagation()
    favoritesService.toggleFavorite(gameId)
    setFavoriteIds(prev => {
      const ids = favoritesService.getFavorites()
      return ids
    })
  }, [])

  const loadGames = useCallback(async () => {
    try {
      setLoading(true)
      if (window.electron && window.electron.games && window.electron.games.getGames) {
        const data = await window.electron.games.getGames()
        const sortedGames = (data?.games || [])
          .sort((a, b) => {
            const dateA = new Date(a.addedAt || a.added_at || 0)
            const dateB = new Date(b.addedAt || b.added_at || 0)
            return dateB - dateA
          })
          .slice(0, 4)
        setGames(sortedGames)
      }
    } catch (err) {
      console.error('Erreur lors du chargement des jeux:', err)
      setGames([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGames()
    loadFavorites()
    loadPatchNotes()
  }, [loadGames, loadFavorites, loadPatchNotes])
  
  // Mémoriser les jeux triés
  const sortedGames = useMemo(() => {
    return games.slice(0, 4)
  }, [games])

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* Section de bienvenue */}
      <section className="home-hero flex-shrink-0 relative">
        {/* Background glow effect */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        </div>
        
        <div className="space-y-6">
          <Motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <span className="block bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
              ACTORIS
            </span>
          </Motion.h1>
          <Motion.p
            className="text-xl md:text-2xl text-white/70 max-w-xl leading-relaxed font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            Votre destination pour découvrir et jouer aux meilleurs jeux
          </Motion.p>
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <Motion.button
              onClick={() => setShowPatchNotes(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white/90 font-medium hover:bg-white/20 hover:border-white/30 transition-all duration-300 shadow-lg"
            >
              <FiFileText className="text-lg" />
              <span>Notes de mise à jour</span>
            </Motion.button>
          </Motion.div>
        </div>
      </section>

      {/* Modal Patch Notes */}
      <PatchNotes
        isOpen={showPatchNotes}
        onClose={() => setShowPatchNotes(false)}
        version={patchNotesData?.latestVersion || '1.0.25'}
        notes={patchNotesData?.notes || []}
        highlights={patchNotesData?.highlights || []}
        releaseDate={patchNotesData?.releaseDate}
        loading={patchNotesLoading}
      />

      {/* Section Derniers ajouts ou Résultats de recherche */}
      {!loading && sortedGames.length > 0 && (
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
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 min-h-0">
            <AnimatePresence mode="popLayout">
              {sortedGames.map((game, index) => {
                const isInstalled = !!getGameInstallStatus(game.name || game.title)
                return (
                  <Motion.div
                    key={game.id || index}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'game-details', gameId: game.id } }))
                    }}
                    className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl transition-all duration-500 cursor-pointer hover:border-white/10 hover:bg-white/8 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2"
                    style={{
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
                    }}
                  >
                    {/* Badge "Télécharger" ou "Installé" */}
                    <div className="absolute top-4 left-4 z-20">
                      <Motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(index * 0.02 + 0.1, 0.3), type: "spring", stiffness: 200 }}
                        className="relative group/badge"
                      >
                        {/* Badge avec effet de brillance */}
                        <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border shadow-2xl overflow-hidden ${
                          isInstalled 
                            ? 'bg-emerald-500/20 border-emerald-400/30' 
                            : 'bg-black/60 border-white/10'
                        }`}>
                          {/* Effet de brillance animé */}
                          <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/badge:translate-x-full transition-transform duration-1000 ease-in-out ${
                            isInstalled ? 'via-emerald-400/20' : ''
                          }`} />
                          
                          {/* Contenu du badge */}
                          <div className="relative flex items-center gap-1.5">
                            {isInstalled ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-medium text-emerald-300 tracking-wide">Installé</span>
                              </>
                            ) : (
                              <div className="p-1 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30">
                                <FiDownload className="text-xs text-purple-300" />
                              </div>
                            )}
                          </div>
                          
                          {/* Glow effect au hover */}
                          <div className={`absolute inset-0 rounded-full bg-gradient-to-r transition-all duration-500 pointer-events-none blur-sm ${
                            isInstalled
                              ? 'from-emerald-500/0 via-emerald-500/0 to-emerald-500/0 group-hover/badge:from-emerald-500/20 group-hover/badge:via-emerald-500/10 group-hover/badge:to-emerald-500/0'
                              : 'from-purple-500/0 via-purple-500/0 to-purple-500/0 group-hover/badge:from-purple-500/20 group-hover/badge:via-purple-500/10 group-hover/badge:to-purple-500/0'
                          }`} />
                        </div>
                      </Motion.div>
                    </div>

                    {/* Image du jeu */}
                    <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-black/60 to-black/80 rounded-t-3xl">
                      {(game.coverImage || game.cover_image || game.header_image || game.headerImage) ? (
                        <>
                          <img
                            src={game.coverImage || game.cover_image || game.header_image || game.headerImage}
                            alt={game.name || game.title || 'Jeu'}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                            loading="lazy"
                            decoding="async"
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
                        className={`absolute top-3 right-3 p-2.5 rounded-xl backdrop-blur-md border transition-all z-30 pointer-events-auto ${
                          favoriteIds.includes(game.id) 
                            ? 'opacity-100 bg-red-500/20 border-red-500/30 text-red-400' 
                            : 'opacity-0 group-hover:opacity-100 bg-black/40 border-white/10 text-white hover:bg-red-500/20 hover:border-red-500/30'
                        }`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.9 }}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <FiHeart className={`text-sm ${favoriteIds.includes(game.id) ? 'fill-current' : ''}`} />
                      </Motion.button>
                    </div>

                    {/* Nom du jeu (visible seulement au hover) */}
                    <div className="absolute inset-0 flex flex-col justify-end p-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-3xl -m-6" />
                        <h3 className="relative font-semibold text-lg text-white drop-shadow-lg">
                          {game.name || game.title || 'Sans titre'}
                        </h3>
                      </div>
                    </div>
                    
                    {/* Border glow effect moderne */}
                    <div className="absolute inset-0 rounded-3xl border border-primary/0 group-hover:border-primary/20 transition-all duration-500 pointer-events-none" />
                  </Motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </Motion.section>
      )}

      {loading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <FiGrid className="text-primary text-3xl animate-spin" />
            <p className="text-muted">Chargement des jeux...</p>
          </Motion.div>
        </div>
      )}
    </div>
  )
}
