import { useState, useEffect, useCallback } from 'react'
import { favoritesService } from '../services/favorites'
import { GameCard } from '../components/GameCard'
import { gamesCacheService } from '../services/gamesCache'
import './Library.css'

export const LibraryPage = ({ onNavigate }) => {
  const [installedGames, setInstalledGames] = useState([])
  const [favoriteIds, setFavoriteIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Charger les jeux installés et favoris
  useEffect(() => {
    initializeAndLoadLibraryData()
  }, [])

  const initializeAndLoadLibraryData = async () => {
    try {
      // Initialiser SQLite d'abord
      if (window.electron?.ipcRenderer) {
        console.log('[Library] 🔧 Initialisation SQLite...')
        const initResult = await window.electron.ipcRenderer.invoke('sqlite-library:init')
        if (initResult.success) {
          console.log('[Library] ✅ SQLite initialisé avec succès')
        } else {
          console.error('[Library] ❌ Erreur initialisation SQLite:', initResult.error)
        }
      }
      
      // Charger les données
      await loadLibraryData()
    } catch (error) {
      console.error('[Library] ❌ Erreur initialisation:', error)
      await loadLibraryData() // Essayer de charger quand même
    }
  }

  const loadLibraryData = async () => {
    try {
      setLoading(true)
      
      // Charger les jeux installés depuis SQLite
      let installedGamesData = []
      if (window.electron?.ipcRenderer) {
        try {
          console.log('[Library] 📡 Récupération des jeux installés depuis SQLite...')
          const result = await window.electron.ipcRenderer.invoke('sqlite-library:getGames')
          console.log('[Library] 📊 Résultat SQLite:', result)
          
          if (result.success && result.games) {
            console.log('[Library] ✅ Jeux installés chargés:', result.games.length)
            installedGamesData = result.games
            
            // Log détaillé des jeux
            result.games.forEach(game => {
              console.log(`[Library] 🎮 Jeu installé: ${game.name} (ID: ${game.id || game.gameId})`)
            })
          } else {
            console.warn('[Library] ⚠️ Aucun jeu installé trouvé ou erreur:', result.error)
          }
        } catch (error) {
          console.error('[Library] ❌ Erreur chargement jeux installés:', error)
        }
      } else {
        console.warn('[Library] ⚠️ Electron IPC non disponible')
      }
      
      // Charger les favoris
      const favorites = favoritesService.getFavorites()
      console.log('[Library] ❤️ Favoris chargés:', favorites)
      
      // Charger tous les jeux du catalogue pour enrichir les données
      let allGames = []
      try {
        console.log('[Library] 🔗 Récupération du catalogue depuis le cache...')
        
        let catalogGames = gamesCacheService.getCachedGames()
        if (catalogGames.length === 0) {
          console.log('[Library] 📡 Cache vide, chargement depuis l\'API...')
          catalogGames = await gamesCacheService.getGames(false)
        }
        
        console.log('[Library] 📊 Jeux du catalogue disponibles:', catalogGames.length)
        
        // Créer un map des jeux du catalogue par ID
        const catalogMapById = new Map()
        catalogGames.forEach(catalogGame => {
          if (catalogGame.id) {
            catalogMapById.set(String(catalogGame.id), catalogGame)
          }
        })
        
        // Créer un map des jeux du catalogue par nom pour les jeux installés
        const catalogMapByName = new Map()
        catalogGames.forEach(catalogGame => {
          const name = (catalogGame.name || catalogGame.title || '').toLowerCase().trim()
          if (name) {
            catalogMapByName.set(name, catalogGame)
          }
        })
        
        // 1. Enrichir les jeux installés avec les données du catalogue
        const enrichedInstalledGames = installedGamesData.map(installedGame => {
          const installedName = (installedGame.name || '').toLowerCase().trim()
          const catalogGame = catalogMapByName.get(installedName)
          
          if (catalogGame) {
            console.log(`[Library] 🎯 Match installé trouvé pour "${installedGame.name}"`)
            return {
              ...installedGame,
              isInstalled: true,
              coverImage: catalogGame.coverImage,
              cover_image: catalogGame.cover_image,
              header_image: catalogGame.header_image,
              headerImage: catalogGame.headerImage,
              image: catalogGame.image,
              description: catalogGame.description,
              category: catalogGame.category,
              genre: catalogGame.genre,
              isOnline: catalogGame.isOnline,
              catalogId: catalogGame.id
            }
          }
          
          return {
            ...installedGame,
            isInstalled: true
          }
        })
        
        // 2. Ajouter les jeux favoris qui ne sont pas installés
        const installedGameIds = new Set(enrichedInstalledGames.map(g => String(g.catalogId || g.id || g.gameId)).filter(Boolean))
        
        const favoriteGamesFromCatalog = favorites
          .map(favId => catalogMapById.get(String(favId)))
          .filter(game => game && !installedGameIds.has(String(game.id)))
          .map(game => ({
            ...game,
            isInstalled: false,
            catalogId: game.id
          }))
        
        console.log('[Library] 📋 Favoris du catalogue (non installés):', favoriteGamesFromCatalog.length)
        
        // 3. Combiner tous les jeux
        allGames = [...enrichedInstalledGames, ...favoriteGamesFromCatalog]
        
        console.log('[Library] ✅ Total des jeux:', {
          installed: enrichedInstalledGames.length,
          favoritesNotInstalled: favoriteGamesFromCatalog.length,
          total: allGames.length
        })
        
      } catch (error) {
        console.error('[Library] ❌ Erreur lors du chargement du catalogue:', error)
        allGames = installedGamesData.map(game => ({ ...game, isInstalled: true }))
      }
      
      setInstalledGames(allGames)
      setFavoriteIds(favorites || [])
      
    } catch (error) {
      console.error('[Library] ❌ Erreur lors du chargement:', error)
      setInstalledGames([])
      setFavoriteIds([])
    } finally {
      setLoading(false)
    }
  }

  // Gérer les favoris
  const handleToggleFavorite = useCallback(async (gameId) => {
    try {
      const normalizedGameId = String(gameId)
      console.log('[Library] 🔄 Toggle favori pour:', normalizedGameId)
      
      const success = favoritesService.toggleFavorite(normalizedGameId)
      
      if (success) {
        const updatedFavorites = favoritesService.getFavorites()
        setFavoriteIds(updatedFavorites)
        console.log('[Library] ✅ Favoris mis à jour:', updatedFavorites.length)
      } else {
        console.warn('[Library] ⚠️ Échec du toggle pour:', normalizedGameId)
      }
    } catch (error) {
      console.error('[Library] ❌ Erreur lors de la gestion des favoris:', error)
    }
  }, [])

  // Filtrer les jeux par recherche
  const filteredGames = installedGames.filter(game => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      game.name?.toLowerCase().includes(term) ||
      game.category?.toLowerCase().includes(term)
    )
  })

  // Déduplication des jeux par ID pour éviter les doublons
  const uniqueGames = filteredGames.reduce((acc, game) => {
    const gameId = String(game.id || game.gameId || game.catalogId)
    if (!acc.has(gameId)) {
      acc.set(gameId, game)
    }
    return acc
  }, new Map())
  
  const deduplicatedGames = Array.from(uniqueGames.values())
  
  // Séparer favoris et autres jeux
  const favoriteGames = deduplicatedGames.filter(game => {
    const gameId = String(game.id || game.gameId || game.catalogId)
    return favoriteIds.includes(gameId)
  })
  const otherGames = deduplicatedGames.filter(game => {
    const gameId = String(game.id || game.gameId || game.catalogId)
    return !favoriteIds.includes(gameId)
  })

  if (loading) {
    return (
      <div className="library-container">
        <div className="library-header">
          <div className="library-title-section">
            <div className="library-icon">🎮</div>
            <div>
              <h1 className="library-title">Ma Bibliothèque</h1>
              <p className="library-subtitle">Chargement...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="library-container">
      {/* Header avec icône et titre */}
      <div className="library-header">
        <div className="library-title-section">
          <div className="library-icon">🎮</div>
          <div>
            <h1 className="library-title">Ma Bibliothèque</h1>
            <p className="library-subtitle">
              {deduplicatedGames.filter(g => g.isInstalled).length} jeu{deduplicatedGames.filter(g => g.isInstalled).length !== 1 ? 'x' : ''} installé{deduplicatedGames.filter(g => g.isInstalled).length !== 1 ? 's' : ''} • {favoriteIds.length} favori{favoriteIds.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {/* Barre de recherche */}
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Rechercher un jeu..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Section Favoris */}
      {favoriteGames.length > 0 && (
        <>
          <div className="section-wrapper">
            <div className="section-header">
              <div className="section-title favorites-title">
                <span className="section-title-icon favorites-icon">❤️</span>
                <span>Favoris</span>
                <span className="section-badge favorites-badge">{favoriteGames.length}</span>
              </div>
            </div>
            
            <div className="games-grid">
              {favoriteGames.map((game, index) => (
                <GameCard
                  key={`favorite-${game.id || game.gameId || game.catalogId}-${index}`}
                  game={game}
                  index={index}
                  isFavorite={true}
                  installedGame={game.isInstalled ? {
                    path: game.installFolder || game.path,
                    gamePath: game.installFolder || game.path,
                    exePath: game.executable || game.exe,
                    name: game.name || game.title,
                    installDate: game.installDate,
                    version: game.installedVersion || game.version,
                    launcherId: game.launcherId
                  } : null}
                  onToggleFavorite={() => handleToggleFavorite(game.id || game.gameId || game.catalogId)}
                  onClick={() => onNavigate('game-details', game.catalogId || game.id || game.gameId)}
                />
              ))}
            </div>
          </div>

          {otherGames.filter(game => game.isInstalled).length > 0 && <div className="section-separator"></div>}
        </>
      )}

      {/* Section Tous les jeux installés */}
      {otherGames.filter(game => game.isInstalled).length > 0 && (
        <div className="section-wrapper">
          <div className="section-header">
            <div className="section-title installed-title">
              <span className="section-title-icon installed-icon">📦</span>
              <span>Tous les jeux installés</span>
              <span className="section-badge installed-badge">{otherGames.filter(game => game.isInstalled).length}</span>
            </div>
          </div>
          
          <div className="games-grid">
            {otherGames.filter(game => game.isInstalled).map((game, index) => (
              <GameCard
                key={`installed-${game.id || game.gameId || game.catalogId}-${index}`}
                game={game}
                index={index}
                isFavorite={false}
                installedGame={{
                  path: game.installFolder || game.path,
                  gamePath: game.installFolder || game.path,
                  exePath: game.executable || game.exe,
                  name: game.name || game.title,
                  installDate: game.installDate,
                  version: game.installedVersion || game.version,
                  launcherId: game.launcherId
                }}
                onToggleFavorite={() => handleToggleFavorite(game.id || game.gameId || game.catalogId)}
                onClick={() => onNavigate('game-details', game.catalogId || game.id || game.gameId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* État vide */}
      {deduplicatedGames.filter(g => g.isInstalled).length === 0 && favoriteIds.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-title">Aucun jeu installé</div>
          <div className="empty-description">
            Téléchargez des jeux depuis le catalogue pour les voir ici
          </div>
        </div>
      )}

      {/* Aucun résultat de recherche */}
      {installedGames.length > 0 && deduplicatedGames.length === 0 && searchTerm && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Aucun résultat</div>
          <div className="empty-description">
            Aucun jeu ne correspond à "{searchTerm}"
          </div>
        </div>
      )}
    </div>
  )
}