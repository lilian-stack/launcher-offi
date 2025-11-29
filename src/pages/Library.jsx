import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiBookOpen, FiPlay, FiFolder, FiTrash2, FiLoader } from 'react-icons/fi'
import { UninstallModal } from '../components/UninstallModal'

export function LibraryPage({ onNavigate, activePage, installedGames = [], currentUser = null }) {
  const [isBoostMode, setIsBoostMode] = useState(false)
  const [isUninstalling, setIsUninstalling] = useState({})
  const [catalogGames, setCatalogGames] = useState([])
  const [showUninstallModal, setShowUninstallModal] = useState(false)
  const [gameToUninstall, setGameToUninstall] = useState(null)
  
  useEffect(() => {
    const loadCatalogGames = async () => {
      try {
        if (window.electron && window.electron.games && window.electron.games.getGames) {
          const data = await window.electron.games.getGames()
          setCatalogGames(data.games || [])
        }
      } catch (err) {
        console.error('[Library] Erreur lors du chargement du catalogue:', err)
      }
    }
    loadCatalogGames()
  }, [])
  
  // Mémoriser la fonction de normalisation
  const normalizeName = useCallback((name) => {
    if (!name) return ''
    // Remplacer les tirets par des espaces, puis normaliser
    return name.toLowerCase().trim().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
  }, [])

  // Mémoriser le mapping des jeux du catalogue pour des recherches rapides
  const catalogGamesMap = useMemo(() => {
    if (!catalogGames || catalogGames.length === 0) return new Map()
    
    const map = new Map()
    catalogGames.forEach(g => {
      const title = g.title || g.name || ''
      if (title) {
        const normalized = normalizeName(title)
        if (normalized) {
          map.set(normalized, g)
        }
      }
    })
    return map
  }, [catalogGames, normalizeName])

  // Fonction pour trouver le jeu dans le catalogue et retourner ses données complètes
  const findGameInCatalog = useCallback((gameName) => {
    if (!gameName || catalogGamesMap.size === 0) return null
    
    const normalizedGameName = normalizeName(gameName)
    if (!normalizedGameName) return null
    
    // Enlever les suffixes comme "ankergames" pour la recherche
    const cleanGameName = normalizedGameName.replace(/ankergames$/, '').replace(/ankergame$/, '').trim()
    
    // Recherche directe dans la map (O(1))
    let foundGame = catalogGamesMap.get(normalizedGameName)
    if (foundGame) {
      return foundGame
    }
    
    // Recherche avec le nom nettoyé
    if (cleanGameName && cleanGameName !== normalizedGameName) {
      foundGame = catalogGamesMap.get(cleanGameName)
      if (foundGame) {
        return foundGame
      }
    }
    
    // Recherche partielle si nécessaire (plus flexible)
    const gameWords = cleanGameName.split(' ').filter(w => w.length > 2)
    
    for (const [key, game] of catalogGamesMap.entries()) {
      const cleanKey = key.replace(/ankergames$/, '').replace(/ankergame$/, '').trim()
      const keyWords = cleanKey.split(' ').filter(w => w.length > 2)
      
      if (key === normalizedGameName || 
          key === cleanGameName ||
          cleanKey === normalizedGameName ||
          cleanKey === cleanGameName ||
          key.includes(normalizedGameName) || 
          normalizedGameName.includes(key) ||
          cleanKey.includes(cleanGameName) ||
          cleanGameName.includes(cleanKey)) {
        return game
      }
      
      if (gameWords.length > 0 && keyWords.length > 0) {
        const matchingWords = gameWords.filter(w => keyWords.includes(w))
        const matchRatio = matchingWords.length / Math.max(gameWords.length, keyWords.length)
        if (matchRatio >= 0.5) {
          return game
        }
      }
    }
    
    return null
  }, [catalogGamesMap, normalizeName])

  const getGameImage = useCallback((gameName) => {
    const foundGame = findGameInCatalog(gameName)
    return foundGame ? (foundGame.coverImage || foundGame.image || foundGame.header_image || null) : null
  }, [findGameInCatalog])
  
  // Fonction pour naviguer vers GameDetails
  const handleGameClick = useCallback((game) => {
    // Chercher le jeu dans le catalogue pour obtenir son ID
    const catalogGame = findGameInCatalog(game.name)
    if (catalogGame && catalogGame.id) {
      window.dispatchEvent(new CustomEvent('navigate', { 
        detail: { page: 'game-details', gameId: catalogGame.id } 
      }))
    } else {
      // Si le jeu n'est pas trouvé dans le catalogue, essayer avec le launcherId
      if (game.launcherId) {
        window.dispatchEvent(new CustomEvent('navigate', { 
          detail: { page: 'game-details', gameId: game.launcherId } 
        }))
      } else {
        console.warn('[Library] Jeu non trouvé dans le catalogue:', game.name)
      }
    }
  }, [findGameInCatalog])
  
  useEffect(() => {
    setIsBoostMode(activePage === 'favorites')
  }, [activePage])
  
  const handleToggle = (e) => {
    setIsBoostMode(e.target.checked)
    if (e.target.checked) {
      onNavigate?.('favorites')
    } else {
      onNavigate?.('library')
    }
  }
  
  const handleLaunchGame = async (game) => {
    const exePath = game.exePath || game.executable
    if (!exePath) {
      if (window.electron && window.electron.games && window.electron.games.findGameExe) {
        try {
          const result = await window.electron.games.findGameExe(game.folder, game.name)
          if (result.success && result.exePath) {
            // Utiliser le nouveau handler avec vérification de pub
            if (window.electron.games.launchGameWithAds) {
              const userStatus = currentUser ? {
                isVip: currentUser.isVip || false,
                isBoost: currentUser.isBoost || false,
                id: currentUser.id || null
              } : { isVip: false, isBoost: false, id: null }
              await window.electron.games.launchGameWithAds(result.exePath, game.name, userStatus)
              return
            } else if (window.electron.games.launchGame) {
              // Fallback vers l'ancien handler si le nouveau n'existe pas
              await window.electron.games.launchGame(result.exePath)
              return
            }
          }
        } catch (err) {
          console.error('[Library] Erreur lors de la recherche de l\'exécutable:', err)
        }
      }
      alert('Impossible de trouver l\'exécutable du jeu.')
      return
    }
    
    // Utiliser le nouveau handler avec vérification de pub
    if (window.electron && window.electron.games && window.electron.games.launchGameWithAds) {
      try {
        const userStatus = currentUser ? {
          isVip: currentUser.isVip || false,
          isBoost: currentUser.isBoost || false,
          id: currentUser.id || null
        } : { isVip: false, isBoost: false, id: null }
        await window.electron.games.launchGameWithAds(exePath, game.name, userStatus)
      } catch (err) {
        console.error('[Library] Erreur lors du lancement:', err)
        alert('Erreur lors du lancement: ' + err.message)
      }
    } else if (window.electron && window.electron.games && window.electron.games.launchGame) {
      // Fallback vers l'ancien handler si le nouveau n'existe pas
      try {
        await window.electron.games.launchGame(exePath)
      } catch (err) {
        console.error('[Library] Erreur lors du lancement:', err)
        alert('Erreur lors du lancement: ' + err.message)
      }
    }
  }
  
  const handleUninstall = (gameName) => {
    setGameToUninstall(gameName)
    setShowUninstallModal(true)
  }
  
  return (
    <div className="space-y-6">
      {/* Bibliothèque/Favoris Switch */}
      <div className="flex justify-center">
        <div className={`vip-boost-switch ${isBoostMode ? 'boost-active' : ''}`}>
          <input
            type="checkbox"
            id="library-mode"
            checked={isBoostMode}
            onChange={handleToggle}
            className="hidden"
          />
          <label htmlFor="library-mode" className="switch cursor-pointer">
            <span className="option vip">BIBLIOTHÈQUE</span>
            <span className="option boost">FAVORIS</span>
            <span className="slider" />
          </label>
        </div>
      </div>

      {/* Liste des jeux installés */}
      {installedGames && installedGames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {installedGames.map((game, index) => (
              <Motion.div
                key={game.name || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                onClick={() => handleGameClick(game)}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl transition-all duration-500 hover:border-primary/30 hover:bg-white/10 hover:shadow-2xl hover:shadow-primary/30 cursor-pointer"
                style={{
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08) inset, 0 0 60px rgba(139, 92, 246, 0.1)',
                }}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Badge "Installé" en haut à droite */}
                <div className="absolute top-4 right-4 z-20">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-300">Installé</span>
                  </div>
                </div>

                {/* Image du jeu depuis le catalogue */}
                <div className="relative w-full h-56 overflow-hidden bg-gradient-to-br from-purple-900/30 via-purple-800/20 to-purple-600/10">
                  {getGameImage(game.name) ? (
                    <img 
                      src={getGameImage(game.name)} 
                      alt={game.name}
                      className="w-full h-full object-cover transition-opacity duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        const placeholder = e.target.parentElement.querySelector('.image-placeholder')
                        if (placeholder) placeholder.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  {/* Placeholder si pas d'image */}
                  <div className={`image-placeholder ${getGameImage(game.name) ? 'hidden' : 'flex'} absolute inset-0 items-center justify-center bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-600/20`}>
                    <div className="text-center">
                      <FiBookOpen className="text-5xl text-purple-400/60 mx-auto mb-3" />
                      <p className="text-sm text-purple-300/70 font-medium px-4">{game.name}</p>
                    </div>
                  </div>
                  
                  {/* Overlay gradient moderne */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] via-[#0b0b11]/60 to-transparent pointer-events-none" />
                  
                  {/* Shine effect amélioré */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1500 ease-in-out pointer-events-none" />
                  
                  {/* Glow effect au hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/20 group-hover:via-primary/10 group-hover:to-primary/0 transition-all duration-700 pointer-events-none blur-xl" />
                </div>
                
                {/* Contenu de la carte */}
                <div className="p-5 space-y-4 bg-gradient-to-b from-transparent to-[#0b0b11]/50">
                  {/* Informations du jeu */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors duration-300">
                      {game.name}
                    </h3>
                    
                    <div className="flex flex-col gap-1.5">
                      {game.installDate && (
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <div className="w-1 h-1 rounded-full bg-muted" />
                          <span>Installé le {new Date(game.installDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      )}
                      {game.executableName && (
                        <div className="flex items-center gap-2 text-xs text-emerald-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-medium">{game.executableName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                
                  {/* Boutons d'action */}
                  <div className="flex gap-2 pt-2">
                    {/* Bouton Lancer - Principal */}
                    {(game.hasExecutable || game.exePath || game.executable) ? (
                      <Motion.button
                        onClick={(e) => {
                          e.stopPropagation() // Empêcher la navigation vers GameDetails
                          handleLaunchGame({
                            ...game,
                            exePath: game.exePath || game.executable
                          })
                        }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:from-purple-500 hover:to-purple-600 transition-all duration-300 group/btn"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                        <div className="relative flex items-center justify-center gap-2">
                          <FiPlay className="text-base" />
                          <span>Lancer</span>
                        </div>
                      </Motion.button>
                    ) : (
                      <Motion.button
                        onClick={() => alert('Exécutable non trouvé pour ce jeu.')}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-medium text-muted opacity-50 cursor-not-allowed"
                        disabled
                        title="Exécutable non trouvé"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <FiPlay />
                          <span>Lancer</span>
                        </div>
                      </Motion.button>
                    )}
                    
                    {/* Bouton Dossier */}
                    <Motion.button
                      onClick={(e) => {
                        e.stopPropagation() // Empêcher la navigation vers GameDetails
                        if (window.electron && window.electron.games && window.electron.games.openGameFolder) {
                          window.electron.games.openGameFolder(game.name)
                        }
                      }}
                      whileTap={{ scale: 0.9 }}
                      className="relative overflow-hidden rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm px-4 py-3 text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 group/folder"
                      title="Ouvrir le dossier"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover/folder:opacity-100 transition-opacity duration-300" />
                      <FiFolder className="relative text-base" />
                    </Motion.button>
                    
                    {/* Bouton Désinstaller */}
                    <Motion.button
                      onClick={(e) => {
                        e.stopPropagation() // Empêcher la navigation vers GameDetails
                        handleUninstall(game.name)
                      }}
                      disabled={isUninstalling[game.name]}
                      whileTap={{ scale: 0.9 }}
                      className="relative overflow-hidden rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm px-4 py-3 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300 transition-all duration-300 group/trash disabled:opacity-50"
                      title="Désinstaller"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 to-red-500/20 opacity-0 group-hover/trash:opacity-100 transition-opacity duration-300" />
                      {isUninstalling[game.name] ? (
                        <FiLoader className="relative text-base animate-spin" />
                      ) : (
                        <FiTrash2 className="relative text-base" />
                      )}
                    </Motion.button>
                  </div>
                </div>
                
                {/* Border glow effect */}
                <div className="absolute inset-0 rounded-3xl border border-primary/0 group-hover:border-primary/30 transition-all duration-500 pointer-events-none" />
              </Motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="empty-page">
          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="empty-icon-wrapper"
          >
            <FiBookOpen className="empty-icon" />
          </Motion.div>
          <Motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            Votre bibliothèque vous attend
          </Motion.h2>
          <Motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="empty-description"
          >
            Commencez à explorer le catalogue et téléchargez vos jeux préférés. Ils apparaîtront ici une fois installés.
          </Motion.p>
        </div>
      )}
      
      <UninstallModal
        isOpen={showUninstallModal}
        onClose={() => {
          setShowUninstallModal(false)
          setGameToUninstall(null)
        }}
        gameName={gameToUninstall || ''}
        onConfirm={() => {
          const gameName = gameToUninstall
          if (gameName) {
            // Déclencher un événement pour mettre à jour la liste des jeux installés dans App.jsx
            // Le modal a déjà géré la désinstallation, on déclenche juste la mise à jour
            window.dispatchEvent(new CustomEvent('game-uninstalled', { detail: { gameName } }))
          }
          setShowUninstallModal(false)
          setGameToUninstall(null)
        }}
      />
    </div>
  )
}
