import { useState, useEffect, useCallback } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiMessageCircle, FiSearch, FiCheckCircle, FiXCircle, FiClock, FiExternalLink } from 'react-icons/fi'

const SUGGESTIONS_STORAGE_KEY = 'actoris_suggestions'

// Fonction pour charger les suggestions depuis localStorage
function loadSuggestions() {
  try {
    const stored = localStorage.getItem(SUGGESTIONS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('[Suggestions] Erreur lors du chargement:', error)
    return []
  }
}

// Fonction pour sauvegarder les suggestions dans localStorage
function saveSuggestions(suggestions) {
  try {
    localStorage.setItem(SUGGESTIONS_STORAGE_KEY, JSON.stringify(suggestions))
  } catch (error) {
    console.error('[Suggestions] Erreur lors de la sauvegarde:', error)
  }
}

// Fonction pour vérifier si un jeu existe dans la base de données
async function checkGameExists(gameName) {
  try {
    if (window.electron && window.electron.games && window.electron.games.getGames) {
      const result = await window.electron.games.getGames()
      const games = result?.games || []
      
      // Normaliser le nom pour la comparaison
      const normalizeName = (name) => name.toLowerCase().trim().replace(/\s+/g, ' ')
      const normalizedSearch = normalizeName(gameName)
      
      // Chercher un jeu correspondant
      const found = games.find(game => {
        const gameTitle = game.name || game.title || ''
        const normalizedTitle = normalizeName(gameTitle)
        return normalizedTitle === normalizedSearch || 
               normalizedTitle.includes(normalizedSearch) ||
               normalizedSearch.includes(normalizedTitle)
      })
      
      return found ? { exists: true, game: found } : { exists: false }
    }
    return { exists: false }
  } catch (error) {
    console.error('[Suggestions] Erreur lors de la vérification:', error)
    return { exists: false }
  }
}

// Fonction pour envoyer une suggestion à Discord
async function sendSuggestionToDiscord(gameName, gameExists, gameId = null) {
  try {
    // Envoyer la suggestion au serveur Discord via le bot
    const response = await fetch('http://localhost:3000/api/suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameName,
        gameExists,
        gameId,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error('Erreur lors de l\'envoi à Discord')
    }

    return await response.json()
  } catch (error) {
    console.error('[Suggestions] Erreur lors de l\'envoi à Discord:', error)
    throw error
  }
}

export function SuggestionsPage({ toast }) {
  const [suggestions, setSuggestions] = useState([])
  const [gameName, setGameName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingSuggestion, setPendingSuggestion] = useState(null)
  const [filter, setFilter] = useState('all') // 'all', 'pending', 'accepted', 'refused'

  // Charger les suggestions au démarrage
  useEffect(() => {
    const loaded = loadSuggestions()
    setSuggestions(loaded)
  }, [])

  // Écouter les mises à jour de statut depuis Discord (polling ou WebSocket)
  useEffect(() => {
    // Fonction pour vérifier les mises à jour
    const checkForUpdates = async () => {
      try {
        // Essayer de récupérer les mises à jour depuis le serveur
        const response = await fetch('http://localhost:3000/api/suggestions/updates', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const updates = await response.json()
          
          // Mettre à jour les suggestions locales
          if (updates && updates.length > 0) {
            setSuggestions(prev => {
              const updated = prev.map(suggestion => {
                const update = updates.find(u => u.id === suggestion.id)
                if (update && update.status !== suggestion.status) {
                  // Notification si le statut a changé
                  if (toast) {
                    const statusText = update.status === 'accepted' ? 'acceptée' : 'refusée'
                    toast.showInfo(`Votre suggestion "${suggestion.gameName}" a été ${statusText}.`, { duration: 7000 })
                  }
                  return { ...suggestion, status: update.status, updatedAt: update.updatedAt || new Date().toISOString() }
                }
                return suggestion
              })
              saveSuggestions(updated)
              return updated
            })
          }
        }
      } catch (error) {
        // Erreur silencieuse - le serveur peut ne pas être disponible
        console.debug('[Suggestions] Serveur de mises à jour non disponible')
      }
    }

    // Vérifier immédiatement
    checkForUpdates()

    // Vérifier toutes les 30 secondes
    const interval = setInterval(checkForUpdates, 30000)

    return () => clearInterval(interval)
  }, [toast])

  // Filtrer les suggestions
  const filteredSuggestions = suggestions.filter(s => {
    if (filter === 'all') return true
    return s.status === filter
  })

  // Gérer la soumission d'une suggestion
  const handleSubmit = useCallback(async () => {
    if (!gameName.trim()) return

    setIsSubmitting(true)
    try {
      // Vérifier si le jeu existe
      const checkResult = await checkGameExists(gameName)
      
      // Créer la suggestion
      const suggestion = {
        id: Date.now().toString(),
        gameName: gameName.trim(),
        status: 'pending',
        gameExists: checkResult.exists,
        gameId: checkResult.exists ? checkResult.game.id : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Envoyer à Discord
      try {
        await sendSuggestionToDiscord(
          suggestion.gameName,
          suggestion.gameExists,
          suggestion.gameId
        )
      } catch (error) {
        console.warn('[Suggestions] Impossible d\'envoyer à Discord, suggestion sauvegardée localement')
      }

      // Sauvegarder localement
      const updated = [suggestion, ...suggestions]
      setSuggestions(updated)
      saveSuggestions(updated)

      // Afficher une notification
      if (toast) {
        if (checkResult.exists) {
          toast.showInfo(`Le jeu "${suggestion.gameName}" existe déjà dans le catalogue.`, { duration: 5000 })
        } else {
          toast.showSuccess(`Suggestion de "${suggestion.gameName}" envoyée avec succès !`, { duration: 5000 })
        }
      }

      // Réinitialiser le formulaire
      setGameName('')
      setShowConfirmModal(false)
      setPendingSuggestion(null)
    } catch (error) {
      console.error('[Suggestions] Erreur lors de la soumission:', error)
      if (toast) {
        toast.showError('Erreur lors de l\'envoi de la suggestion: ' + error.message, { duration: 7000 })
      } else {
        alert('Erreur lors de l\'envoi de la suggestion: ' + error.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [gameName, suggestions, toast])

  // Gérer le clic sur "Suggérer"
  const handleSuggestClick = () => {
    if (!gameName.trim()) {
      alert('Veuillez entrer un nom de jeu')
      return
    }

    setPendingSuggestion({ gameName: gameName.trim() })
    setShowConfirmModal(true)
  }

  // Gérer la confirmation
  const handleConfirm = () => {
    handleSubmit()
  }

  // Naviguer vers les détails du jeu
  const handleViewGame = (gameId) => {
    if (gameId) {
      window.dispatchEvent(new CustomEvent('navigate', {
        detail: { page: 'game-details', gameId }
      }))
    }
  }

  // Obtenir l'icône du statut
  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted':
        return <FiCheckCircle className="text-green-500" />
      case 'refused':
        return <FiXCircle className="text-red-500" />
      default:
        return <FiClock className="text-yellow-500" />
    }
  }

  // Obtenir le texte du statut
  const getStatusText = (status) => {
    switch (status) {
      case 'accepted':
        return 'Accepté'
      case 'refused':
        return 'Refusé'
      default:
        return 'En attente'
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* En-tête */}
      <Motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FiMessageCircle className="text-primary" />
            Suggestions de jeux
          </h1>
          <p className="text-gray-400 mt-1">
            Proposez un jeu à ajouter au catalogue
          </p>
        </div>
      </Motion.div>

      {/* Formulaire de suggestion */}
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-lg p-6 border border-border"
      >
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && gameName.trim()) {
                  handleSuggestClick()
                }
              }}
              placeholder="Entrez le nom du jeu..."
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Motion.button
            onClick={handleSuggestClick}
            disabled={!gameName.trim() || isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FiMessageCircle />
            Suggérer
          </Motion.button>
        </div>
      </Motion.div>

      {/* Filtres */}
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2"
      >
        {['all', 'pending', 'accepted', 'refused'].map((status) => (
          <Motion.button
            key={status}
            onClick={() => setFilter(status)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-primary text-white'
                : 'bg-card text-gray-400 hover:text-white border border-border'
            }`}
          >
            {status === 'all' ? 'Tous' : 
             status === 'pending' ? 'En attente' :
             status === 'accepted' ? 'Acceptés' : 'Refusés'}
          </Motion.button>
        ))}
      </Motion.div>

      {/* Liste des suggestions */}
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex-1 overflow-y-auto space-y-3"
      >
        {filteredSuggestions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FiMessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Aucune suggestion {filter !== 'all' ? getStatusText(filter).toLowerCase() : ''}</p>
          </div>
        ) : (
          filteredSuggestions.map((suggestion) => (
            <Motion.div
              key={suggestion.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      {suggestion.gameName}
                    </h3>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(suggestion.status)}
                      <span className="text-sm text-gray-400">
                        {getStatusText(suggestion.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>
                      {suggestion.gameExists ? (
                        <span className="text-green-500 flex items-center gap-1">
                          <FiCheckCircle className="w-4 h-4" />
                          Jeu disponible
                        </span>
                      ) : (
                        <span className="text-yellow-500">Jeu non trouvé</span>
                      )}
                    </span>
                    <span>
                      {new Date(suggestion.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
                {suggestion.gameExists && suggestion.gameId && (
                  <Motion.button
                    onClick={() => handleViewGame(suggestion.gameId)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="ml-4 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 flex items-center gap-2"
                  >
                    <FiExternalLink />
                    Voir le jeu
                  </Motion.button>
                )}
              </div>
            </Motion.div>
          ))
        )}
      </Motion.div>

      {/* Modal de confirmation */}
      {showConfirmModal && pendingSuggestion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border"
          >
            <h3 className="text-xl font-bold text-white mb-4">
              Confirmer la suggestion
            </h3>
            <p className="text-gray-300 mb-6">
              Voulez-vous vraiment suggérer le jeu <strong>{pendingSuggestion.gameName}</strong> ?
            </p>
            <div className="flex gap-3">
              <Motion.button
                onClick={() => {
                  setShowConfirmModal(false)
                  setPendingSuggestion(null)
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Annuler
              </Motion.button>
              <Motion.button
                onClick={handleConfirm}
                disabled={isSubmitting}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Envoi...' : 'Confirmer'}
              </Motion.button>
            </div>
          </Motion.div>
        </div>
      )}
    </div>
  )
}

