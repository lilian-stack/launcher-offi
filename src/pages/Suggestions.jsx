import { useState, useEffect } from 'react'
import { Motion } from '../components/Motion'
import { FiPlus, FiSend, FiCheck, FiX, FiExternalLink } from 'react-icons/fi'

export function SuggestionsPage({ currentUser, onNavigate }) {
  const [suggestions, setSuggestions] = useState([])
  const [gameName, setGameName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    try {
      setLoading(true)
      // Simuler le chargement des suggestions
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSuggestions([
        {
          id: 1,
          gameName: 'Cyberpunk 2077',
          status: 'approved',
          submittedBy: 'User123',
          submittedAt: '2024-01-15',
          gameExists: true,
          gameId: 'cyberpunk-2077'
        },
        {
          id: 2,
          gameName: 'Elden Ring DLC',
          status: 'pending',
          submittedBy: 'Gamer456',
          submittedAt: '2024-01-14'
        }
      ])
    } catch (error) {
      console.error('Erreur lors du chargement des suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!gameName.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Simuler l'envoi de la suggestion
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const newSuggestion = {
        id: Date.now(),
        gameName: gameName.trim(),
        status: 'pending',
        submittedBy: currentUser?.username || 'Anonyme',
        submittedAt: new Date().toISOString().split('T')[0]
      }
      
      setSuggestions(prev => [newSuggestion, ...prev])
      setGameName('')
    } catch (error) {
      console.error('Erreur lors de l\'envoi:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredSuggestions = suggestions.filter(suggestion => {
    if (filter === 'all') return true
    return suggestion.status === filter
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-400'
      case 'pending': return 'text-yellow-400'
      case 'refused': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <FiCheck />
      case 'pending': return <FiSend />
      case 'refused': return <FiX />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0f0f14] text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Suggestions de Jeux</h1>
          <p className="text-gray-400">Proposez des jeux à ajouter au catalogue Actoris</p>
        </Motion.div>

        {/* Formulaire de suggestion */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 rounded-xl p-6 mb-8 border border-gray-700/50"
        >
          <h2 className="text-xl font-semibold mb-4">Suggérer un nouveau jeu</h2>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Nom du jeu à suggérer..."
              className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!gameName.trim() || isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiPlus />
              )}
              {isSubmitting ? 'Envoi...' : 'Suggérer'}
            </button>
          </form>
        </Motion.div>

        {/* Filtres */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-4 mb-6"
        >
          {[
            { key: 'all', label: 'Toutes', icon: FiSend },
            { key: 'pending', label: 'En attente', icon: FiSend },
            { key: 'approved', label: 'Approuvées', icon: FiCheck },
            { key: 'refused', label: 'Refusées', icon: FiX },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                filter === key
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Icon className="text-sm" />
              <span>{label}</span>
            </button>
          ))}
        </Motion.div>

        {/* Liste des suggestions */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {filteredSuggestions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiSend className="mx-auto text-4xl mb-4 opacity-50" />
              <p>Aucune suggestion trouvée</p>
            </div>
          ) : (
            filteredSuggestions.map((suggestion) => (
              <Motion.div
                key={suggestion.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {suggestion.gameName}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Par {suggestion.submittedBy}</span>
                      <span>•</span>
                      <span>{suggestion.submittedAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 ${getStatusColor(suggestion.status)}`}>
                      {getStatusIcon(suggestion.status)}
                      <span className="capitalize">{suggestion.status}</span>
                    </div>
                    {suggestion.gameExists && suggestion.gameId && (
                      <button
                        onClick={() => onNavigate?.('game-details', suggestion.gameId)}
                        className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                      >
                        <FiExternalLink />
                        <span>Voir le jeu</span>
                      </button>
                    )}
                  </div>
                </div>
              </Motion.div>
            ))
          )}
        </Motion.div>
      </div>
    </div>
  )
}