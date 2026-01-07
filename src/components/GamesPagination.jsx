import { useState, useMemo } from 'react'
import { Motion } from './Motion'
import { FiChevronLeft, FiChevronRight, FiMoreHorizontal } from 'react-icons/fi'

export function GamesPagination({ 
  games, 
  searchFilter, 
  gameFilter, 
  itemsPerPage = 24, 
  onItemsPerPageChange,
  renderGame 
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(itemsPerPage)

  // Filtrer les jeux
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      if (searchFilter) {
        const searchLower = searchFilter.toLowerCase()
        return game.name?.toLowerCase().includes(searchLower) ||
               game.title?.toLowerCase().includes(searchLower) ||
               game.downloadUrl?.toLowerCase().includes(searchLower) ||
               game.id?.toString().includes(searchLower)
      }
      if (gameFilter === 'with-link') {
        return game.downloadUrl && game.downloadUrl.trim() !== '' ||
               game.dl && game.dl.length > 0
      }
      if (gameFilter === 'without-link') {
        return (!game.downloadUrl || game.downloadUrl.trim() === '') &&
               (!game.dl || game.dl.length === 0)
      }
      if (gameFilter === 'not-found') {
        return game.category === 'Pas trouvé'
      }
      if (gameFilter === 'other-links') {
        // Jeux avec des liens qui ne sont ni Buzz ni Gofile
        const hasLinks = (game.downloadUrl && game.downloadUrl.trim() !== '') || 
                         (game.dl && game.dl.length > 0)
        if (!hasLinks) return false
        
        const links = game.dl || [game.downloadUrl].filter(Boolean)
        return links.some(link => {
          const linkLower = link.toLowerCase()
          return !linkLower.includes('buzz') && 
                 !linkLower.includes('gofile') &&
                 linkLower.trim() !== ''
        })
      }
      return true
    })
  }, [games, searchFilter, gameFilter])

  // Calculer la pagination
  const totalPages = Math.ceil(filteredGames.length / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const currentGames = filteredGames.slice(startIndex, endIndex)

  // Reset à la page 1 quand les filtres changent
  useMemo(() => {
    setCurrentPage(1)
  }, [searchFilter, gameFilter])

  // Générer les numéros de pages à afficher
  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 7
    
    if (totalPages <= maxVisiblePages) {
      // Afficher toutes les pages si peu de pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Logique pour afficher les pages avec ellipses
      if (currentPage <= 4) {
        // Début: 1, 2, 3, 4, 5, ..., last
        for (let i = 1; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        // Fin: 1, ..., last-4, last-3, last-2, last-1, last
        pages.push(1)
        pages.push('ellipsis')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Milieu: 1, ..., current-1, current, current+1, ..., last
        pages.push(1)
        pages.push('ellipsis')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      
      // Scroll vers le haut - essayer plusieurs méthodes pour assurer la compatibilité
      try {
        // Méthode 1: Scroller le conteneur principal de l'app
        const mainContent = document.querySelector('main[style*="height: calc(100% - 4rem)"]')
        if (mainContent) {
          mainContent.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          // Méthode 2: Scroller le body/html
          document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
          document.body.scrollTo({ top: 0, behavior: 'smooth' })
        }
        
        // Méthode 3: Fallback avec window
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (error) {
        console.warn('[GamesPagination] Erreur lors du scroll:', error)
        // Fallback sans animation
        try {
          window.scrollTo(0, 0)
        } catch (e) {
          console.warn('[GamesPagination] Impossible de scroller')
        }
      }
    }
  }

  const handleItemsPerPageChange = (newPerPage) => {
    setPerPage(newPerPage)
    setCurrentPage(1) // Reset à la première page
    if (onItemsPerPageChange) {
      onItemsPerPageChange(newPerPage)
    }
  }

  return (
    <div className="space-y-6">
      {/* Informations de pagination */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <div>
          Affichage de {startIndex + 1} à {Math.min(endIndex, filteredGames.length)} sur {filteredGames.length} jeux
        </div>
        <div>
          Page {currentPage} sur {totalPages}
        </div>
      </div>

      {/* Grille des jeux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {currentGames.map((game, index) => renderGame(game, startIndex + index))}
      </div>

      {/* Contrôles de pagination */}
      {totalPages > 1 && (
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 pt-6"
        >
          {/* Bouton Précédent */}
          <Motion.button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
            whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              currentPage === 1
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 hover:border-cyan-400/30'
            }`}
          >
            <FiChevronLeft />
            Précédent
          </Motion.button>

          {/* Numéros de pages */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              page === 'ellipsis' ? (
                <div key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                  <FiMoreHorizontal />
                </div>
              ) : (
                <Motion.button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    currentPage === page
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                      : 'text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 hover:border-cyan-400/30'
                  }`}
                >
                  {page}
                </Motion.button>
              )
            ))}
          </div>

          {/* Bouton Suivant */}
          <Motion.button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
            whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              currentPage === totalPages
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 hover:border-cyan-400/30'
            }`}
          >
            Suivant
            <FiChevronRight />
          </Motion.button>
        </Motion.div>
      )}

      {/* Sélecteur de nombre d'éléments par page */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
        <span className="text-sm text-gray-400">Jeux par page:</span>
        <div className="flex gap-2">
          {[12, 24, 48, 96].map(count => (
            <Motion.button
              key={count}
              onClick={() => handleItemsPerPageChange(count)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                perPage === count
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-white/10'
              }`}
            >
              {count}
            </Motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Hook pour gérer la pagination
export function usePagination(items, itemsPerPage = 24) {
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(itemsPerPage)

  const totalPages = Math.ceil(items.length / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const currentItems = items.slice(startIndex, endIndex)

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const nextPage = () => goToPage(currentPage + 1)
  const prevPage = () => goToPage(currentPage - 1)

  const changePerPage = (newPerPage) => {
    setPerPage(newPerPage)
    setCurrentPage(1) // Reset à la première page
  }

  // Reset à la page 1 quand les items changent
  useMemo(() => {
    setCurrentPage(1)
  }, [items.length])

  return {
    currentPage,
    totalPages,
    currentItems,
    startIndex,
    endIndex,
    perPage,
    goToPage,
    nextPage,
    prevPage,
    changePerPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  }
}