import { useState, useEffect } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiBookOpen, FiPlay, FiFolder, FiTrash2, FiLoader } from 'react-icons/fi'

export function LibraryPage({ onNavigate, activePage, installedGames = [] }) {
  const [isBoostMode, setIsBoostMode] = useState(false)
  const [isUninstalling, setIsUninstalling] = useState({})
  const [catalogGames, setCatalogGames] = useState([])
  
  // Charger les jeux du catalogue pour récupérer les images
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
  
  // Fonction pour trouver l'image d'un jeu dans le catalogue
  const getGameImage = (gameName) => {
    if (!gameName || !catalogGames.length) return null
    
    // Normaliser les noms pour une meilleure correspondance
    const normalizeName = (name) => {
      if (!name) return ''
      return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '')
    }
    
    const normalizedGameName = normalizeName(gameName)
    
    // Chercher par nom exact ou similaire
    const foundGame = catalogGames.find(g => {
      const gameTitle = normalizeName(g.title || g.name || '')
      const gameNameLower = normalizedGameName
      
      // Correspondance exacte
      if (gameTitle === gameNameLower) return true
      
      // Correspondance partielle
      if (gameTitle.includes(gameNameLower) || gameNameLower.includes(gameTitle)) return true
      
      // Correspondance par mots-clés (au moins 50% des mots)
      const gameWords = gameNameLower.split(' ').filter(w => w.length > 2)
      const titleWords = gameTitle.split(' ').filter(w => w.length > 2)
      if (gameWords.length > 0 && titleWords.length > 0) {
        const matchingWords = gameWords.filter(w => titleWords.includes(w))
        const matchRatio = matchingWords.length / gameWords.length
        if (matchRatio >= 0.5) return true
      }
      
      return false
    })
    
    return foundGame?.coverImage || foundGame?.image || foundGame?.header_image || null
  }
  
  useEffect(() => {
    // Synchroniser le toggle avec la page active
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
      // Si pas d'exePath direct, essayer de le trouver
      if (window.electron && window.electron.games && window.electron.games.findGameExe) {
        try {
          const result = await window.electron.games.findGameExe(game.folder, game.name)
          if (result.success && result.exePath) {
            if (window.electron.games.launchGame) {
              await window.electron.games.launchGame(result.exePath)
              console.log('[Library] Jeu lancé:', game.name)
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
    
    if (window.electron && window.electron.games && window.electron.games.launchGame) {
      try {
        await window.electron.games.launchGame(exePath)
        console.log('[Library] Jeu lancé:', game.name)
      } catch (err) {
        console.error('[Library] Erreur lors du lancement:', err)
        alert('Erreur lors du lancement: ' + err.message)
      }
    } else {
      alert('Fonctions Electron non disponibles.')
    }
  }
  
  const handleUninstall = async (gameName) => {
    const confirm = window.confirm(
      `Voulez-vous vraiment désinstaller ${gameName} ?\n\n` +
      `Cette action est irréversible et supprimera tous les fichiers du jeu.`
    )
    if (!confirm) return
    
    setIsUninstalling(prev => ({ ...prev, [gameName]: true }))
    
    try {
      if (window.electron && window.electron.games && window.electron.games.uninstallGame) {
        const result = await window.electron.games.uninstallGame(gameName)
        if (result.success) {
          // Recharger la page pour mettre à jour la liste
          window.location.reload()
        } else {
          alert('Erreur: ' + result.error)
        }
      }
    } catch (err) {
      console.error('[Library] Erreur lors de la désinstallation:', err)
      alert('Erreur: ' + err.message)
    } finally {
      setIsUninstalling(prev => ({ ...prev, [gameName]: false }))
    }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {installedGames.map((game, index) => (
              <Motion.div
                key={game.name || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/5 backdrop-blur-xl hover:border-white/10 hover:bg-white/8 transition-all"
              >
                {/* Image du jeu depuis le catalogue */}
                <div className="relative w-full h-48 overflow-hidden rounded-t-xl bg-gradient-to-br from-purple-900/20 to-purple-600/10">
                  {getGameImage(game.name) ? (
                    <img 
                      src={getGameImage(game.name)} 
                      alt={game.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      onError={(e) => {
                        // Si l'image ne charge pas, afficher un placeholder
                        e.target.style.display = 'none'
                        const placeholder = e.target.parentElement.querySelector('.image-placeholder')
                        if (placeholder) placeholder.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  {/* Placeholder si pas d'image */}
                  <div className={`image-placeholder ${getGameImage(game.name) ? 'hidden' : 'flex'} absolute inset-0 items-center justify-center bg-gradient-to-br from-purple-900/30 to-purple-600/20`}>
                    <div className="text-center">
                      <FiBookOpen className="text-4xl text-purple-400/50 mx-auto mb-2" />
                      <p className="text-xs text-purple-300/50 font-medium">{game.name}</p>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b11] via-transparent to-transparent pointer-events-none" />
                </div>
                
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{game.name}</h3>
                      {game.installDate && (
                        <p className="text-xs text-muted">
                          Installé le {new Date(game.installDate).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {game.executableName && (
                        <p className="text-xs text-green-400 mt-1">✅ {game.executableName}</p>
                      )}
                    </div>
                  </div>
                
                  <div className="flex gap-2 mt-4">
                    {/* Bouton Lancer - toujours affiché si le jeu a un exécutable */}
                    {(game.hasExecutable || game.exePath || game.executable) ? (
                      <Motion.button
                        onClick={() => handleLaunchGame({
                          ...game,
                          exePath: game.exePath || game.executable
                        })}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 btn btn-primary text-sm py-2"
                      >
                        <FiPlay className="mr-2" />
                        Lancer
                      </Motion.button>
                    ) : (
                      <Motion.button
                        onClick={() => alert('Exécutable non trouvé pour ce jeu.')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 btn btn-primary text-sm py-2 opacity-50 cursor-not-allowed"
                        disabled
                        title="Exécutable non trouvé"
                      >
                        <FiPlay className="mr-2" />
                        Lancer
                      </Motion.button>
                    )}
                    <Motion.button
                    onClick={() => {
                      if (window.electron && window.electron.games && window.electron.games.openGameFolder) {
                        window.electron.games.openGameFolder(game.name)
                      }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="btn btn-secondary text-sm px-3 py-2"
                    title="Ouvrir le dossier"
                  >
                    <FiFolder />
                  </Motion.button>
                  <Motion.button
                    onClick={() => handleUninstall(game.name)}
                    disabled={isUninstalling[game.name]}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="btn btn-secondary text-sm px-3 py-2 text-red-400 hover:text-red-300"
                    title="Désinstaller"
                  >
                    {isUninstalling[game.name] ? (
                      <FiLoader className="animate-spin" />
                    ) : (
                      <FiTrash2 />
                    )}
                  </Motion.button>
                  </div>
                </div>
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
    </div>
  )
}


