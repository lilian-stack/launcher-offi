import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Motion, AnimatePresence } from './Motion'
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
  
  // Plus besoin de calculer la position - le composant est maintenant positionné relativement au wrapper
  
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
          }
        } else {
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
  // Logs supprimés pour optimisation
  
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
      className="w-full"
      style={{ 
        position: 'relative',
        zIndex: 10000
      }}
    >
          <div 
            className="bg-gradient-to-br from-[#0a0a0f]/98 via-[#1a1a20]/95 to-[#0a0a0f]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(6, 182, 212, 0.1) inset, 0 0 30px rgba(6, 182, 212, 0.08)',
              backgroundColor: 'rgba(10, 10, 15, 0.98)',
            }}
          >
            {/* En-tête moderne et épuré */}
            <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[#0a0a0f]/50 via-[#1a1a20]/30 to-[#0a0a0f]/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Motion.div 
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    className="p-2.5 rounded-xl bg-gradient-to-br from-[#06b6d4]/20 to-[#0891b2]/20 border border-[#06b6d4]/30"
                  >
                    <FiSearch className="text-[#06b6d4] text-lg" />
                  </Motion.div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {filteredGames.length > 0 
                        ? `${filteredGames.length} résultat${filteredGames.length > 1 ? 's' : ''} trouvé${filteredGames.length > 1 ? 's' : ''}`
                        : 'Aucun résultat'
                      }
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                    onClick={() => handleGameClick(game)}
                    className="group relative flex items-center gap-3 px-4 py-1.5 hover:bg-white/5 cursor-pointer transition-all duration-200 border-b border-white/5 last:border-b-0"
                  >
                    {/* Miniature - Agrandie */}
                    <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-black/40 border border-white/10">
                      {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={game.name || game.title || 'Jeu'}
                          className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <FiGrid className="text-primary/50 text-base" />
                        </div>
                      )}
                      {/* Badge installé - petit point */}
                      {isInstalled && (
                        <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white/20" />
                      )}
                    </div>
                    
                    {/* Nom du jeu - Agrandi */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-semibold text-white text-base leading-tight group-hover:text-[#06b6d4] transition-colors duration-200">
                        {game.name || game.title || 'Sans titre'}
                      </h3>
                      {/* Badge Installé compact */}
                      {isInstalled && (
                        <span className="text-[11px] font-medium text-emerald-400 mt-0.5">Installé</span>
                      )}
                    </div>
                    
                    {/* Icône de téléchargement */}
                    {!isInstalled && (
                      <div className="flex-shrink-0 p-1.5 rounded-lg bg-primary/10 border border-primary/20 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                        <FiDownload className="text-primary text-sm" />
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

