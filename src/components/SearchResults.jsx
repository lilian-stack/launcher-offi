import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiSearch, FiDownload, FiGrid } from 'react-icons/fi'
import { useSearch } from '../contexts/SearchContext'
import { gamesCacheService } from '../services/gamesCache'

export function SearchResults({ installedGames = [], onGameClick }) {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  let searchContext
  try {
    searchContext = useSearch()
  } catch (err) {
    console.error('[SearchResults] Erreur useSearch:', err)
    searchContext = { searchQuery: '', debouncedSearchQuery: '', updateSearchQuery: () => {} }
  }
  const debouncedSearchQuery = searchContext?.debouncedSearchQuery || ''
  const searchQuery = searchContext?.searchQuery || ''
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(false)
  const searchResultsRef = useRef(null)
  
  // Calculer la position depuis le wrapper de recherche
  useEffect(() => {
    if (searchResultsRef.current && searchQuery && searchQuery.trim()) {
      const updatePosition = () => {
        const searchWrapper = document.querySelector('.search-wrapper')
        if (searchWrapper && searchResultsRef.current) {
          const rect = searchWrapper.getBoundingClientRect()
          searchResultsRef.current.style.top = `${rect.bottom + 8}px`
          searchResultsRef.current.style.left = `${rect.left}px`
          searchResultsRef.current.style.width = `${rect.width}px`
        }
      }
      
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [searchQuery])
  
  // Charger tous les jeux pour la recherche
  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true)
        // Essayer d'abord le cache
        let allGames = []
        try {
          allGames = await gamesCacheService.getGames(false)
        } catch (cacheErr) {
          console.warn('[SearchResults] Erreur cache, essai direct:', cacheErr)
        }
        
        // Si le cache est vide ou échoue, charger directement depuis Electron
        if (!allGames || allGames.length === 0) {
          if (window.electron && window.electron.games && window.electron.games.getGames) {
            const data = await window.electron.games.getGames()
            allGames = data?.games || []
            console.log('[SearchResults] Jeux chargés depuis Electron:', allGames.length)
          }
        } else {
          console.log('[SearchResults] Jeux chargés depuis le cache:', allGames.length)
        }
        
        setGames(allGames || [])
      } catch (err) {
        console.error('[SearchResults] Erreur lors du chargement des jeux:', err)
        setGames([])
      } finally {
        setLoading(false)
      }
    }
    loadGames()
  }, [])
  
  // Normaliser les noms pour la correspondance
  const normalizeName = useCallback((name) => {
    if (!name) return ''
    return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
  }, [])
  
  // Mapper les jeux installés
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
  
  // Vérifier si un jeu est installé
  const getGameInstallStatus = useCallback((game) => {
    if (!game || installedGamesMap.size === 0) return null
    const gameName = game.name || game.title
    if (!gameName) return null
    const normalizedGameName = normalizeName(gameName)
    return installedGamesMap.get(normalizedGameName) || null
  }, [installedGamesMap, normalizeName])
  
  // Algorithme de recherche intelligent avec scoring de pertinence
  const filteredGames = useMemo(() => {
    const queryToUse = searchQuery || debouncedSearchQuery
    
    if (!queryToUse || !queryToUse.trim() || !games.length) {
      return []
    }
    
    const query = queryToUse.toLowerCase().trim()
    if (!query || query.length < 2) { // Minimum 2 caractères
      return []
    }
    
    const queryWords = query.split(/\s+/).filter(w => w.length > 0)
    
    // Fonction de scoring pour classer les résultats par pertinence
    const calculateScore = (game) => {
      if (!game) return 0
      
      const name = (game.name || game.title || '').toLowerCase()
      const desc = (game.short_description || game.description || '').toLowerCase()
      
      // Gérer category/genre qui peut être un string ou un array
      let categoryStr = ''
      if (game.category) {
        categoryStr = Array.isArray(game.category) 
          ? game.category.map(c => String(c).toLowerCase()).join(' ')
          : String(game.category).toLowerCase()
      } else if (game.genre) {
        categoryStr = Array.isArray(game.genre)
          ? game.genre.map(g => String(g).toLowerCase()).join(' ')
          : String(game.genre).toLowerCase()
      }
      
      // Gérer les tags
      const tags = Array.isArray(game.tags) 
        ? game.tags.map(t => String(t).toLowerCase()).join(' ') 
        : (game.tags ? String(game.tags).toLowerCase() : '')
      
      let score = 0
      
      // Recherche exacte dans le nom (score le plus élevé)
      if (name === query) score += 1000
      else if (name.startsWith(query)) score += 500
      else if (name.includes(query)) score += 200
      
      // Recherche par mots dans le nom
      queryWords.forEach(word => {
        if (name.includes(word)) {
          // Bonus si le mot est au début du nom
          if (name.startsWith(word)) score += 150
          else score += 50
        }
      })
      
      // Recherche dans la description
      if (desc.includes(query)) score += 30
      queryWords.forEach(word => {
        if (desc.includes(word)) score += 10
      })
      
      // Recherche dans la catégorie/genre
      if (categoryStr && categoryStr.includes(query)) score += 40
      queryWords.forEach(word => {
        if (categoryStr && categoryStr.includes(word)) score += 15
      })
      
      // Recherche dans les tags
      if (tags && tags.includes(query)) score += 25
      queryWords.forEach(word => {
        if (tags && tags.includes(word)) score += 8
      })
      
      return score
    }
    
    // Filtrer et scorer les jeux
    const scoredGames = games
      .map(game => ({
        game,
        score: calculateScore(game)
      }))
      .filter(item => item.score > 0) // Seulement les jeux avec un score > 0
      .sort((a, b) => b.score - a.score) // Trier par score décroissant
      .slice(0, 8) // Limiter à 8 résultats
      .map(item => item.game) // Retourner seulement les jeux
    
    return scoredGames
  }, [games, searchQuery, debouncedSearchQuery])
  
  // Gérer le clic sur un jeu
  const handleGameClick = useCallback((game) => {
    if (onGameClick && game.id) {
      onGameClick(game.id)
    } else {
      window.dispatchEvent(new CustomEvent('navigate', { 
        detail: { page: 'game-details', gameId: game.id } 
      }))
    }
  }, [onGameClick])
  
  // Debug: vérifier que le composant est bien rendu (AVANT tout return conditionnel)
  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      console.log('[SearchResults] State:', { 
        searchQuery, 
        debouncedSearchQuery, 
        gamesCount: games.length, 
        filteredCount: filteredGames.length,
        loading
      })
    }
  }, [searchQuery, debouncedSearchQuery, games.length, filteredGames.length, loading])
  
  // Ne pas afficher si pas de recherche ou recherche vide (APRÈS tous les hooks)
  if (!searchQuery || !searchQuery.trim()) {
    return null
  }
  
  return (
    <Motion.div
      ref={searchResultsRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      style={{ 
        position: 'fixed',
        zIndex: 10000,
        maxWidth: '600px'
      }}
    >
          <div 
            className="bg-gradient-to-br from-surface-muted/98 via-surface-muted/95 to-surface-muted/98 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden"
            style={{
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(139, 92, 246, 0.1) inset, 0 0 40px rgba(139, 92, 246, 0.1)',
              backgroundColor: 'rgba(19, 19, 28, 0.98)',
            }}
          >
            {/* En-tête moderne */}
            <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
                    <FiSearch className="text-primary text-lg" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {filteredGames.length > 0 
                        ? `${filteredGames.length} résultat${filteredGames.length > 1 ? 's' : ''} trouvé${filteredGames.length > 1 ? 's' : ''}`
                        : 'Aucun résultat'
                      }
                    </p>
                    <p className="text-xs text-white/50 mt-0.5">
                      {filteredGames.length > 0 
                        ? `pour "${searchQuery}"`
                        : `Aucun jeu ne correspond à "${searchQuery}"`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Liste des résultats */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-3"></div>
                  <p className="text-sm text-white/60">Chargement des jeux...</p>
                </div>
              ) : filteredGames.length > 0 ? (
                filteredGames.map((game, index) => {
                const isInstalled = !!getGameInstallStatus(game)
                const coverUrl = game.coverImage || game.cover_image || game.header_image || game.headerImage
                
                return (
                  <Motion.div
                    key={game.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                    onClick={() => handleGameClick(game)}
                    className="group relative flex items-center gap-3 px-4 py-3 hover:bg-gradient-to-r hover:from-primary/10 hover:via-primary/5 hover:to-transparent cursor-pointer transition-all duration-300 border-b border-white/5 last:border-b-0 hover:border-primary/20"
                  >
                    {/* Image du jeu - Design moderne */}
                    <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-black/40 border border-white/10 group-hover:border-primary/30 transition-all duration-300">
                      {coverUrl ? (
                        <>
                          <img
                            src={coverUrl}
                            alt={game.name || game.title || 'Jeu'}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <FiGrid className="text-primary/50 text-2xl" />
                        </div>
                      )}
                      {/* Badge installé moderne - seulement sur l'image */}
                      {isInstalled && (
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-lg border border-white/20" />
                      )}
                    </div>
                    
                    {/* Informations du jeu - Design amélioré */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-sm leading-tight group-hover:text-primary transition-colors duration-200">
                          {game.name || game.title || 'Sans titre'}
                        </h3>
                      </div>
                      {game.short_description && (
                        <p className="text-xs text-white/50 line-clamp-1 leading-relaxed">
                          {game.short_description}
                        </p>
                      )}
                      {/* Catégorie/Genre */}
                      {(game.category || game.genre) && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary/80 border border-primary/20">
                            {Array.isArray(game.genre) ? game.genre[0] : (Array.isArray(game.category) ? game.category[0] : (game.category || game.genre))}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Badge Installé ou Icône de téléchargement */}
                    {isInstalled ? (
                      <div className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                        <span className="text-xs font-semibold text-emerald-300">Installé</span>
                      </div>
                    ) : (
                      <div className="flex-shrink-0 p-2 rounded-xl bg-primary/10 border border-primary/20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                        <FiDownload className="text-primary text-lg" />
                      </div>
                    )}
                  </Motion.div>
                )
              })
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                    <FiGrid className="text-primary/60 text-3xl" />
                  </div>
                  <p className="text-base font-semibold text-white mb-2">Aucun jeu trouvé</p>
                  <p className="text-sm text-white/50 mb-4">Essayez avec d'autres mots-clés ou vérifiez l'orthographe</p>
                  <div className="flex flex-wrap gap-2 justify-center text-xs text-white/40">
                    <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">Astuce: Utilisez au moins 2 caractères</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer si plus de résultats */}
            {filteredGames.length >= 8 && (
              <div className="px-4 py-3 border-t border-white/10 bg-white/5 text-center">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: 'catalog' }))
                  }}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Voir tous les résultats →
                </button>
              </div>
            )}
          </div>
        </Motion.div>
  )
}

