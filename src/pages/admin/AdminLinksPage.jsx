import { useState, useEffect, useRef } from 'react'
import { FiRefreshCw, FiLoader, FiCheck, FiAlertCircle, FiDownload, FiGrid, FiSearch } from 'react-icons/fi'

export function AdminLinksPage({ games, loadingGames, onLoadGames, onUpdateDownloadUrl }) {
  const [editingGame, setEditingGame] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [filter, setFilter] = useState('all') // 'all', 'with-link', 'without-link'
  const [searchTerm, setSearchTerm] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Filtrer les jeux
  const filteredGames = games.filter(game => {
    // Filtre par statut de lien
    if (filter === 'with-link' && !game.downloadUrl) return false
    if (filter === 'without-link' && game.downloadUrl) return false

    // Filtre par recherche
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const name = (game.name || game.title || '').toLowerCase()
      return name.includes(search)
    }

    return true
  })

  const handleUpdateLink = async (gameId, url) => {
    try {
      setError('')
      setSuccess('')
      
      const cleanedUrl = url.trim()
      if (!cleanedUrl) {
        setError('Le lien ne peut pas être vide')
        setTimeout(() => setError(''), 3000)
        return
      }

      await onUpdateDownloadUrl(gameId, cleanedUrl)
      
      const urlCount = cleanedUrl.split(/[,\n]/).filter(u => u.trim()).length
      setSuccess(urlCount > 1 ? `${urlCount} liens mis à jour !` : 'Lien mis à jour !')
      setEditingGame(null)
      setDownloadUrl('')
      
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError('Erreur lors de la mise à jour: ' + err.message)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleStartEdit = (game) => {
    setEditingGame(game.id)
    setDownloadUrl(game.downloadUrl || '')
    setError('')
    setSuccess('')
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <FiRefreshCw className="text-green-400" />
          Gestion des liens de téléchargement
        </h2>
        <p className="text-gray-400 text-sm">Mettre à jour les liens de téléchargement des jeux</p>
      </div>

      {/* Messages de succès/erreur */}
      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-400">
          <FiCheck />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {/* Filtres et recherche */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un jeu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Filtres */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Tous ({games.length})
            </button>
            <button
              onClick={() => setFilter('with-link')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'with-link'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Avec lien ({games.filter(g => g.downloadUrl).length})
            </button>
            <button
              onClick={() => setFilter('without-link')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'without-link'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Sans lien ({games.filter(g => !g.downloadUrl).length})
            </button>
          </div>

          {/* Bouton rafraîchir */}
          <button
            onClick={onLoadGames}
            disabled={loadingGames}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiLoader className={loadingGames ? 'animate-spin' : ''} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Liste des jeux */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        {loadingGames ? (
          <div className="text-center py-12">
            <FiLoader className="animate-spin text-cyan-400 text-4xl mx-auto mb-4" />
            <p className="text-gray-400">Chargement des jeux...</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-12">
            <FiGrid className="text-gray-600 text-4xl mx-auto mb-4" />
            <p className="text-gray-400">Aucun jeu trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                className="bg-gray-900 rounded-lg border border-gray-700 p-4 hover:border-cyan-500/50 transition-colors"
              >
                {/* Image du jeu */}
                {game.header_image && (
                  <img
                    src={game.header_image}
                    alt={game.name}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}

                {/* Nom du jeu */}
                <h3 className="text-white font-semibold mb-3 line-clamp-2">
                  {game.name || game.title || 'Sans titre'}
                </h3>

                {/* Édition du lien */}
                {editingGame === game.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={downloadUrl}
                      onChange={(e) => setDownloadUrl(e.target.value)}
                      placeholder="URL(s) de téléchargement (une par ligne ou séparées par des virgules)"
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                    />
                    {downloadUrl && (
                      <p className="text-xs text-gray-400">
                        {downloadUrl.split(/[,\n]/).filter(u => u.trim()).length} partie(s) détectée(s)
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateLink(game.id, downloadUrl)}
                        className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <FiCheck />
                        Valider
                      </button>
                      <button
                        onClick={() => {
                          setEditingGame(null)
                          setDownloadUrl('')
                          setError('')
                        }}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Affichage du lien actuel */}
                    {game.downloadUrl ? (
                      <div className="flex items-center gap-2 text-sm text-cyan-400">
                        <FiDownload />
                        <span>
                          {game.downloadUrl.split(/[,\n]/).filter(u => u.trim()).length > 1
                            ? `${game.downloadUrl.split(/[,\n]/).filter(u => u.trim()).length} parties`
                            : 'Lien disponible'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Aucun lien</div>
                    )}

                    {/* Bouton modifier */}
                    <button
                      onClick={() => handleStartEdit(game)}
                      className="w-full px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <FiRefreshCw />
                      {game.downloadUrl ? 'Modifier le lien' : 'Ajouter un lien'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

