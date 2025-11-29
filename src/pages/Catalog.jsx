import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiGrid, FiSearch, FiLoader, FiAlertCircle, FiDownload, FiHeart } from 'react-icons/fi'
import { favoritesService } from '../services/favorites'
import { GameCard } from '../components/GameCard'
import { gamesCacheService } from '../services/gamesCache'
import { useSearch } from '../contexts/SearchContext'

const VIRTUAL_BATCH_SIZE = 20 // Optimisé pour de meilleures performances
const IMAGE_LOAD_DELAY = 50 // Délai pour le chargement des images (ms)

export function CatalogPage({ installedGames = [] }) {
  const [games, setGames] = useState(gamesCacheService.getCachedGames())
  const [loading, setLoading] = useState(!gamesCacheService.isCacheValid())
  const [error, setError] = useState('')
  const { debouncedSearchQuery } = useSearch() // Utiliser la recherche avec debounce
  const [favoriteIds, setFavoriteIds] = useState([])
  const [visibleCount, setVisibleCount] = useState(VIRTUAL_BATCH_SIZE)
  const loadMoreRef = useRef(null)
  
  // Mémoriser la fonction de normalisation
  const normalizeName = useCallback((name) => {
    if (!name) return ''
    return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
  }, [])
  
  // Mémoriser le mapping des jeux installés pour des recherches rapides
  // Utiliser launcherId en priorité, puis le nom
  const installedGamesMap = useMemo(() => {
    if (!installedGames || installedGames.length === 0) return { byLauncherId: new Map(), byName: new Map() }
    
    const byLauncherId = new Map()
    const byName = new Map()
    
    installedGames.forEach(g => {
      // Indexer par launcherId (priorité 1)
      if (g.launcherId) {
        byLauncherId.set(g.launcherId, g)
      }
      
      // Indexer par nom normalisé (fallback)
      if (g.name) {
        const normalized = normalizeName(g.name)
        if (normalized) {
          byName.set(normalized, g)
          // Stocker aussi les mots individuels pour la correspondance partielle
          normalized.split(' ').filter(w => w.length > 2).forEach(word => {
            if (!byName.has(word)) byName.set(word, g)
          })
        }
      }
    })
    
    return { byLauncherId, byName }
  }, [installedGames, normalizeName])
  
  // Marquer les jeux comme installés (mémorisé)
  // Utilise launcherId en priorité, puis le nom
  const getGameInstallStatus = useCallback((game) => {
    if (!game || (!installedGamesMap.byLauncherId.size && !installedGamesMap.byName.size)) return null
    
    // Priorité 1 : Recherche par launcherId (le plus fiable)
    if (game.id && installedGamesMap.byLauncherId.has(game.id)) {
      return installedGamesMap.byLauncherId.get(game.id)
    }
    
    // Fallback : Recherche par nom
    const gameName = game.name || game.title
    if (!gameName) return null
    
    const normalizedGameName = normalizeName(gameName)
    if (!normalizedGameName) return null
    
    // Recherche directe dans la map par nom (O(1))
    const directMatch = installedGamesMap.byName.get(normalizedGameName)
    if (directMatch) return directMatch
    
    // Recherche partielle (vérifier si le nom contient des mots de la map)
    const gameWords = normalizedGameName.split(' ').filter(w => w.length > 2)
    for (const word of gameWords) {
      const match = installedGamesMap.byName.get(word)
      if (match) {
        // Vérifier que c'est une vraie correspondance
        const matchName = normalizeName(match.name)
        if (matchName.includes(normalizedGameName) || normalizedGameName.includes(matchName)) {
          return match
        }
      }
    }
    
    return null
  }, [installedGamesMap, normalizeName])

  // Charger les favoris (défini avant le useEffect qui l'utilise)
  const loadFavorites = useCallback(() => {
    const ids = favoritesService.getFavorites()
    setFavoriteIds(ids)
  }, [])

  // Charger les jeux (défini avant le useEffect qui l'utilise)
  const loadGames = useCallback(async (silent = false, forceRefresh = false) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      setError('')
      
      // Utiliser le service de cache partagé
      const gamesList = await gamesCacheService.getGames(forceRefresh)
      
      // Mettre à jour l'état
      if (!silent) {
        setGames(gamesList)
      } else {
        // Mise à jour silencieuse du cache seulement
        setGames(prevGames => {
          // Ne mettre à jour que si les données ont changé
          if (JSON.stringify(prevGames) !== JSON.stringify(gamesList)) {
            return gamesList
          }
          return prevGames
        })
      }
    } catch (err) {
      console.error('Error loading games:', err)
      if (!silent) {
        setError(`Erreur lors du chargement des jeux: ${err.message || err}`)
        setGames([])
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  // Charger les jeux immédiatement (pas de délai)
  useEffect(() => {
    // Charger les favoris immédiatement (local, rapide)
    loadFavorites()
    
    // Si on a un cache récent, l'utiliser
    if (gamesCacheService.isCacheValid()) {
      const cachedGames = gamesCacheService.getCachedGames()
      setGames(cachedGames)
      setLoading(false)
      // Recharger en arrière-plan pour mettre à jour le cache
      loadGames(true)
    } else {
      // Charger immédiatement
      loadGames()
    }
  }, [loadFavorites, loadGames])

  // Forcer un re-render quand installedGames change pour mettre à jour les badges
  useEffect(() => {
    // Le re-render se fera automatiquement car installedGames est utilisé dans le render
  }, [installedGames])

  const handleToggleFavorite = useCallback((gameId) => {
    favoritesService.toggleFavorite(gameId)
    loadFavorites()
  }, [loadFavorites])

  // Filtrer les jeux selon la recherche (mémorisé avec debounce)
  const filteredGames = useMemo(() => {
    // Si pas de jeux chargés, retourner un tableau vide
    if (!games || games.length === 0) {
      return []
    }
    
    // Si pas de recherche ou recherche vide, retourner tous les jeux
    if (!debouncedSearchQuery || !debouncedSearchQuery.trim()) {
      return games
    }
    
    const query = debouncedSearchQuery.toLowerCase().trim()
    if (!query || query.length === 0) {
      return games
    }
    
    // Optimisation : pré-calculer les champs de recherche et utiliser une recherche plus intelligente
    const queryWords = query.split(' ').filter(w => w.length > 0)
    
    return games.filter(game => {
      if (!game) return false
      
      const name = game.name?.toLowerCase() || game.title?.toLowerCase() || ''
      const desc = game.short_description?.toLowerCase() || ''
      const category = game.category?.toLowerCase() || ''
      
      // Recherche par mots-clés : au moins un mot doit être présent (recherche plus permissive)
      return queryWords.some(word => 
        name.includes(word) || desc.includes(word) || category.includes(word)
      )
    })
  }, [games, debouncedSearchQuery])

  useEffect(() => {
    setVisibleCount(VIRTUAL_BATCH_SIZE)
  }, [filteredGames.length])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node) return undefined
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount(prev => Math.min(prev + VIRTUAL_BATCH_SIZE, filteredGames.length))
      }
    }, { rootMargin: '300px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [filteredGames.length])

  const visibleGames = useMemo(() => filteredGames.slice(0, visibleCount), [filteredGames, visibleCount])

  const handleCardClick = useCallback((game) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'game-details', gameId: game.id } }))
  }, [])

  // Composant de carte optimisé avec lazy loading des images
  const GameCardOptimized = memo(({ game, index, isFavorite, installedGame, onToggleFavorite, onClick }) => {
    const [shouldLoadImage, setShouldLoadImage] = useState(index < 12) // Charger les 12 premières immédiatement
    const [imageError, setImageError] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)
    const imageRef = useRef(null)
    const observerRef = useRef(null)
    
    // Utiliser IntersectionObserver pour charger les images quand elles sont visibles
    useEffect(() => {
      if (shouldLoadImage || imageError) return
      
      // Nettoyer l'observer précédent s'il existe
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setShouldLoadImage(true)
              if (observerRef.current) {
                observerRef.current.disconnect()
                observerRef.current = null
              }
            }
          })
        },
        { rootMargin: '200px' } // Charger 200px avant que l'image soit visible pour éviter la disparition
      )
      
      if (imageRef.current) {
        observerRef.current.observe(imageRef.current)
      }
      
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect()
          observerRef.current = null
        }
      }
    }, [shouldLoadImage, imageError])
    
    // Charger l'image avec un léger délai pour les images non prioritaires (fallback)
    useEffect(() => {
      if (!shouldLoadImage && index >= 12 && !imageError) {
        const timer = setTimeout(() => setShouldLoadImage(true), IMAGE_LOAD_DELAY * (index - 12))
        return () => clearTimeout(timer)
      }
    }, [shouldLoadImage, index, imageError])
    
    const coverUrl = game.coverImage || game.cover_image || game.header_image || game.headerImage
    const isInstalled = !!installedGame
    const handleClick = useCallback(() => onClick(game), [onClick, game])
    const handleFavorite = useCallback((e) => {
      e.stopPropagation()
      e.preventDefault()
      onToggleFavorite(game.id)
    }, [onToggleFavorite, game.id])
    
    return (
      <div
        onClick={handleClick}
        className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm transition-all duration-200 cursor-pointer hover:border-white/10 hover:bg-white/8"
        style={{
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Badge "Télécharger" ou "Installé" */}
        <div className="absolute top-4 left-4 z-20">
          <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm border shadow-lg ${
            isInstalled 
              ? 'bg-emerald-500/20 border-emerald-400/30' 
              : 'bg-black/60 border-white/10'
          }`}>
            {isInstalled ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-medium text-emerald-300">Installé</span>
              </>
            ) : (
              <div className="p-1 rounded-full bg-purple-500/20 border border-purple-400/30">
                <FiDownload className="text-xs text-purple-300" />
              </div>
            )}
          </div>
        </div>

        {/* Image du jeu */}
        <div 
          ref={imageRef}
          className="relative aspect-video overflow-hidden bg-gradient-to-br from-black/60 to-black/80 rounded-t-3xl"
        >
          {shouldLoadImage && coverUrl && !imageError ? (
            <>
              <img
                src={coverUrl}
                alt={game.name || game.title || 'Jeu'}
                className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ease-out ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading={index < 12 ? "eager" : "lazy"}
                decoding="async"
                fetchpriority={index < 12 ? "high" : "low"}
                onError={(e) => {
                  setImageError(true)
                  setImageLoaded(false)
                }}
                onLoad={(e) => {
                  setImageError(false)
                  setImageLoaded(true)
                  // S'assurer que l'image reste visible même après le scroll
                  e.target.style.display = 'block'
                }}
                style={{ 
                  minHeight: '200px',
                  backgroundColor: 'transparent'
                }}
              />
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-muted/40 to-surface-muted/20">
                  <FiGrid className="text-muted text-5xl opacity-50 animate-pulse" />
                </div>
              )}
              <div className="hidden absolute inset-0 flex items-center justify-center bg-black/30">
                <FiGrid className="text-muted text-4xl" />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-muted/40 to-surface-muted/20">
              <FiGrid className="text-muted text-5xl opacity-50" />
            </div>
          )}
          {/* Overlay gradient simplifié */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {/* Bouton favori */}
          <button
            onClick={handleFavorite}
            className={`absolute top-3 right-3 p-2.5 rounded-xl backdrop-blur-md border transition-all z-30 ${
              isFavorite 
                ? 'opacity-100 bg-red-500/20 border-red-500/30 text-red-400' 
                : 'opacity-0 group-hover:opacity-100 bg-black/40 border-white/10 text-white hover:bg-red-500/20 hover:border-red-500/30'
            }`}
            style={{ pointerEvents: 'auto' }}
          >
            <FiHeart className={`text-sm ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Nom du jeu (visible seulement au hover) */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent rounded-b-3xl -m-4" />
            <h3 className="relative font-semibold text-base text-white drop-shadow-md">
              {game.name || game.title || 'Sans titre'}
            </h3>
          </div>
        </div>
      </div>
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
            {debouncedSearchQuery ? 'Aucun jeu trouvé' : 'Aucun jeu disponible'}
          </Motion.h2>
          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="empty-description"
          >
            {debouncedSearchQuery
              ? 'Essayez avec d\'autres mots-clés.'
              : 'Le catalogue sera bientôt disponible. Revenez plus tard pour découvrir nos jeux.'}
          </Motion.p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {filteredGames.length} {filteredGames.length === 1 ? 'jeu' : 'jeux'}
              {debouncedSearchQuery && ` pour "${debouncedSearchQuery}"`}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {visibleGames.map((game, index) => (
                <Motion.div
                  key={game.id || index}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: index * 0.03,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  layout
                >
                  <GameCardOptimized
                    game={game}
                    index={index}
                    isFavorite={favoriteIds.includes(game.id)}
                    installedGame={getGameInstallStatus(game)}
                    onToggleFavorite={handleToggleFavorite}
                    onClick={handleCardClick}
                  />
                </Motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {/* Indicateur de chargement pour les jeux suivants */}
          {visibleCount < filteredGames.length && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-muted">
                <FiLoader className="animate-spin" />
                <span className="text-sm">Chargement de plus de jeux...</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
